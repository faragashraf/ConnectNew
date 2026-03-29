#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROJECT_PATH="${REPO_ROOT}/ENPO.Connect.Backend/Api/Api.csproj"
OUTPUT_PATH="/Users/ashraffarag/Webserver/Connect"

echo "Publishing backend to ${OUTPUT_PATH} ..."
dotnet publish "${PROJECT_PATH}" -c Release -o "${OUTPUT_PATH}" -nologo
echo "Publish completed."
