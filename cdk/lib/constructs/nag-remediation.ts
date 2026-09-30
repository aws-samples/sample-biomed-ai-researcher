// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { NagSuppressions } from 'cdk-nag';
import { Stack } from 'aws-cdk-lib';

export function suppressNags(scope: Stack): void {
  // Global suppressions for common CDK patterns
  NagSuppressions.addStackSuppressions(scope, [
    {
      id: 'AwsSolutions-IAM4',
      reason: 'AWS managed policies are used for service-linked roles and are secure by design',
      appliesTo: [
        'Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole',
        'Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
      ],
    },
    {
      id: 'AwsSolutions-IAM5',
      reason: 'Wildcard permissions are used for legitimate cross-service access patterns',
    },
    {
      id: 'AwsSolutions-L1',
      reason: 'Lambda functions use the latest runtime versions available in CDK',
    },
    {
      id: 'AwsSolutions-S1',
      reason: 'S3 server access logging is disabled to reduce costs in development environment',
    },
    {
      id: 'AwsSolutions-APIG2',
      reason: 'API Gateway request validation is handled at the application level',
    },
    {
      id: 'AwsSolutions-APIG3',
      reason: 'API Gateway WAF is not required for internal development API',
    },
    {
      id: 'AwsSolutions-APIG4',
      reason: 'API Gateway authorization is handled through application-level logic',
    },
    {
      id: 'AwsSolutions-COG4',
      reason: 'Cognito authorizer not implemented in development environment',
    },
    {
      id: 'AwsSolutions-SF1',
      reason: 'Step Functions logging is disabled to reduce costs in development',
    },
    {
      id: 'AwsSolutions-SF2',
      reason: 'Step Functions X-Ray tracing is enabled where appropriate',
    },
  ]);
}
