#!/usr/bin/env bash
# Runs on the server (invoked over SSH by .github/workflows/deploy.yml, which does the `git
# pull` itself before calling this — this script has to already exist there to be run at all).
# Builds a fresh static release and atomically swaps it in — nginx serves the "current" symlink
# directly (server/api-proxy.mjs handles /api/* separately, as its own long-running systemd
# service, untouched by this script), so this never restarts anything user-facing and the site
# is never down or half-updated while a deploy runs.
set -euo pipefail
cd "$(dirname "$0")/.."

# --no-audit/--no-fund skip a network round-trip npm otherwise makes on every install even when
# nothing changed — that alone was ~64s of an otherwise <1s no-op install.
npm install --no-audit --no-fund
npm run build

SHA=$(git rev-parse --short HEAD)
REL="releases/${SHA}-$(date +%s)"
mkdir -p "$REL"
cp -r dist "$REL/dist"

ln -sfn "$(pwd)/$REL/dist" current-tmp
mv -Tf current-tmp current

# Keep the last 5 releases around for a quick manual rollback (re-point the "current"
# symlink), prune anything older.
cd releases
ls -1dt */ 2>/dev/null | tail -n +6 | xargs -r rm -rf
