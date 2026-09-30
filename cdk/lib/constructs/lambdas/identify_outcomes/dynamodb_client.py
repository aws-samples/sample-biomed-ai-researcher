# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
import os, boto3, datetime
from botocore.config import Config

AWS_REGION = os.getenv("AWS_REGION", "us-east-1")

DOCUMENT_TABLE = os.environ["DYNAMODB_TABLE"]
PROMPT_TABLE = os.environ["PROMPT_TABLE"]

PROMPT_GROUP = "default"
prompt_dict = {}

boto_config = Config(
    read_timeout=900,
    connect_timeout=900,
    region_name=AWS_REGION,
    signature_version="v4",
    retries={"max_attempts": 10, "mode": "standard"},
)

script_dir = os.path.dirname(os.path.abspath(__file__))
file_path = os.path.join(script_dir, "outcomes_prompt.txt")
with open(file_path) as f:
    outcomes_prompt = f.read()

file_path = os.path.join(script_dir, "supplemental_prompt.txt")
with open(file_path) as f:
    supplemental_prompt = f.read()


def get_dynamodb_resource():
    return boto3.resource("dynamodb", config=boto_config)


def update_dynamo_record(key: str, stage: str, status: str):
    table = get_dynamodb_resource().Table(DOCUMENT_TABLE)
    response = table.get_item(Key={"file_id": key})

    if "Item" in response:
        print("Existing record")
        record = response["Item"]
        record["date_updated"] = datetime.datetime.now(
            datetime.timezone.utc
        ).isoformat()

    else:
        print("New record")
        record = {
            "file_id": key,
            "file_name": "UNKNOWN",
            "submitter": "UNKNOWN",
            "date_created": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "date_updated": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "prompt_group": PROMPT_GROUP,
        }

    record["status"] = status
    record[stage] = status

    return table.put_item(Item=record)


def get_prompt(stage: str, prompt_type: str, prompt_group: str = PROMPT_GROUP):
    if prompt_type in prompt_dict:
        return prompt_dict[prompt_type]
    else:
        prompt_id = f"{stage}-{prompt_type}-{prompt_group}"
        table = get_dynamodb_resource().Table(PROMPT_TABLE)
        response = table.get_item(
            Key={"prompt_id": prompt_id, "prompt_group": prompt_group},
        )
        if "Item" not in response:
            prompt_value = globals()[f"{prompt_type}_prompt"]
            table.put_item(
                Item={
                    "prompt_id": prompt_id,
                    "prompt": prompt_value,
                    "prompt_group": prompt_group,
                }
            )
            prompt_dict[prompt_type] = prompt_value
            return prompt_value
        else:
            prompt_dict[prompt_type] = response["Item"]["prompt"]
            return response["Item"]["prompt"]


def get_dynamo_record(key: str):
    table = get_dynamodb_resource().Table(DOCUMENT_TABLE)
    response = table.get_item(Key={"file_id": key})

    return response["Item"]
