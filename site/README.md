# TAB Agent Recruitment Landing Page

Static site for TAB LLC's freight-agent recruitment funnel, deployed on
Cloudflare Pages with Functions-backed forms and Resend-powered email
automation.

Two lead magnets:

1. **Commission Calculator** — interactive tool, captures lead after result
2. **Growth Playbook** — gated PDF download (`site/playbook.pdf`)

## File layout

```
site/
├── index.html              # The whole page
├── styles.css              # All styles
├── calculator.js           # Calc logic + lead form handling
├── playbook.pdf            # The gated PDF lead magnet
├── _headers                # CF Pages security + cache headers
├── assets/                 # Logos, photos
└── functions/
    └── api/
        ├── _lib.js         # Shared helpers (Resend client, json, escape)
        ├── lead.js         # POST /api/lead     (calculator submissions)
        └── playbook.js     # POST /api/playbook (playbook downloads)
```

## How the automations work

Both endpoints validate the payload, optionally pass through to a webhook,
then send two emails via Resend:

| Endpoint        | To the lead                                     | To TAB (`NOTIFY_EMAIL`)              |
|-----------------|--------------------------------------------------|--------------------------------------|
| `/api/playbook` | "Your TAB Growth Playbook" — link to `/playbook.pdf` | "New playbook download — {name}" |
| `/api/lead`     | "Your TAB earnings projection" — full breakdown      | "New calculator lead — {name} (+$X lift)" |

`reply_to` on lead emails goes to the `from` address (so the lead can reply
to a real inbox). `reply_to` on internal notifications is the lead's email
(so you can reply directly from your inbox).

## Deploy to Cloudflare Pages

1. Push this repo to GitHub (or connect via the Pages "Direct Upload" flow).
2. CF Dashboard → **Workers & Pages** → **Create application** → **Pages** → connect repo.
3. **Build settings:**
   - Framework preset: `None`
   - Build command: *(leave blank)*
   - Build output directory: `site`
4. Add env vars (see below).
5. Add the custom domain (`growwithtab.com`) under **Custom domains**.

## Required environment variables

Set these in CF Pages → Settings → Environment variables (Production):

| Variable           | Required | Default                                          | Notes |
|--------------------|----------|--------------------------------------------------|-------|
| `RESEND_API_KEY`   | yes      | —                                                | `re_...` from resend.com → API Keys |
| `FROM_EMAIL`       | no       | `TAB Agents <agents@growwithtab.com>`            | Must be on a Resend-verified domain |
| `NOTIFY_EMAIL`     | no       | `wes@championdigitalmedia.com`                   | Where new-lead alerts go |
| `SITE_URL`         | no       | `https://growwithtab.com`                        | Used to build absolute PDF URL in emails |
| `LEAD_WEBHOOK_URL` | no       | —                                                | Optional Zapier/Make/HubSpot pass-through |

Mark `RESEND_API_KEY` as **encrypted** when adding it.

## Resend setup (one-time)

1. Sign up at [resend.com](https://resend.com).
2. **Domains** → **Add Domain** → enter `growwithtab.com`.
3. Resend will give you DNS records to add. In Cloudflare DNS for
   `growwithtab.com`, add:
   - **MX** record (Resend bounce subdomain)
   - **TXT** record for SPF (`v=spf1 include:_spf.resend.com ~all` — or merge with any existing SPF)
   - **TXT/CNAME** records for DKIM (Resend will list them)
   - **TXT** record for DMARC (recommended: `v=DMARC1; p=none; rua=mailto:wes@championdigitalmedia.com`)
4. **Important:** turn off Cloudflare proxy (gray cloud, not orange) on every record Resend gives you. SPF/DKIM/MX records must resolve directly.
5. Click **Verify DNS Records** in Resend until it goes green.
6. Create an API key (`Sending` scope, restricted to `growwithtab.com`).
7. Paste it into CF Pages env as `RESEND_API_KEY`.

## DNS for the site itself

In Cloudflare for `growwithtab.com`:
- Cloudflare Pages adds the apex/www records automatically when you add the
  custom domain. Leave those proxied (orange cloud).

## Local preview

The static HTML opens fine via `file://`, but the form submissions hit live
endpoints. To test the Functions locally:

```bash
npx wrangler pages dev site
```

To exercise the email send locally, create `site/.dev.vars`:

```
RESEND_API_KEY=re_xxxxxxxxxxxx
FROM_EMAIL=TAB Agents <agents@growwithtab.com>
NOTIFY_EMAIL=wes@championdigitalmedia.com
SITE_URL=http://localhost:8788
```

`.dev.vars` is gitignored by wrangler convention — never commit it.

## Updating the playbook PDF

1. Rebuild the source PDF: `cd ../playbook && bash build.sh`
2. Copy it into the site: `cp ../playbook/playbook.pdf ./playbook.pdf`
3. Commit + push — CF Pages redeploys.

## Things to update if the calculator inputs change

Tiers and assumptions live in two places that must stay in sync:
- `calculator.js` (client-side display)
- the email templates pass through `inputs` and `results` from the client,
  so the math itself is computed once on the client; the Functions only
  format what they receive

If the tiers change, update `calculator.js` only. The emails will reflect
the new numbers automatically.

## Brand notes

- Navy: `#0d3b66`
- Tan accent: `#a89b8a`
- Cyan accent: `#5fd7e4`
- Font: Inter (Google Fonts)
- Voice: built by agents, for agents — no hype, concrete numbers, "you keep your business, we remove the ceiling"
