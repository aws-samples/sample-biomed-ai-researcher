#!/bin/bash
set -e

STACK_NAME="${1:-LitCuration}"
REGION="${2:-us-east-1}"

echo "Deploying CDK stack..."
cd cdk
cdk deploy

echo ""
echo "Generating frontend config from CDK outputs..."
cd ..
chmod +x scripts/generate-frontend-config.sh
./scripts/generate-frontend-config.sh "$STACK_NAME" "$REGION"

echo ""
echo "Deployment and configuration update complete!"
