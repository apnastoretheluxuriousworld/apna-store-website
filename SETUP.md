# Apna Store: Setup Guide

This guide covers where every credential comes from, the commands to run, and how to move to a VPS later.
All secrets go in `.env`, which git ignores. `.env.example` is the committed template.

---

## 1. Database: Supabase (free tier)

1. Create a project at https://supabase.com. Choose **Region: Mumbai (ap-south-1)** and save the database password.
2. Open **Project → Connect** (top bar) and copy two connection strings. Replace `[YOUR-PASSWORD]` in each:

   | `.env` variable | Supabase option | Port | Used by |
   |---|---|---|---|
   | `DATABASE_URL` | **Transaction pooler** | 6543 | the running app (serverless-friendly) |
   | `DATABASE_URL_DIRECT` | **Session pooler** | 5432 | migrations and seed |

> We use Supabase **only as Postgres**. That means no Supabase Auth, Storage, RLS or Edge Functions, so the data can move to any Postgres server.

## 2. Storage: Cloudflare R2 (free up to 10 GB)

1. Go to **Cloudflare dashboard → R2 Object Storage → Create bucket** and name it `apna-store-media`. For location, choose **Asia-Pacific**.
2. **Public access:** open the bucket → **Settings → Public access**.
   - For now, set **R2.dev subdomain → Allow**, then copy the `https://pub-….r2.dev` URL into `S3_PUBLIC_URL`.
   - At launch, connect a custom domain (e.g. `media.apnastore.in`) instead and update `S3_PUBLIC_URL`.
3. **API token:** go to **R2 → Manage API tokens → Create API token** and choose **Object Read & Write**, limited to this bucket. Copy the following into `.env`:
   - Access Key ID → `S3_ACCESS_KEY_ID`
   - Secret Access Key → `S3_SECRET_ACCESS_KEY`
   - Your account ID, from the R2 overview page, goes into the endpoint: `S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
4. **CORS** (lets the admin upload directly from the browser): open the bucket → **Settings → CORS policy** and paste the policy below. Add your Netlify or custom domain to `AllowedOrigins` once you have it.

   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000", "https://YOUR-SITE.netlify.app"],
       "AllowedMethods": ["GET", "PUT", "HEAD"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

## 3. First run

```bash
npm install
npm run db:migrate     # creates all 19 tables (SQL lives in ./drizzle)
npm run db:seed        # 8 categories + their fields, homepage sections, settings
npm run infra:check    # verifies DB + R2 end to end (upload → public URL → delete)
npm run dev
```

Then open http://localhost:3000/api/health. It should return `{"status":"ok", …, "categories": 8}`.

Other useful commands:

| Command | What it does |
|---|---|
| `npm run db:studio` | Opens a visual table browser |
| `npm run db:generate` | Creates a new migration after editing `src/lib/db/schema.ts` |
| `npm test` | Runs offline database and storage tests, with no credentials needed |

## 4. Deploy: Netlify (free tier)

The Vercel free plan doesn't allow commercial sites. Netlify's free plan does.

1. Push this repo to GitHub.
2. In Netlify, go to **Add new site → Import from Git**. It detects Next.js on its own, and `netlify.toml` is already set up.
3. Under **Site configuration → Environment variables**, add every variable from `.env`. Set `NEXT_PUBLIC_SITE_URL` to the live URL.
4. Deploy, then open `https://<site>/api/health`.
5. Add the live URL to the R2 CORS `AllowedOrigins`.

## 5. Moving to a Hostinger VPS later

Nothing in the code changes. Only the environment changes.

```bash
# 1. On the VPS: run Postgres (docker-compose.yml in this repo works as-is)
docker compose up -d

# 2. Copy the data from Supabase (use the Session pooler URL) into the VPS
pg_dump  "$SUPABASE_DATABASE_URL_DIRECT" --no-owner --no-acl -Fc -f apnastore.dump
pg_restore --no-owner -d "postgresql://apna:PASSWORD@localhost:5432/apnastore" apnastore.dump

# 3. Point .env at the VPS database (both URLs can be the same)
# 4. Build and run the app:  npm ci && npm run build && npm start   (behind Nginx + PM2)
```

Storage can stay on R2, which has free bandwidth. To self-host it instead, run MinIO, copy the bucket with `rclone`, and change the `S3_*` values. The app talks to storage through the standard S3 API, so no code changes are needed.
