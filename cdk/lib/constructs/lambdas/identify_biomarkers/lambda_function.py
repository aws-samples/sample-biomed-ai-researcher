# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
from bedrock_client import get_bedrock_client, ModelId
import json, logging, os, boto3, io, datetime
from botocore.config import Config
from dynamodb_client import update_dynamo_record, get_prompt, get_dynamo_record

SOURCE_BUCKET = os.environ["SOURCE_BUCKET"]
TARGET_BUCKET = os.environ["TARGET_BUCKET"]
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
STAGE = os.getenv("STAGE", "IDENTIFY_BIOMARKERS")

boto_config = Config(
    read_timeout=900,
    connect_timeout=900,
    region_name=AWS_REGION,
    signature_version="v4",
    retries={"max_attempts": 10, "mode": "standard"},
)

def get_s3_client():
    return boto3.client(service_name="s3", config=boto_config)


def s3_get_data(bucket: str, search_key: str, decode: bool = False):
    s3_client = get_s3_client()

    response = s3_client.list_objects_v2(Bucket=bucket, Prefix=search_key)
    if "Contents" in response:
        obj = s3_client.get_object(Bucket=bucket, Key=search_key)
        if decode:
            return obj["Body"].read().decode("utf-8")
        else:
            return io.BytesIO(obj["Body"].read())
    else:
        logging.info(f"No data found for {search_key}")
        

def s3_put_data(bucket: str, data_key: str, data:str):
    s3_client = get_s3_client()

    response = s3_client.put_object(Body=json.dumps(data), Bucket=bucket, Key=data_key)
    
    return response


def extract_biomarkers(document: str, prompt_group: str, modelID: ModelId = ModelId.CLAUDE_3_SONNET):
    biomarker_prompt = get_prompt(stage=STAGE, prompt_type="base", prompt_group=prompt_group)
    
    variables = {"document": document}
    bio_prompt = biomarker_prompt.format(**variables)
    input_data = json.dumps(
        {
            "messages": [
                {"role": "user", "content": [{"type": "text", "text": bio_prompt}]}
            ],
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1000,
            "temperature": 0.2,
        }
    )

    logging.info("Starting variants extraction")
    biomarker_response = get_bedrock_client().invoke_model(
        body=input_data, modelId=modelID
    )
    biomarker_response = json.loads(biomarker_response["body"].read())["content"][0][
        "text"
    ].strip()

    # The model is expected to emit a short preamble line, a blank line, then the
    # list of variants. Drop the preamble when present, but never crash if the
    # output isn't shaped that way (model formatting varies between Claude
    # versions): keep everything after the first blank-line break, else keep all.
    parts = biomarker_response.split("\n\n")
    variants_only = "\n\n".join(parts[1:]).strip() if len(parts) > 1 else biomarker_response

    return variants_only


def lambda_handler(event, context):
    if "bucket" in event:
        source_bucket = event["bucket"]
    else:
        source_bucket = SOURCE_BUCKET

    if "document_id" in event:
        key = event["document_id"]
    else:
        return {"statusCode": 400, "body": "Missing 'document_id' parameter in the event"}
    
    dynamo_record = get_dynamo_record(key=key)
    
    prompt_group = dynamo_record["prompt_group"]

    update_dynamo_record(key=key, stage=STAGE, status="Extracting biomarkers")
    
    markdown_text = s3_get_data(
        bucket=source_bucket, search_key=key + "/fulltext.json", decode=True
    )

    biomarkers = extract_biomarkers(document=markdown_text, prompt_group=prompt_group)
    
    s3_put_data(bucket=TARGET_BUCKET, data_key=key +"/biomarkers.txt", data=biomarkers)

    update_dynamo_record(key=key, stage=STAGE, status="Done extracting biomarkers")
    
    # Return the response as a dictionary
    return {
        "statusCode": 200,  # HTTP status code 200 (OK)
        "biomarkers": biomarkers,
        "document_id": key
    }


if __name__ == "__main__":
    event = {"document_id": "1737051488_7b5cd717"}
    print(json.dumps(lambda_handler(event, None), indent=4))
