#!/usr/bin/env node
//
// check-versions-uniform — one version across the line, and every internal
// range admits it.
//
// WHY THIS EXISTS.
//
// These ten packages move as a single lockstep line. Nothing enforces that:
// a version lives in ten separate files, and an edit that misses one is
// locally correct, passes every in-repo gate, and only surfaces as an
// ERESOLVE in a consumer's install.
//
// The second half is the one this repo specifically needs. There is exactly
// ONE internal dependency edge in the whole family — as-xlsx -> as-zip — and
// it is a PEER, deliberately, because a peer makes version skew visible to a
// consumer instead of silently resolving to a second copy. That property is
// only worth anything if the range actually admits the version we ship. A
// range left behind at a previous release publishes a peer requirement that
// the sibling being published alongside it does not satisfy.
//
// ⚠️ Written as an INVARIANT over the OUTPUT, not as a pinned version:
// "no two packages may disagree, and no internal range may exclude our own
// version". A check whose expected value is edited every release is a check
// people stop reading, and it cannot see the class — only the instance it was
// last edited for.
//
//   node scripts/check-versions-uniform.mjs
//
// Exit 1 on any disagreement.
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import semver from 'semver'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const pkgDirs = readdirSync(ROOT).filter(
  (d) => !d.startsWith('.') && d !== 'node_modules' && d !== 'scripts' && existsSync(join(ROOT, d, 'package.json')),
)

const pkgs = pkgDirs.map((d) => ({ dir: d, json: readJson(join(ROOT, d, 'package.json')) }))
const own = new Set(pkgs.map((p) => p.json.name))
const failures = []

// ── Invariant 1: every package carries the same version ──────────────────
const versions = new Map()
for (const { dir, json } of pkgs) {
  if (!versions.has(json.version)) versions.set(json.version, [])
  versions.get(json.version).push(dir)
}
if (versions.size > 1) {
  const lines = [...versions.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([v, dirs]) => `      ${v.padEnd(18)} ${dirs.join(', ')}`)
  failures.push(`the line is not uniform — ${versions.size} different versions:\n${lines.join('\n')}`)
}

// ── Invariant 2: every internal range admits the version being shipped ───
// Checked against each DEPENDED-ON package's own version rather than against a
// single repo-wide value, so this stays correct even while invariant 1 is
// failing — the two report independently instead of one masking the other.
const versionOf = new Map(pkgs.map((p) => [p.json.name, p.json.version]))
for (const { dir, json } of pkgs) {
  for (const field of ['dependencies', 'peerDependencies', 'devDependencies', 'optionalDependencies']) {
    for (const [name, range] of Object.entries(json[field] ?? {})) {
      if (!own.has(name)) continue
      const target = versionOf.get(name)
      if (range.endsWith('||') || range.trim().endsWith('||')) {
        failures.push(`${dir}: ${field}.${name} range ends in "||" — an unfinished append floors at 0.0.0`)
        continue
      }
      if (!semver.validRange(range)) {
        failures.push(`${dir}: ${field}.${name} range "${range}" is not a valid semver range`)
        continue
      }
      if (!semver.satisfies(target, range, { includePrerelease: true })) {
        failures.push(`${dir}: ${field}.${name} is "${range}", which does NOT admit ${name}@${target} as shipped from this repo`)
      }
    }
  }
}

if (failures.length) {
  console.error('\n✗ version invariants violated:\n')
  for (const f of failures) console.error(`   • ${f}`)
  console.error('')
  process.exit(1)
}
console.log(`✓ all ${pkgs.length} package(s) on ${pkgs[0].json.version}; every internal range admits what it points at`)
