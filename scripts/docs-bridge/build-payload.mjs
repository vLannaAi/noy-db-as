/**
 * Assemble `docs-bridge.json` for the ten `@noy-db/as-*` packages.
 *
 * WHAT READS THIS, and why the failure mode is other people's problem: from the
 * moment noy-db-docs makes this repo a partition source, a release of ours
 * above 0.7.0 with no `docs-bridge.json` asset is a `BridgeAssetMissingError`,
 * which exits the whole sync run — EVERY partition, not just `as`. The
 * operator's only recovery is `--skip-tag noy-db-as@<tag>`, named in a commit.
 * So this file is release-critical for repos that are not this one.
 *
 * Contract: noy-db-docs `docs/superpowers/specs/2026-09-05-as-on-at-doc-sync-
 * sources-design.md`, ruled lanna-db#17. Parity target is noy-db-ui's builder,
 * not noy-db-to's: no `as-*` package is a store.
 *
 * ⛔ DO NOT EMIT `shape` / `capabilities` / `txAtomic` / `conditionalBits`.
 * They are read only by `checkBridgeDivergence`, which runs from
 * `registry/scan-to-capabilities.mjs --bridge` and refuses any repo but
 * noy-db-to. Emitting them would ship a schema nothing consumes — worse than
 * none, because a later reader takes it for a checked contract.
 *
 * ⚠️ THE PACKAGE SET IS DERIVED FROM THE DIRECTORY LISTING, NOT A TABLE. Two
 * noy-db-to releases shipped a broken payload because a new store was missing
 * from a hard-coded WIRING table, and both runs reported success. An eleventh
 * `as-*` package is picked up here with no edit to this file.
 *
 * ⚠️ AND THE DIRS ARE TOP-LEVEL. This repo is FLAT — `as-zip/`, not
 * `packages/as-zip/`. That difference is the same one that left noy-db's
 * interop job `cd`-ing into a path the extraction had emptied, failing
 * advisorily for two days.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { extractSection } from './changelog.mjs'

const PREFIX = 'as-'
export const REPO = 'vLannaAi/noy-db-as'

export function buildPayload({ rootDir, tag, channel, runUrl, isFirstPublish }) {
  const dirs = readdirSync(rootDir, { withFileTypes: true })
    .filter(
      (d) =>
        d.isDirectory() &&
        d.name.startsWith(PREFIX) &&
        existsSync(join(rootDir, d.name, 'package.json')),
    )
    .map((d) => d.name)
    .sort()

  // Named rather than left to an empty array: an empty `packages` is
  // schema-VALID and silently describes a release with no packages. The
  // consumer would accept it.
  if (dirs.length === 0) {
    throw new Error(
      `no ${PREFIX}* package directories under ${rootDir} — refusing to emit an empty payload`,
    )
  }

  const packages = dirs.map((dir) => {
    const pkg = JSON.parse(readFileSync(join(rootDir, dir, 'package.json'), 'utf8'))

    // Per-package changelogs do not exist in this repo (the root CHANGELOG says
    // so, and explains why). The general rule is implemented anyway so that a
    // package which later grows one is described correctly rather than
    // silently `version-only`. Today this is always null — which is the honest
    // value, NOT a placeholder to fill with the root section: release-scoped
    // prose attributed to ten packages that did not each say it is a defect
    // this family keeps finding.
    const clPath = join(rootDir, dir, 'CHANGELOG.md')
    const changelog = existsSync(clPath)
      ? extractSection(readFileSync(clPath, 'utf8'), pkg.version)
      : null

    // Ordered, per the spec. `updated` is unreachable here while no package has
    // its own changelog, and `added` is unreachable while every as-* name is
    // already on npm from the pre-extraction 0.7.0. All ten reading
    // `version-only` is correct, not a bug to work around.
    const changeType = isFirstPublish(pkg.name)
      ? 'added'
      : changelog !== null
        ? 'updated'
        : 'version-only'

    return {
      name: pkg.name,
      dir,
      version: pkg.version,
      description: pkg.description ?? null,
      hubPeerRange: pkg.peerDependencies?.['@noy-db/hub'] ?? null,
      changeType,
      changelog,
    }
  })

  // Lockstep ASSERTED. `check:versions-uniform` already enforces it in CI, but
  // this runs on a release checkout where that gate is not in the path, and the
  // payload carries ONE version — a split would make it a lie about the other
  // nine.
  const versions = [...new Set(packages.map((p) => p.version))]
  if (versions.length > 1) {
    const detail = packages.map((p) => `${p.name}@${p.version}`).join(', ')
    throw new Error(
      `packages are not in lockstep (${detail}) — the payload carries one version, so this would ` +
        'misdescribe the others. Run `pnpm version:set <version>` before cutting.',
    )
  }

  // The root section is this payload's ONLY prose. Absent, the plan shows the
  // operator versions and no reason for them.
  const rootChangelogPath = join(rootDir, 'CHANGELOG.md')
  const changelog = existsSync(rootChangelogPath)
    ? extractSection(readFileSync(rootChangelogPath, 'utf8'), versions[0])
    : null

  return {
    bridge: 1,
    repo: REPO,
    version: versions[0],
    tag,
    channel,
    runUrl,
    changelog,
    packages,
  }
}

/**
 * npm reports "never published" as E404 on the write path too, so this checks
 * the message rather than the exit code. Any OTHER failure — network, registry
 * outage, auth — is NOT first-publish and must rethrow: mislabelling one tells
 * the docs side to write a brand-new page for a package that has shipped for
 * months.
 */
export function isFirstPublishFromError(err) {
  return `${err?.stderr ?? ''}${err?.stdout ?? ''}`.toString().includes('E404')
}

/** True when npm knows no version of this package other than the current one. */
export function npmIsFirstPublish(name) {
  try {
    const out = execFileSync('npm', ['view', name, 'versions', '--json'], {
      stdio: 'pipe',
    }).toString()
    const versions = JSON.parse(out)
    return (Array.isArray(versions) ? versions : [versions]).length <= 1
  } catch (err) {
    if (isFirstPublishFromError(err)) return true
    throw err
  }
}

/**
 * The pre-upload validation the spec requires, run against the object we are
 * about to write rather than re-read from disk — same check the release job
 * repeats on the file, deliberately duplicated so a hand run gets it too.
 */
export function assertUploadable(payload) {
  const problems = []
  if (payload.bridge !== 1) problems.push(`bridge is ${payload.bridge}, must be 1`)
  if (payload.repo !== REPO) problems.push(`repo is ${payload.repo}, must be ${REPO}`)
  if (!Array.isArray(payload.packages) || payload.packages.length === 0) {
    problems.push('packages is empty')
  }
  if (payload.tag !== `v${payload.version}`) {
    problems.push(`tag ${payload.tag} does not equal "v" + version ${payload.version}`)
  }
  for (const p of payload.packages ?? []) {
    if (!['added', 'updated', 'version-only'].includes(p.changeType)) {
      // classifyBridge throws on a fourth value and stops the whole run.
      problems.push(`${p.dir}: changeType "${p.changeType}" is not one of added|updated|version-only`)
    }
  }
  if (problems.length > 0) {
    throw new Error(`docs-bridge payload is not uploadable:\n  - ${problems.join('\n  - ')}`)
  }
  return payload
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const get = (flag) => {
    const i = args.indexOf(flag)
    return i === -1 ? null : args[i + 1]
  }
  const payload = buildPayload({
    rootDir: process.cwd(),
    tag: get('--tag'),
    channel: get('--channel'),
    runUrl: get('--run-url'),
    isFirstPublish: npmIsFirstPublish,
  })
  assertUploadable(payload)
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
}
