#!/usr/bin/env node
//
// check-not-already-published — refuse a version the registry already carries.
//
// WHY THIS EXISTS.
//
// "A version bump committed to a repo is not real until it is published" is
// the family's standing law, and it bites in BOTH directions. The direction
// that hit this repo is the one the law is rarely read in: the registry ran
// AHEAD of the tree. Core cut 0.7.0 while these ten packages were still in
// its monorepo and removed them afterwards, so npm carried 0.7.0 for every
// package while this repo still claimed 0.7.0-pre.17. A publish from that
// tree would have been EPUBLISHCONFLICT at best.
//
// Nothing in the repo could see it. Every in-repo gate — build, tests, lint,
// typecheck, architecture, peer-floor — was green, because every one of them
// asks a question about the tree and none of them asks the registry. This is
// that missing question, made executable.
//
// ⚠️ A read failure is FATAL, deliberately. This gates a decision, and
// "could not confirm" must never render as "fine to publish" — that is the
// degraded-state-looks-healthy collapse the family record keeps hitting. Only
// an explicit 404 (the package has never been published) is a pass, and it is
// reported as its own distinct state rather than folded into success.
//
//   node scripts/check-not-already-published.mjs
//
// Exit 1 if any package's version is already on the registry, or if the
// registry could not be read.
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const pkgDirs = readdirSync(ROOT).filter(
  (d) => !d.startsWith('.') && d !== 'node_modules' && d !== 'scripts' && existsSync(join(ROOT, d, 'package.json')),
)

const taken = []
const unreadable = []
const firstPublish = []
const clear = []

for (const dir of pkgDirs) {
  const { name, version, private: isPrivate } = readJson(join(ROOT, dir, 'package.json'))
  if (isPrivate) continue
  let raw
  try {
    raw = execFileSync('npm', ['view', `${name}`, 'versions', '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (err) {
    const stderr = String(err.stderr ?? '')
    // npm reports write-path auth failures as 404 too, so match the phrase the
    // registry uses for a genuinely absent package rather than the exit code.
    if (/E404/.test(stderr) && /is not in this registry|404 Not Found/.test(stderr)) {
      firstPublish.push(`${name}@${version}`)
      continue
    }
    unreadable.push(`${name}: ${stderr.trim().split('\n').slice(-1)[0] || err.message}`)
    continue
  }
  const parsed = JSON.parse(raw)
  const published = Array.isArray(parsed) ? parsed : [parsed]
  if (published.includes(version)) taken.push(`${name}@${version}`)
  else clear.push(`${name}@${version}`)
}

if (unreadable.length) {
  console.error('\n✗ could not read the registry — this gates a decision, so it is fatal:\n')
  for (const u of unreadable) console.error(`   • ${u}`)
  console.error('\n   "could not confirm" is not "not published". Re-run when the registry is reachable.\n')
  process.exit(1)
}
if (taken.length) {
  console.error('\n✗ the registry already carries these versions — publishing would conflict:\n')
  for (const t of taken) console.error(`   • ${t}`)
  console.error('\n   Bump the line (pnpm version:set <version>) before cutting.\n')
  process.exit(1)
}
if (firstPublish.length) {
  console.log(`ℹ ${firstPublish.length} package(s) never published — this would be a FIRST publish:`)
  for (const f of firstPublish) console.log(`   • ${f}`)
  console.log('   ⚠️ npm sets `latest` on a first publish regardless of --tag.')
}
console.log(`✓ ${clear.length} package version(s) not yet on the registry`)
