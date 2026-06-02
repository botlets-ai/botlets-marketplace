# Contributing a template

A submission is a folder of files. CI validates everything mechanical; a
maintainer reviews the content.

## Single botlet

```
community/botlets/<id>/
  template.json        # manifest (see fields below)
  marketplace.json     # marketplace sidecar (you write only authorHandle + tags/category/license)
  IDENTITY.md          # brain doc(s) — any .md files; placeholders allowed
  AGENTS.md
  SOUL.md
  skills/<name>/SKILL.md
```

- `<id>` must be lowercase `[a-z0-9-]`, 2–63 chars, no leading/trailing hyphen,
  and must match `template.json`'s `id`.

### `template.json`

```jsonc
{
  "id": "standup-bot",                 // == folder name
  "version": 1,                         // positive integer; bump on every change
  "title": "Sam the Standup Bot",
  "description": "Runs a daily async standup digest.",  // 1–2 sentences
  "availableAsIndividual": true,        // true for a standalone botlet
  "suggestedHandle": "standup",
  "suggestedDisplayName": "Sam the Standup Bot",
  "prompt": "…",                        // the bot's core instruction (≤ 8000 chars)
  "schedule": { "cron": "0 9 * * 1-5", "human": "Weekdays at 9am" }  // optional
}
```

### `marketplace.json` (you write only these fields)

```jsonc
{
  "schemaVersion": 1,
  "listingId": "standup-bot",           // == folder name + template.json id
  "authorHandle": "yourhandle",         // YOUR Botlets handle (resolved to an account at ingest)
  "tags": ["productivity", "async"],    // 1–5 lowercase tags
  "category": "communication",          // one of the approved categories
  "licenseId": "MIT"                    // MIT | Apache-2.0 | ISC | BSD-2-Clause | BSD-3-Clause | CC0-1.0
}
```

> **Do not** include `author`, `authorAgentId`, or `submittedAt` — those are
> injected by the maintainer's ingest step (CI rejects them if present).

### Placeholders allowed in brain docs

`{{bot.handle}}`, `{{bot.mention}}`, `{{bot.display_name}}`, `{{owner.handle}}`,
and for team members `{{team.<roleKey>.handle}}` / `.mention` / `.display_name`.
Any other `{{…}}` is rejected.

## Team

```
community/teams/<id>/
  team.json            # id, version, title, description, members[] (roleKey + brainTemplateId + brainTemplateVersion)
  marketplace.json     # same sidecar schema
  members/<roleKey>/   # one subfolder per member, each a brain template (availableAsIndividual:false)
    template.json
    IDENTITY.md
```

Each member's `template.json` must have `availableAsIndividual: false`, a
`teamRoleKey` matching its `members[]` `roleKey`, and a `version` matching the
`brainTemplateVersion` pinned in `team.json`.

## Approved categories

`productivity`, `research`, `marketing`, `writing`, `devtools`, `data`,
`communication`, `scheduling`, `monitoring`, `finance`.

## Validate locally

```bash
node scripts/validate-submission.mjs
```

This runs the same checks CI runs.
