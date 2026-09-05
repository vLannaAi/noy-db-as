# Changelog — `@noy-db/as-*`

One file for the whole line: these ten packages are versioned and released
together, so ten per-package changelogs would be ten copies of this one.

Hand-written, deliberately. There is no changeset tooling here and none is
wanted — see `scripts/set-version.mjs` for why. Note that **no package ships a
changelog**: every `files` array is `["dist", "README.md", "LICENSE"]`, so a
mistake in this file is amendable rather than frozen into a published tarball,
which is the opposite of hub's situation.

## Unreleased

Nothing yet.

## 0.7.1-pre.0

First release cut from this repository. `0.7.0` was published by **noy-db**,
before the `as-*` families were removed from it on 2026-09-01 — so this line's
history starts in another repo, and this is the handover.

### Published surface

- **`filter` is now generic** on `as-zip` and `as-xlsx`. It was
  `(record: unknown) => boolean` with no type parameter to supply, so
  `filter: (r) => r.status === 'paid'` compiled for nobody — and because a
  callback in property position is contravariant in its parameter, a consumer
  could not annotate their way out either. `T` defaults to `unknown`, so every
  existing call is unchanged:

  ```ts
  await toBytes<Invoice>(vault, { records: { collection: 'invoices', filter: (r) => r.status === 'paid' } })
  ```

  The type argument is an assertion, not a proof — records arrive as plain
  objects and nothing verifies the shape at runtime. That is the contract
  `vault.collection<T>()` already makes.

- ⚠️ **`@noy-db/as-zip` is now a PEER dependency of `@noy-db/as-xlsx`**, not a
  plain dependency (lanna-db#16). It is still installed automatically — peers
  are auto-installed by default in both npm and pnpm — so `as-xlsx` keeps
  working with no change. **But it is no longer YOUR dependency:** under an
  isolated `node_modules` layout (pnpm's default) you can no longer
  `import '@noy-db/as-zip'` unless you depend on it directly. If you use
  `as-zip`'s API yourself, add it to your own dependencies. Measured under both
  managers rather than inferred; under npm's hoisted layout it still resolves.

- **The `@noy-db/hub` peer range is widened to `^0.7.0 || ^0.7.1-pre.0`** in all
  ten packages, so they resolve against core's current prerelease line. Widened
  by appending; nothing that resolved before stops resolving.

### Documentation corrections, all found by compiling the prose

- `as-zip`'s README taught `asZip.toBytes(vault, …)` in two examples. **There is
  no such export** — the package exports `toBytes`, `fromBytes`, `download`,
  `write`. Shipped in the published `0.7.0` tarball; a consumer copying either
  block got an undefined reference.
- `as-xlsx` and `as-zip` `db.grant()` examples omitted the required
  `displayName`.
- Undefined placeholder identifiers in `as-aws-s3`, `as-csv` and `as-zip`
  examples.
- A `manifest.json` illustration was fenced as ```` ```ts ````. `tsc` skips
  semantic checking for the whole program on any syntactic diagnostic, so that
  one fence was silencing eleven diagnostics in as-zip's other blocks.
- ⚠️ **`as-zip`'s AES interop claim is narrowed to what is now proven.** 7-Zip
  prompts for the password on Linux, macOS and Windows. **`unar` as shipped by
  Ubuntu (checked 2026-09-05) cannot read these archives** — it reports
  "Missing or wrong password". A newer `unar` reads the identical bytes, as does
  7-Zip everywhere, so this is that build's limitation rather than the
  archive's; but a recipient on Ubuntu reaching for their distro's tool will not
  get in. The `password` JSDoc said the opposite — that nothing had been
  validated — and now agrees with the README.

### Repository (not published)

- **`pnpm check:prose-examples`** compiles every fenced `ts` block in every
  shipped README against that package's built `dist`. noy-db's equivalent scans
  `packages/*/README.md` in noy-db; these READMEs left that scope at the
  extraction and nothing replaced it, while `files` ships all ten. It refuses to
  run against an unbuilt package rather than resolving every import to `any`,
  and reports a syntactic diagnostic as poisoning the package rather than as
  ordinary findings.
- **A blocking three-OS interop job** for `as-zip`, replacing noy-db's dropped
  copy (noy-db #1331). `NOYDB_INTEROP_REQUIRE` names the tools that must be
  present, so a missing one fails instead of skipping quietly; `publish` depends
  on the job.
- CI's `pull_request` trigger no longer filters on the base branch, which had
  been skipping every stacked PR while `peer-floor` still ran — showing some
  green checks and no CI.
- Version tooling the extraction never carried across: `pnpm version:set`,
  `check:versions-uniform`, `check:not-already-published`.
- Ported scripts and workflows corrected against this tree rather than
  noy-db-to's, including a `release.yml` version gate that compared the string
  `"undefined"` to the tag and would have failed every release.

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
