// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { S3BucketsConfig, Configuration } from '../configuration';

export class S3Construct extends Construct {
  public readonly bucketList: { [key: string]: s3.Bucket } = {};

  constructor(scope: Construct, id: string, s3Config: S3BucketsConfig, config: Configuration) {
    super(scope, id);

    // Create all buckets defined in the configuration
    for (const [bucketKey, bucketName] of Object.entries(s3Config)) {
      this.bucketList[bucketKey] = this.createBucket(bucketKey, bucketName, config);
    }
  }

  private createBucket(bucketKey: string, bucketName: string, config: Configuration): s3.Bucket {
    // Add CORS for source bucket to allow browser uploads
    const corsRules: s3.CorsRule[] = bucketKey === 's3_source_bucket' ? [
      {
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST, s3.HttpMethods.HEAD],
        allowedOrigins: ['http://localhost:5173', 'https://localhost:5173'],
        allowedHeaders: ['*'],
        exposedHeaders: ['ETag'],
        maxAge: 3000,
      },
    ] : [];

    const bucket = new s3.Bucket(this, `${bucketKey}Bucket`, {
      bucketName: `${config.appname.toLowerCase()}-${bucketName}-${config.region}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: false,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      eventBridgeEnabled: bucketKey === 's3_source_bucket',
      cors: corsRules.length > 0 ? corsRules : undefined,
      lifecycleRules: [
        {
          id: 'DeleteIncompleteMultipartUploads',
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
        {
          id: 'DeleteOldVersions',
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
    });

    return bucket;
  }
}
