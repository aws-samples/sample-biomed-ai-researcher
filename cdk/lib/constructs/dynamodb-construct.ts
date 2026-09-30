// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class DynamoDBConstruct extends Construct {
  public readonly table: dynamodb.Table;

  constructor(
    scope: Construct,
    tableName: string,
    primaryKey: string,
    secondaryKey?: string
  ) {
    super(scope, `${tableName}Table`);

    let tableProps: dynamodb.TableProps = {
      tableName: tableName,
      partitionKey: {
        name: primaryKey,
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    };

    // Add sort key if provided
    if (secondaryKey) {
      tableProps = {
        ...tableProps,
        sortKey: {
          name: secondaryKey,
          type: dynamodb.AttributeType.STRING,
        },
      };
    }

    this.table = new dynamodb.Table(this, 'Table', tableProps);
  }
}
