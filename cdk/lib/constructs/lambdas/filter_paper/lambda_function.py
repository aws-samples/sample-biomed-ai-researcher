# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
from bedrock_client import get_bedrock_client, ModelId
from util import s3_get_data, s3_put_data
import json, logging, os, re
from dynamodb_client import update_dynamo_record, get_prompt, get_dynamo_record


def extract_json(text: str) -> dict:
    """Parse a JSON object from an LLM response.

    Newer Claude models often wrap JSON in markdown code fences or add a short
    preamble, so a bare json.loads() can fail. Try a direct parse, then strip
    ```json fences, then fall back to the first balanced { ... } object.
    """
    if text is None:
        raise ValueError("Empty model response (no text returned)")

    # 1) direct
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 2) strip a ```json ... ``` (or plain ```) fenced block
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if fenced:
        try:
            return json.loads(fenced.group(1).strip())
        except json.JSONDecodeError:
            pass

    # 3) first balanced-looking JSON object in the text
    obj = re.search(r"\{[\s\S]*\}", text)
    if obj:
        return json.loads(obj.group())  # let a real failure raise

    raise ValueError(f"Could not extract JSON from model response: {text[:500]}")


def get_final_answer(filter_result: dict) -> str:
    """Return the filter decision normalized to 'yes'/'no'.

    Different Claude model generations spell the key differently
    ('final answer' vs 'final_answer') and vary the casing of the value, so look
    it up tolerantly instead of indexing a single fixed key.
    """
    summary = filter_result.get("summary", {}) if isinstance(filter_result, dict) else {}
    value = None
    for k, v in summary.items():
        if k.strip().lower().replace("_", " ") == "final answer":
            value = v
            break
    if value is None:
        raise ValueError(f"No 'final answer' in filter summary: {summary}")
    return "yes" if str(value).strip().lower() in ("yes", "true", "y") else "no"


DEFAULT_CONDITION = os.environ.get("DEFAULT_CONDITION", "lung cancer")
SOURCE_BUCKET = os.environ["SOURCE_BUCKET"]
TARGET_BUCKET = os.environ["TARGET_BUCKET"]
STAGE = os.getenv("STAGE", "FILTER_DOCUMENT")

def filter_paper(
    document: str,
    condition: str,
    prompt_group: str,
    modelID: ModelId = ModelId.CLAUDE_3_SONNET
):
    filter_prompt = get_prompt(STAGE, "filter", prompt_group)
    format_prompt = get_prompt(STAGE, "format", prompt_group)
    questions = get_prompt(STAGE, "question", prompt_group)

    variables = {"document": document, "condition": condition, "format":format_prompt}

    logging.info("Starting outcomes extraction")
    filter_formatted = filter_prompt.format(**variables)
    questions_prompt = questions.format(**variables)

    input_data = json.dumps(
        {
            "system": filter_formatted,
            "messages": [
                {"role": "user", "content": [{"type": "text", "text": questions_prompt}]}
            ],
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 4096,
            "temperature": 0.2,
        }
    )

    logging.info("Starting outcomes extraction")
    outcomes_response = get_bedrock_client().invoke_model(
        body=input_data, modelId=modelID
    )
    outcomes_response = json.loads(outcomes_response["body"].read())["content"][0][
        "text"
    ]

    return extract_json(outcomes_response)


def lambda_handler(event, context):
    """
    This function handles the Lambda event and context.
    It retrieves the 'name' parameter from the event and returns a greeting message.
    """

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

    dynamo_record = get_dynamo_record(key=key)
    if "condition" not in dynamo_record:
        condition = DEFAULT_CONDITION
        logging.info(f"Using defail condition: {condition}")
    else:
        condition = dynamo_record["condition"]
        
    prompt_group = dynamo_record["prompt_group"]

    markdown_text = s3_get_data(
        bucket=source_bucket, search_key=key + "/fulltext.json", decode=True
    )

    update_dynamo_record(key=key, stage=STAGE, status="Filter generating")

    filter_result = filter_paper(document=markdown_text, condition=condition, prompt_group=prompt_group)

    s3_put_data(bucket=TARGET_BUCKET, data_key=key + "/filter.json", data=filter_result)

    should_process = get_final_answer(filter_result)

    # When the paper is filtered out, the Step Function skips the analysis
    # branches (which would otherwise set the terminal status), so set a terminal
    # status here. Otherwise the record stays at an intermediate status and the
    # UI polls indefinitely.
    if should_process == "yes":
        update_dynamo_record(key=key, stage=STAGE, status="Filtering complete")
    else:
        update_dynamo_record(
            key=key, stage=STAGE, status="Filtering complete - not relevant"
        )

    # Return the response as a dictionary
    return {
        "statusCode": 200,  # HTTP status code 200 (OK)
        "filter_result": json.dumps(filter_result),
        "document_id": key,
        "should_process": should_process
    }


if __name__ == "__main__":
    event = {
        "statusCode": 200,
        "biomarkers": "- Gpr75 (G-protein coupled receptor 75)\n- Gpr75 null (KO) mice\n- Gpr75 heterozygous (HET) mice\n- Wild type (WT) mice\n- 20-HETE (20-hydroxyeicosatetraenoic acid)\n- CYP4A12\n- CYP4F2\n- FFAR1 (GPR40)\n- Il-6 (Interleukin-6)\n- Tnfa (Tumor necrosis factor-alpha)\n- Ccl5 (Chemokine ligand 5)\n- Pgc1a (Peroxisome proliferator-activated receptor gamma coactivator 1-alpha)\n- Ucp1 (Uncoupling protein-1)\n- Prdm16 (PR domain containing 16)\n- Ucp3 (Uncoupling protein-3)\n- Mfn1 (Mitofusin-1)\n- Insulin receptor\n- Insulin receptor substrate-1\n- Phosphatidylinositol 3-kinase\n- AKT\n- PPAR𝛾 (Peroxisome proliferator-activated receptor gamma)",
        "document_id": "1737051488_7b5cd717",
    }
    print(json.dumps(lambda_handler(event, None), indent=4))
