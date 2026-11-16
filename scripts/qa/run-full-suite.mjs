#!/usr/bin/env node
/**
 * Full QA orchestrator for `npm run test`.
 * Runs independent phases to completion; aggregates exit codes.
 * Never recursively invokes `npm run test`.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { runPreflight } from './preflight.mjs'

const ROOT = process.cwd()
const OUT = resolve(ROOT, 'test-results')
mkdirSync(OUT, { recursive: true })

function run(cmd, args, opts = {}) {
  return new Promise((resolvePromise) => {
    const started = Date.now()
    const child = spawn(cmd, args, {
      cwd: ROOT,
      env: { ...process.env, ...opts.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (d) => {
      const s = d.toString()
      stdout += s
      process.stdout.write(s)
    })
    child.stderr?.on('data', (d) => {
      const s = d.toString()
      stderr += s
      process.stderr.write(s)
    })
    child.on('close', (code) => {
      resolvePromise({
        code: code ?? 1,
        duration_ms: Date.now() - started,
        stdout,
        stderr,
      })
    })
  })
}

function npmRun(script, extraArgs = []) {
  return run('npm', ['run', script, '--', ...extraArgs])
}

function npx(bin, args) {
  return run('npx', [bin, ...args])
}

function statusFrom(code, blocked = false, notRun = false) {
  if (notRun) return 'NOT RUN'
  if (blocked) return 'BLOCKED'
  if (code === 0) return 'PASS'
  return 'FAIL'
}

async function main() {
  const startedAt = new Date().toISOString()
  console.log('\n========================================')
  console.log('GLAMOROUS GALLERY BY MAHI')
  console.log('COMPLETE APPLICATION QA')
  console.log('========================================\n')

  const preflight = runPreflight()
  const phases = []

  const record = (id, name, result, { blocked = false, notRun = false, mandatory = true } = {}) => {
    const status = statusFrom(result?.code ?? 1, blocked, notRun)
    const entry = {
      id,
      name,
      status,
      exit_code: result?.code ?? (blocked || notRun ? null : 1),
      duration_ms: result?.duration_ms ?? 0,
      mandatory,
      blocked,
      summary: blocked
        ? 'Blocked by preflight / missing prerequisites'
        : notRun
          ? 'Skipped — dependency unavailable'
          : undefined,
    }
    phases.push(entry)
    const icon = status.padEnd(8)
    console.log(
      `\n[${id}] ${name} → ${icon} (${Math.round((entry.duration_ms || 0) / 1000)}s)\n`,
    )
    return entry
  }

  // [01] Environment Validation
  record('01', 'Environment Validation', { code: preflight.ok ? 0 : 1, duration_ms: 0 }, {
    blocked: !preflight.ok,
    mandatory: true,
  })

  // [02] Route Discovery
  {
    const r = await run('node', ['scripts/qa/generate-route-manifest.mjs'])
    record('02', 'Route Discovery', r)
  }

  // [03] TypeScript
  {
    const r = await npmRun('typecheck')
    record('03', 'TypeScript', r)
  }

  // [04] Lint
  {
    const r = await npmRun('lint')
    record('04', 'Lint', r)
  }

  // [05] Unit Tests (full Vitest — unique primary unit count)
  {
    const r = await npmRun('test:unit')
    record('05', 'Unit Tests', r)
  }

  // [06] Component Tests (subset; overlap with 05 noted in summary — not additive coverage)
  {
    const r = await npmRun('test:components')
    record('06', 'Component Tests (subset of unit tree)', r)
  }

  // [07] Feature Vitest under src/features/**/__tests__ (mocked/service — not live DB)
  {
    const r = await npmRun('test:features')
    record('07', 'Feature Vitest (mocked/service)', r)
  }

  // [08] Database Tests — BLOCKED when TEST_DATABASE_URL unsafe/missing (never PASS)
  {
    if (!preflight.db_ready) {
      record('08', 'Database Tests', { code: 0, duration_ms: 0 }, {
        blocked: true,
        mandatory: true,
      })
      phases[phases.length - 1].summary =
        preflight.test_database_block_reason ||
        'TEST_DATABASE_URL missing/unsafe — BLOCKED (not PASS). DATABASE_URL is never a silent fallback.'
    } else {
      const r = await npmRun('test:db')
      if (r.code !== 0) {
        record('08', 'Database Tests', r, { blocked: true, mandatory: true })
        phases[phases.length - 1].status = 'BLOCKED'
        phases[phases.length - 1].summary = 'SQL smoke failed against staging TEST_DATABASE_URL'
      } else {
        record('08', 'Database Tests', r)
      }
    }
  }

  // [09] Authentication
  {
    if (!preflight.auth_ready) {
      record('09', 'Authentication', { code: 0, duration_ms: 0 }, { blocked: true })
    } else {
      const r = await npx('playwright', [
        'test',
        'e2e/auth',
        '--project=desktop',
        `--output=${OUT}/playwright-auth`,
      ])
      record('09', 'Authentication', r)
    }
  }

  // [10] RBAC — fail/block when critical cashier cases not seeded
  {
    if (!preflight.auth_ready) {
      record('10', 'RBAC', { code: 0, duration_ms: 0 }, { blocked: true })
    } else {
      if (preflight.db_ready && !existsSync(resolve(OUT, 'staging-fixtures.json'))) {
        await run('node', ['scripts/qa/seed-staging-fixtures.mjs'])
      }
      const r = await npx('playwright', [
        'test',
        'e2e/rbac',
        '--project=desktop',
        `--output=${OUT}/playwright-rbac`,
      ])
      const cashierSeeded = existsSync(resolve(OUT, 'staging-fixtures.json'))
      if (!cashierSeeded) {
        // Critical cashier matrix not executable — BLOCKED (never PASS)
        record('10', 'RBAC (cashier matrix BLOCKED)', r.code === 0 ? r : r, {
          blocked: true,
          mandatory: true,
        })
        phases[phases.length - 1].summary =
          'Disposable cashier not seeded — critical denial matrix BLOCKED (not PASS)'
        if (r.code !== 0) {
          phases[phases.length - 1].status = 'FAIL'
          phases[phases.length - 1].blocked = false
        }
      } else {
        record('10', 'RBAC', r)
      }
    }
  }

  // [11] Route Smoke
  {
    const unit = await npmRun('test:routes')
    if (!preflight.auth_ready) {
      record('11', 'Route Smoke', unit)
    } else {
      const e2e = await npx('playwright', [
        'test',
        'e2e/routes',
        '--project=desktop',
        `--output=${OUT}/playwright-routes`,
      ])
      record('11', 'Route Smoke', {
        code: unit.code || e2e.code,
        duration_ms: unit.duration_ms + e2e.duration_ms,
      })
    }
  }

  // [12] Module E2E (shell-level — labeled honestly)
  {
    if (!preflight.auth_ready) {
      record('12', 'Module E2E shells', { code: 0, duration_ms: 0 }, { blocked: true })
    } else {
      const r = await npx('playwright', [
        'test',
        'e2e/modules',
        'e2e/sales/exchange-cases.spec.ts',
        '--project=desktop',
        `--output=${OUT}/playwright-modules`,
      ])
      record('12', 'Module E2E shells + exchange cases', r)
    }
  }

  // [13] Cross-Module E2E — run read-only always when auth ready; mutating subset gated
  {
    if (!preflight.auth_ready) {
      record('13', 'Cross-Module E2E', { code: 0, duration_ms: 0 }, { blocked: true })
    } else {
      const r = await npx('playwright', [
        'test',
        'e2e/critical-flows',
        '--project=desktop',
        `--output=${OUT}/playwright-critical`,
      ])
      if (!preflight.mutating_allowed) {
        if (r.code !== 0) {
          record('13', 'Cross-Module E2E (read-only ran; failures present)', r)
        } else {
          record('13', 'Cross-Module E2E (mutating subset BLOCKED)', r, {
            blocked: true,
            mandatory: true,
          })
          phases[phases.length - 1].summary =
            'Read-only critical flows executed; mutating transactions BLOCKED without ALLOW_MUTATING_E2E + safe TEST_DATABASE_URL'
        }
      } else {
        record('13', 'Cross-Module E2E', r)
      }
    }
  }

  // [14] Inventory UI smoke (not DB recon)
  {
    if (!preflight.auth_ready) {
      record('14', 'Inventory UI smoke', { code: 0, duration_ms: 0 }, { blocked: true })
    } else {
      const r = await npx('playwright', [
        'test',
        'e2e/inventory',
        '--project=desktop',
        `--output=${OUT}/playwright-inventory`,
      ])
      record('14', 'Inventory UI smoke', r)
    }
  }

  // [14b] Inventory DB reconciliation
  {
    if (!preflight.db_ready) {
      record('14b', 'Inventory DB reconciliation', { code: 0, duration_ms: 0 }, {
        blocked: true,
        mandatory: true,
      })
      phases[phases.length - 1].summary = 'Requires safe TEST_DATABASE_URL — not claimed from UI smoke'
    } else {
      const r = await run('node', ['scripts/qa/inventory-db-recon.mjs'])
      record('14b', 'Inventory DB reconciliation', r)
    }
  }

  // [15] Responsive Tests
  {
    if (!preflight.auth_ready) {
      record('15', 'Responsive Tests', { code: 0, duration_ms: 0 }, { blocked: true })
    } else {
      const r = await npx('playwright', [
        'test',
        'e2e/responsive',
        '--project=desktop',
        `--output=${OUT}/playwright-responsive`,
      ])
      record('15', 'Responsive Tests', r)
    }
  }

  // [16] Print/Export shell smoke (not output-accuracy proof)
  {
    if (!preflight.auth_ready) {
      record('16', 'Print/Export shell smoke', { code: 0, duration_ms: 0 }, { blocked: true })
    } else {
      const r = await npx('playwright', [
        'test',
        'e2e/print',
        '--project=desktop',
        `--output=${OUT}/playwright-print`,
      ])
      record('16', 'Print/Export shell smoke', r)
    }
  }

  // [17] Production Build
  {
    const r = await npmRun('build')
    record('17', 'Production Build', r)
  }

  const finishedAt = new Date().toISOString()
  const passed = phases.filter((p) => p.status === 'PASS').length
  const failed = phases.filter((p) => p.status === 'FAIL').length
  const blocked = phases.filter((p) => p.status === 'BLOCKED').length
  const notRun = phases.filter((p) => p.status === 'NOT RUN').length

  let routeCoverage = null
  const manifestPath = resolve(ROOT, 'tests/contracts/route-manifest.json')
  if (existsSync(manifestPath)) {
    try {
      routeCoverage = JSON.parse(readFileSync(manifestPath, 'utf8')).summary
    } catch {
      routeCoverage = null
    }
  }

  const mandatoryFailed = phases.some(
    (p) => p.mandatory && (p.status === 'FAIL' || p.status === 'BLOCKED'),
  )
  // Soft: BLOCKED auth when no credentials should fail the suite for full `npm run test`
  // per V5: missing auth → BLOCKED and nonzero when mandatory
  const overall = failed > 0 || mandatoryFailed ? 'FAIL' : 'PASS'

  const summary = {
    run_id: preflight.run_id,
    environment: preflight.test_environment_id,
    git_commit: process.env.GITHUB_SHA ?? null,
    started_at: startedAt,
    finished_at: finishedAt,
    mutating_allowed: preflight.mutating_allowed,
    auth_ready: preflight.auth_ready,
    db_ready: preflight.db_ready,
    phases,
    total_phases: phases.length,
    passed,
    failed,
    blocked,
    skipped: notRun,
    skipped_critical: phases
      .filter((p) => p.status === 'BLOCKED' && p.mandatory)
      .map((p) => p.id + ' ' + p.name),
    coverage_overlap_note:
      'Phase 06 is a subset of phase 05 Vitest files — do not sum counts as unique coverage.',
    db_reconciliation: existsSync(resolve(OUT, 'inventory-recon.json'))
      ? 'test-results/inventory-recon.json'
      : null,
    route_coverage: routeCoverage,
    overall,
    report_paths: {
      summary: 'test-results/summary.json',
      html: 'test-results/qa-report.html',
      preflight: 'test-results/preflight.json',
      route_manifest: 'tests/contracts/route-manifest.json',
      db_smoke: 'test-results/db-smoke.log',
    },
  }

  writeFileSync(resolve(OUT, 'summary.json'), JSON.stringify(summary, null, 2))
  writeFileSync(resolve(OUT, 'qa-report.html'), renderHtml(summary))

  console.log('\n========================================')
  console.log('CONSOLIDATED QA SUMMARY')
  console.log('========================================')
  console.log(
    `Phases: ${phases.length} | PASS: ${passed} | FAIL: ${failed} | BLOCKED: ${blocked} | NOT RUN: ${notRun}`,
  )
  console.log(`Overall: ${overall}`)
  console.log(`Report: test-results/qa-report.html\n`)

  for (const p of phases) {
    console.log(`  ${p.id} ${p.status.padEnd(8)} ${p.name}`)
  }

  process.exit(overall === 'PASS' ? 0 : 1)
}

function renderHtml(summary) {
  const rows = summary.phases
    .map(
      (p) =>
        `<tr><td>${p.id}</td><td>${escapeHtml(p.name)}</td><td class="${p.status.toLowerCase().replace(' ', '-')}">${p.status}</td><td>${p.duration_ms}ms</td></tr>`,
    )
    .join('\n')
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>QA Report ${escapeHtml(summary.run_id)}</title>
<style>
body{font-family:system-ui,sans-serif;margin:2rem;background:#0f1419;color:#e7ecf1}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #334;padding:.5rem;text-align:left}
.pass{color:#3dd68c}.fail{color:#f07178}.blocked{color:#ffcc66}.not-run{color:#888}
</style></head><body>
<h1>Glamorous Gallery By Mahi — QA Report</h1>
<p>Run: <code>${escapeHtml(summary.run_id)}</code> · Overall: <strong class="${summary.overall.toLowerCase()}">${summary.overall}</strong></p>
<p>Environment: ${escapeHtml(String(summary.environment ?? 'unset'))} · Mutating: ${summary.mutating_allowed} · Auth ready: ${summary.auth_ready}</p>
<p>PASS ${summary.passed} · FAIL ${summary.failed} · BLOCKED ${summary.blocked} · NOT RUN ${summary.skipped}</p>
<table><thead><tr><th>ID</th><th>Phase</th><th>Status</th><th>Duration</th></tr></thead>
<tbody>${rows}</tbody></table>
<p>No credentials are included in this report.</p>
</body></html>`
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
