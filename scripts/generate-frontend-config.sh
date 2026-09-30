#!/bin/bash
set -e

# Generates front-end/src/config.json from CDK CloudFormation outputs.
# Run this after 'cdk deploy' to wire the frontend to your deployed stack.

STACK_NAME="${1:-LitCuration}"
REGION="${2:-us-east-1}"

echo "Reading outputs from CloudFormation stack: $STACK_NAME in $REGION..."

get_output() {
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" \
    --output text
}

API_ENDPOINT=$(get_output "ApiGatewayUrl")
CLIENT_ID=$(get_output "UserPoolClientId")
IDENTITY_POOL=$(get_output "IdentityPoolId")
USER_POOL=$(get_output "UserPoolId")
BUCKET=$(get_output "SourceBucketName")
STACK_REGION=$(get_output "Region")

# Validate that we got values
if [ -z "$API_ENDPOINT" ] || [ "$API_ENDPOINT" = "None" ]; then
  echo "ERROR: Could not read CDK outputs. Make sure the stack '$STACK_NAME' is deployed."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_PATH="$SCRIPT_DIR/../front-end/src/config.json"

cat > "$CONFIG_PATH" << EOF
{
  "apiEndpoint": "${API_ENDPOINT}",
  "clientId": "${CLIENT_ID}",
  "identityPool": "${IDENTITY_POOL}",
  "userPool": "${USER_POOL}",
  "bucket": "${BUCKET}",
  "region": "${STACK_REGION}"
}
EOF

echo "Frontend config written to: $CONFIG_PATH"
echo ""
echo "  apiEndpoint:  $API_ENDPOINT"
echo "  userPool:     $USER_POOL"
echo "  clientId:     $CLIENT_ID"
echo "  identityPool: $IDENTITY_POOL"
echo "  bucket:       $BUCKET"
echo "  region:       $STACK_REGION"
