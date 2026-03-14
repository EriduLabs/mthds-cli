# Cloud Run Deployment Walkthrough

## What Was Accomplished
The application has been fully configured for a single-container deployment to Google Cloud Run! The deployment workflow leverages a multi-stage Docker build to compile the React frontend and serve it securely via Django using Whitenoise. A Cloud Build configuration is also now available to handle automated building and pushing of the Docker image to Google Artifact Registry.

## Architecture Changes Made
- Installed `whitenoise` and `gunicorn` in the Django backend.
- Updated [settings.py](file:///c:/Users/Eridu/OneDrive/Desktop/Mthds/backend/config/settings.py) to use Whitenoise for static file serving.
- Updated [urls.py](file:///c:/Users/Eridu/OneDrive/Desktop/Mthds/backend/config/urls.py) in Django with a catch-all route `re_path(r'^(?!api/).*$'...)` to serve your React frontend on the root path `/` and anything that isn't an `/api/` endpoint.
- Updated [vite.config.ts](file:///c:/Users/Eridu/OneDrive/Desktop/Mthds/frontend/vite.config.ts) to output its build to `backend/frontend_build`.
- Built a multi-stage `Dockerfile`.
- Built a Google Cloud automated build pipeline `cloudbuild.yaml`.

## Deploying to Cloud Run

Here is the exact set of commands you need to execute in your terminal to deploy your application.

### 1. Build and Push the Docker Image
First, you'll use the generated `cloudbuild.yaml` to build and upload your Docker image to Google Artifact Registry. Ensure you substitute your exact GCP Project ID below!

```bash
gcloud builds submit --config cloudbuild.yaml --substitutions=_REGION="us-central1"
```

### 2. Deploy to Cloud Run
Once the image is pushed, deploy it to Cloud Run while passing your environment variables.

```bash
gcloud run deploy mthds-app \
  --image us-central1-docker.pkg.dev/YOUR_PROJECT_ID/mthds-repo/mthds-app:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL="your-database-connection-url",PROJECT_ID="YOUR_PROJECT_ID",SECRET_KEY="your-django-production-secret"
```

> [!TIP]
> Ensure you create the `mthds-repo` Artifact Registry repository first if you haven't already:
> `gcloud artifacts repositories create mthds-repo --repository-format=docker --location=us-central1`
