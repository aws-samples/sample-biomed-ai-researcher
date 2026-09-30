// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as cdk from 'aws-cdk-lib';
import { RemovalPolicy } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';

interface CognitoConstructProps {
  buckets: s3.Bucket[];
  appName: string;
  environment: string;
}

export class CognitoConstruct extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly identityPool: cognito.CfnIdentityPool;

  constructor(scope: Construct, id: string, props: CognitoConstructProps) {
    super(scope, id);

    // Create User Pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${props.appName}-${props.environment}-user-pool`,
      selfSignUpEnabled: true,
      signInAliases: {
        username: true,
      },
      accountRecovery: cognito.AccountRecovery.NONE,
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      removalPolicy: RemovalPolicy.DESTROY,
      deletionProtection: false,
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: true,
        otp: true,
      },
    });

    // Create default users and groups
    const userGroups = [
      { group: 'admin', users: ['admin-user'] },
      { group: 'researcher', users: ['researcher-user'] },
    ];

    userGroups.forEach((element) => {
      const userPoolGroup = new cognito.CfnUserPoolGroup(
        this,
        `UserGroup${element.group}`,
        {
          groupName: element.group,
          userPoolId: this.userPool.userPoolId,
        }
      );

      element.users.forEach((username) => {
        const user = new cognito.CfnUserPoolUser(this, `${username}`, {
          userPoolId: this.userPool.userPoolId,
          username: username,
          messageAction: 'SUPPRESS',
          userAttributes: [],
        });

        const userGroupAttachment = new cognito.CfnUserPoolUserToGroupAttachment(
          this,
          `${username}ToGroupAttachment`,
          {
            groupName: element.group,
            username: username,
            userPoolId: this.userPool.userPoolId,
          }
        );

        userGroupAttachment.node.addDependency(userPoolGroup);
        userGroupAttachment.node.addDependency(user);
      });
    });

    // Create User Pool Client
    this.userPoolClient = new cognito.UserPoolClient(
      this,
      'UserPoolClient',
      {
        userPool: this.userPool,
        userPoolClientName: `${props.appName}-${props.environment}-user-pool-client`,
        generateSecret: false,
        authFlows: {
          adminUserPassword: true,
          userPassword: true,
          userSrp: true,
          custom: true,
        },
        refreshTokenValidity: cdk.Duration.days(30),
        accessTokenValidity: cdk.Duration.hours(1),
        idTokenValidity: cdk.Duration.hours(1),
        preventUserExistenceErrors: true,
      }
    );

    // Create Identity Pool
    this.identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
      identityPoolName: `${props.appName}-${props.environment}-identity-pool`,
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: this.userPoolClient.userPoolClientId,
          providerName: this.userPool.userPoolProviderName,
        },
      ],
    });

    // Create authenticated role
    const authenticatedRole = this.buildAuthenticatedRole(props.buckets);

    // Attach role to identity pool
    new cognito.CfnIdentityPoolRoleAttachment(
      this,
      'IdentityPoolRoleAttachment',
      {
        identityPoolId: this.identityPool.ref,
        roles: {
          authenticated: authenticatedRole.roleArn,
        },
      }
    );

    // Add NAG suppressions
    NagSuppressions.addResourceSuppressions(this.userPool, [
      {
        id: 'AwsSolutions-COG3',
        reason: 'Advanced security features not required for this prototype environment',
      },
    ]);

    NagSuppressions.addResourceSuppressions(
      this.userPool,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'SMS role automatically created by Cognito for MFA',
          appliesTo: ['Resource::*'],
        },
      ],
      true
    );
  }

  private buildAuthenticatedRole(buckets: s3.Bucket[]): iam.Role {
    const role = new iam.Role(this, 'AuthenticatedRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });

    // Grant S3 permissions for file operations
    buckets.forEach((bucket) => {
      role.addToPolicy(
        new iam.PolicyStatement({
          actions: [
            's3:GetObject',
            's3:PutObject',
            's3:DeleteObject',
            's3:ListBucket',
          ],
          resources: [bucket.bucketArn, `${bucket.bucketArn}/*`],
          conditions: {
            StringEquals: {
              'aws:RequestedRegion': cdk.Stack.of(this).region,
            },
          },
        })
      );
    });

    return role;
  }
}