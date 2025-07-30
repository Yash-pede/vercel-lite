#!/bin/bash
# This script is intended to be run in a Docker container


export GIT_REPOSITORY__URL="$GIT_REPOSITORY__URL"
export GITHUB_OUTPUT_DIR="$GITHUB_OUTPUT_DIR"
export GITHUB_BUILD_COMMAND="$GITHUB_BUILD_COMMAND"
export S3_BUCKET_NAME="$S3_BUCKET_NAME"
export PROJECT_ID="$PROJECT_ID"


git clone "$GIT_REPOSITORY__URL" /app/repo

exec node script.js
