#!/usr/bin/env node
/**
 * Generate route manifest by scanning src/app/routes/*.routes.tsx + index.
 * Recursively joins parent path prefixes for relative child routes.
 */
import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

const ROOT = process.cwd()
const ROUTES_DIR = resolve(ROOT, 'src/app/routes')
const OUT_DIR = resolve(ROOT, 'tests/contracts')
const E2E_DIR = resolve(ROOT, 'e2e')

function joinPath(parent, child) {
  if (!child || child === '') return parent || '/'
  if (child.startsWith('/')) return child
  if (!parent || parent === '/') return `/${child}`
  return `${parent.replace(/\/$/, '')}/${child}`
}

/**
 * Lightweight brace-aware walk for route object literals containing path: '...'
 * Handles nested children arrays used by React Router configs.
 */
function extractPathsFromSource(src, moduleHint, sourceFile) {
  const routes = []
  const redirects = new Map()

  // Redirect pairs
  const navRe =
    /path:\s*['"`]([^'"`]+)['"`][\s\S]{0,240}?Navigate\s+to=["']([^"']+)["']/g
  for (const m of src.matchAll(navRe)) {
    redirects.set(m[1].startsWith('/') ? m[1] : `/${m[1]}`, m[2])
  }

  function walk(text, parentPath) {
    // Find path: '...' or path: "..." at this nesting level by scanning sequentially
    let i = 0
    while (i < text.length) {
      const pathMatch = text.slice(i).match(/path:\s*['"`]([^'"`]+)['"`]/)
      const childrenMatch = text.slice(i).match(/children:\s*\[/)
      const indexMatch = text.slice(i).match(/index:\s*true/)

      // Choose earliest of path / children / index
      const candidates = []
      if (pathMatch) candidates.push({ kind: 'path', idx: i + pathMatch.index, m: pathMatch })
      if (childrenMatch)
        candidates.push({ kind: 'children', idx: i + childrenMatch.index, m: childrenMatch })
      if (indexMatch) candidates.push({ kind: 'index', idx: i + indexMatch.index, m: indexMatch })
      if (!candidates.length) break
      candidates.sort((a, b) => a.idx - b.idx)
      const next = candidates[0]

      if (next.kind === 'path') {
        const rel = next.m[1]
        const full = joinPath(parentPath, rel)
        const before = text.slice(Math.max(0, next.idx - 500), next.idx)
        let permission = null
        const permSingle = before.match(/permission=["']([^"']+)["']/)
        const permArr = before.match(/permission=\{\[([^\]]+)\]\}/)
        if (permSingle) permission = [permSingle[1]]
        else if (permArr) {
          permission = [...permArr[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1])
        }
        const isRedirect = redirects.has(full) || redirects.has(rel)
        routes.push({
          route_id: pathToId(full, moduleHint),
          path: full,
          module: moduleHint,
          parent_guard: before.includes('PermissionRoute')
            ? 'PermissionRoute'
            : before.includes('AdminAuthGuard')
              ? 'AdminAuthGuard'
              : null,
          nested_permission: permission,
          redirect_target: isRedirect ? redirects.get(full) || redirects.get(rel) : null,
          dynamic_params: [...full.matchAll(/:([A-Za-z0-9_]+)/g)].map((x) => x[1]),
          kind: isRedirect ? 'redirect' : 'primary',
          source_file: sourceFile,
          test_status: 'unknown',
        })

        // Look ahead for children of this route object
        const afterPath = text.slice(next.idx + next.m[0].length)
        const childIdx = afterPath.search(/children:\s*\[/)
        const nextPathIdx = afterPath.search(/path:\s*['"`]/)
        if (childIdx >= 0 && (nextPathIdx < 0 || childIdx < nextPathIdx)) {
          const absChild = next.idx + next.m[0].length + childIdx
          const sliceStart = text.indexOf('[', absChild)
          const { inner, end } = readBracket(text, sliceStart)
          walk(inner, full)
          i = end + 1
        } else {
          i = next.idx + next.m[0].length
        }
      } else if (next.kind === 'children') {
        const sliceStart = text.indexOf('[', next.idx)
        const { inner, end } = readBracket(text, sliceStart)
        walk(inner, parentPath)
        i = end + 1
      } else {
        // index: true under parent
        routes.push({
          route_id: pathToId(parentPath || '/', moduleHint) + '-INDEX',
          path: parentPath || '/',
          module: moduleHint,
          parent_guard: null,
          nested_permission: null,
          redirect_target: null,
          dynamic_params: [],
          kind: 'primary',
          source_file: sourceFile,
          test_status: 'unknown',
        })
        i = next.idx + next.m[0].length
      }
    }
  }

  walk(src, '')
  return routes
}

function readBracket(text, openIdx) {
  let depth = 0
  for (let i = openIdx; i < text.length; i++) {
    if (text[i] === '[') depth++
    else if (text[i] === ']') {
      depth--
      if (depth === 0) return { inner: text.slice(openIdx + 1, i), end: i }
    }
  }
  return { inner: text.slice(openIdx + 1), end: text.length - 1 }
}

function pathToId(path, moduleHint) {
  const slug =
    path
      .replace(/^\//, '')
      .replace(/\//g, '_')
      .replace(/:/g, '')
      .replace(/-/g, '_')
      .toUpperCase() || 'ROOT'
  const prefix = (moduleHint || 'APP').slice(0, 6).toUpperCase()
  return `${prefix}-${slug}`
}

function moduleFromFilename(name) {
  return name.replace(/\.routes\.tsx$/, '').replace(/\.tsx$/, '')
}

function listE2ECoverage() {
  const covered = new Set()
  if (!existsSync(E2E_DIR)) return covered
  const walk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name)
      if (ent.isDirectory()) walk(p)
      else if (/\.(spec|test)\.ts$/.test(ent.name)) {
        const text = readFileSync(p, 'utf8')
        for (const m of text.matchAll(/['"`](\/[A-Za-z0-9_:\-/?=&]+)['"`]/g)) {
          covered.add(m[1].split('?')[0])
        }
      }
    }
  }
  walk(E2E_DIR)
  return covered
}

function pathPatternMatch(pattern, concrete) {
  const re = new RegExp('^' + pattern.replace(/:[^/]+/g, '[^/]+') + '$')
  return re.test(concrete)
}

function main() {
  const files = readdirSync(ROUTES_DIR).filter(
    (f) => f.endsWith('.routes.tsx') || f === 'index.tsx',
  )
  let all = []
  for (const f of files) {
    const abs = join(ROUTES_DIR, f)
    const src = readFileSync(abs, 'utf8')
    all.push(
      ...extractPathsFromSource(src, moduleFromFilename(f), abs.replace(ROOT + '/', '')),
    )
  }

  // Also ensure /admin/login from index
  if (!all.some((r) => r.path === '/admin/login')) {
    all.push({
      route_id: 'AUTH-ADMIN_LOGIN',
      path: '/admin/login',
      module: 'index',
      parent_guard: null,
      nested_permission: null,
      redirect_target: null,
      dynamic_params: [],
      kind: 'primary',
      source_file: 'src/app/routes/index.tsx',
      test_status: 'unknown',
    })
  }

  const byPath = new Map()
  for (const r of all) byPath.set(r.path, r)
  all = [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path))

  const e2ePaths = listE2ECoverage()
  for (const r of all) {
    if (r.kind === 'redirect') {
      r.test_status = 'redirect_assert_only'
      continue
    }
    const hit =
      e2ePaths.has(r.path) ||
      [...e2ePaths].some((p) => r.path.includes(':') && pathPatternMatch(r.path, p))
    r.test_status = hit ? 'has_e2e_reference' : 'untested'
  }

  const primary = all.filter((r) => r.kind === 'primary')
  const redirects = all.filter((r) => r.kind === 'redirect')
  const withTests = primary.filter((r) => r.test_status === 'has_e2e_reference')
  const untested = primary.filter((r) => r.test_status === 'untested')

  const summary = {
    generated_at: new Date().toISOString(),
    source: 'src/app/routes',
    total_paths: all.length,
    primary_routes: primary.length,
    redirect_routes: redirects.length,
    primary_with_e2e_reference: withTests.length,
    primary_untested: untested.length,
    docs_baseline_note:
      'ROUTE_AUDIT_TEST_BRIEF.md is an audit baseline (~147 primary); live count is recalculated here.',
  }

  const payload = { summary, routes: all, untested_primary: untested.map((r) => r.path) }
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, 'route-manifest.json'), JSON.stringify(payload, null, 2))
  writeFileSync(
    join(OUT_DIR, 'route-coverage-gap.md'),
    [
      '# Route coverage gap',
      '',
      `Generated: ${summary.generated_at}`,
      '',
      `- Primary routes: **${summary.primary_routes}**`,
      `- With E2E path reference: **${summary.primary_with_e2e_reference}**`,
      `- Untested primary: **${summary.primary_untested}**`,
      `- Redirects: **${summary.redirect_routes}**`,
      '',
      '## Untested primary paths',
      '',
      ...untested.map((r) => `- \`${r.path}\` (${r.source_file})`),
      '',
    ].join('\n'),
  )

  console.log('Route manifest written → tests/contracts/route-manifest.json')
  console.log(
    `Primary: ${summary.primary_routes} | E2E refs: ${summary.primary_with_e2e_reference} | Untested: ${summary.primary_untested} | Redirects: ${summary.redirect_routes}`,
  )
}

main()
