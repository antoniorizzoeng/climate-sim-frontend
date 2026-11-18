#!/usr/bin/env bash
set -euo pipefail
export ENGINE_REF="${ENGINE_REF:-$(git ls-remote https://github.com/antoniorizzoeng/climate-sim-mpi-cpp.git refs/heads/main | cut -f1)}"

cd "$(dirname "${BASH_SOURCE[0]}")/.."
artifact_dir=artifacts/e2e-fullstack
mkdir -p "$artifact_dir"
rm -f "$artifact_dir/containers.log" "$artifact_dir/compose-ps.log"

compose=(docker compose --project-name climate-sim-e2e -f docker-compose.yml -f docker-compose.e2e.yml)
if [[ -n "${E2E_COMPOSE_CACHE_FILE:-}" ]]; then
  compose+=(-f "$E2E_COMPOSE_CACHE_FILE")
fi

cleanup() {
  local status=$?
  if (( status != 0 )); then
    "${compose[@]}" ps --all > "$artifact_dir/compose-ps.log" 2>&1 || true
    "${compose[@]}" logs --no-color > "$artifact_dir/containers.log" 2>&1 || true
  fi
  "${compose[@]}" down -v || {
    if (( status == 0 )); then
      status=1
    fi
  }
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

"${compose[@]}" up --build -d --wait --wait-timeout 90 2>&1 | tee "$artifact_dir/compose-up.log"
npx --no-install playwright test --config playwright.fullstack.config.ts "$@"
