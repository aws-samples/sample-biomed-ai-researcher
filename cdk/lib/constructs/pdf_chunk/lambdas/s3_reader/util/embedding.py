# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import json
import boto3
import os
import logging
from botocore.config import Config

# Set up logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

region = os.environ.get("AWS_REGION", "us-east-1")
boto_config = Config(
    read_timeout=900,
    connect_timeout=900,
    region_name=region,
    signature_version="v4",
    retries={"max_attempts": 10, "mode": "standard"},
)
bedrock_client = None


def get_bedrock_client():
    global bedrock_client
    if bedrock_client is None:
        bedrock_client = boto3.client(
            service_name="bedrock-runtime", config=boto_config
        )
    return bedrock_client


def get_embeddings(text):
    """Generate embeddings for the given text using Amazon Titan."""
    try:
        logger.info(
            f"Starting embedding generation for text of length: {len(text) if text else 0}"
        )

        if not text or not text.strip():
            logger.warning("Empty or whitespace-only text provided for embedding")
            return None

        # Truncate text if too long (Titan has limits)
        max_length = 8000  # Conservative limit for Titan
        if len(text) > max_length:
            logger.warning(
                f"Text length {len(text)} exceeds limit, truncating to {max_length}"
            )
            text = text[:max_length]

        payload = {"inputText": f"{text}"}
        body = json.dumps(payload)
        modelId = "amazon.titan-embed-text-v1"
        accept = "application/json"
        contentType = "application/json"

        logger.info(f"Invoking Bedrock model: {modelId}")
        logger.info(f"Payload size: {len(body)} bytes")

        response = get_bedrock_client().invoke_model(
            body=body, modelId=modelId, accept=accept, contentType=contentType
        )

        logger.info("Successfully received response from Bedrock")
        response_body = json.loads(response.get("body").read())
        logger.info(f"Response body keys: {list(response_body.keys())}")

        embedding = response_body.get("embedding")

        if embedding:
            logger.info(
                f"Successfully generated embedding with dimension: {len(embedding)}"
            )
        else:
            logger.error("No embedding found in response body")
            logger.error(f"Full response body: {response_body}")

        return embedding

    except Exception as e:
        logger.error(f"Error generating embedding: {str(e)}")
        logger.error(f"Exception type: {type(e).__name__}")
        import traceback

        logger.error(f"Full traceback: {traceback.format_exc()}")
        return None
