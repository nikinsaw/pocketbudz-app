# Deploying the backend to Google Cloud (Cloud Run + Cloud SQL)

The server runs as a container on **Cloud Run**, talks to **Cloud SQL (Postgres)** over a unix
socket, and reads its secrets from **Secret Manager**. Run the commands in Git Bash from the
repository root. `gcloud` flags below were checked against Google's reference pages.

Names used throughout (change them everywhere if you pick others):

| What | Value |
|---|---|
| Project | `pocketbudz-app` |
| Region | `asia-south1` (Cloud Run and Cloud SQL must match) |
| Cloud SQL instance / database / user | `pocketbudz-db` / `pocketbudz` / `pocketbudz` |
| Cloud Run service | `pocketbudz-api` |
| Runtime service account | `pocketbudz-api@pocketbudz-app.iam.gserviceaccount.com` |

## One-time setup

1. **Project and billing.** Link a billing account to the project, then
   `gcloud config set project pocketbudz-app`.
2. **APIs.**
   ```bash
   gcloud services enable run.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com compute.googleapis.com
   ```
3. **Runtime service account** with only the two roles the server needs.
   ```bash
   gcloud iam service-accounts create pocketbudz-api --display-name="PocketBudz API"
   gcloud projects add-iam-policy-binding pocketbudz-app --member="serviceAccount:pocketbudz-api@pocketbudz-app.iam.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
   gcloud projects add-iam-policy-binding pocketbudz-app --member="serviceAccount:pocketbudz-api@pocketbudz-app.iam.gserviceaccount.com" --role="roles/cloudsql.client"
   ```
4. **Database.**
   ```bash
   gcloud sql instances create pocketbudz-db --database-version=POSTGRES_16 --edition=ENTERPRISE --tier=db-f1-micro --region=asia-south1
   gcloud sql databases create pocketbudz --instance=pocketbudz-db
   gcloud sql users create pocketbudz --instance=pocketbudz-db --prompt-for-password
   ```
5. **Secrets.** Never put these on a command line or in git.
   - `JWT_SECRET`: 48 random bytes
     `node -e "process.stdout.write(require('crypto').randomBytes(48).toString('hex'))" | gcloud secrets create JWT_SECRET --data-file=-`
   - `GEMINI_API_KEY`: from https://aistudio.google.com/apikey, restricted to the
     Generative Language API.
     `read -s -p "Gemini key: " K; echo; printf %s "$K" | gcloud secrets create GEMINI_API_KEY --data-file=-; unset K`
   - `DATABASE_URL`: the socket form, with the password URL-encoded (a raw `@ / : #` breaks it).
     ```bash
     export CN=$(gcloud sql instances describe pocketbudz-db --format="value(connectionName)"); read -s -p "DB password: " P; echo; export P
     node -e "process.stdout.write('postgresql://pocketbudz:'+encodeURIComponent(process.env.P)+'@localhost/pocketbudz?host=/cloudsql/'+process.env.CN)" | gcloud secrets create DATABASE_URL --data-file=-
     unset P CN
     ```
     To change a secret later use `gcloud secrets versions add NAME --data-file=-`.

## Deploy

Cloud Build builds `backend/Dockerfile` and Cloud Run starts it.

```bash
CN=$(gcloud sql instances describe pocketbudz-db --format="value(connectionName)")
gcloud run deploy pocketbudz-api \
  --source backend \
  --region asia-south1 \
  --service-account pocketbudz-api@pocketbudz-app.iam.gserviceaccount.com \
  --add-cloudsql-instances "$CN" \
  --set-secrets DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --set-env-vars GOOGLE_CLIENT_ID=<your web client id>,TRUST_PROXY_HOPS=1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --timeout 300 \
  --max-instances 3
```

- `--allow-unauthenticated` only opens the *network* door. Every data route still requires a
  signed-in user; the app signs in with Google.
- `TRUST_PROXY_HOPS=1` makes the rate limit see each caller's real address (Cloud Run is one proxy
  hop). Without it everyone shares one allowance and gets blocked together.
- `--max-instances 3` x the pool size (`DB_POOL_MAX`, default 5) keeps connections well under what
  a `db-f1-micro` allows. Raise both together if you grow.
- `--timeout 300` leaves room for a slow Gemini call (a real one took 50 s) and large imports.
- `NODE_ENV=production` is set in the image. The server refuses to start without
  `GOOGLE_CLIENT_ID` and `JWT_SECRET`.

The command prints the service URL (`https://pocketbudz-api-<hash>-el.a.run.app`).

## Create the tables (migrations)

Run once after the first deploy, and again after any release that adds a migration. It runs the
same image as a Cloud Run job.

```bash
IMAGE=$(gcloud run services describe pocketbudz-api --region asia-south1 --format="value(spec.template.spec.containers[0].image)")
CN=$(gcloud sql instances describe pocketbudz-db --format="value(connectionName)")
gcloud run jobs deploy pocketbudz-migrate \
  --image "$IMAGE" \
  --region asia-south1 \
  --service-account pocketbudz-api@pocketbudz-app.iam.gserviceaccount.com \
  --set-cloudsql-instances "$CN" \
  --set-secrets DATABASE_URL=DATABASE_URL:latest \
  --command npx --args prisma,migrate,deploy \
  --max-retries 0
gcloud run jobs execute pocketbudz-migrate --region asia-south1 --wait
```

Migrations are applied with `prisma migrate deploy`, which only applies existing migration files.
It never creates or resets anything. If the job fails, read its log:
`gcloud run jobs executions list --job pocketbudz-migrate --region asia-south1`, then the logs link.

## Check it

```bash
URL=$(gcloud run services describe pocketbudz-api --region asia-south1 --format="value(status.url)")
curl "$URL/health"   # {"status":"ok"}
curl "$URL/ready"    # {"status":"ready"} once the database answers; 503 otherwise
```

## Point the app at it

In the GitHub repo (Settings -> Secrets and variables -> Actions -> Variables) set
`API_BASE_URL` to the service URL (https) and `GOOGLE_WEB_CLIENT_ID` to the web client ID, then
build a new release. For a local build, put the same two values in the root `.env`.

## Day to day

- **Logs:** Cloud Console -> Cloud Run -> `pocketbudz-api` -> Logs. Errors carry `severity=ERROR`.
  Request bodies (spending notes, AI prompts) are never logged.
- **New release:** rerun the deploy command; run the migration job if there are new migrations.
- **Rotate the Gemini key:** add a new secret version, then
  `gcloud run services update pocketbudz-api --region asia-south1 --update-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest`
  (or redeploy), then delete the old key in AI Studio.
- **Cold starts** take a few seconds when idle. `--min-instances 1` keeps one warm for about
  $10/month extra.
- **Cost:** Cloud SQL is the main cost (always on). Cloud Run is free at small scale.

## Troubleshooting

- **Build permission errors on the first `--source` deploy.** New projects sometimes need the build
  service account to have the Cloud Build role. Grant `roles/cloudbuild.builds.builder` to the
  account named in the error.
- **Container fails to start.** The log usually names a missing setting; check the three secrets
  are attached and `GOOGLE_CLIENT_ID` is set.
- **`/ready` returns 503.** The database is unreachable: check `--add-cloudsql-instances`, that the
  service account has *Cloud SQL Client*, and that the `DATABASE_URL` secret's password is encoded.
- **Everyone gets "too many requests".** `TRUST_PROXY_HOPS=1` is missing.

## Testing the image locally

```bash
docker build -t pocketbudz-api backend
docker run --rm -p 3100:8080 -e PORT=8080 -e JWT_SECRET=<40+ chars> -e GOOGLE_CLIENT_ID=test \
  -e DATABASE_URL=postgresql://pocketbudz:pocketbudz@host.docker.internal:5432/pocketbudz pocketbudz-api
```
