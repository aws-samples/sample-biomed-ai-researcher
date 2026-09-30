# PDF Chunker Construct

A modern AWS construct for automated PDF processing using Bedrock Data Automation, OpenSearch vector storage, and intelligent document analysis.

## Overview

The PDF Chunker construct provides a complete solution for processing PDF documents with advanced capabilities including:

- **Bedrock Data Automation**: Native AWS service for intelligent document processing
- **Vector Search**: OpenSearch integration for semantic document search
- **Status Tracking**: DynamoDB-based processing status management
- **Scalable Architecture**: Built on AWS managed services for high availability

## Architecture

```
PDFChunkerConstruct
├── BedrockDataAutomationConstruct
│   ├── Input S3 Bucket (auto-created or provided)
│   ├── Output S3 Bucket (auto-created or provided)
│   └── BDA Project with configurable processing
├── BdaStepFunctionConstruct
│   ├── Step Function State Machine
│   ├── CloudWatch Log Group
│   └── IAM Role with BDA permissions
├── OpenSearchVectorConstruct
│   ├── Vector Search Collection
│   └── Data Access Policies
├── S3ReaderLambda (BDA integration)
└── ProcessingTable (DynamoDB)
```

## Features

### 🤖 **Bedrock Data Automation**
- Page and element level extraction
- Bounding box detection for precise content location
- Generative field descriptions using AI
- Multiple output formats (Markdown, CSV, JSON)
- Configurable processing granularity

### 🔍 **Vector Search**
- OpenSearch Serverless vector collections
- Semantic search capabilities
- Automatic indexing of processed content
- Scalable search infrastructure

### 📊 **Processing Management**
- DynamoDB-based status tracking
- Step Function orchestration
- CloudWatch logging and monitoring
- X-Ray tracing for debugging

### 🔧 **Configuration-Driven**
- Centralized JSON configuration
- Environment-specific settings
- Flexible deployment options

## Quick Start

### Basic Usage

```typescript
import { PDFChunkerConstruct } from './pdf_chunk';

const pdfChunker = new PDFChunkerConstruct(this, 'PDFChunker', {
  region: 'us-east-1',
  aossCollection: 'pdf-documents',
  aossIndex: 'document-chunks'
});
```

### With Custom S3 Buckets

```typescript
const pdfChunker = new PDFChunkerConstruct(this, 'PDFChunker', {
  incomingBucket: myInputBucket,
  outgoingBucket: myOutputBucket,
  region: 'us-east-1'
});
```

### Advanced Configuration

```typescript
const pdfChunker = new PDFChunkerConstruct(this, 'PDFChunker', {
  incomingBucket: inputBucket,
  outgoingBucket: outputBucket,
  aossCollection: 'enterprise-docs',
  aossIndex: 'processed-content',
  region: 'us-east-1',
  dynamodbTableName: 'document-processing-status',
  vpc: myVpc
});
```

## Configuration

The construct uses a centralized configuration file (`config.json`) with the following sections:

### Bedrock Data Automation

```json
{
  "bedrock_data_automation": {
    "project_name": "pdf-processing-project",
    "project_description": "Automated PDF processing with page and element level granularity",
    "enable_bounding_boxes": true,
    "granularity_types": ["PAGE", "ELEMENT"],
    "enable_generative_fields": true,
    "text_format": "MARKDOWN",
    "additional_file_format": "CSV"
  }
}
```

### OpenSearch Configuration

```json
{
  "opensearch": {
    "collection_type": "VECTORSEARCH",
    "index_name": "pdf-chunks"
  }
}
```

### Step Function Settings

```json
{
  "step_function": {
    "log_retention_days": 7,
    "enable_tracing": true
  }
}
```

## Accessing Components

After instantiation, you can access individual components:

```typescript
// Bedrock Data Automation
const bdaProject = pdfChunker.bedrockDataAutomation;
const projectArn = bdaProject.projectArn;

// Step Function
const stepFunction = pdfChunker.bdaStepFunction;
const stateMachineArn = stepFunction.stateMachine.stateMachineArn;

// OpenSearch
const opensearch = pdfChunker.opensearch;
const collectionEndpoint = opensearch.collection.attrCollectionEndpoint;

// S3 Reader Lambda
const s3Reader = pdfChunker.s3ReaderLambda;
const lambdaArn = s3Reader.functionArn;

// Processing Status Table
const statusTable = pdfChunker.processingTable;
const tableName = statusTable.tableName;
```

## Processing Workflow

1. **Document Upload**: PDF files uploaded to input S3 bucket
2. **BDA Processing**: Bedrock Data Automation processes documents
3. **Content Extraction**: Text, metadata, and structure extracted
4. **Vector Indexing**: Content indexed in OpenSearch for search
5. **Status Tracking**: Processing status updated in DynamoDB
6. **Output Storage**: Processed results stored in output S3 bucket

## Monitoring and Debugging

### CloudWatch Logs
- Step Function execution logs
- Lambda function logs
- BDA processing logs

### X-Ray Tracing
- End-to-end request tracing
- Performance analysis
- Error debugging

### DynamoDB Status Tracking
- Job status monitoring
- Processing metrics
- Error tracking

## Security

### IAM Roles
- Least privilege access
- Service-specific roles
- CDK NAG compliance

### Encryption
- S3 server-side encryption
- DynamoDB encryption at rest
- OpenSearch encryption

### Network Security
- VPC support
- Security group configuration
- Private endpoint options

## Cost Optimization

- **Pay-per-use**: Serverless architecture
- **Managed Services**: Reduced operational overhead
- **Efficient Processing**: BDA native capabilities
- **Resource Right-sizing**: Optimized Lambda configurations

## Troubleshooting

### Common Issues

1. **BDA Project Creation Fails**
   - Check IAM permissions for Bedrock Data Automation
   - Verify region availability for BDA service

2. **OpenSearch Access Denied**
   - Verify data access policies
   - Check IAM role permissions

3. **Step Function Execution Fails**
   - Review CloudWatch logs
   - Check X-Ray traces for detailed error information

### Debug Mode

Enable detailed logging by setting environment variables:

```typescript
const pdfChunker = new PDFChunkerConstruct(this, 'PDFChunker', {
  // ... other props
});

// Access S3 Reader Lambda and add debug environment
pdfChunker.s3ReaderLambda.addEnvironment('DEBUG', 'true');
pdfChunker.s3ReaderLambda.addEnvironment('LOG_LEVEL', 'DEBUG');
```

## Examples

See the `test-refactored-construct.ts` file for a complete example of how to instantiate and test the construct.

## Dependencies

- AWS CDK v2
- AWS Bedrock Data Automation
- Amazon OpenSearch Serverless
- AWS Step Functions
- Amazon DynamoDB
- AWS Lambda

## License

Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0
