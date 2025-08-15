#!/bin/bash
cd "$(dirname "$0")"
# Prevent browser from opening automatically
export BROWSER=none
# Increase memory limit significantly
export NODE_OPTIONS="--max-old-space-size=32768"
npm start
