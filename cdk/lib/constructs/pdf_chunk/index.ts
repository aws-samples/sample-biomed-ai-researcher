// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// Main PDF Chunker construct with modern BDA-based architecture
export {
  PDFChunkerConstruct,
  PDFChunkerConstructProps
} from './pdf-chunker-construct';

// Self-contained constructs for standalone usage
export {
  BedrockDataAutomationConstruct
} from './bedrock-data-automation-construct';

export {
  BdaStepFunctionConstruct
} from './bda-step-function-construct';

export {
  OpenSearchVectorConstruct,
  OpenSearchKeywordConstruct
} from './opensearch-construct';
