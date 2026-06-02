#!/usr/bin/env node

// Self-contained validator for community marketplace submissions. Mirrors the
// checks in the monorepo's scripts/marketplace-validate.mjs but has zero deps so
// the public repo's CI can run it standalone. Validates every folder under
// community/botlets/<id>/ and community/teams/<id>/.
//
// Exit non-zero on any failure (CI gate). On success, prints a per-listing
// summary that the maintainer can skim in the PR.

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname);
const botletsRoot = join(repoRoot, 'community', 'botlets');
const teamsRoot = join(repoRoot, 'community', 'teams');

const idPattern = /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/;
const roleKeyPattern = /^[a-z](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
const tagPattern = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
const handleSuffixPattern = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const authorHandlePattern = /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/;
const placeholderPattern = /\{\{([a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)*)\}\}/g;

const CATEGORIES = ['productivity', 'research', 'marketing', 'writing', 'devtools', 'data', 'communication', 'scheduling', 'monitoring', 'finance'];
const LICENSES = ['MIT', 'Apache-2.0', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'CC0-1.0'];
const INGEST_INJECTED = ['author', 'authorAgentId', 'submittedAt'];
const FORBIDDEN = [
  { label: 'demo @jon handle', re: /@jon\./i },
  { label: 'demo bare jon handle', re: /\bjon\./i },
  { label: 'local agent credential path', re: /~\/\.comment-io\/agents\// },
  { label: 'demo workspace path', re: /gtm-demo|demo-bots|botlets-dogfood/i },
  { label: 'local etiquette file path', re: /etiquette\.txt/i },
];

const errors = [];
const summaries = [];
function fail(msg) { errors.push(msg); }

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}
async function listDirs(p) {
  try {
    return (await readdir(p, { withFileTypes: true }))
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name);
  } catch { return []; }
}
async function walkMarkdown(dir, root = dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const abs = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walkMarkdown(abs, root));
    else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) out.push(abs);
  }
  return out;
}

function checkForbidden(label, text) {
  for (const f of FORBIDDEN) {
    f.re.lastIndex = 0;
    if (f.re.test(text)) fail(`${label} contains ${f.label}`);
  }
}
function checkPlaceholders(label, md) {
  for (const m of md.matchAll(placeholderPattern)) {
    const parts = m[1].split('.');
    const ok =
      (parts.length === 2 && parts[0] === 'owner' && parts[1] === 'handle') ||
      (parts.length === 2 && parts[0] === 'bot' && ['handle', 'mention', 'display_name'].includes(parts[1])) ||
      (parts.length === 3 && parts[0] === 'team' && roleKeyPattern.test(parts[1]) && ['handle', 'mention', 'display_name'].includes(parts[2]));
    if (!ok) fail(`${label} has unsupported placeholder {{${m[1]}}}`);
  }
  const stripped = md.replace(placeholderPattern, '');
  const bad = stripped.match(/\{\{[^}]+}}/);
  if (bad) fail(`${label} has malformed placeholder ${bad[0]}`);
}

function checkSidecar(label, raw, id) {
  if (raw.schemaVersion !== 1) fail(`${label}: schemaVersion must be 1`);
  if (raw.listingId !== id) fail(`${label}: listingId "${raw.listingId}" must equal folder id "${id}"`);
  for (const f of INGEST_INJECTED) if (f in raw) fail(`${label}: must not include "${f}" (injected at ingest)`);
  if (typeof raw.authorHandle !== 'string' || !authorHandlePattern.test(raw.authorHandle)) {
    fail(`${label}: authorHandle is required and must be a valid handle`);
  }
  if (!Array.isArray(raw.tags) || raw.tags.length < 1 || raw.tags.length > 5) fail(`${label}: tags must be 1–5 items`);
  else {
    for (const t of raw.tags) if (typeof t !== 'string' || !tagPattern.test(t)) fail(`${label}: invalid tag "${t}"`);
    if (new Set(raw.tags).size !== raw.tags.length) fail(`${label}: duplicate tags`);
  }
  if (!CATEGORIES.includes(raw.category)) fail(`${label}: category must be one of ${CATEGORIES.join(', ')}`);
  if (!LICENSES.includes(raw.licenseId)) fail(`${label}: licenseId must be one of ${LICENSES.join(', ')}`);
  if (raw.homepageUrl != null) {
    try { const u = new URL(raw.homepageUrl); if (!/^https?:$/.test(u.protocol)) throw 0; }
    catch { fail(`${label}: homepageUrl must be a valid http(s) URL`); }
  }
}

async function readJson(path, label) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (e) { fail(`${label}: ${e.message}`); return null; }
}

async function validateBrainFolder(dir, id, { requireIndividual }) {
  const manifest = await readJson(join(dir, 'template.json'), `${id}/template.json`);
  if (!manifest) return null;
  if (manifest.id !== id) fail(`${id}/template.json: id "${manifest.id}" must equal folder name`);
  if (!idPattern.test(id)) fail(`${id}: invalid id (lowercase, 2–63, no leading/trailing hyphen)`);
  if (!Number.isInteger(manifest.version) || manifest.version < 1) fail(`${id}: version must be a positive integer`);
  if (typeof manifest.prompt === 'string' && manifest.prompt.length > 8000) fail(`${id}: prompt exceeds 8000 chars`);
  if (typeof manifest.description === 'string' && manifest.description.length > 500) fail(`${id}: description exceeds 500 chars`);
  if (requireIndividual && manifest.availableAsIndividual === false) fail(`${id}: a standalone botlet must have availableAsIndividual:true`);
  checkForbidden(`${id}/template.json`, JSON.stringify(manifest));
  const mds = await walkMarkdown(dir);
  if (mds.length === 0) fail(`${id}: needs at least one .md brain doc`);
  for (const p of mds) {
    const md = await readFile(p, 'utf8');
    const rel = p.slice(dir.length + 1);
    checkForbidden(`${id}/${rel}`, md);
    checkPlaceholders(`${id}/${rel}`, md);
  }
  return manifest;
}

async function validateBotlet(id) {
  const dir = join(botletsRoot, id);
  const manifest = await validateBrainFolder(dir, id, { requireIndividual: true });
  const sidecar = await readJson(join(dir, 'marketplace.json'), `${id}/marketplace.json`);
  if (sidecar) checkSidecar(`${id}/marketplace.json`, sidecar, id);
  if (manifest && sidecar) summaries.push(`botlet  ${id}  v${manifest.version}  [${(sidecar.tags || []).join(', ')}]  @${sidecar.authorHandle}`);
}

async function validateTeam(id) {
  const dir = join(teamsRoot, id);
  const team = await readJson(join(dir, 'team.json'), `${id}/team.json`);
  const sidecar = await readJson(join(dir, 'marketplace.json'), `${id}/marketplace.json`);
  if (sidecar) checkSidecar(`${id}/marketplace.json`, sidecar, id);
  if (!team) return;
  if (team.id !== id) fail(`${id}/team.json: id must equal folder name`);
  if (!idPattern.test(id)) fail(`${id}: invalid team id`);
  if (!Number.isInteger(team.version) || team.version < 1) fail(`${id}: team version must be a positive integer`);
  if (!Array.isArray(team.members) || team.members.length === 0) { fail(`${id}: team needs at least one member`); return; }
  const memberDirs = new Set(await listDirs(join(dir, 'members')));
  const seenRoles = new Set();
  for (const m of team.members) {
    if (!m || typeof m !== 'object') { fail(`${id}: malformed member`); continue; }
    if (!roleKeyPattern.test(m.roleKey || '')) fail(`${id}: invalid roleKey "${m.roleKey}"`);
    if (seenRoles.has(m.roleKey)) fail(`${id}: duplicate roleKey "${m.roleKey}"`);
    seenRoles.add(m.roleKey);
    const memberBareId = String(m.brainTemplateId || '');
    if (!memberDirs.has(memberBareId)) { fail(`${id}: member "${m.roleKey}" references members/${memberBareId}/ which is missing`); continue; }
    const memberManifest = await validateBrainFolder(join(dir, 'members', memberBareId), memberBareId, { requireIndividual: false });
    if (!memberManifest) continue;
    if (memberManifest.availableAsIndividual !== false) fail(`${id}: member ${memberBareId} must have availableAsIndividual:false`);
    if (memberManifest.teamRoleKey !== m.roleKey) fail(`${id}: member ${memberBareId} teamRoleKey must equal "${m.roleKey}"`);
    if (memberManifest.version !== m.brainTemplateVersion) fail(`${id}: member ${memberBareId} version must equal pinned brainTemplateVersion ${m.brainTemplateVersion}`);
  }
  // Orphan member dirs (present but not referenced).
  const referenced = new Set(team.members.map((m) => String(m.brainTemplateId || '')));
  for (const d of memberDirs) if (!referenced.has(d)) fail(`${id}: orphan members/${d}/ not referenced in team.json`);
  if (team && sidecar) summaries.push(`team    ${id}  v${team.version}  ${team.members.length} member(s)  @${sidecar.authorHandle}`);
}

// Global id uniqueness across botlets + teams.
const botletIds = await listDirs(botletsRoot);
const teamIds = await listDirs(teamsRoot);
const collide = botletIds.filter((b) => teamIds.includes(b));
for (const c of collide) fail(`id "${c}" used by both a botlet and a team — ids must be globally unique`);

for (const id of botletIds) await validateBotlet(id);
for (const id of teamIds) await validateTeam(id);

if (errors.length > 0) {
  console.error(`\n✗ ${errors.length} validation error(s):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error('');
  process.exit(1);
}
console.log(`\n✓ ${summaries.length} listing(s) valid:\n`);
for (const s of summaries) console.log(`  ${s}`);
console.log('');
