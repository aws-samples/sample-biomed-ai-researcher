// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as fs from 'fs';
import * as path from 'path';

export class StepFunctionConstruct extends Construct {
  public readonly stateMachine: stepfunctions.StateMachine;
  public readonly stepRole: iam.Role;

  constructor(scope: Construct, id: string, substitutions: { [key: string]: string }) {
    super(scope, id);

    // Create the Step Function execution role
    this.stepRole = new iam.Role(this, 'StepFunctionRole', {
      assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
      description: 'Step Function execution role',
    });

    // Add permissions for Lambda invocation
    this.stepRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['lambda:InvokeFunction'],
        resources: ['*'],
      })
    );

    // Add permissions for nested state machine execution.
    // Note: state machine creation/update/deletion is performed by
    // CloudFormation at deploy time using the deployer's credentials, NOT by
    // this execution role at runtime, so those actions are intentionally absent.
    this.stepRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'states:StartExecution',
          'states:DescribeExecution',
          'states:StopExecution',
        ],
        resources: ['*'],
      })
    );

    // Add permissions for EventBridge managed rules
    this.stepRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'events:PutRule',
          'events:PutTargets',
          'events:DeleteRule',
        ],
resources: ['*'],
      })
    );

    // Read the state machine definition
    const definitionJson = fs.readFileSync(
      path.join(__dirname, 'state_machine_def.json'),
      'utf8'
    );

    // Parse the definition with CDK substitutions
    const definition = stepfunctions.DefinitionBody.fromString(definitionJson);

    // Create the state machine with CDK substitutions for Tokens
    this.stateMachine = new stepfunctions.StateMachine(this, 'StateMachine', {
      definitionBody: definition,
      definitionSubstitutions: substitutions,
      role: this.stepRole,
      timeout: cdk.Duration.hours(2),
      tracingEnabled: true,
    });
  }
}
