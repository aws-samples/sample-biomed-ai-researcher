// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as fs from 'fs';

export interface LambdaConfig {
  name: string;
  description: string;
  type: string;
  deployment_vpc: string;
  runtime: string;
  env: { [key: string]: string };
  handler: string;
  path: string;
  memory: number;
  timeout: number;
}

export interface S3BucketsConfig {
  s3_source_bucket: string;
  s3_target_bucket: string;
  s3_llm_bucket: string;
}

export interface OpenSearchConfig {
  index_name: string;
  collection_name: string;
}

export interface DynamoDBTableConfig {
  TableName: string;
  PrimaryKey: string;
  SecondaryKey?: string;
}

export interface DynamoDBConfig {
  DocumentIndex: DynamoDBTableConfig;
  Prompts: DynamoDBTableConfig;
  UIStorage: DynamoDBTableConfig;
}

export interface Configuration {
  appname: string;
  region: string;
  VPCCIDR: string;
  VPC_PRIVACY: string;
  MAXAZs: number;
  VPCID: string | null;
  VPCSecurityGroup: string | null;
  opensearch: OpenSearchConfig;
  s3_buckets: S3BucketsConfig;
  lambdas: {
    upload_file: LambdaConfig;
    s3_trigger: LambdaConfig;
    filter: LambdaConfig;
    identify_biomarkers: LambdaConfig;
    identify_outcomes: LambdaConfig;
    summary: LambdaConfig;
    dynamo_data: LambdaConfig;
    s3_get_data: LambdaConfig;
    s3_proxy: LambdaConfig;
    ui_storage_crud: LambdaConfig;
  };
  DynamoDB: DynamoDBConfig;
}

export function loadConfiguration(path: string = './configuration.json'): Configuration {
  const configData = fs.readFileSync(path, 'utf8');
  return JSON.parse(configData) as Configuration;
}
