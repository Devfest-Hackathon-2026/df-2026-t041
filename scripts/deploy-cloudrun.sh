#!/usr/bin/env bash
# Deploys the app to Cloud Run, built from source with Cloud Build (Dockerfile in the repo root).
# AI runs on Gemini via Vertex AI with the service's own service account: no API key is stored.
#
# Usage:  PROJECT_ID=my-project ./scripts/deploy-cloudrun.sh
# Optional: REGION (default asia-northeast1), SERVICE (default prmaker),
#           OPENAI_SECRET=<Secret Manager secret name holding an OpenAI key> to enable the fallback.
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-asia-northeast1}"
SERVICE="${SERVICE:-prmaker}"
[ -n "$PROJECT_ID" ] || { echo "PROJECT_ID is not set" >&2; exit 1; }

echo "Project: $PROJECT_ID  Region: $REGION  Service: $SERVICE"

gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com aiplatform.googleapis.com \
  --project "$PROJECT_ID"

# The default compute service account builds the image (Cloud Build) and runs the service.
# Newer projects give it no roles, so grant what the build and Vertex AI calls need.
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
for ROLE in roles/cloudbuild.builds.builder roles/aiplatform.user; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member "serviceAccount:${RUNTIME_SA}" --role "$ROLE" --condition None >/dev/null
done

EXTRA=()
if [ -n "${OPENAI_SECRET:-}" ]; then
  EXTRA+=(--set-secrets "OPENAI_API_KEY=${OPENAI_SECRET}:latest")
fi

gcloud run deploy "$SERVICE" --quiet \
  --project "$PROJECT_ID" --region "$REGION" \
  --source . \
  --allow-unauthenticated \
  --memory 1Gi --cpu 1 --timeout 300 --max-instances 3 \
  --set-env-vars "GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GOOGLE_CLOUD_LOCATION=global" \
  ${EXTRA[@]+"${EXTRA[@]}"}

gcloud run services describe "$SERVICE" --project "$PROJECT_ID" --region "$REGION" --format 'value(status.url)'
