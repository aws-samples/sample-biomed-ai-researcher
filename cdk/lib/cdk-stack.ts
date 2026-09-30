// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';
import { Configuration } from './configuration';
import { VpcConstruct } from './constructs/vpc-construct';
import { S3Construct } from './constructs/s3-construct';
import { DynamoDBConstruct } from './constructs/dynamodb-construct';
import { StepFunctionConstruct } from './constructs/step-function-construct';
import { ApiGatewayConstruct } from './constructs/api-gateway-construct';
import { CognitoConstruct } from './constructs/cognito-construct';
import { buildLambda } from './constructs/lambda-util';
import { suppressNags } from './constructs/nag-remediation';
import { PDFChunkerConstruct } from './constructs/pdf_chunk/pdf-chunker-construct';
import { EventbridgeToLambda } from '@aws-solutions-constructs/aws-eventbridge-lambda';
import { NagSuppressions } from 'cdk-nag';

export class CdkStack extends cdk.Stack {
  private vpc: VpcConstruct;
  private s3Buckets: S3Construct;
  private chunker: PDFChunkerConstruct;
  private docIndexDynamodbTable: DynamoDBConstruct;
  private promptsDynamodbTable: DynamoDBConstruct;
  private uiStorageDynamodbTable: DynamoDBConstruct;
  private masterStepFunction: StepFunctionConstruct;
  private apiGateway: ApiGatewayConstruct;
  private cognito: CognitoConstruct;

  // Lambda functions
  private s3UploadLambda: [cdk.aws_lambda.Function, iam.Role];
  private s3TriggerLambda: [cdk.aws_lambda.Function, iam.Role];
  private filterLambda: [cdk.aws_lambda.Function, iam.Role];
  private biomarkerLambda: [cdk.aws_lambda.Function, iam.Role];
  private outcomesLambda: [cdk.aws_lambda.Function, iam.Role];
  private summaryLambda: [cdk.aws_lambda.Function, iam.Role];
  private dynamoData: [cdk.aws_lambda.Function, iam.Role];
  private s3GetData: [cdk.aws_lambda.Function, iam.Role];
  private s3Proxy: [cdk.aws_lambda.Function, iam.Role];
  private uiStorageCrud: [cdk.aws_lambda.Function, iam.Role];

  private eventbridge: EventbridgeToLambda;

  constructor(scope: Construct, id: string, config: Configuration, props?: cdk.StackProps) {
    super(scope, id, props);

    this.buildIt(config);
    this.grantAccess();
    this.addOutputs();
    suppressNags(this);
  }

  private buildIt(config: Configuration): void {
    // Create VPC
    this.vpc = new VpcConstruct(this, 'VPC', config);

    // Create S3 buckets
    this.s3Buckets = new S3Construct(this, 'Storage', config.s3_buckets, config);

    // Create PDF Chunker construct
    this.chunker = new PDFChunkerConstruct(this, 'Chunker', {
      incomingBucket: this.s3Buckets.bucketList['s3_source_bucket'],
      outgoingBucket: this.s3Buckets.bucketList['s3_target_bucket'],
      targetBucket: this.s3Buckets.bucketList['s3_target_bucket'],  // Where fulltext.json goes for downstream lambdas
      aossCollection: config.opensearch.collection_name,
      aossIndex: config.opensearch.index_name,
      region: config.region,
      vpc: this.vpc.vpc,
    });

    // Create DynamoDB tables
    this.docIndexDynamodbTable = new DynamoDBConstruct(
      this,
      config.DynamoDB.DocumentIndex.TableName,
      config.DynamoDB.DocumentIndex.PrimaryKey,
      config.DynamoDB.DocumentIndex.SecondaryKey
    );

    this.promptsDynamodbTable = new DynamoDBConstruct(
      this,
      config.DynamoDB.Prompts.TableName,
      config.DynamoDB.Prompts.PrimaryKey,
      config.DynamoDB.Prompts.SecondaryKey
    );

    this.uiStorageDynamodbTable = new DynamoDBConstruct(
      this,
      config.DynamoDB.UIStorage.TableName,
      config.DynamoDB.UIStorage.PrimaryKey,
      config.DynamoDB.UIStorage.SecondaryKey
    );

    // Build Lambda functions
    this.buildLambdas(config);

    // Create substitutions for the step function
    const substitutions = {
      chunker_state_machine: this.chunker.bdaStepFunction.stateMachine.stateMachineArn,
      filter_lambda: this.filterLambda[0].functionArn,
      biomarker_lambda: this.biomarkerLambda[0].functionArn,
      summary_lambda: this.summaryLambda[0].functionArn,
      outcome_lambda: this.outcomesLambda[0].functionArn,
    };

    // Create master step function
    this.masterStepFunction = new StepFunctionConstruct(this, 'MainStep', substitutions);

    // Configure S3 trigger lambda environment variables
    const s3TriggerConfig = { ...config.lambdas.s3_trigger };
    s3TriggerConfig.env['REGION'] = config.region;
    s3TriggerConfig.env['DYNAMODB_TABLE'] = this.docIndexDynamodbTable.table.tableName;
    s3TriggerConfig.env['STATE_MACHINE'] = this.masterStepFunction.stateMachine.stateMachineArn;
    this.s3TriggerLambda = buildLambda(this, s3TriggerConfig, this.vpc.vpc);

    // Create Cognito construct
    this.cognito = new CognitoConstruct(this, 'Cognito', {
      buckets: Object.values(this.s3Buckets.bucketList),
      appName: config.appname,
      environment: 'prod',
    });

    // Update Lambda environment variables with Cognito User Pool ID
    this.s3Proxy[0].addEnvironment('COGNITO_USER_POOL_ID', this.cognito.userPool.userPoolId);
    this.uiStorageCrud[0].addEnvironment('COGNITO_USER_POOL_ID', this.cognito.userPool.userPoolId);

    // Create API Gateway with Cognito authentication
    this.apiGateway = new ApiGatewayConstruct(this, 'ApiGateway', {
      userPool: this.cognito.userPool,
    });

    // Add API Gateway resources
    this.apiGateway.addResourceToPost('document', this.s3UploadLambda[0], 'POST');
    this.apiGateway.addResourceToGet('document_metadata', this.dynamoData[0], 'GET');
    this.apiGateway.addResourceToGet('document_data', this.s3GetData[0], 'GET');
    this.apiGateway.addResourceForList('genes-conditions', 'GET');

    // Add S3 proxy endpoints
    this.apiGateway.addS3ProxyResource('s3', this.s3Proxy[0]);
    
    // Add UI storage CRUD endpoints
    this.apiGateway.addUIStorageResource('ui-storage', this.uiStorageCrud[0]);

    // Create EventBridge integration
    this.eventbridge = new EventbridgeToLambda(this, 'incomingFileEventBridgeToLambda', {
      existingLambdaObj: this.s3TriggerLambda[0],
      eventRuleProps: {
        eventPattern: {
          source: ['aws.s3'],
          detailType: ['Object Created'],
          detail: {
            bucket: {
              name: [this.s3Buckets.bucketList['s3_source_bucket'].bucketName],
            },
          },
        },
      },
    });
  }

  private buildLambdas(config: Configuration): void {
    // S3 Upload Lambda
    const s3UploadConfig = { ...config.lambdas.upload_file };
    s3UploadConfig.env['S3_TARGET'] = this.s3Buckets.bucketList['s3_source_bucket'].bucketName;
    s3UploadConfig.env['REGION'] = config.region;
    s3UploadConfig.env['DYNAMODB_TABLE'] = this.docIndexDynamodbTable.table.tableName;
    this.s3UploadLambda = buildLambda(this, s3UploadConfig, this.vpc.vpc);

    // Filter Lambda
    const filterConfig = { ...config.lambdas.filter };
    filterConfig.env['REGION'] = config.region;
    filterConfig.env['DYNAMODB_TABLE'] = this.docIndexDynamodbTable.table.tableName;
    filterConfig.env['PROMPT_TABLE'] = this.promptsDynamodbTable.table.tableName;
    filterConfig.env['SOURCE_BUCKET'] = this.s3Buckets.bucketList['s3_target_bucket'].bucketName;
    filterConfig.env['TARGET_BUCKET'] = this.s3Buckets.bucketList['s3_llm_bucket'].bucketName;
    this.filterLambda = buildLambda(this, filterConfig, this.vpc.vpc);

    // Biomarker Lambda
    const biomarkerConfig = { ...config.lambdas.identify_biomarkers };
    biomarkerConfig.env['REGION'] = config.region;
    biomarkerConfig.env['DYNAMODB_TABLE'] = this.docIndexDynamodbTable.table.tableName;
    biomarkerConfig.env['PROMPT_TABLE'] = this.promptsDynamodbTable.table.tableName;
    biomarkerConfig.env['SOURCE_BUCKET'] = this.s3Buckets.bucketList['s3_target_bucket'].bucketName;
    biomarkerConfig.env['TARGET_BUCKET'] = this.s3Buckets.bucketList['s3_llm_bucket'].bucketName;
    this.biomarkerLambda = buildLambda(this, biomarkerConfig, this.vpc.vpc);

    // Outcomes Lambda
    const outcomesConfig = { ...config.lambdas.identify_outcomes };
    outcomesConfig.env['REGION'] = config.region;
    outcomesConfig.env['DYNAMODB_TABLE'] = this.docIndexDynamodbTable.table.tableName;
    outcomesConfig.env['PROMPT_TABLE'] = this.promptsDynamodbTable.table.tableName;
    outcomesConfig.env['SOURCE_BUCKET'] = this.s3Buckets.bucketList['s3_target_bucket'].bucketName;
    outcomesConfig.env['TARGET_BUCKET'] = this.s3Buckets.bucketList['s3_llm_bucket'].bucketName;
    this.outcomesLambda = buildLambda(this, outcomesConfig, this.vpc.vpc);

    // Summary Lambda
    const summaryConfig = { ...config.lambdas.summary };
    summaryConfig.env['REGION'] = config.region;
    summaryConfig.env['DYNAMODB_TABLE'] = this.docIndexDynamodbTable.table.tableName;
    summaryConfig.env['PROMPT_TABLE'] = this.promptsDynamodbTable.table.tableName;
    summaryConfig.env['SOURCE_BUCKET'] = this.s3Buckets.bucketList['s3_target_bucket'].bucketName;
    summaryConfig.env['TARGET_BUCKET'] = this.s3Buckets.bucketList['s3_llm_bucket'].bucketName;
    this.summaryLambda = buildLambda(this, summaryConfig, this.vpc.vpc);

    // DynamoDB Data Lambda
    const dynamoDataConfig = { ...config.lambdas.dynamo_data };
    dynamoDataConfig.env['REGION'] = config.region;
    dynamoDataConfig.env['DYNAMODB_TABLE'] = this.docIndexDynamodbTable.table.tableName;
    this.dynamoData = buildLambda(this, dynamoDataConfig, this.vpc.vpc);

    // S3 Get Data Lambda
    const s3GetDataConfig = { ...config.lambdas.s3_get_data };
    s3GetDataConfig.env['REGION'] = config.region;
    s3GetDataConfig.env['BUCKET_NAME'] = this.s3Buckets.bucketList['s3_llm_bucket'].bucketName;
    // Needed to verify document ownership (owner_sub) before serving results.
    s3GetDataConfig.env['DYNAMODB_TABLE'] = this.docIndexDynamodbTable.table.tableName;
    this.s3GetData = buildLambda(this, s3GetDataConfig, this.vpc.vpc);

    // S3 Proxy Lambda
    const s3ProxyConfig = { ...config.lambdas.s3_proxy };
    s3ProxyConfig.env['REGION'] = config.region;
    s3ProxyConfig.env['S3_BUCKET_NAME'] = this.s3Buckets.bucketList['s3_source_bucket'].bucketName;
    s3ProxyConfig.env['COGNITO_USER_POOL_ID'] = '';
    this.s3Proxy = buildLambda(this, s3ProxyConfig, this.vpc.vpc);

    // UI Storage CRUD Lambda
    const uiStorageCrudConfig = { ...config.lambdas.ui_storage_crud };
    uiStorageCrudConfig.env['REGION'] = config.region;
    uiStorageCrudConfig.env['DYNAMODB_TABLE_NAME'] = this.uiStorageDynamodbTable.table.tableName;
    uiStorageCrudConfig.env['COGNITO_USER_POOL_ID'] = '';
    this.uiStorageCrud = buildLambda(this, uiStorageCrudConfig, this.vpc.vpc);
  }

  private grantAccess(): void {
    // Grant S3 permissions
    this.s3Buckets.bucketList['s3_source_bucket'].grantReadWrite(this.s3UploadLambda[1]);
    this.s3Buckets.bucketList['s3_llm_bucket'].grantReadWrite(this.s3GetData[1]);
    this.s3Buckets.bucketList['s3_source_bucket'].grantReadWrite(this.s3Proxy[1]);
    
    // Grant DynamoDB permissions for UI storage
    this.uiStorageDynamodbTable.table.grantReadWriteData(this.uiStorageCrud[1]);

    // s3GetData needs read access to the document index to verify ownership
    // (owner_sub) before returning analysis results.
    this.docIndexDynamodbTable.table.grantReadData(this.s3GetData[1]);

    // Lambda list for common permissions
    const lambdaList1 = [this.s3UploadLambda[1], this.s3TriggerLambda[1]];
    for (const lambdaRole of lambdaList1) {
      this.docIndexDynamodbTable.table.grantReadWriteData(lambdaRole);
      this.s3Buckets.bucketList['s3_target_bucket'].grantReadWrite(lambdaRole);
      this.s3Buckets.bucketList['s3_source_bucket'].grantReadWrite(lambdaRole);
    }

    // Lambda list for processing functions
    const lambdaList2 = [
      this.filterLambda[1],
      this.outcomesLambda[1],
      this.biomarkerLambda[1],
      this.summaryLambda[1],
      this.dynamoData[1],
    ];
    for (const lambdaRole of lambdaList2) {
      this.docIndexDynamodbTable.table.grantReadWriteData(lambdaRole);
      this.promptsDynamodbTable.table.grantReadWriteData(lambdaRole);
      this.s3Buckets.bucketList['s3_target_bucket'].grantRead(lambdaRole);
      this.s3Buckets.bucketList['s3_llm_bucket'].grantReadWrite(lambdaRole);
    }

    // Grant Bedrock access to processing functions
    const bedrockLambdas = [
      this.filterLambda[1],
      this.outcomesLambda[1],
      this.biomarkerLambda[1],
      this.summaryLambda[1],
    ];
    bedrockLambdas.forEach((lambdaRole, index) => {
      this.grantBedrockAccess(lambdaRole, `Flow${index.toString().padStart(2, '0')}`);
    });

    // Grant Step Function permissions
    this.masterStepFunction.stateMachine.grantStartExecution(this.s3TriggerLambda[1]);
    this.chunker.bdaStepFunction.stateMachine.grantStartExecution(this.masterStepFunction.stepRole);

    // Grant Lambda invoke permissions to Step Function
    this.filterLambda[0].grantInvoke(this.masterStepFunction.stepRole);
    this.outcomesLambda[0].grantInvoke(this.masterStepFunction.stepRole);
    this.biomarkerLambda[0].grantInvoke(this.masterStepFunction.stepRole);
    this.summaryLambda[0].grantInvoke(this.masterStepFunction.stepRole);
  }

  private grantBedrockAccess(grantee: iam.Role, name: string): void {
    const policy = new iam.Policy(this, `${name}BedrockAccess`, {
      document: iam.PolicyDocument.fromJson({
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'VisualEditor0',
            Effect: 'Allow',
            Action: ['bedrock:InvokeModel', 'bedrock:ListFoundationModels'],
            Resource: '*',
          },
        ],
      }),
    });

    grantee.attachInlinePolicy(policy);

    NagSuppressions.addResourceSuppressions(
      policy,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Wildcard permissions appropriate here for Bedrock model access',
          appliesTo: ['Resource::*'],
        },
      ],
      true
    );
  }

  private addOutputs(): void {
    // Cognito outputs for frontend configuration
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.cognito.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.cognito.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: this.cognito.identityPool.ref,
      description: 'Cognito Identity Pool ID',
    });

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: this.apiGateway.api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'Region', {
      value: this.region,
      description: 'AWS Region',
    });

    new cdk.CfnOutput(this, 'SourceBucketName', {
      value: this.s3Buckets.bucketList['s3_source_bucket'].bucketName,
      description: 'S3 Source Bucket Name',
    });
  }
}
