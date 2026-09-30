// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import * as fs from 'fs';
import * as path from 'path';

interface BdaStepFunctionConstructProps {
  dataAutomationProjectArn: string;
  outputS3Uri: string;
  dynamodbTableName: string;
  projectName: string;
  s3ReaderLambdaArn: string;
}

export class BdaStepFunctionConstruct extends Construct {
  public readonly stepRole: iam.Role;
  public readonly stateMachine: stepfunctions.StateMachine;
  private stepLogGroup: logs.LogGroup;

  constructor(
    scope: Construct,
    id: string,
    props: BdaStepFunctionConstructProps
  ) {
    super(scope, id);

    const definitionString = this.getStateMachineDefinition();

    this.stepLogGroup = this.createStepLogGroup();

    this.stepRole = new iam.Role(this, 'BdaStepFunctionRole', {
      assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
    });

    // Add Bedrock Data Automation permissions
    const bedrockDataAutomationPolicy = new iam.Policy(this, 'BedrockDataAutomationPolicy', {
      policyName: 'BedrockDataAutomationPolicy',
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'bedrock-data-automation-runtime:InvokeDataAutomationAsync',
            'bedrock-data-automation-runtime:GetDataAutomationStatus',
            'bedrock:InvokeDataAutomationAsync',
            'bedrock:GetDataAutomationStatus',
          ],
          resources: ['*'],
        }),
      ],
    });

    this.stepRole.attachInlinePolicy(bedrockDataAutomationPolicy);

    // Add S3 permissions for input and output buckets
    const s3Policy = new iam.Policy(this, 'BdaS3Policy', {
      policyName: 'BdaS3Policy',
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            's3:GetObject',
            's3:PutObject',
            's3:ListBucket',
          ],
          resources: ['*'], // Will be restricted based on actual bucket ARNs in implementation
        }),
      ],
    });

    this.stepRole.attachInlinePolicy(s3Policy);

    // Add DynamoDB permissions
    const dynamodbPolicy = new iam.Policy(this, 'BdaDynamoDBPolicy', {
      policyName: 'BdaDynamoDBPolicy',
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'dynamodb:PutItem',
            'dynamodb:UpdateItem',
            'dynamodb:GetItem',
            'dynamodb:Query',
          ],
          resources: [
            `arn:aws:dynamodb:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:table/${props.dynamodbTableName}`,
            `arn:aws:dynamodb:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:table/${props.dynamodbTableName}/index/*`,
          ],
        }),
      ],
    });

    this.stepRole.attachInlinePolicy(dynamodbPolicy);

    // Add XRay tracing permissions
    const stepXrayPolicy = new iam.Policy(this, 'BdaStepFunctionXRayPolicy', {
      policyName: 'BdaStepXRayPolicy',
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'xray:PutTraceSegments',
            'xray:PutTelemetryRecords',
            'xray:GetSamplingRules',
            'xray:GetSamplingTargets',
          ],
          resources: ['*'],
        }),
      ],
    });

    this.stepRole.attachInlinePolicy(stepXrayPolicy);

    // Add CloudWatch Logs permissions
    const logPolicy = new iam.Policy(this, 'BdaStepFunctionLogGroupPolicy', {
      policyName: 'BdaStepLogGroupPolicy',
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'logs:CreateLogDelivery',
            'logs:CreateLogStream',
            'logs:GetLogDelivery',
            'logs:UpdateLogDelivery',
            'logs:DeleteLogDelivery',
            'logs:ListLogDeliveries',
            'logs:PutLogEvents',
            'logs:PutResourcePolicy',
            'logs:DescribeResourcePolicies',
            'logs:DescribeLogGroups',
          ],
          resources: ['*'],
        }),
      ],
    });
    this.stepRole.attachInlinePolicy(logPolicy);

    // Add Lambda invocation permissions for S3 Reader
    const lambdaPolicy = new iam.Policy(this, 'BdaLambdaPolicy', {
      policyName: 'BdaLambdaPolicy',
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'lambda:InvokeFunction',
          ],
          resources: [props.s3ReaderLambdaArn],
        }),
      ],
    });

    this.stepRole.attachInlinePolicy(lambdaPolicy);

    this.stateMachine = new stepfunctions.StateMachine(
      this,
      'BdaStateMachine',
      {
        role: this.stepRole,
        definitionBody: stepfunctions.DefinitionBody.fromString(definitionString),
        definitionSubstitutions: {
          data_automation_profile_arn: `arn:aws:bedrock:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:data-automation-profile/us.data-automation-v1`,
          data_automation_project_arn: props.dataAutomationProjectArn,
          output_s3_uri: props.outputS3Uri,
          dynamodb_table_name: props.dynamodbTableName,
          project_name: props.projectName,
          s3_reader_lambda_arn: props.s3ReaderLambdaArn,
        },
        logs: {
          destination: this.stepLogGroup,
          level: stepfunctions.LogLevel.ALL,
          includeExecutionData: true,
        },
        tracingEnabled: true,
      }
    );

    // Add CDK Nag suppressions
    NagSuppressions.addResourceSuppressions(
      bedrockDataAutomationPolicy,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Bedrock Data Automation Runtime requires wildcard permissions for project and invocation management',
          appliesTo: ['Resource::*'],
        },
      ],
      true
    );

    NagSuppressions.addResourceSuppressions(
      s3Policy,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'S3 permissions will be restricted to specific buckets in implementation',
          appliesTo: ['Resource::*'],
        },
      ],
      true
    );

    NagSuppressions.addResourceSuppressions(
      stepXrayPolicy,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Wildcard resource permissions appropriate here for XRay policy',
          appliesTo: ['Resource::*'],
        },
      ],
      true
    );

    NagSuppressions.addResourceSuppressions(
      logPolicy,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Wildcard resource permissions appropriate here for Logging policy',
          appliesTo: ['Resource::*'],
        },
      ],
      true
    );

    NagSuppressions.addResourceSuppressions(
      this.stepRole,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Wildcard resource permissions appropriate here for resource policy',
          appliesTo: ['Resource::*'],
        },
      ],
      true
    );
  }

  private createStepLogGroup(): logs.LogGroup {
    return new logs.LogGroup(this, 'BdaLogGroup', {
      logGroupName: '/aws/stepfunctions/BdaStateMachine',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }

  private getStateMachineDefinition(): string {
    // Read the step function definition from the JSON file
    const definitionPath = path.join(__dirname, 'bda_step', 'bda_step.def.json');

    try {
      const definitionContent = fs.readFileSync(definitionPath, 'utf8');
      const definition = JSON.parse(definitionContent);

      // Replace hardcoded values with substitution placeholders
      if (definition.States?.InvokeDataAutomationAsync?.Arguments) {
        const args = definition.States.InvokeDataAutomationAsync.Arguments;

        // Replace DataAutomationProfileArn with substitution
        if (args.DataAutomationProfileArn) {
          args.DataAutomationProfileArn = '${data_automation_profile_arn}';
        }

        // Replace DataAutomationProjectArn with substitution
        if (args.DataAutomationConfiguration?.DataAutomationProjectArn) {
          args.DataAutomationConfiguration.DataAutomationProjectArn = '${data_automation_project_arn}';
        }

        // Replace OutputConfiguration S3Uri with substitution
        if (args.OutputConfiguration?.S3Uri) {
          args.OutputConfiguration.S3Uri = '${output_s3_uri}';
        }
      }

      return JSON.stringify(definition, null, 2);
    } catch (error) {
      console.error('Error reading BDA step function definition:', error);
      throw new Error(`Failed to read BDA step function definition: ${error}`);
    }
  }
}
