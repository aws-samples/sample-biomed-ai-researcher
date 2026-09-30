# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
import json
import logging
from typing import Any, Dict

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def create_cors_response(status_code: int, body: Dict[str, Any]) -> Dict[str, Any]:
    """Create a response with proper CORS headers"""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "http://localhost:5173",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Max-Age": "86400",
        },
        "body": json.dumps(body),
    }


def lambda_handler(event, context):
    """
    Lambda handler function for UI Storage CRUD operations.

    DISABLED: This endpoint previously skipped user validation and exposed an
    unscoped table.scan() that returned every user's stored UI state (broken
    access control / OWASP A01). It is unused by the application frontend, so it
    is disabled rather than shipped with broken authorization. Re-enable only
    after implementing per-user ownership (scope all reads/writes to the caller's
    Cognito sub).
    """
    http_method = event.get("httpMethod", "").upper()

    # Still answer CORS preflight so the browser gets a clean response.
    if http_method == "OPTIONS":
        return create_cors_response(200, {"message": "CORS preflight"})

    return create_cors_response(403, {"error": "This endpoint is disabled"})