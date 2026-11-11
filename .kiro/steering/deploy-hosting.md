---
inclusion: fileMatch
fileMatchPattern: ["netlify.toml", "netlify/**", ".github/workflows/**", "scripts/**", "site/**", "docs/DEPLOY.md"]
---

# Deploy and hosting

The always-included rules still apply: free hosting, URL live until Jan 29, 2027, and every production deploy needs the owner's explicit approval (`workflow.md`).

## Netlify site
- One site (Free plan) serves `/` (landing from `site/`), `/interview/` and `/defense/`, plus `netlify/functions/llm.mts` from spec (e).
- **Production branch is `release`.** Iterate on `main` with branch deploys and deploy previews, which are not metered.
- Budget: at most 10 production deploys per month.

## Credits (Free plan)
- Confirmed in Netlify's billing docs: 300 credits per month with a hard limit, 15 credits per production deploy, 20 credits per GB of bandwidth; deploy previews and branch deploys are not metered.
- Netlify's plan comparison page says Free projects pause until the next billing cycle when credits run out. Treat a pause as possible.
- Large assets and camera models load from CDNs, not Netlify bandwidth.

## Backup mirror
- A GitHub Actions workflow publishes the same build to GitHub Pages in demo + BYOK mode (no proxy), linked from the README.
