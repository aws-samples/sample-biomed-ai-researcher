# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
import os
from boto3.session import Session, Config
from boto3 import _get_default_session
from enum import Enum


AWS_REGION = os.getenv("AWS_REGION", "us-east-1")

boto_config = Config(
    read_timeout=900,
    connect_timeout=900,
    region_name=AWS_REGION,
    signature_version="v4",
    retries={"max_attempts": 1, "mode": "standard"},
)


class ModelId(str, Enum):
    """Bedrock model identifiers used by the pipeline.

    These are cross-region inference profile IDs (the "us." prefix). The legacy
    on-demand Claude 3.x model IDs were retired by Bedrock; current Claude models
    are only invokable via inference profiles. Update these to the model(s)
    enabled in your account/region.
    """

    CLAUDE_HAIKU = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
    CLAUDE_SONNET = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
    CLAUDE_OPUS = "us.anthropic.claude-opus-4-5-20251101-v1:0"

    # Backwards-compatible aliases so existing call sites keep working.
    CLAUDE_3_HAIKU = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
    CLAUDE_3_SONNET = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
    CLAUDE_3_OPUS = "us.anthropic.claude-opus-4-5-20251101-v1:0"
    CLAUDE_3_5_SONNET = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"


def get_bedrock_client(
    region: str = AWS_REGION, profile: str | None = None
):
    """Get a Bedrock client."""
    session: Session

    if profile is None:
        session = _get_default_session()
    else:
        session = Session(profile_name=profile)

    return session.client("bedrock-runtime", region_name=region, config=boto_config)


