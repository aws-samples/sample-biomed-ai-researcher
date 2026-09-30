// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as opensearchserverless from 'aws-cdk-lib/aws-opensearchserverless';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';

interface DataAccessPolicyDocument {
  Rules: Array<{
    ResourceType: string;
    Resource: string[];
    Permission: string[];
  }>;
  Principal: string[];
}

class OpenSearchConstruct extends Construct {
  public readonly collection: opensearchserverless.CfnCollection;
  public readonly managedPolicy: iam.ManagedPolicy;
  public readonly managedCollectionPolicy: iam.ManagedPolicy;
  public readonly collectionName: string;
  private readonly dataAccessPolicyDocument: DataAccessPolicyDocument[] = [];
  private readonly dataAccessPolicy: opensearchserverless.CfnAccessPolicy;

  constructor(
    scope: Construct,
    id: string,
    name: string,
    indexType: string,
    props?: cdk.StackProps
  ) {
    super(scope, id);

    this.collectionName = name.toLowerCase();

    this.collection = new opensearchserverless.CfnCollection(
      this,
      this.collectionName,
      {
        name: this.collectionName.toLowerCase(),
        type: indexType,
      }
    );

    // Create shortened policy names to comply with 32-character AWS limit
    const encryptionPolicyName = `${this.collectionName}-enc-policy`.toLowerCase();
    const networkPolicyName = `${this.collectionName}-net-policy`.toLowerCase();

    const ossEncryptionPolicy = new opensearchserverless.CfnSecurityPolicy(
      this,
      this.collectionName + 'EncryptionPolicy',
      {
        type: 'encryption',
        name: encryptionPolicyName,
        policy: JSON.stringify({
          AWSOwnedKey: true,
          Rules: [
            {
              ResourceType: 'collection',
              Resource: [`collection/${this.collectionName}`],
            },
          ],
        }),
      }
    );

    const ossNetworkPolicy = new opensearchserverless.CfnSecurityPolicy(
      this,
      this.collectionName + 'NetworkPolicy',
      {
        type: 'network',
        name: networkPolicyName,
        policy: JSON.stringify([
          {
            AllowFromPublic: true, // set to False when using vpce
            Rules: [
              {
                ResourceType: 'collection',
                Resource: [`collection/${this.collectionName}`],
              },
              {
                ResourceType: 'dashboard',
                Resource: [`collection/${this.collectionName}`],
              },
            ],
          },
        ]),
      }
    );

    this.collection.addDependency(ossEncryptionPolicy);
    this.collection.addDependency(ossNetworkPolicy);

    const isDataAccessPolicyNotEmpty = new cdk.CfnCondition(
      this,
      'IsDataAccessPolicyNotEmpty',
      {
        expression: cdk.Fn.conditionNot(
          cdk.Fn.conditionEquals(
            0,
            cdk.Lazy.number({
              produce: () => this.dataAccessPolicyDocument.length,
            })
          )
        ),
      }
    );

    // Create shortened data access policy name to comply with 32-character AWS limit
    const dataAccessPolicyName = `${this.collectionName.substring(0,19)}-data-policy`.toLowerCase();

    this.dataAccessPolicy = new opensearchserverless.CfnAccessPolicy(
      this,
      this.collectionName + 'DataAccessPolicy',
      {
        name: dataAccessPolicyName,
        type: 'data',
        policy: cdk.Lazy.string({
          produce: () => JSON.stringify(this.dataAccessPolicyDocument),
        }),
      }
    );
    this.dataAccessPolicy.cfnOptions.condition = isDataAccessPolicyNotEmpty;

    const policy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['aoss:APIAccessAll'],
      resources: [this.collection.attrArn],
    });

    this.managedPolicy = new iam.ManagedPolicy(this, 'AOSSApiAccessAll', {
      statements: [policy],
    });

    const collectionPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'aoss:CreateCollection',
        'aoss:ListCollections',
        'aoss:BatchGetCollection',
        'aoss:UpdateCollection',
      ],
      resources: ['*'],
    });

    this.managedCollectionPolicy = new iam.ManagedPolicy(
      this,
      'AOSSCollectionAccessAll',
      {
        statements: [collectionPolicy],
      }
    );

    NagSuppressions.addResourceSuppressions(
      this.managedCollectionPolicy,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Wildcard permissions appropriate here for collection access',
          appliesTo: ['Resource::*'],
        },
      ],
      true
    );
  }

  public grantAccess(grantees: iam.IRole[]): void {
    const principals: string[] = [];
    for (const grantee of grantees) {
      principals.push(grantee.roleArn);
      grantee.addManagedPolicy(this.managedPolicy);
      grantee.addManagedPolicy(this.managedCollectionPolicy);
    }

    this.dataAccessPolicyDocument.push({
      Rules: [
        {
          ResourceType: 'collection',
          Resource: [`collection/${this.collectionName}`],
          Permission: [
            'aoss:DescribeCollectionItems',
            'aoss:CreateCollectionItems',
            'aoss:UpdateCollectionItems',
            'aoss:DeleteCollectionItems',
          ],
        },
        {
          ResourceType: 'index',
          Resource: [`index/${this.collectionName}/*`],
          Permission: [
            'aoss:CreateIndex',
            'aoss:DeleteIndex',
            'aoss:UpdateIndex',
            'aoss:DescribeIndex',
            'aoss:ReadDocument',
            'aoss:WriteDocument',
          ],
        },
      ],
      Principal: principals,
    });
  }
}

export class OpenSearchVectorConstruct extends OpenSearchConstruct {
  constructor(scope: Construct, id: string, name: string, props?: cdk.StackProps) {
    const collectionName = name;
    const collectionType = 'VECTORSEARCH';

    super(scope, id, collectionName, collectionType, props);
  }
}

export class OpenSearchKeywordConstruct extends OpenSearchConstruct {
  constructor(scope: Construct, id: string, name: string, props?: cdk.StackProps) {
    const collectionName = name;
    const collectionType = 'SEARCH';

    super(scope, id, collectionName, collectionType, props);
  }
}
