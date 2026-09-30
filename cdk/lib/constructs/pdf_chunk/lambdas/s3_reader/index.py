# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import json
import boto3
import os
from datetime import datetime
from typing import Dict, Any, List
from aws_lambda_powertools import Logger, Tracer, Metrics
from aws_lambda_powertools.metrics import MetricUnit

# Import utility modules
from util.embedding import get_embeddings
from util.opensearch import collection_host, createIndexIfNotExists, indexDocument

# Initialize AWS Lambda Powertools
logger = Logger()
tracer = Tracer()
metrics = Metrics(namespace="BDAChunker")

# Initialize S3 client
s3_client = boto3.client("s3")

# Environment variables for OpenSearch. The CDK sets OPENSEARCH_COLLECTION /
# OPENSEARCH_INDEX; accept the *_NAME variants too for backwards compatibility,
# then fall back to the configuration defaults.
OPENSEARCH_COLLECTION_NAME = (
    os.environ.get("OPENSEARCH_COLLECTION")
    or os.environ.get("OPENSEARCH_COLLECTION_NAME")
    or "chunkcollection"
)
OPENSEARCH_INDEX_NAME = (
    os.environ.get("OPENSEARCH_INDEX")
    or os.environ.get("OPENSEARCH_INDEX_NAME")
    or "documentindex"
)

# Environment variable for target bucket (where fulltext.json goes for downstream lambdas)
TARGET_BUCKET = os.environ.get("TARGET_BUCKET", "")


def parse_s3_uri(s3_uri: str) -> tuple[str, str]:
    """Parse S3 URI into bucket and key components."""
    if not s3_uri.startswith("s3://"):
        raise ValueError("Invalid S3 URI format. Must start with 's3://'")

    s3_path = s3_uri[5:]  # Remove 's3://'
    if "/" not in s3_path:
        raise ValueError("Invalid S3 URI format. Missing object key")

    bucket_name = s3_path.split("/", 1)[0]
    object_key = s3_path.split("/", 1)[1]

    return bucket_name, object_key


def read_s3_json(bucket: str, key: str) -> Dict[str, Any]:
    """Read and parse JSON file from S3."""
    response = s3_client.get_object(Bucket=bucket, Key=key)
    content = response["Body"].read().decode("utf-8")
    return json.loads(content)


def write_s3_text(bucket: str, key: str, content: str) -> None:
    """Write text content to S3."""
    s3_client.put_object(
        Bucket=bucket,
        Key=key,
        Body=content.encode("utf-8"),
        ContentType="text/markdown",
    )


def extract_markdown_from_elements(elements: List[Dict[str, Any]]) -> str:
    """Extract and concatenate markdown content from elements array."""
    markdown_parts = []

    for element in elements:
        if "representation" in element and "markdown" in element["representation"]:
            markdown_content = element["representation"]["markdown"]
            if markdown_content and markdown_content.strip():
                markdown_parts.append(markdown_content.strip())

    return "\n\n".join(markdown_parts)


def create_opensearch_document(
    element: Dict[str, Any],
    embedding: List[float],
    job_metadata: Dict[str, Any],
    document_metadata: Dict[str, Any],
) -> Dict[str, Any]:
    """Create an OpenSearch document from an element with embedding and metadata."""

    # Extract basic element information
    element_id = element.get("id", "")
    content = element.get("representation", {}).get("markdown", "")

    # Create the document structure
    document = {
        "element_id": element_id,
        "job_id": job_metadata.get("job_id", ""),
        "asset_id": document_metadata.get("asset_id", ""),
        "content": content,
        "vector_field": embedding,
        "type": element.get("type", ""),
        "sub_type": element.get("sub_type", ""),
        "reading_order": element.get("reading_order", 0),
        "page_indices": element.get("page_indices", []),
        "locations": element.get("locations", []),
        "crop_images": element.get("crop_images", []),
        "title": element.get("title", ""),
        "summary": element.get("summary", ""),
        "document_metadata": {
            "s3_bucket": document_metadata.get("s3_bucket", ""),
            "s3_key": document_metadata.get("s3_key", ""),
            "file_type": document_metadata.get("file_type", ""),
            "total_pages": document_metadata.get("number_of_pages", 0),
        },
        "indexed_at": datetime.utcnow().isoformat(),
    }

    return document


def process_elements_for_opensearch(
    elements: List[Dict[str, Any]],
    job_metadata: Dict[str, Any],
    document_metadata: Dict[str, Any],
) -> Dict[str, Any]:
    """Process all elements for OpenSearch indexing."""

    # Initialize OpenSearch connection
    try:
        host = collection_host(OPENSEARCH_COLLECTION_NAME)
        if not host:
            logger.error(
                f"Could not get host for OpenSearch collection: {OPENSEARCH_COLLECTION_NAME}"
            )
            return {
                "total_elements": len(elements),
                "successfully_indexed": 0,
                "failed_indexing": len(elements),
                "failed_element_ids": [e.get("id", "unknown") for e in elements],
                "error": "Could not connect to OpenSearch collection",
            }

        # Ensure index exists
        createIndexIfNotExists(host, OPENSEARCH_INDEX_NAME, is_vector=True)
        logger.info(f"OpenSearch index {OPENSEARCH_INDEX_NAME} ready")

    except Exception as e:
        logger.error(f"Error setting up OpenSearch: {str(e)}")
        return {
            "total_elements": len(elements),
            "successfully_indexed": 0,
            "failed_indexing": len(elements),
            "failed_element_ids": [e.get("id", "unknown") for e in elements],
            "error": f"OpenSearch setup error: {str(e)}",
        }

    # Process elements sequentially
    successfully_indexed = 0
    failed_indexing = 0
    failed_element_ids = []

    logger.info(f"Starting to process {len(elements)} elements for OpenSearch indexing")

    for i, element in enumerate(elements):
        element_id = element.get("id", f"unknown-{i}")

        try:
            # Extract markdown content
            markdown_content = element.get("representation", {}).get("markdown", "")

            # Skip elements without meaningful content
            if not markdown_content or not markdown_content.strip():
                logger.info(f"Skipping element {element_id} - no markdown content")
                continue

            logger.info(f"Processing element {i+1}/{len(elements)}: {element_id}")

            # Generate embedding
            logger.info(
                f"Generating embedding for element {element_id} (content length: {len(markdown_content)})"
            )
            embedding = get_embeddings(markdown_content)

            if not embedding:
                logger.error(
                    f"Failed to generate embedding for element {element_id} - embedding is None or empty"
                )
                failed_indexing += 1
                failed_element_ids.append(element_id)
                continue

            logger.info(
                f"Generated embedding for element {element_id} (dimension: {len(embedding)})"
            )

            # Create document
            document = create_opensearch_document(
                element, embedding, job_metadata, document_metadata
            )
            logger.info(
                f"Created document for element {element_id} with {len(document)} fields"
            )

            # Index document
            logger.info(
                f"Indexing element {element_id} to OpenSearch index {OPENSEARCH_INDEX_NAME}"
            )
            result = indexDocument(host, OPENSEARCH_INDEX_NAME, element_id, document)
            logger.info(f"OpenSearch indexing result for {element_id}: {result}")

            successfully_indexed += 1
            logger.info(f"Successfully indexed element {element_id}")

        except Exception as e:
            logger.error(f"Error processing element {element_id}: {str(e)}")
            logger.error(f"Exception type: {type(e).__name__}")
            import traceback

            logger.error(f"Full traceback: {traceback.format_exc()}")
            failed_indexing += 1
            failed_element_ids.append(element_id)
            continue

    logger.info(
        f"OpenSearch indexing complete: {successfully_indexed} successful, {failed_indexing} failed"
    )

    return {
        "total_elements": len(elements),
        "successfully_indexed": successfully_indexed,
        "failed_indexing": failed_indexing,
        "failed_element_ids": failed_element_ids,
    }


def dump_job_metadata_to_log(event: Dict[str, Any]) -> None:
    """Read and dump job metadata file from S3 to the log."""
    try:
        # Get the s3Uri parameter from the event
        s3_uri = event.get("s3Uri")

        if not s3_uri:
            logger.warning("No s3Uri found in event, cannot read job metadata file")
            return

        logger.info("=== JOB METADATA DUMP ===")
        logger.info(f"Reading job metadata from {s3_uri}")

        # Parse the S3 URI and read the metadata file
        bucket_name, object_key = parse_s3_uri(s3_uri)
        job_metadata = read_s3_json(bucket_name, object_key)

        logger.info(f"Job Metadata File Content: {json.dumps(job_metadata, indent=2)}")
        logger.info("=== END JOB METADATA DUMP ===")

    except s3_client.exceptions.NoSuchKey:
        logger.warning(f"Job metadata file not found at {s3_uri}")
    except s3_client.exceptions.NoSuchBucket:
        logger.warning(f"S3 bucket not found for {s3_uri}")
    except Exception as e:
        logger.error(f"Error reading job metadata from S3: {str(e)}")


@tracer.capture_lambda_handler
@logger.inject_lambda_context(log_event=True)
@metrics.log_metrics
def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda function to process BDA job metadata and extract markdown content.

    Expected input format:
    {
        "s3Uri": "s3://bucket/path/to/job_metadata.json"
    }

    Returns:
    {
        "statusCode": 200,
        "body": {
            "success": true,
            "processed_files": [
                {
                    "input_json_path": "s3://bucket/path/to/result.json",
                    "output_markdown_path": "s3://bucket/path/to/result.md",
                    "markdown_elements_count": 120
                }
            ],
            "job_id": "e4e6ea62-52ad-4343-8d38-de62e80e8738"
        }
    }
    """
    try:
        # Step 1: Dump job metadata to log at the start of execution
        dump_job_metadata_to_log(event)

        # Validate input format
        if not isinstance(event, dict):
            logger.error("Event must be a dictionary")
            metrics.add_metric(name="S3ReaderErrors", unit=MetricUnit.Count, value=1)
            return {
                "statusCode": 400,
                "body": {"success": False, "error": "Event must be a dictionary"},
            }

        # Get the s3Uri parameter from the event
        s3_uri = event.get("s3Uri")
        if not s3_uri:
            logger.error("s3Uri is required in the event payload")
            metrics.add_metric(name="S3ReaderErrors", unit=MetricUnit.Count, value=1)
            return {
                "statusCode": 400,
                "body": {
                    "success": False,
                    "error": "s3Uri is required in the event payload",
                },
            }

        # Step 2: Read metadata file from input URI
        logger.info(f"Reading job metadata from {s3_uri}")
        bucket_name, object_key = parse_s3_uri(s3_uri)
        job_metadata = read_s3_json(bucket_name, object_key)

        # Extract job information from metadata
        job_id = job_metadata.get("job_id")
        job_status = job_metadata.get("job_status")
        output_metadata = job_metadata.get("output_metadata", [])

        if job_status != "PROCESSED":
            logger.warning(
                f"Job status is {job_status}, not PROCESSED. Continuing anyway."
            )

        logger.info(f"Processing BDA job {job_id} with status {job_status}")

        processed_files = []

        # Step 3: Process each asset in output_metadata
        for asset_metadata in output_metadata:
            asset_id = asset_metadata.get("asset_id", "unknown")
            segment_metadata = asset_metadata.get("segment_metadata", [])

            logger.info(
                f"Processing asset {asset_id} with {len(segment_metadata)} segments"
            )

            # Process each segment
            for segment in segment_metadata:
                standard_output_path = segment.get("standard_output_path")

                if not standard_output_path:
                    logger.warning(
                        f"No standard_output_path found in segment for asset {asset_id}"
                    )
                    continue

                logger.info(f"Processing standard_output_path: {standard_output_path}")

                try:
                    # Parse S3 URI
                    bucket, key = parse_s3_uri(standard_output_path)

                    # Read JSON file from S3
                    json_data = read_s3_json(bucket, key)

                    # Extract elements array
                    elements = json_data.get("elements", [])
                    if not elements:
                        logger.warning(f"No elements found in {standard_output_path}")
                        continue

                    # Extract markdown content
                    markdown_content = extract_markdown_from_elements(elements)

                    if not markdown_content:
                        logger.warning(
                            f"No markdown content extracted from {standard_output_path}"
                        )
                        continue

                    # Generate output path (replace .json with .md)
                    if key.endswith(".json"):
                        output_key = key[:-5] + ".md"
                    else:
                        output_key = key + ".md"

                    output_path = f"s3://{bucket}/{output_key}"

                    # Write markdown file to S3
                    write_s3_text(bucket, output_key, markdown_content)

                    # Write fulltext.json to TARGET_BUCKET for downstream lambdas
                    if TARGET_BUCKET:
                        # Extract document_id from the original input key in job metadata
                        input_s3_key = asset_metadata.get("asset_input_path", {}).get("s3_key", "")
                        if input_s3_key:
                            # Remove .pdf extension to get document_id
                            document_id = input_s3_key.rsplit(".", 1)[0] if "." in input_s3_key else input_s3_key
                            fulltext_key = f"{document_id}/fulltext.json"
                            s3_client.put_object(
                                Bucket=TARGET_BUCKET,
                                Key=fulltext_key,
                                Body=markdown_content.encode("utf-8"),
                                ContentType="application/json",
                            )
                            logger.info(f"Wrote fulltext.json to s3://{TARGET_BUCKET}/{fulltext_key}")

                    # Count markdown elements
                    markdown_elements_count = len(
                        [
                            e
                            for e in elements
                            if e.get("representation", {}).get("markdown")
                        ]
                    )

                    # NEW: Process elements for OpenSearch indexing
                    logger.info(
                        f"Processing {len(elements)} elements for OpenSearch indexing"
                    )

                    # Prepare document metadata from json_data
                    document_metadata = json_data.get("metadata", {})
                    document_metadata.update({"s3_bucket": bucket, "s3_key": key})

                    # Process elements for OpenSearch
                    opensearch_results = process_elements_for_opensearch(
                        elements, job_metadata, document_metadata
                    )

                    # Add OpenSearch metrics
                    metrics.add_metric(
                        name="OpenSearchIndexedElements",
                        unit=MetricUnit.Count,
                        value=opensearch_results["successfully_indexed"],
                    )
                    metrics.add_metric(
                        name="OpenSearchFailedElements",
                        unit=MetricUnit.Count,
                        value=opensearch_results["failed_indexing"],
                    )

                    processed_files.append(
                        {
                            "input_json_path": standard_output_path,
                            "output_markdown_path": output_path,
                            "markdown_elements_count": markdown_elements_count,
                            "opensearch_results": opensearch_results,
                        }
                    )

                    logger.info(
                        f"Successfully processed {standard_output_path} -> {output_path}"
                    )
                    logger.info(
                        f"Extracted {markdown_elements_count} markdown elements"
                    )
                    logger.info(
                        f"OpenSearch indexing: {opensearch_results['successfully_indexed']} successful, {opensearch_results['failed_indexing']} failed"
                    )

                except Exception as segment_error:
                    logger.error(
                        f"Error processing segment {standard_output_path}: {str(segment_error)}"
                    )
                    # Continue processing other segments
                    continue

        # Add success metrics
        metrics.add_metric(name="S3ReaderSuccess", unit=MetricUnit.Count, value=1)
        metrics.add_metric(
            name="ProcessedFiles", unit=MetricUnit.Count, value=len(processed_files)
        )

        logger.info(
            f"Successfully processed {len(processed_files)} files for job {job_id}"
        )

        return {
            "statusCode": 200,
            "body": {
                "success": True,
                "processed_files": processed_files,
                "job_id": job_id,
                "total_files_processed": len(processed_files),
            },
        }

    except ValueError as ve:
        logger.error(f"Validation error: {str(ve)}")
        metrics.add_metric(name="S3ReaderErrors", unit=MetricUnit.Count, value=1)
        return {
            "statusCode": 400,
            "body": {"success": False, "error": f"Validation error: {str(ve)}"},
        }

    except s3_client.exceptions.NoSuchBucket as e:
        logger.error(f"S3 bucket does not exist: {str(e)}")
        metrics.add_metric(name="S3ReaderErrors", unit=MetricUnit.Count, value=1)
        return {
            "statusCode": 404,
            "body": {"success": False, "error": f"S3 bucket does not exist: {str(e)}"},
        }

    except s3_client.exceptions.NoSuchKey as e:
        logger.error(f"S3 object does not exist: {str(e)}")
        metrics.add_metric(name="S3ReaderErrors", unit=MetricUnit.Count, value=1)
        return {
            "statusCode": 404,
            "body": {"success": False, "error": f"S3 object does not exist: {str(e)}"},
        }

    except Exception as e:
        logger.error(f"Unexpected error processing BDA job: {str(e)}")
        metrics.add_metric(name="S3ReaderErrors", unit=MetricUnit.Count, value=1)
        return {
            "statusCode": 500,
            "body": {
                "success": False,
                "error": f"Unexpected error processing BDA job: {str(e)}",
            },
        }
