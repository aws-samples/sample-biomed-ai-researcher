# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
"""
User validation module for Lambda functions.
Validates users from API Gateway events using Cognito.
"""

import json
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


class UserValidationError(Exception):
    """Exception raised when user validation fails"""
    pass


def validate_user_from_event(event: Dict[str, Any], user_pool_id: str) -> Dict[str, Any]:
    """
    Validate user from API Gateway event.
    
    Args:
        event: API Gateway event
        user_pool_id: Cognito User Pool ID
        
    Returns:
        User attributes dictionary
        
    Raises:
        UserValidationError: If validation fails
    """
    try:
        # Extract user information from the request context
        request_context = event.get('requestContext', {})
        authorizer = request_context.get('authorizer', {})
        
        # Check if user is authenticated via Cognito
        claims = authorizer.get('claims', {})
        if not claims:
            raise UserValidationError("No user claims found in request")
        
        # Extract user attributes
        user_attributes = {
            'sub': claims.get('sub'),
            'email': claims.get('email'),
            'username': claims.get('cognito:username'),
            'user_pool_id': user_pool_id
        }
        
        # Validate required fields
        if not user_attributes['sub']:
            raise UserValidationError("User sub not found in claims")
            
        logger.info(f"User validated successfully: {user_attributes['username']}")
        return user_attributes
        
    except Exception as e:
        logger.error(f"User validation failed: {str(e)}")
        raise UserValidationError(f"User validation failed: {str(e)}")