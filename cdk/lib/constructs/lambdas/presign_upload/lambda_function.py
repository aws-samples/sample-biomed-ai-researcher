# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
import boto3, os, json
from botocore.config import Config
import uuid
import time
import datetime

REGION = os.environ.get("AWS_REGION", "us-east-1")
S3_TARGET = os.environ["S3_TARGET"]
UPLOAD_TTL = int(os.environ.get("UPLOAD_TTL", "3600"))
DYNAMODB_TABLE = os.environ["DYNAMODB_TABLE"]

boto_config = Config(
    read_timeout=900,
    connect_timeout=900,
    region_name=REGION,
    signature_version="v4",
    retries={"max_attempts": 10, "mode": "standard"},
)


def get_s3_client():
    return boto3.client(service_name="s3", config=boto_config)


def get_dynamodb_resource():
    return boto3.resource("dynamodb", config=boto_config)


def generate_short_unique_filename(prefix=""):
    """Generates a short, unique filename with an optional prefix."""

    timestamp = int(time.time())
    unique_id = uuid.uuid4().hex[:8]
    filename = (
        f"{prefix}{timestamp}_{unique_id}" if prefix else f"{timestamp}_{unique_id}"
    )

    return filename


def get_caller_identity(event):
    """Extract the authenticated caller's identity from the Cognito authorizer
    claims. Returns (sub, display_name). Raises KeyError/TypeError if claims are
    absent, which results in a 4xx rather than trusting client-supplied values."""
    claims = event["requestContext"]["authorizer"]["claims"]
    sub = claims["sub"]
    display_name = claims.get("cognito:username") or claims.get("email") or sub
    return sub, display_name


def lambda_handler(event, context):
    if "body" in event:
        data = json.loads(event["body"])
    else:
        data = event

    # Derive identity from the verified Cognito token, never from the request
    # body. A client-supplied "submitter" is ignored to prevent attribution
    # spoofing and to provide a trustworthy owner for downstream authorization.
    try:
        owner_sub, submitter = get_caller_identity(event)
    except (KeyError, TypeError):
        return {
            "statusCode": 401,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps({"error": "Unauthorized"}),
            "isBase64Encoded": False,
        }

    original_file_name = data["file_name"]
    
    prompt_group = data.get("prompt_group","default")
    condition = ",".join(data.get("condition", []))
    gene = ",".join(data.get("gene", []))

    table = get_dynamodb_resource().Table(DYNAMODB_TABLE)

    print(" Generating pre-signed url...")

    key = generate_short_unique_filename()

    presigned_url = get_s3_client().generate_presigned_url(
        "put_object",
        Params={"Bucket": S3_TARGET, "Key": key + ".pdf"},
        ExpiresIn=UPLOAD_TTL,
        HttpMethod="PUT",
    )

    print(f"Key: {key}")

    response = table.put_item(
        Item={
            "file_id": key,
            "file_name": original_file_name,
            "condition": condition,
            "gene": gene,
            "owner_sub": owner_sub,
            "submitter": submitter,
            "date_created": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "status": "UPLOAD_URL_CREATED",
            "prompt_group": prompt_group
        }
    )

    status_code = response["ResponseMetadata"]["HTTPStatusCode"]

    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps({"presigned_url": presigned_url, "file_id": key}),
        "isBase64Encoded": False,
    }


if __name__ == "__main__":
    print(
        lambda_handler(
            {
                "requestContext": {
                    "authorizer": {
                        "claims": {
                            "sub": "11111111-2222-3333-4444-555555555555",
                            "cognito:username": "testuser",
                        }
                    }
                },
                "file_name": "nihms-1859350.pdf",
                "prompt_group": "default",
                "condition": [
                    "obesity",
                    "overweight",
                    "cardiovascular metabolism",
                    "coronary artery disease",
                    "diabetes",
                    "premature coronary artery disease",
                    "hypercholesterolemia",
                    "hypertriglyceridemia",
                    "hyperlipidemia",
                    "dyslipidemia",
                ],
                "gene": ["GPR75"],
            },
            None,
        )
    )
