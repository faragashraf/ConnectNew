#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_PROJECT="$ROOT_DIR/Tests/Persistence.Tests/Persistence.Tests.csproj"

mode="${1:-all}"

case "$mode" in
  all)
    echo "Running all backend tests..."
    dotnet test "$TEST_PROJECT"
    ;;
  pricing)
    echo "Running pricing regression tests..."
    dotnet test "$TEST_PROJECT" --filter "FullyQualifiedName~SummerPricingServiceRegressionTests"
    ;;
  lifecycle)
    echo "Running booking lifecycle tests (pay/transfer/cancel)..."
    dotnet test "$TEST_PROJECT" --filter "FullyQualifiedName~SummerWorkflowServiceLifecycleTests"
    ;;
  filter)
    filter_value="${2:-}"
    if [[ -z "$filter_value" ]]; then
      echo "Usage: ./scripts/run-tests.sh filter \"FullyQualifiedName~YourTestName\""
      exit 1
    fi
    echo "Running tests with filter: $filter_value"
    dotnet test "$TEST_PROJECT" --filter "$filter_value"
    ;;
  *)
    echo "Unknown mode: $mode"
    echo "Usage:"
    echo "  ./scripts/run-tests.sh all"
    echo "  ./scripts/run-tests.sh pricing"
    echo "  ./scripts/run-tests.sh lifecycle"
    echo "  ./scripts/run-tests.sh filter \"FullyQualifiedName~YourTestName\""
    exit 1
    ;;
esac
