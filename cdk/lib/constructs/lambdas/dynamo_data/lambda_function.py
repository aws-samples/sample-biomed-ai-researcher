# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
import json
import boto3
import os
import logging
from botocore.config import Config
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

REGION = os.environ.get("AWS_REGION", "us-east-1")
DYNAMODB_TABLE = os.environ["DYNAMODB_TABLE"]

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


def get_dynamodb_resource():
    return boto3.resource("dynamodb", config=boto_config)


def get_caller_sub(event):
    """Return the authenticated caller's Cognito 'sub', or None if absent."""
    try:
        return event["requestContext"]["authorizer"]["claims"]["sub"]
    except (KeyError, TypeError):
        return None


def response(status_code, body):
    return {
        'statusCode': status_code,
        'body': json.dumps(body),
        'headers': CORS_HEADERS,
    }


def lambda_handler(event, context):

    # Authorization: require an authenticated caller and enforce that the
    # document belongs to them. Without this, any authenticated user could read
    # any other user's document metadata by guessing/enumerating file_id (IDOR).
    caller_sub = get_caller_sub(event)
    if not caller_sub:
        return response(401, {'error': 'Unauthorized'})

    try:
        # Extract the primary key from the request
        key = event['queryStringParameters']['key']

        table = get_dynamodb_resource().Table(DYNAMODB_TABLE)

        # Query the table
        item = table.get_item(Key={'file_id': key}).get('Item')

        if not item:
            return response(404, {'error': 'Not found'})

        # Fail closed: deny if the record has no owner or the owner differs.
        if item.get('owner_sub') != caller_sub:
            logger.warning(
                f"Access denied: caller {caller_sub} requested file_id {key} "
                f"owned by {item.get('owner_sub')}"
            )
            return response(403, {'error': 'Forbidden'})

        return response(200, item)
    except ClientError as e:
        logger.error(f"DynamoDB error: {str(e)}")
        return response(500, {'error': 'Internal server error'})
    except KeyError:
        return response(400, {'error': 'Key parameter is required'})