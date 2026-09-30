#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CdkStack } from '../lib/cdk-stack';
import { loadConfiguration } from '../lib/configuration';
import { AwsSolutionsChecks } from 'cdk-nag';

const config = loadConfiguration();

const app = new cdk.App();
new CdkStack(app, 'LitCuration', config, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: config.region,
  },
});

// Add CDK Nag checks
cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
