# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
import json, boto3, os, datetime
from botocore.config import Config

REGION = os.environ.get("AWS_REGION", "us-east-1")
DYNAMODB_TABLE = os.environ["DYNAMODB_TABLE"]
STATE_MACHINE = os.environ["STATE_MACHINE"]

boto_config = Config(
    read_timeout=900,
    connect_timeout=900,
    region_name=REGION,
    signature_version="v4",
    retries={"max_attempts": 10, "mode": "standard"},
)


def get_dynamodb_resource():
    return boto3.resource("dynamodb", config=boto_config)


def get_step_client():
    return boto3.client("stepfunctions", config=boto_config)


def lambda_handler(event, context):
    bucket = event["detail"]["bucket"]["name"]
    key = event["detail"]["object"]["key"]

    if key.rfind("."):
        key = key[: key.rfind(".")]

    input_dict = {"bucket": bucket, "key": key + ".pdf"}

    response = get_step_client().start_execution(
        stateMachineArn=STATE_MACHINE, input=json.dumps(input_dict)
    )

    status_code_step = response["ResponseMetadata"]["HTTPStatusCode"]

    table = get_dynamodb_resource().Table(DYNAMODB_TABLE)

    response = table.get_item(Key={"file_id": key})

    if "Item" in response:
        print("Existing record")
        record = response["Item"]
        record["date_updated"] = datetime.datetime.now(
            datetime.timezone.utc
        ).isoformat()
        record["status"] = "CHUNKING_RUNNING"
    else:
        print("New record")
        record = {
            "file_id": key,
            "file_name": "UNKNOWN",
            "submitter": "UNKNOWN",
            "date_created": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "status": "CHUNKING_RUNNING",
        }

    response = table.put_item(Item=record)
    status_code_dynamodb = response["ResponseMetadata"]["HTTPStatusCode"]

    return {
        "statusCodeChunking": status_code_step,
        "statusCodeDynamo": status_code_dynamodb,
        "body": json.dumps("Chunking Started"),
    }
