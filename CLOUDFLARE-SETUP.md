# Running COD Pilot on Cloudflare

The app is a Cloudflare Worker with one R2 bucket. `cloudflare/entry.js` replaces the
ChatGPT Sites sign-in with Cloudflare Access: only emails you allow can open the app.

## One-time setup

1. Create a free account at https://dash.cloudflare.com.
2. **R2**: open R2 in the dashboard, enable it, and create a bucket named `cod-pilot-media`.
3. **Deploy key**: My Profile > API Tokens > Create Token > template "Edit Cloudflare Workers".
   Copy your Account ID from the Workers & Pages overview page.
4. In GitHub, repo Settings > Secrets and variables > Actions, add
   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Never paste them in a chat.
5. Push to `main` (or re-run the workflow). The app appears at
   `https://cod-pilot.<your-subdomain>.workers.dev`.
6. **Sign-in**: Zero Trust > Access > Applications > Add > Self-hosted, domain = the
   workers.dev address above, policy "Allow" with your email. Then copy the team domain
   (`<team>.cloudflareaccess.com`) and the Application Audience (AUD) tag into
   `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` in `wrangler.toml`, and push.
   Until this step is done, every API call answers 401.

## Secrets (Workers > cod-pilot > Settings > Variables and Secrets)

| Name | Needed for |
| --- | --- |
| `GEMINI_API_KEY` | Google voice and automatic shot planning |
| `VOICE_OWNER_ID` | Your sign-in email, lowercase (who may spend on voice) |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | Optional ElevenLabs voice |
| `META_APP_ID`, `META_APP_SECRET`, `META_LOGIN_CONFIG_ID` | Facebook connection |
| `N8N_WEBHOOK_KEY`, `N8N_MONITOR_URL` | Old n8n assistant and monitor |

For Facebook, add `https://<your workers.dev address>/api/meta/callback` to the Meta app's
Valid OAuth Redirect URIs.

Data saved on the ChatGPT site (uploaded videos, Facebook connections) does not move over;
reconnect Facebook once on the new address.

## Local development

`npx wrangler dev` with a `.dev.vars` file containing `DEV_USER_EMAIL=you@example.com`
(used only on localhost and only when Access is not configured).
