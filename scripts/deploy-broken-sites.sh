#!/usr/bin/env bash
# Trigger the missing first production deploy for customer sites that show
# DEPLOYMENT_NOT_FOUND (Vercel project linked but never built). Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/.."
E=apps/web/.env.local
VT=$(grep '^VERCEL_TOKEN' "$E"   | sed 's/^[^=]*="\{0,1\}//;s/"$//')
GT=$(grep '^GITHUB_TOKEN' "$E"   | sed 's/^[^=]*="\{0,1\}//;s/"$//')
TEAM=$(grep '^VERCEL_TEAM_ID' "$E" | sed 's/^[^=]*="\{0,1\}//;s/"$//')

# Add/remove slugs here as needed.
for slug in adsprint-04gy quotegenius-jh3g brewglobe-utmt craftbot-juxo; do
  repo="adyourventure-mainak/$slug"
  rid=$(curl -s -H "Authorization: Bearer $GT" "https://api.github.com/repos/$repo" \
        | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
  state=$(curl -s -X POST "https://api.vercel.com/v13/deployments?teamId=$TEAM" \
        -H "Authorization: Bearer $VT" -H "Content-Type: application/json" \
        -d "{\"name\":\"$slug\",\"target\":\"production\",\"gitSource\":{\"type\":\"github\",\"repoId\":$rid,\"ref\":\"main\"},\"projectSettings\":{\"framework\":null,\"buildCommand\":null,\"installCommand\":null,\"outputDirectory\":\".\"}}" \
        | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('readyState') or d.get('error'))")
  echo "$slug -> $state"
done
echo "Give it ~1 min, then reload the .vercel.app URLs."
