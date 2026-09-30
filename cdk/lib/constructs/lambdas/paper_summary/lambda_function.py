# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
from bedrock_client import get_bedrock_client, ModelId
from util import s3_get_data, s3_put_data
import json, logging, os, time, re
from dynamodb_client import update_dynamo_record, get_prompt, get_dynamo_record


def extract_json(text: str) -> dict:
    """Extract JSON from LLM response, handling malformed output."""
    if text is None:
        raise ValueError("Empty model response (no text returned)")

    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strip a ```json ... ``` (or plain ```) fenced block — newer Claude models
    # often wrap JSON in markdown fences.
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if fenced:
        try:
            return json.loads(fenced.group(1).strip())
        except json.JSONDecodeError:
            pass

    # Try to find JSON object in text
    match = re.search(r'\{[\s\S]*"results_table"[\s\S]*\}', text)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    # Last resort: truncate at last complete object in results_table array
    match = re.search(r'(\{[\s\S]*"results_table"\s*:\s*\[[\s\S]*\}\s*\])\s*\}', text)
    if match:
        try:
            return json.loads(match.group(1) + '}')
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not extract valid JSON from response: {text[:500]}...")
STAGE = os.getenv("STAGE", "SUMMARIZE_DOCUMENT")

logging.basicConfig()
logger = logging.getLogger()
logger.setLevel(logging.INFO)

DEFAULT_CONDITION = os.environ.get("DEFAULT_CONDITION", "lung cancer")
SOURCE_BUCKET = os.environ["SOURCE_BUCKET"]
TARGET_BUCKET = os.environ["TARGET_BUCKET"]
DELAY_SLEEP = int(os.environ.get("DELAY_SLEEP", "5"))


def group_by_four(lst):
    result = []
    for i in range(0, len(lst), 4):
        result.append(lst[i : i + 4])
    return result


def build_question_sets(questions_string:str, variables: dict):
    questions = json.loads(questions_string)
    header = questions["header"].format(**variables)

    question_list = list(questions["questions"].keys())
    question_set = group_by_four(question_list)
    # logger.info(len(question_set))

    list_count = 1
    questions_prompts = []
    for qset in question_set:
        cur_question = str(header) + "\n"
        for question in qset:
            letter = "a"
            cur_question += f"{list_count}. {question}\n"
            for sub_question in questions["questions"][question]:
                cur_question += f"    {list_count}{letter}. {sub_question}\n"
                letter = chr(ord(letter) + 1)
            list_count += 1
        questions_prompts.append(cur_question)

    return questions_prompts


def answer_questions(
    document: str,
    condition: str,
    biomarkers: str,
    prompt_group: str,
    modelID: ModelId = ModelId.CLAUDE_3_5_SONNET,
):
    format_prompt = get_prompt(stage=STAGE, prompt_type="format", prompt_group=prompt_group)
    table_prompt = get_prompt(stage=STAGE, prompt_type="table", prompt_group=prompt_group)
    questions=get_prompt(stage=STAGE, prompt_type="questions", prompt_group=prompt_group)

    if "\n" in biomarkers:
        biomarkers = "\n" + biomarkers

    variables = {
        "document": document,
        "condition": condition,
        "format": format_prompt,
        "biomarkers": biomarkers,
    }

    logger.info("Starting summary")
    table_prompt_formatted = table_prompt.format(**variables)

    question_set = build_question_sets(questions_string=questions, variables=variables)

    table_data = None
    for index, questions_prompt in enumerate(question_set):
        logger.info("Starting questions")
        # logger.info(questions_prompt)
        input_data = json.dumps(
            {
                "system": table_prompt_formatted,
                "messages": [
                    {
                        "role": "user",
                        "content": [{"type": "text", "text": questions_prompt}],
                    }
                ],
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 8192,
                "temperature": 0.2,
            }
        )

        logger.info("Starting question extraction")
        table_response = None
        for attempt in range(3):
            questions_response = get_bedrock_client().invoke_model(
                body=input_data, modelId=modelID
            )
            raw_text = json.loads(questions_response["body"].read())["content"][0]["text"]
            try:
                table_response = extract_json(raw_text)
                break
            except (json.JSONDecodeError, ValueError) as e:
                logger.warning(f"Attempt {attempt + 1} failed: {e}")
                if attempt == 2:
                    raise
                time.sleep(2)  # nosec # nosemgrep: arbitrary-sleep — Intentional backoff between Bedrock API retry attempts to avoid throttling

        if table_data is not None:
            table_data["results_table"].extend(table_response["results_table"])

        else:
            table_data = table_response

        # Rate limiting: pause between Bedrock batches to avoid throttling (configurable via DELAY_SLEEP env var)
        if index < len(question_set) - 1 and DELAY_SLEEP > 0:
            logger.info(f"Sleeping for {DELAY_SLEEP} seconds")
            time.sleep(DELAY_SLEEP)  # nosec — Intentional rate-limiting pause between Bedrock batch calls

    return table_data


def build_summary(table_data: dict, prompt_group: str, modelID: ModelId = ModelId.CLAUDE_3_SONNET):
    summary_prompt = get_prompt(stage=STAGE, prompt_type="summary", prompt_group=prompt_group)

    logging.info("Starting summary of answers")

    input_data = json.dumps(
        {
            "system": summary_prompt,
            "messages": [
                {
                    "role": "user",
                    "content": [{"type": "text", "text": json.dumps(table_data)}],
                }
            ],
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 4096,
            "temperature": 0.2,
        }
    )

    summary_response = get_bedrock_client().invoke_model(
        body=input_data, modelId=modelID
    )

    summary = json.loads(summary_response["body"].read())["content"][0]["text"]

    return summary


def lambda_handler(event, context):
    if "bucket" in event:
        source_bucket = event["bucket"]
    else:
        source_bucket = SOURCE_BUCKET

    if "document_id" in event:
        key = event["document_id"]
    else:
        return {
            "statusCode": 400,
            "body": "Missing 'document_id' parameter in the event",
        }

    if "biomarkers" in event:
        biomarkers = event["biomarkers"]
    else:
        return {
            "statusCode": 400,
            "body": "Missing 'biomarkers' parameter in the event",
        }

    dynamo_record = get_dynamo_record(key=key)
    prompt_group = dynamo_record["prompt_group"]
    
    if "condition" not in dynamo_record:
        condition = DEFAULT_CONDITION
        logger.info(f"Using default condition: {condition}")
    else:
        condition = dynamo_record["condition"]

    update_dynamo_record(key=key, stage=STAGE, status="Answering Questions")

    markdown_text = s3_get_data(
        bucket=source_bucket, search_key=key + "/fulltext.json", decode=True
    )

    answered_questions = answer_questions(
        document=markdown_text, condition=condition, biomarkers=biomarkers, prompt_group=prompt_group
    )

    update_dynamo_record(key=key, stage=STAGE, status="Building Summary")

    summary = build_summary(table_data=answered_questions, prompt_group=prompt_group)

    response = {
        "summary": summary,
        "results_table": answered_questions["results_table"],
    }

    s3_put_data(
        bucket=TARGET_BUCKET,
        data_key=key + "/summary.json",
        data=response,
    )
    
    update_dynamo_record(key=key, stage=STAGE, status="Summary Complete")

    # Return the response as a dictionary
    return {
        "statusCode": 200,  # HTTP status code 200 (OK)
        "filter_result": json.dumps(response),
        "document_id": key,
    }


if __name__ == "__main__":
    event = {
        "statusCode": 200,
        "biomarkers": "- Gpr75 (G-protein coupled receptor 75)\n- Gpr75 null (KO) mice\n- Gpr75 heterozygous (HET) mice\n- Wild type (WT) mice\n- 20-HETE (20-hydroxyeicosatetraenoic acid)\n- CYP4A12\n- CYP4F2\n- FFAR1 (GPR40)\n- Il-6 (Interleukin-6)\n- Tnfa (Tumor necrosis factor-alpha)\n- Ccl5 (Chemokine ligand 5)\n- Pgc1a (Peroxisome proliferator-activated receptor gamma coactivator 1-alpha)\n- Ucp1 (Uncoupling protein-1)\n- Prdm16 (PR domain containing 16)\n- Ucp3 (Uncoupling protein-3)\n- Mfn1 (Mitofusin-1)\n- Insulin receptor\n- Insulin receptor substrate-1\n- Phosphatidylinositol 3-kinase\n- AKT\n- PPAR𝛾 (Peroxisome proliferator-activated receptor gamma)",
        "document_id": "1737051488_7b5cd717",
    }
    print(json.dumps(lambda_handler(event, None), indent=4))
