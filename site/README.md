# TAB Agent Recruitment Landing Page

Static site for TAB LLC's freight-agent recruitment funnel. Two lead magnets:

1. **Commission Calculator** — interactive tool, captures lead after result
2. **Growth Playbook** — gated PDF download (placeholder PDF for now)

## File layout

```
site/
├── index.html              # The whole page
├── styles.css              # All styles
├── calculator.js           # Calc logic + lead form handling
├── _headers                # CF Pages security + cache headers
├── assets/
│   └── logo.png            # ← drop the TAB logo here (PNG, ideally ~80px tall)
└── functions/
    └── api/
        ├── lead.js         # POST /api/lead     (calculator submissions)
        └── playbook.js     # POST /api/playbook (playbook downloads)
```

## Deploy to Cloudflare Pages

1. Push this folder to a Git repo (or zip + drag into the Pages dashboard).
2. In Pages → **Create project** → connect repo.
3. **Build settings:**
   - Framework preset: `None`
   - Build command: *(leave blank)*
   - Build output directory: `/` (or `site` if you push the parent folder)
4. **Environment variables** (Settings → Environment variables):
   - `LEAD_WEBHOOK_URL` — set to your Zapier/Make/n8n webhook, Slack incoming webhook, or HubSpot endpoint. Leads will be forwarded there as JSON.
5. **Custom domain** — point e.g. `agents.tab-llc.com` (or whatever standalone domain you bought) at the Pages project.

## Things to update before going live

### 1. Commission tier table (`calculator.js`)

Tiers are based on **top-line customer revenue** (not gross profit) per Brian's 4/27 sync. Domestic is the standard tiered scale; International caps flat at 60%.

```js
// Domestic
const DOMESTIC_TIERS = [
  { minRev: 0,         maxRev: 5_000_000,   split: 0.65 },
  { minRev: 5_000_000, maxRev: 10_000_000,  split: 0.70 },
  { minRev: 10_000_000, maxRev: 20_000_000, split: 0.75 },
  { minRev: 20_000_000, maxRev: Infinity,   split: 0.80 },
];

// International
const INTERNATIONAL_SPLIT = 0.60;

// GP assumption for take-home math
const ASSUMED_GP_MARGIN = 0.15;
```

Asset/line-haul bonus (5/4/3/2% based on customer longevity) is **intentionally excluded from the calculator** — different formula (% of line haul, not gross profit), and TAB doesn't want to incentivize agents to sell assets directly. Asset capability is referenced in the FAQ and "Why TAB" sections instead.

The disclaimer in the calculator output marks this clearly as "for illustration only" — not a binding offer.

### 2. Logo

Drop the TAB logo into `site/assets/logo.png`. The hero will show it next to the wordmark; if the file is missing the wordmark renders alone.

### 3. Playbook PDF

Currently the playbook form returns `/playbook-placeholder.pdf` from the API stub. Once the real PDF is built, drop it at `site/playbook.pdf` and update `functions/api/playbook.js` accordingly. Or send the link via the follow-up email and return just `{ ok: true }`.

### 4. Lead delivery

The forms POST to `/api/lead` and `/api/playbook`. Pick one:
- **Easiest:** Set `LEAD_WEBHOOK_URL` to a Zapier "Catch Hook" — route it to HubSpot, Mailchimp, Slack, Google Sheets, whatever.
- **Direct HubSpot:** Replace the webhook block with a HubSpot Forms API call. Drop the portalId + formGuid in.
- **Just email:** Add a Mailchannels integration (free on CF Pages Functions) and route to BrianA@tab-llc.com.

### 5. Discovery call CTA

The "Book a discovery call" button in the final CTA mailtos `Brian@tab-llc.com`. If the team uses a HubSpot meetings link (the main TAB site does), swap that in.

## Local preview

Just open `index.html` in a browser. The form POSTs will fail silently against the local file (no API), but the success state still renders so you can see the full UX.

For full Functions support locally:

```bash
npx wrangler pages dev site
```

## Brand notes used

- Navy: `#0d3b66`
- Tan accent: `#a89b8a`
- Cyan accent: `#5fd7e4`
- Font: Inter (Google Fonts)
- Voice: built by agents, for agents — no hype, concrete numbers, focus on "you keep your business, we remove the ceiling"
