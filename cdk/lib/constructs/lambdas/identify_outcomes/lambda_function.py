# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
from bedrock_client import get_bedrock_client, ModelId
from util import s3_get_data, s3_put_data
import json, logging, os
from dynamodb_client import update_dynamo_record, get_prompt, get_dynamo_record

DEFAULT_CONDITION = os.environ.get("DEFAULT_CONDITION", "lung cancer")
SOURCE_BUCKET = os.environ["SOURCE_BUCKET"]
TARGET_BUCKET = os.environ["TARGET_BUCKET"]
STAGE = os.getenv("STAGE", "IDENTIFY_OUTCOMES")


def extract_outcomes(
    document: str,
    variants: str,
    condition: str,
    prompt_group:str,
    modelID: ModelId = ModelId.CLAUDE_3_SONNET,
):
    variables = {"document": document, "condition": condition, "variants": variants}

    outcomes_prompt = get_prompt(STAGE, "outcomes", prompt_group)
    supplemental_outcomes_prompt = get_prompt(STAGE, "supplemental", prompt_group)
    
    logging.info("Starting outcomes extraction")
    out_prompt = outcomes_prompt.format(**variables)
    out_prompt += supplemental_outcomes_prompt

    input_data = json.dumps(
        {
            "messages": [
                {"role": "user", "content": [{"type": "text", "text": out_prompt}]}
            ],
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 4000,
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

    return outcomes_response


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

    if "biomarkers" in event:
        outcomes = event["biomarkers"]
    else:
        return {
            "statusCode": 400,
            "body": "Missing 'biomarkers' parameter in the event",
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

    update_dynamo_record(key=key, stage=STAGE, status="Extracting Outcomes")

    outcomes = extract_outcomes(document=markdown_text, variants=outcomes, condition=condition, prompt_group=prompt_group)

    s3_put_data(bucket=TARGET_BUCKET, data_key=key + "/outcomes.txt", data=outcomes)
    
    update_dynamo_record(key=key, stage=STAGE, status="Extracted Outcomes")

    # Return the response as a dictionary
    return {
        "statusCode": 200,  # HTTP status code 200 (OK)
        "outcomes": outcomes,
        "document_id": key,
    }


if __name__ == "__main__":
    event = {
        "statusCode": 200,
        "biomarkers": "- Gpr75 (G-protein coupled receptor 75)\n- Gpr75 null (KO) mice\n- Gpr75 heterozygous (HET) mice\n- Wild type (WT) mice\n- 20-HETE (20-hydroxyeicosatetraenoic acid)\n- CYP4A12\n- CYP4F2\n- FFAR1 (GPR40)\n- Il-6 (Interleukin-6)\n- Tnfa (Tumor necrosis factor-alpha)\n- Ccl5 (Chemokine ligand 5)\n- Pgc1a (Peroxisome proliferator-activated receptor gamma coactivator 1-alpha)\n- Ucp1 (Uncoupling protein-1)\n- Prdm16 (PR domain containing 16)\n- Ucp3 (Uncoupling protein-3)\n- Mfn1 (Mitofusin-1)\n- Insulin receptor\n- Insulin receptor substrate-1\n- Phosphatidylinositol 3-kinase\n- AKT\n- PPAR𝛾 (Peroxisome proliferator-activated receptor gamma)",
        "document_id": "1737051488_7b5cd717",
    }
    print(json.dumps(lambda_handler(event, None), indent=4))
