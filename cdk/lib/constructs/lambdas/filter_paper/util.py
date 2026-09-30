# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
from bedrock_client import get_bedrock_client
import json, logging, boto3, io, datetime, os
from botocore.config import Config

AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
DYNAMODB_TABLE = os.environ["DYNAMODB_TABLE"]

boto_config = Config(
    read_timeout=900,
    connect_timeout=900,
    region_name=AWS_REGION,
    signature_version="v4",
    retries={"max_attempts": 10, "mode": "standard"},
)


def get_dynamodb_resource():
    return boto3.resource("dynamodb", config=boto_config)


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


def s3_put_data(bucket: str, data_key: str, data: str):
    s3_client = get_s3_client()

    response = s3_client.put_object(Body=json.dumps(data), Bucket=bucket, Key=data_key)

    return response
