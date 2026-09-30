# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
import os
import logging
import boto3
from botocore.exceptions import ClientError
from botocore.config import Config

logger = logging.getLogger()
logger.setLevel(logging.INFO)

REGION = os.environ.get("AWS_REGION", "us-east-1")
BUCKET_NAME = os.environ["BUCKET_NAME"]
DYNAMODB_TABLE = os.environ["DYNAMODB_TABLE"]
UPLOAD_TTL = int(os.environ.get("UPLOAD_TTL", "3600"))

boto_config = Config(
    read_timeout=900,
    connect_timeout=900,
    region_name=REGION,
    signature_version="v4",
    retries={"max_attempts": 10, "mode": "standard"},
)

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'http://localhost:5173',
    'Access-Control-Allow-Credentials': 'true'
}

def get_s3_client():
    return boto3.client(service_name="s3", config=boto_config)


def get_dynamodb_resource():
    return boto3.resource("dynamodb", config=boto_config)


def get_caller_sub(event):
    """Return the authenticated caller's Cognito 'sub', or None if absent."""
    try:
        return event["requestContext"]["authorizer"]["claims"]["sub"]
    except (KeyError, TypeError):
        return None


def caller_owns_document(file_id, caller_sub):
    """Look up the document_index record and confirm the caller owns it.
    Fails closed: returns False if the record is missing or has no owner_sub."""
    table = get_dynamodb_resource().Table(DYNAMODB_TABLE)
    item = table.get_item(Key={"file_id": file_id}).get("Item")
    if not item:
        return False
    return item.get("owner_sub") == caller_sub


def lambda_handler(event, context):
    # Authorization: require an authenticated caller. Object results are keyed
    # by file_id; without an ownership check any authenticated user could read
    # another user's analysis output by enumerating file_id (IDOR).
    caller_sub = get_caller_sub(event)
    if not caller_sub:
        return {
            "statusCode": 401,
            "body": "Unauthorized",
            "headers": CORS_HEADERS
        }

    query_params = event.get("queryStringParameters", {})
    file_id = query_params.get("file-id")
    request_type = query_params.get("request-type")
    # Validate required parameters
    if not file_id or not request_type:
        return {
            "statusCode": 400,
            "body": "Missing required query parameters: 'file-id' and 'request-type'",
            "headers": CORS_HEADERS
        }

    # Map request types to specific file names in S3
    request_type_to_file = {
        "biomarkers": "biomarkers.txt",
        "filter": "filter.json",
        "outcomes": "outcomes.txt",
        "summary": "summary.json"
    }

    file_name = request_type_to_file.get(request_type.lower())
    if not file_name:
        return {
            "statusCode": 400,
            "body": f"Invalid request-type: '{request_type}'. Allowed values are: {list(request_type_to_file.keys())}",
            "headers": CORS_HEADERS
        }

    # Enforce ownership before serving any content.
    try:
        if not caller_owns_document(file_id, caller_sub):
            logger.warning(
                f"Access denied: caller {caller_sub} requested file-id {file_id}"
            )
            return {
                "statusCode": 403,
                "body": "Forbidden",
                "headers": CORS_HEADERS
            }
    except ClientError as e:
        logger.error(f"Ownership lookup failed for {file_id}: {str(e)}")
        return {
            "statusCode": 500,
            "body": "Internal server error",
            "headers": CORS_HEADERS
        }

    file_key = f"{file_id}/{file_name}"
    try:
        response = get_s3_client().get_object(Bucket=BUCKET_NAME, Key=file_key)
        file_content = response["Body"].read().decode("utf-8")

        return {
            "statusCode": 200,
            "body": file_content,
            "headers": CORS_HEADERS
        }

    except ClientError as e:
        if e.response["Error"]["Code"] == "NoSuchKey":
            return {
                "statusCode": 404,
                "body": "File not found",
                "headers": CORS_HEADERS
            }
        else:
            logger.error(f"Error fetching file {file_key}: {str(e)}")
            return {
                "statusCode": 500,
                "body": "Internal server error",
                "headers": CORS_HEADERS
            }