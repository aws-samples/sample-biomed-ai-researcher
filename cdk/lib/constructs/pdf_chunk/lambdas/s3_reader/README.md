# S3 Reader Lambda - OpenSearch Integration

This document describes the enhanced s3-reader lambda function that now includes OpenSearch indexing capabilities alongside the existing markdown file generation.

## Overview

The s3-reader lambda function has been modified to:
1. **Maintain existing functionality**: Continue generating markdown files from BDA result.json files
2. **Add OpenSearch indexing**: Process each element from the result.json and create searchable documents in OpenSearch with embeddings

## Key Features

### Dual Functionality
- **Markdown Generation**: Extracts and concatenates markdown content from all elements into .md files (existing functionality)
- **OpenSearch Indexing**: Processes each element individually to create searchable documents with embeddings

### Sequential Processing
- Elements are processed one by one (no batching) as requested
- Each element gets its own embedding and OpenSearch document
- Failures in individual elements don't stop the entire process

### Comprehensive Metadata Storage
- All element metadata is preserved in OpenSearch documents
- Document structure includes bounding boxes, page indices, element types, and more
- Job and document metadata are included for traceability

## Document Structure

Each OpenSearch document contains:

```json
{
  "element_id": "unique-element-id",
  "job_id": "bda-job-id",
  "asset_id": "document-asset-id",
  "content": "markdown content for embedding",
  "vector_field": [1536-dimensional-embedding-array],
  "type": "TEXT|FIGURE|etc",
  "sub_type": "PARAGRAPH|HEADER|LOGO|etc",
  "reading_order": 5,
  "page_indices": [0, 1],
  "locations": [
    {
      "page_index": 0,
      "bounding_box": {
        "left": 0.055,
        "top": 0.022,
        "width": 0.097,
        "height": 0.069
      }
    }
  ],
  "crop_images": ["s3://bucket/path/to/image.png"],
  "title": "Element title",
  "summary": "Element summary",
  "document_metadata": {
    "s3_bucket": "source-bucket",
    "s3_key": "path/to/result.json",
    "file_type": "PDF",
    "total_pages": 11
  },
  "indexed_at": "2025-01-01T00:00:00Z"
}
```

## Configuration

### Environment Variables
- `OPENSEARCH_COLLECTION_NAME`: Name of the OpenSearch collection (default: "chunk-data")
- `OPENSEARCH_INDEX_NAME`: Name of the OpenSearch index (default: "chunk-data")
- `LOG_LEVEL`: Logging level (default: "INFO")

### Lambda Configuration Updates
- **Timeout**: Increased to 900 seconds (15 minutes) to handle embedding generation
- **Memory**: Increased to 1024 MB for better performance
- **Environment Variables**: Added OpenSearch configuration

## Dependencies

### New Dependencies Added
- `opensearch-py>=2.0.0`: OpenSearch Python client
- `requests>=2.28.0`: HTTP library for OpenSearch client
- `requests-aws4auth>=1.1.2`: AWS authentication for requests

### Utility Modules
- `util/embedding.py`: Handles Amazon Titan embedding generation
- `util/opensearch.py`: Manages OpenSearch connections and operations

## Processing Flow

1. **Read BDA Job Metadata**: Parse job metadata from S3
2. **Process Each Result File**:
   - Read result.json from S3
   - Extract elements array
   - Generate consolidated markdown file (existing)
   - **NEW**: Process each element for OpenSearch:
     - Generate embedding for element's markdown content
     - Create document with all metadata
     - Index to OpenSearch collection
3. **Return Results**: Include both markdown and OpenSearch results

## Response Format

The lambda now returns enhanced results including OpenSearch indexing information:

```json
{
  "statusCode": 200,
  "body": {
    "success": true,
    "processed_files": [
      {
        "input_json_path": "s3://bucket/result.json",
        "output_markdown_path": "s3://bucket/result.md",
        "markdown_elements_count": 120,
        "opensearch_results": {
          "total_elements": 120,
          "successfully_indexed": 118,
          "failed_indexing": 2,
          "failed_element_ids": ["element-id-1", "element-id-2"]
        }
      }
    ],
    "job_id": "job-id",
    "total_files_processed": 1
  }
}
```

## Error Handling

### Graceful Degradation
- OpenSearch failures don't prevent markdown file generation
- Individual element failures don't stop processing of other elements
- Detailed error logging for debugging

### Retry Logic
- Embedding generation failures are logged but don't stop processing
- OpenSearch connection issues are handled gracefully
- Failed element IDs are tracked and reported

## Monitoring and Metrics

### CloudWatch Metrics
- `OpenSearchIndexedElements`: Count of successfully indexed elements
- `OpenSearchFailedElements`: Count of failed indexing attempts
- `S3ReaderSuccess`: Overall lambda success count
- `ProcessedFiles`: Number of files processed

### Logging
- Detailed logging for each processing step
- Element-level success/failure tracking
- Performance metrics for embedding generation and indexing

## IAM Permissions Required

The lambda execution role needs:
- **S3 Access**: Read access to source and target buckets
- **Bedrock Access**: Model invocation for embedding generation
- **OpenSearch Access**: Collection and index operations
- **CloudWatch**: Logging and metrics

## Testing

A test script is provided at the project root:
```bash
python test-s3-reader-opensearch.py
```

This script simulates lambda execution with sample data to verify functionality.

## Deployment Notes

1. **Dependencies**: Ensure all new dependencies are installed in the lambda environment
2. **OpenSearch Collection**: The "chunk-data" collection must exist and be accessible
3. **IAM Permissions**: Update lambda execution role with required permissions
4. **Environment Variables**: Configure OpenSearch collection and index names
5. **Timeout**: Ensure lambda timeout is sufficient for processing large documents

## Backward Compatibility

The enhanced lambda maintains full backward compatibility:
- All existing markdown generation functionality is preserved
- Response format is extended (not changed)
- No breaking changes to the API contract

## Performance Considerations

- **Sequential Processing**: Elements are processed one by one as requested
- **Memory Usage**: Increased to 1024 MB to handle embedding operations
- **Timeout**: Set to 15 minutes to accommodate large documents
- **Embedding Generation**: Each element requires a Bedrock API call
- **OpenSearch Indexing**: Individual document indexing per element

## Troubleshooting

### Common Issues
1. **OpenSearch Connection Failures**: Check collection status and IAM permissions
2. **Embedding Generation Failures**: Verify Bedrock model access and quotas
3. **Timeout Issues**: Consider increasing lambda timeout for large documents
4. **Memory Issues**: Monitor memory usage and increase if needed

### Debug Logging
Set `LOG_LEVEL=DEBUG` for detailed processing information including:
- Individual element processing steps
- Embedding generation timing
- OpenSearch indexing results
- Error details and stack traces
