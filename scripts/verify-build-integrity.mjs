import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '../dist')

const ASSET_REF_PATTERN =
  /(?:src|href)=["'](\/assets\/[^"']+\.(?:js|css))["']|import\(["'](\/assets\/[^"']+\.js)["']\)/g

function walkFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath))
    } else {
      files.push(fullPath)
    }
  }
  return files
}

function collectAssetReferences(content) {
  const refs = new Set()
  for (const match of content.matchAll(ASSET_REF_PATTERN)) {
    refs.add(match[1] ?? match[2])
  }
  return refs
}

function assertDistExists() {
  if (!existsSync(distDir)) {
    console.error('Build integrity failed: dist/ directory not found. Run `npm run build` first.')
    process.exit(1)
  }
}

function verifyIndexHtml() {
  const indexPath = path.join(distDir, 'index.html')
  if (!existsSync(indexPath)) {
    console.error('Build integrity failed: dist/index.html is missing.')
    process.exit(1)
  }

  const html = readFileSync(indexPath, 'utf8')
  const refs = collectAssetReferences(html)
  const missing = [...refs].filter((ref) => !existsSync(path.join(distDir, ref.slice(1))))

  if (missing.length > 0) {
    console.error('Build integrity failed: index.html references missing assets:')
    for (const ref of missing) console.error(`  - ${ref}`)
    process.exit(1)
  }

  if (!html.includes('name="app-build-id"')) {
    console.error('Build integrity failed: index.html is missing app-build-id meta tag.')
    process.exit(1)
  }
}

function verifyGeneratedAssets() {
  const files = walkFiles(distDir).filter((file) => file.endsWith('.js') || file.endsWith('.css'))
  const missing = []

  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    const refs = collectAssetReferences(content)
    for (const ref of refs) {
      const assetPath = path.join(distDir, ref.slice(1))
      if (!existsSync(assetPath)) {
        missing.push({ from: path.relative(distDir, file), ref })
      }
    }
  }

  if (missing.length > 0) {
    console.error('Build integrity failed: generated bundles reference missing assets:')
    for (const item of missing) {
      console.error(`  - ${item.from} -> ${item.ref}`)
    }
    process.exit(1)
  }
}

function verifyStorefrontLayoutChunk() {
  const assetDir = path.join(distDir, 'assets')
  if (!existsSync(assetDir)) {
    console.error('Build integrity failed: dist/assets directory is missing.')
    process.exit(1)
  }

  const storefrontChunks = readdirSync(assetDir).filter((name) => name.startsWith('StorefrontLayout-'))
  if (storefrontChunks.length === 0) {
    console.error('Build integrity failed: StorefrontLayout chunk was not generated.')
    process.exit(1)
  }
}

function verifyServiceWorkerReferences() {
  const swPath = path.join(distDir, 'sw.js')
  if (!existsSync(swPath)) return

  const sw = readFileSync(swPath, 'utf8')
  const precacheMatches = [...sw.matchAll(/"([^"]+\.(?:js|css|html|svg|png|webmanifest))"/g)].map(
    (match) => match[1],
  )

  const missing = precacheMatches.filter((ref) => {
    const normalized = ref.startsWith('/') ? ref.slice(1) : ref
    return !existsSync(path.join(distDir, normalized))
  })

  if (missing.length > 0) {
    console.error('Build integrity failed: service worker references missing precache assets:')
    for (const ref of missing) console.error(`  - ${ref}`)
    process.exit(1)
  }
}

function summarize() {
  const assetCount = readdirSync(path.join(distDir, 'assets')).length
  const distSize = walkFiles(distDir).reduce((total, file) => total + statSync(file).size, 0)
  console.log(`Build integrity passed (${assetCount} assets, ${(distSize / 1024 / 1024).toFixed(2)} MB).`)
}

assertDistExists()
verifyIndexHtml()
verifyGeneratedAssets()
verifyStorefrontLayoutChunk()
verifyServiceWorkerReferences()
summarize()
