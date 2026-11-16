# JARVIS v4 Firebase and Vercel setup

## Required Vercel environment variables

Set these in Vercel for Production and Preview as appropriate:

- `GEMINI_API_KEY`: server-side Google Gemini API key.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: the complete Firebase service-account JSON as one environment-variable value. Never put it in browser code or commit it.
- `ADMIN_EMAIL`: `ipbaba.pk@gmail.com` (optional; this is the code default).

Optional:

- `GEMINI_MODEL`: defaults to `gemini-2.5-flash`.
- `GEMINI_FALLBACK_MODEL`: defaults to `gemini-2.0-flash`.
- `GEMINI_REQUEST_TIMEOUT_MS`: defaults to 22000.
- `ALLOWED_ORIGINS`: comma-separated additional HTTPS origins, only if a trusted custom domain is intentionally used.

Redeploy after changing environment variables.

## Firebase Console checklist

1. Open Firebase project `ip-baba-jarvis`.
2. Authentication → Sign-in method: enable Google and Email/Password if both are offered to users.
3. Authentication → Settings → Authorized domains: add the production JARVIS hostname and any Vercel preview hostname used for testing.
4. Firestore Database: create a database in Native mode and choose the correct region. The Admin SDK collections used by this release are `jarvisConfig`, `jarvisProfiles`, and `jarvisUsage`.
5. Apply `firestore.rules`. These rules deny direct browser access; the server-side Firebase Admin SDK uses the service account and is not restricted by client rules.
6. Create/download a service account for the same Firebase project and set its complete JSON in Vercel as `FIREBASE_SERVICE_ACCOUNT_JSON`. Ensure the service account can access Firestore and Firebase Authentication.
7. Confirm the admin Gmail is exactly `ipbaba.pk@gmail.com` and its Google sign-in email is verified.

## What is recorded

- Successful chat API replies increment a per-user request counter.
- First/last seen timestamps are recorded from this release onward.
- Older browser-local chats cannot be retrospectively counted by the server.
- Live Voice sessions/audio minutes are not included in the request counter yet.
- User block/unblock uses Firebase Authentication's disabled-account flag and a server-side profile flag.

## Runtime knowledge and instructions

Admin → Knowledge Base accepts a JSON object. Validate JSON before publishing. Admin → AI Instructions stores additional system instructions for new chat requests. Changes affect new requests, not messages already generated.

## Timeout behavior

Gemini primary and fallback requests are each bounded to 22 seconds; the browser waits up to 55 seconds and Vercel's chat function is configured for up to 60 seconds. Actual maximum duration still depends on the Vercel plan and platform limits. If the plan caps functions below 60 seconds, upgrade the plan or lower `GEMINI_REQUEST_TIMEOUT_MS`.

## Security

Do not commit service-account JSON, API keys, user passwords, or private personal data. The admin API checks the verified Firebase token and exact admin email server-side. Never rely on a hidden admin link as authorization.
