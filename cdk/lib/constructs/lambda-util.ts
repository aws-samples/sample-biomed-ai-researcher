// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { LambdaConfig } from '../configuration';
import * as path from 'path';

export function buildLambda(
  scope: Construct,
  lambdaConfig: LambdaConfig,
  vpc: ec2.IVpc
): [lambda.Function, iam.Role] {
  // Create the Lambda execution role
  const role = new iam.Role(scope, `${lambdaConfig.name}Role`, {
    assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    managedPolicies: [
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
    ],
  });

  // Add basic Lambda permissions
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

  // Get runtime from string
  const runtime = getRuntimeFromString(lambdaConfig.runtime);

  // Create the Lambda function
  const lambdaFunction = new lambda.Function(scope, lambdaConfig.name, {
    runtime: runtime,
    handler: lambdaConfig.handler,
    code: lambda.Code.fromAsset(path.join(__dirname, lambdaConfig.path)),
    environment: lambdaConfig.env,
    timeout: cdk.Duration.seconds(lambdaConfig.timeout),
    memorySize: lambdaConfig.memory,
    role: role,
    vpc: vpc,
    vpcSubnets: {
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    },
    description: lambdaConfig.description,
  });

  return [lambdaFunction, role];
}

function getRuntimeFromString(runtimeString: string): lambda.Runtime {
  switch (runtimeString) {
    case 'python3.14':
      return lambda.Runtime.PYTHON_3_14;
    case 'python3.13':
      return lambda.Runtime.PYTHON_3_13;
    case 'python3.12':
      return lambda.Runtime.PYTHON_3_12;
    case 'python3.11':
      return lambda.Runtime.PYTHON_3_11;
    case 'python3.10':
      return lambda.Runtime.PYTHON_3_10;
    case 'python3.9':
      return lambda.Runtime.PYTHON_3_9;
    case 'nodejs18.x':
      return lambda.Runtime.NODEJS_18_X;
    case 'nodejs20.x':
      return lambda.Runtime.NODEJS_20_X;
    default:
      return lambda.Runtime.PYTHON_3_14;
  }
}
