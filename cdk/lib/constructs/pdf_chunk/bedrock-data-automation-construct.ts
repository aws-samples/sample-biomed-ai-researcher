// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import { Aws } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as iam from 'aws-cdk-lib/aws-iam';
import { md5hash } from 'aws-cdk-lib/core/lib/helpers-internal';

/**
 * Properties for creating a Bedrock Data Automation construct using the native CfnDataAutomationProject.
 */
export interface BedrockDataAutomationConstructProps {
  /**
   * S3 bucket for input PDF documents
   * If not provided, a new bucket will be created
   */
  inputBucket?: s3.IBucket;

  /**
   * S3 bucket for processed output
   * If not provided, a new bucket will be created
   */
  outputBucket?: s3.IBucket;

  /**
   * Project name for the Bedrock Data Automation project
   * Must match pattern: ^[a-zA-Z0-9-_]+$
   * @default 'pdf-processing-project'
   */
  projectName?: string;

  /**
   * Project description
   * @default 'Automated PDF processing with page and element level granularity'
   */
  projectDescription?: string;

  /**
   * Whether to enable bounding box extraction
   * @default true
   */
  enableBoundingBoxes?: boolean;

  /**
   * Document extraction granularity types
   * Common values: ['DOCUMENT', 'PAGE', 'ELEMENT', 'WORD', 'LINE']
   * @default ['PAGE', 'ELEMENT']
   */
  granularityTypes?: string[];

  /**
   * Whether to enable generative field descriptions
   * @default true
   */
  enableGenerativeFields?: boolean;

  /**
   * Text output format type
   * Common values: 'PLAIN_TEXT', 'MARKDOWN', 'HTML'
   * @default 'MARKDOWN'
   */
  textFormat?: string;

  /**
   * Additional file format type
   * Common values: 'CSV', 'XLSX'
   * @default 'CSV'
   */
  additionalFileFormat?: string;

  /**
   * KMS key ID for encryption (optional)
   */
  kmsKeyId?: string;

  /**
   * KMS encryption context (optional)
   */
  kmsEncryptionContext?: { [key: string]: string };

  /**
   * Tags to apply to the project
   */
  tags?: { [key: string]: string };
}

/**
 * A construct that creates a Bedrock Data Automation project using the native AWS CDK CfnDataAutomationProject
 * for processing PDF documents with configurable granularity, bounding boxes, and output formats.
 */
export class BedrockDataAutomationConstruct extends Construct {
  public readonly inputBucket: s3.IBucket;
  public readonly outputBucket: s3.IBucket;
  public readonly dataAutomationProject: bedrock.CfnDataAutomationProject;
  public readonly projectArn: string;
  public readonly projectName: string;

  constructor(scope: Construct, id: string, props: BedrockDataAutomationConstructProps) {
    super(scope, id);

    // Set default values
    this.projectName = props.projectName || 'pdf-processing-project';
    const projectDescription = props.projectDescription || 'Automated PDF processing with page and element level granularity';
    const enableBoundingBoxes = props.enableBoundingBoxes ?? true;
    const granularityTypes = props.granularityTypes || ['PAGE', 'ELEMENT'];
    const enableGenerativeFields = props.enableGenerativeFields ?? true;
    const textFormat = props.textFormat || 'MARKDOWN';
    const additionalFileFormat = props.additionalFileFormat || 'CSV';

    // Validate project name pattern
    if (!/^[a-zA-Z0-9-_]+$/.test(this.projectName)) {
      throw new Error('Project name must match pattern: ^[a-zA-Z0-9-_]+$');
    }

    if (this.projectName.length < 1 || this.projectName.length > 128) {
      throw new Error('Project name must be between 1 and 128 characters');
    }

    // Compute hash used for bucket name
    const hash = md5hash(id + Aws.ACCOUNT_ID + Aws.REGION);

    // Create S3 buckets
    this.inputBucket = this.handleS3Bucket(props.inputBucket, 'input', hash);
    this.outputBucket = this.handleS3Bucket(props.outputBucket, 'output', hash);

    // Create the Bedrock Data Automation project using the native CDK construct
    this.dataAutomationProject = new bedrock.CfnDataAutomationProject(this, 'DataAutomationProject', {
      projectName: this.projectName,
      projectDescription: projectDescription,
      standardOutputConfiguration: {
        document: {
          extraction: {
            granularity: {
              types: granularityTypes
            },
            boundingBox: {
              state: enableBoundingBoxes ? 'ENABLED' : 'DISABLED'
            }
          },
          generativeField: {
            state: enableGenerativeFields ? 'ENABLED' : 'DISABLED'
          },
          outputFormat: {
            textFormat: {
              types: [textFormat]
            },
            additionalFileFormat: {
              state: 'ENABLED'
            }
          }
        }
      },
      kmsKeyId: props.kmsKeyId,
      kmsEncryptionContext: props.kmsEncryptionContext,
      tags: props.tags ? Object.entries(props.tags).map(([key, value]) => ({
        key,
        value
      })) : undefined
    });

    // Set the project ARN
    this.projectArn = this.dataAutomationProject.attrProjectArn;

    // Create IAM role for Bedrock Data Automation to access S3 buckets
    const bedrockDataAutomationRole = new iam.Role(this, 'BedrockDataAutomationRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      description: 'Role for Bedrock Data Automation to access S3 buckets',
      inlinePolicies: {
        S3Access: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:GetObjectVersion'
              ],
              resources: [
                this.inputBucket.arnForObjects('*')
              ]
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:PutObject',
                's3:PutObjectAcl',
                's3:DeleteObject'
              ],
              resources: [
                this.outputBucket.arnForObjects('*')
              ]
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:ListBucket'
              ],
              resources: [
                this.inputBucket.bucketArn,
                this.outputBucket.bucketArn
              ]
            })
          ]
        })
      }
    });

    // Add KMS permissions if KMS key is provided
    if (props.kmsKeyId) {
      bedrockDataAutomationRole.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'kms:Decrypt',
          'kms:GenerateDataKey',
          'kms:DescribeKey'
        ],
        resources: [
          `arn:aws:kms:${Aws.REGION}:${Aws.ACCOUNT_ID}:key/${props.kmsKeyId}`
        ]
      }));
    }

    // Add CDK outputs
    new cdk.CfnOutput(this, 'InputBucketName', {
      value: this.inputBucket.bucketName,
      description: 'S3 bucket for input PDF documents'
    });

    new cdk.CfnOutput(this, 'OutputBucketName', {
      value: this.outputBucket.bucketName,
      description: 'S3 bucket for processed output with configured granularity'
    });

    new cdk.CfnOutput(this, 'DataAutomationProjectArn', {
      value: this.projectArn,
      description: 'ARN of the Bedrock Data Automation project'
    });

    new cdk.CfnOutput(this, 'DataAutomationProjectName', {
      value: this.projectName,
      description: 'Name of the Bedrock Data Automation project'
    });

    new cdk.CfnOutput(this, 'ProcessingCapabilities', {
      value: JSON.stringify({
        granularityTypes: granularityTypes,
        boundingBoxes: enableBoundingBoxes,
        generativeFields: enableGenerativeFields,
        textFormat: textFormat,
        additionalFileFormat: additionalFileFormat
      }),
      description: 'Configured PDF processing capabilities'
    });

    new cdk.CfnOutput(this, 'ProjectStage', {
      value: this.dataAutomationProject.attrProjectStage,
      description: 'Current stage of the Data Automation project'
    });

    new cdk.CfnOutput(this, 'ProjectStatus', {
      value: this.dataAutomationProject.attrStatus,
      description: 'Current status of the Data Automation project'
    });

    new cdk.CfnOutput(this, 'BedrockDataAutomationRoleArn', {
      value: bedrockDataAutomationRole.roleArn,
      description: 'IAM role ARN for Bedrock Data Automation service'
    });
  }

  /**
   * Handles the creation or retrieval of an S3 bucket.
   */
  private handleS3Bucket(existingBucket: s3.IBucket | undefined, type: string, hash: string): s3.IBucket {
    if (existingBucket) {
      return existingBucket;
    }

    // Create server access log bucket
    const serverAccessLogBucket = new s3.Bucket(this, `${hash}-${type}-serveraccesslogbucket`, {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(90),
        },
      ],
    });

    // Create the main bucket
    return new s3.Bucket(this, `${hash}-${type}-bucket`, {
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      serverAccessLogsBucket: serverAccessLogBucket,
      serverAccessLogsPrefix: `${type}-bucket-logs/`,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.POST,
            s3.HttpMethods.PUT,
            s3.HttpMethods.DELETE,
          ],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          exposedHeaders: [
            'x-amz-server-side-encryption',
            'x-amz-request-id',
            'x-amz-id-2',
            'ETag',
            'Content-Type',
            'Content-Disposition',
            'Access-Control-Allow-Origin'
          ],
        },
      ],
    });
  }
}
