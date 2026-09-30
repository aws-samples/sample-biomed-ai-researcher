// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

interface ApiGatewayConstructProps {
  userPool: cognito.UserPool;
}

export class ApiGatewayConstruct extends Construct {
  public readonly api: apigateway.RestApi;
  private readonly cognitoAuthorizer: apigateway.CognitoUserPoolsAuthorizer;

  constructor(scope: Construct, id: string, props: ApiGatewayConstructProps) {
    super(scope, id);

    // Create CloudWatch log group for API Gateway
    const logGroup = new logs.LogGroup(this, 'ApiLogGroup', {
logGroupName: `/aws/apigateway/LiteratureCurationApi-${cdk.Stack.of(this).stackName}`,
retention: logs.RetentionDays.ONE_WEEK, // Cost optimization
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create Cognito User Pool Authorizer
    this.cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      'CognitoAuthorizer',
      {
        cognitoUserPools: [props.userPool],
        identitySource: 'method.request.header.Authorization',
        authorizerName: 'LiteratureCurationCognitoAuthorizer',
        resultsCacheTtl: cdk.Duration.minutes(5),
      }
    );

    // Create the REST API
    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: 'LiteratureCurationApi',
      description: 'API for biomedical literature curation pipeline',
      deployOptions: {
        stageName: 'prod',
        tracingEnabled: true,
        accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: false,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: ['http://localhost:5173', 'https://localhost:5173'],
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
        allowCredentials: true,
      },
    });

    // Add gateway response for authorization errors
    this.api.addGatewayResponse('DEFAULT_AUTH', {
      type: apigateway.ResponseType.UNAUTHORIZED,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'http://localhost:5173'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Security-Token'",
        'Access-Control-Allow-Credentials': "'true'",
      },
    });
  }

  public addResourceToPost(resourceName: string, lambdaFunction: lambda.Function, method: string = 'POST'): void {
    const resource = this.api.root.addResource(resourceName);
    const integration = new apigateway.LambdaIntegration(lambdaFunction, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'http://localhost:5173'",
            'method.response.header.Access-Control-Allow-Credentials': "'true'",
          },
        },
      ],
    });

    resource.addMethod(method, integration, {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: this.cognitoAuthorizer,
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Credentials': true,
          },
        },
      ],
    });
  }

  public addResourceToGet(resourceName: string, lambdaFunction: lambda.Function, method: string = 'GET'): void {
    const resource = this.api.root.addResource(resourceName);
    const integration = new apigateway.LambdaIntegration(lambdaFunction, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'http://localhost:5173'",
            'method.response.header.Access-Control-Allow-Credentials': "'true'",
          },
        },
      ],
    });

    resource.addMethod(method, integration, {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: this.cognitoAuthorizer,
      requestParameters: {
        'method.request.querystring.id': false,
        'method.request.querystring.filter': false,
      },
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Credentials': true,
          },
        },
      ],
    });
  }

  public addResourceForList(resourceName: string, method: string = 'GET'): void {
    const resource = this.api.root.addResource(resourceName);
    
    // Mock integration for static list responses
    const integration = new apigateway.MockIntegration({
      integrationResponses: [
        {
          statusCode: '200',
          responseTemplates: {
            'application/json': JSON.stringify({
              genes: ['BRCA1', 'BRCA2', 'TP53', 'EGFR'],
              conditions: ['breast cancer', 'lung cancer', 'diabetes', 'hypertension'],
            }),
          },
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'http://localhost:5173'",
            'method.response.header.Access-Control-Allow-Credentials': "'true'",
          },
        },
      ],
      requestTemplates: {
        'application/json': '{ "statusCode": 200 }',
      },
    });

    resource.addMethod(method, integration, {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: this.cognitoAuthorizer,
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Credentials': true,
          },
        },
      ],
    });
  }

  public addS3ProxyResource(resourceName: string, lambdaFunction: lambda.Function): void {
    const resource = this.api.root.addResource(resourceName);
    const integration = new apigateway.LambdaIntegration(lambdaFunction, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'http://localhost:5173'",
            'method.response.header.Access-Control-Allow-Credentials': "'true'",
          },
        },
      ],
    });

    // Add methods for S3 operations
    const methodOptions = {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: this.cognitoAuthorizer,
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Credentials': true,
          },
        },
      ],
    };

    resource.addMethod('GET', integration, methodOptions);
    resource.addMethod('POST', integration, methodOptions);
    resource.addMethod('PUT', integration, methodOptions);
    resource.addMethod('DELETE', integration, methodOptions);

    // Add proxy resource for object keys
    const proxyResource = resource.addResource('{key+}');
    proxyResource.addMethod('GET', integration, methodOptions);
    proxyResource.addMethod('POST', integration, methodOptions);
    proxyResource.addMethod('PUT', integration, methodOptions);
    proxyResource.addMethod('DELETE', integration, methodOptions);

    // Add presigned URL endpoint
    const presignedResource = resource.addResource('presigned');
    presignedResource.addMethod('GET', integration, methodOptions);
  }

  public addUIStorageResource(resourceName: string, lambdaFunction: lambda.Function): void {
    const resource = this.api.root.addResource(resourceName);
    const integration = new apigateway.LambdaIntegration(lambdaFunction, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'http://localhost:5173'",
            'method.response.header.Access-Control-Allow-Credentials': "'true'",
          },
        },
      ],
    });

    const methodOptions = {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: this.cognitoAuthorizer,
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Credentials': true,
          },
        },
      ],
    };

    // Root resource methods
    resource.addMethod('GET', integration, methodOptions);
    resource.addMethod('POST', integration, methodOptions);

    // ID-based resource
    const idResource = resource.addResource('{id}');
    idResource.addMethod('GET', integration, methodOptions);
    idResource.addMethod('PUT', integration, methodOptions);
    idResource.addMethod('DELETE', integration, methodOptions);
  }
}
