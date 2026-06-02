## Submission checklist

- [ ] Folder name matches `template.json` `id` (or `team.json` `id` for teams)
- [ ] `version` is a positive integer (bumped from the previous version if updating an existing listing)
- [ ] `availableAsIndividual` is set correctly (`true` for a standalone botlet; `false` for every team member)
- [ ] `marketplace.json` has my `authorHandle` and does **not** include `author`, `authorAgentId`, or `submittedAt`
- [ ] `tags` (1–5), `category`, and `licenseId` are from the approved sets in CONTRIBUTING.md
- [ ] No hard-coded owner handles, credential paths, or demo workspace paths in any file
- [ ] All `{{…}}` placeholders are from the supported set
- [ ] `npm run validate` (or `node scripts/validate-submission.mjs`) passes locally
- [ ] I own this content or have the right to publish it under the stated license

## What this template does

<!-- One paragraph so a maintainer can review quickly: what it's for, who it helps. -->
