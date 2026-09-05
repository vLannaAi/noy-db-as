/**
 * Extract the verbatim markdown body of a CHANGELOG section for `version`.
 * Returns null when there is no such section.
 *
 * ⚠️ PORTED FROM noy-db-ui AND KEPT DELIBERATELY LENIENT. Its header records
 * why: noy-db's and noy-db-to's copies match a bare `## 0.6.0-pre.16` heading
 * only, and noy-db-ui writes Keep a Changelog (`## [0.3.0-pre.5] — 2026-08-09`),
 * so porting theirs verbatim matched NOTHING there — every package classified
 * `version-only`, and the bridge reported success while carrying no prose.
 *
 * This repo writes the bare form today (`## 0.7.0`). Both are accepted anyway,
 * because the failure is silent in exactly the direction that looks fine, and
 * the cost of accepting both is one alternation.
 *
 * Matching stays EXACT on the version: `0.7.0` must not match `0.7.0-pre.11`.
 */
const SECTION = /^##\s+(?:\[([^\]]+)\]|(\S+))/

function headingVersion(line) {
  const m = SECTION.exec(line)
  return m ? (m[1] ?? m[2]) : null
}

export function extractSection(changelogText, version) {
  const lines = changelogText.split('\n')
  const start = lines.findIndex((l) => headingVersion(l) === version)
  if (start === -1) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      end = i
      break
    }
  }
  return lines.slice(start + 1, end).join('\n').trim() || null
}
