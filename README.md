# TAB Agent Recruitment Landing Page

Static landing page for TAB LLC's freight-agent recruitment funnel. Two lead magnets:

1. **Commission Calculator** — interactive client-side tool
2. **Growth Playbook** — gated PDF download (placeholder PDF for now)

## Deploys

- **Preview / coworker review:** GitHub Pages — auto-deploys from `main` via `.github/workflows/pages.yml`
- **Production:** Cloudflare Pages (serves `site/` and runs `site/functions/*` for the lead-capture API)

The calculator is fully client-side and works on either host. Lead-capture forms only post successfully when running on Cloudflare Pages (or another host that runs `site/functions/`); on GitHub Pages they fail silently and show the success UI.

## Local preview

```bash
python3 -m http.server 8000 --directory site
```

Then open http://localhost:8000.

## Structure

```
site/
├── index.html
├── styles.css
├── calculator.js
├── _headers              # Cloudflare Pages headers (ignored by GH Pages)
├── assets/
└── functions/api/        # Cloudflare Pages Functions (ignored by GH Pages)
.github/workflows/pages.yml
```

See `site/README.md` for editing notes (commission tier table, lead-routing webhook, etc.).
