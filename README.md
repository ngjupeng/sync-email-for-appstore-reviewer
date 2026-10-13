# Tester OTP Dashboard

A tiny password-protected web dashboard that reads your tester Gmail inbox over
IMAP, extracts the latest login OTP code, and shows it on a clean page so an App
Store reviewer can grab the code without ever logging into Google.

- Reviewer opens a URL, types one shared password, sees the latest code with a
  big **Copy** button.
- Auto-refreshes every 5s. Shows the most recent code plus a short history.
- Codes are filtered by sender / subject / time window so only real OTPs show.

## How it works

```
Reviewer ──▶ /login (shared password) ──▶ /  (dashboard, polls every 5s)
                                            │
                                            ▼
                                      /api/otp  ──IMAP──▶  Gmail inbox
                                      (connect, scan recent msgs, regex the code)
```

Stack: Next.js (App Router) on Vercel. IMAP via `imapflow`, email parsing via
`mailparser`, session cookie signed with `jose`.

## 1. Get a Gmail App Password

The dashboard logs into the tester inbox with an **App Password**, not the real
password.

1. Turn on 2-Step Verification for the tester Google account.
2. Go to https://myaccount.google.com/apppasswords
3. Create a password (name it e.g. "OTP dashboard"). Copy the 16 characters.

## 2. Configure env

Copy `.env.local.example` to `.env.local` and fill it in:

| Var                  | What                                                        |
| -------------------- | ---------------------------------------------------------- |
| `IMAP_USER`          | tester Gmail address                                        |
| `IMAP_PASSWORD`      | the 16-char App Password                                    |
| `DASHBOARD_PASSWORD` | password the reviewer types                                 |
| `AUTH_SECRET`        | random string for cookie signing (`openssl rand -base64 32`)|
| `OTP_FROM`           | (optional) only show mail from this sender substring        |
| `OTP_SUBJECT`        | (optional) only show mail whose subject contains this       |
| `OTP_REGEX`          | (optional) capture group for the code, default 4-8 digits   |
| `OTP_WINDOW_MINUTES` | (optional) ignore mail older than this, default 15          |

Tip: set `OTP_FROM` to your app's sending address (e.g. `noreply@yourapp.com`)
so unrelated emails never leak as a "code".

## 3. Run locally

```bash
npm install
npm run dev
# open http://localhost:3000  → redirects to /login
```

## 4. Deploy to Vercel

```bash
npm i -g vercel   # if needed
vercel            # link/create the project
vercel --prod     # deploy
```

Then add the same env vars in the Vercel dashboard
(**Project → Settings → Environment Variables**) and redeploy. Send the
production URL + `DASHBOARD_PASSWORD` to the reviewer.

The `/api/otp` route runs on the Node.js runtime (IMAP needs raw TCP) and is set
to `force-dynamic`, so it always fetches live.

## Security notes

- Anyone with the URL **and** the password can log into your app as the tester.
  Use a strong `DASHBOARD_PASSWORD` and rotate it after review.
- Only the dashboard (`/`) and `/api/otp` are gated; the IMAP credentials never
  reach the browser, they live only in server env vars.
- Codes are read-only from the inbox; the app never deletes or sends mail.
