// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cdk from 'aws-cdk-lib';
import { NagSuppressions } from 'cdk-nag';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as path from 'path';

// Import the self-contained constructs
import { BedrockDataAutomationConstruct } from './bedrock-data-automation-construct';
import { BdaStepFunctionConstruct } from './bda-step-function-construct';
import { OpenSearchVectorConstruct } from './opensearch-construct';

import jsonData from './config.json';

interface LambdaConfig {
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
  layers: string[];
}

interface LayerConfig {
  name: string;
  runtime: string;
  architecture: string;
  removalPolicy: string;
  description: string;
  path: string;
}

interface BedrockDataAutomationConfig {
  project_name: string;
  project_description: string;
  enable_bounding_boxes: boolean;
  granularity_types: string[];
  enable_generative_fields: boolean;
  text_format: string;
  additional_file_format: string;
}

interface OpenSearchConfig {
  collection_type: string;
  index_name: string;
}

interface StepFunctionConfig {
  log_retention_days: number;
  enable_tracing: boolean;
}

interface Config {
  bedrock_data_automation: BedrockDataAutomationConfig;
  opensearch: OpenSearchConfig;
  step_function: StepFunctionConfig;
  lambdas: {
    s3_reader: LambdaConfig;
  };
  layers: {
    [key: string]: LayerConfig;
  };
}

export interface PDFChunkerConstructProps extends cdk.StackProps {
  incomingBucket?: s3.Bucket;
  outgoingBucket?: s3.Bucket;
  targetBucket?: s3.Bucket;  // Bucket where fulltext.json is written for downstream lambdas
  aossCollection?: string;
  aossIndex?: string;
  vpc?: ec2.IVpc;
  region?: string;
  dynamodbTableName?: string;
}

export class PDFChunkerConstruct extends Construct {
  // New modular constructs
  public bedrockDataAutomation: BedrockDataAutomationConstruct;
  public bdaStepFunction: BdaStepFunctionConstruct;
  public opensearch: OpenSearchVectorConstruct;

  // S3 Reader Lambda for BDA integration
  public s3ReaderLambda: lambda.Function;
  public s3ReaderRole: iam.Role;

  // DynamoDB table for tracking processing status
  public processingTable: dynamodb.Table;

  private readonly config: Config;
  private readonly layers: Map<string, lambda.LayerVersion> = new Map();

  constructor(scope: Construct, id: string, props: PDFChunkerConstructProps) {
    super(scope, id);

    this.config = jsonData as Config;
    const region = props.region || 'us-east-1';

    this.build(
      props.incomingBucket,
      props.outgoingBucket,
      props.targetBucket,
      props.aossCollection,
      props.aossIndex,
      region,
      props.vpc,
      props.dynamodbTableName
    );
  }

  private build(
    incomingBucket?: s3.Bucket,
    outgoingBucket?: s3.Bucket,
    targetBucket?: s3.Bucket,
    aossCollection?: string,
    aossIndex?: string,
    region?: string,
    vpc?: ec2.IVpc,
    dynamodbTableName?: string
  ): void {
    const actualRegion = region || 'us-east-1';

    // Create all layers first
    this.createLayers();

    // Create DynamoDB table for processing status tracking
    this.processingTable = new dynamodb.Table(this, 'ProcessingTable', {
      tableName: dynamodbTableName || 'pdf-processing-status',
      partitionKey: { name: 'jobId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
    });

    // Create Bedrock Data Automation construct
    this.bedrockDataAutomation = new BedrockDataAutomationConstruct(this, 'BedrockDataAutomation', {
      inputBucket: incomingBucket,
      outputBucket: outgoingBucket,
      projectName: this.config.bedrock_data_automation.project_name,
      projectDescription: this.config.bedrock_data_automation.project_description,
      enableBoundingBoxes: this.config.bedrock_data_automation.enable_bounding_boxes,
      granularityTypes: this.config.bedrock_data_automation.granularity_types,
      enableGenerativeFields: this.config.bedrock_data_automation.enable_generative_fields,
      textFormat: this.config.bedrock_data_automation.text_format,
      additionalFileFormat: this.config.bedrock_data_automation.additional_file_format,
    });

    // Create OpenSearch construct for chunk data
    const collectionName = aossCollection || 'pdf-chunks-collection';
    this.opensearch = new OpenSearchVectorConstruct(this, 'ChunkDataOpenSearch', collectionName);

    // Create S3 Reader Lambda for BDA integration
    this.s3ReaderRole = this.createLambdaRole('S3ReaderRole', 'S3 Reader Role for BDA integration');
    const s3ReaderConfig = { ...this.config.lambdas.s3_reader };
    s3ReaderConfig.env['DYNAMODB_TABLE_NAME'] = this.processingTable.tableName;
    s3ReaderConfig.env['OPENSEARCH_COLLECTION'] = collectionName;
    s3ReaderConfig.env['OPENSEARCH_INDEX'] = aossIndex || this.config.opensearch.index_name;
    s3ReaderConfig.env['REGION'] = actualRegion;
    if (targetBucket) {
      s3ReaderConfig.env['TARGET_BUCKET'] = targetBucket.bucketName;
    }

    this.s3ReaderLambda = this.createLambdaFunction(
      's3_reader',
      'S3ReaderFunction',
      this.s3ReaderRole,
      s3ReaderConfig.env
    );

    // Grant permissions to S3 Reader Lambda
    this.bedrockDataAutomation.inputBucket.grantRead(this.s3ReaderRole);
    this.bedrockDataAutomation.outputBucket.grantRead(this.s3ReaderRole);
    if (targetBucket) {
      targetBucket.grantWrite(this.s3ReaderRole);
    }
    this.processingTable.grantReadWriteData(this.s3ReaderRole);
    this.opensearch.grantAccess([this.s3ReaderRole]);

    // Create BDA Step Function construct
    this.bdaStepFunction = new BdaStepFunctionConstruct(this, 'BdaStepFunction', {
      dataAutomationProjectArn: this.bedrockDataAutomation.projectArn,
      outputS3Uri: `s3://${this.bedrockDataAutomation.outputBucket.bucketName}/`,
      dynamodbTableName: this.processingTable.tableName,
      projectName: this.config.bedrock_data_automation.project_name,
      s3ReaderLambdaArn: this.s3ReaderLambda.functionArn,
    });

    // Grant BDA Step Function access to S3 buckets
    this.bedrockDataAutomation.inputBucket.grantRead(this.bdaStepFunction.stepRole);
    this.bedrockDataAutomation.outputBucket.grantReadWrite(this.bdaStepFunction.stepRole);

    // Grant S3 Reader Lambda invoke permission to Step Function
    this.s3ReaderLambda.grantInvoke(this.bdaStepFunction.stepRole);

    // Add CDK Nag suppressions
    this.addNagSuppressions();
  }

  /**
   * Creates all layers defined in the configuration
   */
  private createLayers(): void {
    for (const [layerKey, layerConfig] of Object.entries(this.config.layers)) {
      const layer = this.createLayer(layerKey, layerConfig.name);
      this.layers.set(layerKey, layer);
    }
  }

  /**
   * Creates a Lambda layer with the specified configuration
   */
  private createLayer(layerKey: string, layerId: string): lambda.LayerVersion {
    const layerConfig = this.config.layers[layerKey];

    return new lambda.LayerVersion(this, layerId, {
      removalPolicy: this.getLayerRemovalPolicy(layerConfig.removalPolicy),
      code: lambda.Code.fromAsset(
        path.join(__dirname, layerConfig.path),
        {
          bundling: {
            image: this.getLambdaRuntime(layerConfig.runtime).bundlingImage,
            command: [
              'bash',
              '-c',
              'pip install -r requirements.txt -t /asset-output/python && cp -au . /asset-output/python',
            ],
          },
        },
      ),
      compatibleArchitectures: [
        this.getLambdaArchitecture(layerConfig.architecture),
      ],
      compatibleRuntimes: [this.getLambdaRuntime(layerConfig.runtime)],
      description: layerConfig.description,
    });
  }

  /**
   * Creates an IAM role for Lambda functions with CloudWatch logs permissions
   */
  private createLambdaRole(
    roleId: string,
    description: string
  ): iam.Role {
    const role = new iam.Role(this, roleId, {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description,
    });

    this.addLambdaPermissions(role);
    return role;
  }

  /**
   * Creates a Lambda function with the specified configuration
   */
  private createLambdaFunction(
    functionKey: string,
    functionId: string,
    role: iam.Role,
    additionalEnvironment?: Record<string, string>
  ): lambda.Function {
    const functionConfig = this.config.lambdas[functionKey as keyof typeof this.config.lambdas];
    const environment = {
      ...functionConfig.env,
      ...additionalEnvironment,
    };

    // Use standard zip deployment for S3 Reader function
    const layers = this.mapLayers(functionConfig.layers);
    return new lambda.Function(this, functionId, {
      runtime: this.getLambdaRuntime(functionConfig.runtime),
      handler: functionConfig.handler,
      code: lambda.Code.fromAsset(path.join(__dirname, functionConfig.path)),
      layers,
      environment,
      timeout: Duration.seconds(functionConfig.timeout),
      memorySize: functionConfig.memory,
      role,
      currentVersionOptions: {
        removalPolicy: RemovalPolicy.RETAIN,
        description: 'Latest version',
      },
      architecture: lambda.Architecture.ARM_64,
    });
  }

  /**
   * Maps layer keys to actual layer versions
   */
  private mapLayers(layerKeys: string[]): lambda.LayerVersion[] {
    return layerKeys.map(layerKey => {
      const layer = this.layers.get(layerKey);
      if (!layer) {
        throw new Error(`Unknown layer: ${layerKey}`);
      }
      return layer;
    });
  }

  /**
   * Gets Lambda runtime from string configuration
   */
  private getLambdaRuntime(runtimeString: string): lambda.Runtime {
    switch (runtimeString) {
      case 'PYTHON_3_14':
      case 'python3.14':
        return lambda.Runtime.PYTHON_3_14;
      case 'PYTHON_3_13':
      case 'python3.13':
        return lambda.Runtime.PYTHON_3_13;
      case 'PYTHON_3_12':
      case 'python3.12':
        return lambda.Runtime.PYTHON_3_12;
      default:
        return lambda.Runtime.PYTHON_3_14;
    }
  }

  /**
   * Gets Lambda architecture from string configuration
   */
  private getLambdaArchitecture(architectureString: string): lambda.Architecture {
    switch (architectureString) {
      case 'ARM_64':
        return lambda.Architecture.ARM_64;
      case 'X86_64':
        return lambda.Architecture.X86_64;
      default:
        return lambda.Architecture.ARM_64;
    }
  }

  /**
   * Gets removal policy from string configuration
   */
  private getLayerRemovalPolicy(policyString: string): RemovalPolicy {
    switch (policyString) {
      case 'RETAIN':
        return RemovalPolicy.RETAIN;
      case 'DESTROY':
        return RemovalPolicy.DESTROY;
      default:
        return RemovalPolicy.RETAIN;
    }
  }

  private addLambdaPermissions(role: iam.Role): void {
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: ['*'],
      })
    );

    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'ec2:CreateNetworkInterface',
          'ec2:DescribeNetworkInterfaces',
          'ec2:DeleteNetworkInterface',
        ],
        resources: ['*'],
      })
    );

    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'xray:PutTraceSegments',
          'xray:PutTelemetryRecords',
          'xray:GetSamplingRules',
          'xray:GetSamplingTargets',
          'xray:GetSamplingStatisticSummaries',
        ],
        resources: ['*'],
      })
    );

    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['bedrock:InvokeModel'],
        resources: ['*'],
      })
    );

    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
        resources: ['*'],
      })
    );

    NagSuppressions.addResourceSuppressions(
      role,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Wildcard permissions appropriate here for Lambda execution',
          appliesTo: ['Resource::*'],
        },
      ],
      true
    );
  }

  private addNagSuppressions(): void {
    NagSuppressions.addResourceSuppressions(
      this,
      [
        {
          id: 'AwsSolutions-IAM4',
          reason: 'Permission used in transient Lambda for S3 triggers',
          appliesTo: [
            'Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
          ],
        },
      ],
      true
    );

    // Add suppressions for BDA Step Function lambda invoke permissions
    const stack = cdk.Stack.of(this);

    if (this.s3ReaderLambda) {
      NagSuppressions.addResourceSuppressions(
        this.bdaStepFunction.stepRole,
        [
          {
            id: 'AwsSolutions-IAM5',
            reason: 'Wildcard permissions appropriate here for Step function execution lambda access',
            appliesTo: [
              `Resource::<${stack.getLogicalId(this.s3ReaderLambda.node.defaultChild as cdk.CfnElement)}.Arn>:*`,
            ],
          },
        ],
        true
      );
    }
  }
}
