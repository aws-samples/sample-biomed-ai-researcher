// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { Configuration } from '../configuration';
import { NagSuppressions } from 'cdk-nag';

export class VpcConstruct extends Construct {
  public readonly vpc: ec2.IVpc;

  constructor(scope: Construct, id: string, config: Configuration) {
    super(scope, id);

    if (config.VPCID) {
      // Use existing VPC
      this.vpc = ec2.Vpc.fromLookup(this, 'ExistingVpc', {
        vpcId: config.VPCID,
      });
    } else {
      // Create new VPC
      this.vpc = new ec2.Vpc(this, 'Vpc', {
        ipAddresses: ec2.IpAddresses.cidr(config.VPCCIDR),
        maxAzs: config.MAXAZs,
        subnetConfiguration: [
          {
            cidrMask: 24,
            name: 'public',
            subnetType: ec2.SubnetType.PUBLIC,
          },
          {
            cidrMask: 24,
            name: 'private-with-egress',
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          },
        ],
        natGateways: 1, // Cost optimization - single NAT gateway
        enableDnsHostnames: true,
        enableDnsSupport: true,
      });

      // Add VPC Flow Logs for CDK Nag compliance
      this.addVpcFlowLogs();
    }
  }

  private addVpcFlowLogs(): void {
    // Create CloudWatch Log Group for VPC Flow Logs
    const flowLogGroup = new logs.LogGroup(this, 'VpcFlowLogGroup', {
logGroupName: `/aws/vpc/flowlogs/${cdk.Stack.of(this).stackName}`,
retention: logs.RetentionDays.ONE_WEEK, // Cost optimization
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create IAM role for VPC Flow Logs
    const flowLogRole = new iam.Role(this, 'VpcFlowLogRole', {
      assumedBy: new iam.ServicePrincipal('vpc-flow-logs.amazonaws.com'),
      inlinePolicies: {
        FlowLogDeliveryRolePolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
                'logs:DescribeLogGroups',
                'logs:DescribeLogStreams',
              ],
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    // Create VPC Flow Log
    new ec2.FlowLog(this, 'VpcFlowLog', {
      resourceType: ec2.FlowLogResourceType.fromVpc(this.vpc as ec2.Vpc),
      destination: ec2.FlowLogDestination.toCloudWatchLogs(flowLogGroup, flowLogRole),
      trafficType: ec2.FlowLogTrafficType.ALL,
    });

    // Add CDK Nag suppressions for VPC Flow Log role
    NagSuppressions.addResourceSuppressions(
      flowLogRole,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Wildcard permissions required for VPC Flow Logs to write to CloudWatch Logs',
          appliesTo: ['Resource::*'],
        },
      ],
      true
    );
  }
}
