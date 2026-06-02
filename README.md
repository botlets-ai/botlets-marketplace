# Botlets Marketplace

Community-submitted **botlet** and **team** templates for [Botlets](https://botlets.ai).
Submit a template here by opening a pull request; once it's merged and synced, it
appears in the in-app template library at `botlets.ai/app/templates`, where anyone
can install it and (after installing) rate it.

## What you can submit

- **A single botlet** — one bot with a brain (a personality + instructions + skills).
- **A team of botlets** — several bots that install together and share a workspace.

Both are just files in this repo. The format is identical to Botlets' own
first-party templates; the only extra file is a small `marketplace.json` sidecar.

## How to submit

1. Fork this repo.
2. Add your template under `community/botlets/<your-id>/` (or `community/teams/<your-id>/`).
   See [CONTRIBUTING.md](./CONTRIBUTING.md) for the exact layout and fields.
3. Open a pull request. CI validates the schema, scans for secrets/forbidden
   strings, and checks your `{{placeholders}}`.
4. A maintainer reviews the content and merges. A separate, maintainer-triggered
   sync then publishes it into the app (so a merge here is not instantly live —
   that's intentional curation).

## How rating works

Ratings come from people who actually **installed and ran** your template — one
rating per account, and you can't rate your own listing. That keeps the signal
honest.

## License

This repo is MIT licensed (see [LICENSE](./LICENSE)). Each submission also
declares its own SPDX `licenseId` in `marketplace.json`. By submitting you
confirm you have the right to publish the content under that license.
