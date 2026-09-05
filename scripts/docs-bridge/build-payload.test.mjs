/**
 * The payload is release-critical FOR OTHER REPOS: once noy-db-docs makes this
 * repo a partition source, a release above 0.7.0 with a missing or malformed
 * asset stops the entire sync run, every partition. These tests exist because
 * the failure is not visible from here.
 */
import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildPayload, assertUploadable, isFirstPublishFromError, REPO } from './build-payload.mjs'
import { extractSection } from './changelog.mjs'

function fixture(pkgs, rootChangelog = null, perPackageChangelogs = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'as-bridge-'))
  for (const [name, pkg] of Object.entries(pkgs)) {
    mkdirSync(join(dir, name), { recursive: true })
    writeFileSync(join(dir, name, 'package.json'), JSON.stringify(pkg))
    if (perPackageChangelogs[name]) {
      writeFileSync(join(dir, name, 'CHANGELOG.md'), perPackageChangelogs[name])
    }
  }
  if (rootChangelog) writeFileSync(join(dir, 'CHANGELOG.md'), rootChangelog)
  return dir
}

const never = () => false
const base = { 'as-json': { name: '@noy-db/as-json', version: '1.0.0' } }
const build = (dir, over = {}) =>
  buildPayload({ rootDir: dir, tag: 'v1.0.0', channel: 'next', runUrl: 'u', isFirstPublish: never, ...over })

describe('package set', () => {
  it('is derived from top-level as-* dirs, not a table and not packages/', () => {
    const dir = fixture({
      'as-json': { name: '@noy-db/as-json', version: '1.0.0' },
      'as-zip': { name: '@noy-db/as-zip', version: '1.0.0' },
    })
    // A sibling that is not an as-* package must not be picked up.
    mkdirSync(join(dir, 'scripts'), { recursive: true })
    writeFileSync(join(dir, 'scripts', 'package.json'), JSON.stringify({ name: 'x', version: '9' }))
    expect(build(dir).packages.map((p) => p.dir)).toEqual(['as-json', 'as-zip'])
    rmSync(dir, { recursive: true, force: true })
  })

  it('refuses an empty payload rather than emitting a schema-valid lie', () => {
    const dir = mkdtempSync(join(tmpdir(), 'as-bridge-empty-'))
    expect(() => build(dir)).toThrow(/refusing to emit an empty payload/)
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('lockstep', () => {
  it('throws rather than misdescribing nine packages with one version', () => {
    const dir = fixture({
      'as-json': { name: '@noy-db/as-json', version: '1.0.0' },
      'as-zip': { name: '@noy-db/as-zip', version: '1.0.1' },
    })
    expect(() => build(dir)).toThrow(/not in lockstep/)
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('changeType', () => {
  it('is version-only when npm knows the package and it has no own changelog', () => {
    const dir = fixture(base)
    expect(build(dir).packages[0].changeType).toBe('version-only')
    rmSync(dir, { recursive: true, force: true })
  })

  it('is added only on a genuine first publish', () => {
    const dir = fixture(base)
    expect(build(dir, { isFirstPublish: () => true }).packages[0].changeType).toBe('added')
    rmSync(dir, { recursive: true, force: true })
  })

  it('is updated when a package grows its own changelog — unreachable today, implemented anyway', () => {
    const dir = fixture(base, null, { 'as-json': '## 1.0.0\n\nsomething happened\n' })
    const p = build(dir).packages[0]
    expect(p.changeType).toBe('updated')
    expect(p.changelog).toBe('something happened')
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('top-level changelog', () => {
  it('carries the root section verbatim', () => {
    const dir = fixture(base, '# CL\n\n## 1.0.0\n\nthe reason for this release\n\n## 0.9.0\n\nold\n')
    expect(build(dir).changelog).toBe('the reason for this release')
    rmSync(dir, { recursive: true, force: true })
  })

  it('is null when the section is missing — the empty-prose release the spec warns about', () => {
    const dir = fixture(base, '# CL\n\n## Unreleased\n\nnothing\n')
    expect(build(dir).changelog).toBeNull()
    rmSync(dir, { recursive: true, force: true })
  })

  it('is NOT copied into per-package entries', () => {
    const dir = fixture(base, '# CL\n\n## 1.0.0\n\nrelease prose\n')
    const payload = build(dir)
    expect(payload.changelog).toBe('release prose')
    expect(payload.packages[0].changelog).toBeNull()
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('fields the consumer must not receive', () => {
  it('emits no store-divergence keys', () => {
    const dir = fixture(base)
    const p = build(dir)
    for (const k of ['shape', 'capabilities', 'txAtomic', 'conditionalBits']) {
      expect(p).not.toHaveProperty(k)
      expect(p.packages[0]).not.toHaveProperty(k)
    }
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('assertUploadable', () => {
  const ok = () => ({
    bridge: 1, repo: REPO, version: '1.0.0', tag: 'v1.0.0',
    packages: [{ dir: 'as-json', changeType: 'version-only' }],
  })

  it('accepts a well-formed payload', () => {
    expect(() => assertUploadable(ok())).not.toThrow()
  })

  it('rejects a tag that disagrees with the version', () => {
    expect(() => assertUploadable({ ...ok(), tag: 'v1.0.1' })).toThrow(/does not equal/)
  })

  it('rejects the wrong repo slug — the tag-collision guard', () => {
    expect(() => assertUploadable({ ...ok(), repo: 'vLannaAi/noy-db-at' })).toThrow(/must be vLannaAi\/noy-db-as/)
  })

  it('rejects a fourth changeType, which would stop the whole sync run', () => {
    const p = ok()
    p.packages[0].changeType = 'changed'
    expect(() => assertUploadable(p)).toThrow(/not one of added\|updated\|version-only/)
  })

  it('rejects an empty package list', () => {
    expect(() => assertUploadable({ ...ok(), packages: [] })).toThrow(/packages is empty/)
  })
})

describe('first-publish detection', () => {
  it('treats E404 as never-published', () => {
    expect(isFirstPublishFromError({ stderr: 'npm ERR! code E404' })).toBe(true)
  })

  it('does NOT treat a network failure as never-published', () => {
    expect(isFirstPublishFromError({ stderr: 'ETIMEDOUT' })).toBe(false)
  })
})

describe('extractSection', () => {
  it('matches the bare heading this repo writes', () => {
    expect(extractSection('## 0.7.0\n\nbody\n', '0.7.0')).toBe('body')
  })

  it('matches the bracketed Keep a Changelog form too', () => {
    expect(extractSection('## [0.7.0] — 2026-09-05\n\nbody\n', '0.7.0')).toBe('body')
  })

  it('does not match a prerelease of the same base version', () => {
    expect(extractSection('## 0.7.0-pre.1\n\nbody\n', '0.7.0')).toBeNull()
  })
})
