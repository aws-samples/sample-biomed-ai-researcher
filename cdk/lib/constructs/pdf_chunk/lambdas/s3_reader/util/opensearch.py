# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import boto3
import os
import logging
from opensearchpy import OpenSearch, RequestsHttpConnection, AWSV4SignerAuth, exceptions
from botocore.config import Config

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
# Optional: not required for OpenSearch Serverless access (auth uses SigV4 via
# the execution role). Kept as an optional lookup rather than a hard requirement
# so a missing value does not crash the function at import time.
ACCOUNT_NUMBER = os.environ.get("AWS_ACCOUNT")
oss_client = None

boto_config = Config(
    read_timeout=900,
    connect_timeout=900,
    region_name=AWS_REGION,
    signature_version="v4",
    retries={"max_attempts": 10, "mode": "standard"},
)


def get_oss_client():
    global oss_client
    if oss_client is None:
        oss_client = boto3.client("opensearchserverless", config=boto_config)

    return oss_client


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()
oss_client = get_oss_client()


def indexExists(host: str, index_name: str) -> bool:
    client = getClient(host)
    try:
        logger.debug("\nFinding index:")
        response = client.indices.get(index=index_name)
        logger.debug(response)
        return True
    except exceptions.NotFoundError:
        return False
    except exceptions.OpenSearchException as error:
        logger.exception(error)
        return False


def createIndexIfNotExists(host: str, index_name: str, is_vector: bool = True):
    client = getClient(host)

    # Create index
    try:
        if client.indices.exists(index=index_name):
            logger.debug(f"Index Exists: {index_name}")
        else:
            logger.debug(f"Creating index: {index_name}")

            if is_vector:
                settings = {
                    "settings": {"index": {"knn": True}},
                    "mappings": {
                        "properties": {
                            "vector_field": {
                                "type": "knn_vector",
                                "dimension": 1536,
                                "method": {"engine": "faiss", "name": "hnsw"},
                            },
                            "content": {"type": "text"},
                            "element_id": {"type": "keyword"},
                            "job_id": {"type": "keyword"},
                            "asset_id": {"type": "keyword"},
                            "type": {"type": "keyword"},
                            "sub_type": {"type": "keyword"},
                            "reading_order": {"type": "integer"},
                            "page_indices": {"type": "integer"},
                            "title": {"type": "text"},
                            "summary": {"type": "text"},
                            "indexed_at": {"type": "date"},
                        }
                    },
                }
            else:
                settings = {"settings": {"index": {"number_of_shards": 4}}}

            response = client.indices.create(
                index=index_name,
                body=settings,
                params={"wait_for_active_shards": "all"},
            )
            logger.debug(response)
    except exceptions.OpenSearchException as error:
        logger.exception(error)
        raise error


def indexDocument(host: str, index_name: str, document_id: str, document: dict):
    """Index a single document to OpenSearch."""
    client = getClient(host)

    try:
        # For OpenSearch Serverless, try without explicit ID first
        response = client.index(index=index_name, body=document)
        logger.info(f"Successfully indexed document to OpenSearch: {response}")
        return response
    except exceptions.OpenSearchException as error:
        logger.exception(f"Error indexing document {document_id}: {error}")
        raise error


def getClient(host: str) -> OpenSearch:
    service = "aoss"
    credentials = boto3.Session().get_credentials()
    region = boto3.Session().region_name
    if region is None or region == "":
        region = AWS_REGION

    auth = AWSV4SignerAuth(credentials, region, service)

    return OpenSearch(
        hosts=[{"host": host, "port": 443}],
        http_auth=auth,
        use_ssl=True,
        verify_certs=True,
        connection_class=RequestsHttpConnection,
        pool_maxsize=20,
        timeout=900,
    )


def collection_host(collectionName: str) -> str:
    client = get_oss_client()
    response = client.batch_get_collection(names=[collectionName])

    if (
        len(response["collectionDetails"]) > 0
        and response["collectionDetails"][0]["status"] == "ACTIVE"
    ):
        return response["collectionDetails"][0]["collectionEndpoint"].replace(
            "https://", ""
        )
    else:
        raise Exception(
            f"OpenSearch collection '{collectionName}' not found or not active"
        )
