# Local setup

```sh
pnpm install
cp .env.example .env.local   # then fill in the values below
pnpm dev
```

Every value below comes from a free tier. Never commit `.env.local`; on Vercel, add the same keys under **Project → Settings → Environment Variables**.

## 1. Neon (Postgres)

1. Sign up at [neon.tech](https://neon.tech) and create a project (pick the region closest to your Vercel region, e.g. `us-east-1` / `iad1`).
2. On the project dashboard, open **Connect**.
3. Copy the **pooled** connection string (host contains `-pooler`) → `DATABASE_URL`.
4. Toggle pooling off and copy the **direct** string → `DATABASE_URL_UNPOOLED` (migrations need a direct connection).
5. Optional: create a `dev` branch in Neon so local experiments never touch production data.

## 2. Better Auth secret

```sh
openssl rand -base64 32
```

Paste the value into `BETTER_AUTH_SECRET` and set `BETTER_AUTH_URL` to the app's base URL. Use a different secret in production.

## 3. Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com) → create a project → **APIs & Services → OAuth consent screen**: External, app name "Tiebreak", your email as support contact. Scopes: `openid`, `email`, `profile` (defaults).
2. **Credentials → Create credentials → OAuth client ID** → type **Web application**.
3. Authorized redirect URIs (Google allows several, so one client covers both):
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<your-app>.vercel.app/api/auth/callback/google`
4. Copy the client ID / secret → `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
5. While the consent screen is in "Testing", only listed test users can sign in: add yourself, or publish the app before sharing.

## 4. GitHub OAuth

GitHub OAuth apps allow **one** callback URL each, so create two apps: one for local, one for production.

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Local app:
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
3. Production app: same, with your Vercel URL.
4. Generate a client secret → `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` (local values in `.env.local`, production values in Vercel).

## 5. Pusher Channels

1. Sign up at [pusher.com](https://pusher.com) → **Channels → Create app** (name "tiebreak", frontend React, backend Node.js; pick a cluster near your users, e.g. `eu` or `us2`).
2. **App Keys** tab:
   - `app_id` → `PUSHER_APP_ID`
   - `key` → `NEXT_PUBLIC_PUSHER_KEY`
   - `secret` → `PUSHER_SECRET` (server only: never prefix it with `NEXT_PUBLIC_`)
   - `cluster` → `NEXT_PUBLIC_PUSHER_CLUSTER`
3. The sandbox plan (200k messages/day, 100 concurrent connections) is plenty. Events only say "poll X changed"; clients refetch through our API, so no vote data ever travels through Pusher.

## 6. Vercel

1. Import the GitHub repo at [vercel.com/new](https://vercel.com/new). Framework preset: Next.js; install command `pnpm install`.
2. Add every variable from `.env.example` with production values.
3. After the first deploy, add the production callback URLs from steps 3–4.
