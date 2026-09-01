# Changelog — `@noy-db/as-*`

One file for the whole line: these ten packages are versioned and released
together, so ten per-package changelogs would be ten copies of this one.

Hand-written, deliberately. There is no changeset tooling here and none is
wanted — see `scripts/set-version.mjs` for why. Note that **no package ships a
changelog**: every `files` array is `["dist", "README.md", "LICENSE"]`, so a
mistake in this file is amendable rather than frozen into a published tarball,
which is the opposite of hub's situation.

## Unreleased

Nothing yet. The line sits at `0.7.0`, which the registry already carries, so
`pnpm check:not-already-published` will refuse a release until it is bumped.

### Repository (not published)

- Version tooling, which the extraction never carried across. `pnpm version:set
  <version>` moves all ten packages and the internal `as-xlsx -> as-zip` range
  in one edit, delegating ordering to `semver` rather than to a hand-rolled
  comparator. `check:versions-uniform` holds the line uniform in CI;
  `check:not-already-published` gates the release on what npm actually carries.
- The release workflow's version-vs-tag gate read the root manifest's `version`,
  which does not exist here — the root is `private: true`. It compared the
  string `"undefined"` against the tag and would have failed every release. It
  now checks the ten package manifests.
- `docs-bridge` in `release.yml` is marked non-functional. It references three
  files this repo does not have, and the payload schema it targets is
  store-scoped by design, so as-* has no slot in it. Pending a decision.

## 0.7.0

**Inherited, not cut from this repo.** Core published `@noy-db/as-*@0.7.0` from
its own tree — tag `v0.7.0` in `vLannaAi/noy-db` still contains
`packages/as-*`, and the `as-*` families were removed from core in `22fecc8c`
immediately afterwards. So `0.7.0` is the last core-published version of this
line, and this repo is its successor. A clean handover, not a lost release.

The manifests here were baselined onto `0.7.0` in `47d389e` to match. Source
parity was measured rather than assumed, by comparing each published tarball's
embedded sourcemap `sourcesContent` against local `src/`: 17 source files across
all ten packages, 16 byte-identical. The one divergence is `as-xlsx`'s
`src/index.ts`, where extraction dropped a type assertion that was required
against core's workspace source and is redundant against hub's published
`.d.ts`. It is erased at compile time, and the published `dist/index.js` and
`dist/index.d.ts` are byte-identical to a local build.

Also in that baseline:

- The `@noy-db/hub` peer range narrowed from `^0.7.0-pre.17` to `^0.7.0`,
  matching what `0.7.0` publishes. This is a **narrowing**: a prerelease caret
  reaches forward into its stable, so `^0.7.0-pre.17` was the wider range and
  additionally admitted the whole 0.7 pre line.
- `as-xlsx -> as-zip` restored to a **peer** at `^0.7.0`, matching published
  `as-xlsx@0.7.0`, with a devDependency at the same caret so tests still resolve
  `as-zip` from the registry. Extraction had made it a dependency to get
  registry resolution; a peer is what keeps version skew visible to a consumer
  instead of silently resolving to a second copy.

## Earlier

Released from `vLannaAi/noy-db` as part of the core monorepo. See that repo's
`packages/hub/CHANGELOG.md` for the history through `0.7.0`.
