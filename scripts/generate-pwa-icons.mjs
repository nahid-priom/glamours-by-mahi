import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const iconsDir = path.join(root, 'public', 'icons')

const sizes = [
  { name: 'icon-192.png', source: 'icon-source.svg', size: 192 },
  { name: 'icon-512.png', source: 'icon-source.svg', size: 512 },
  { name: 'icon-512-maskable.png', source: 'icon-maskable-source.svg', size: 512 },
  { name: 'apple-touch-icon.png', source: 'icon-source.svg', size: 180 },
  { name: 'icon-monochrome.png', source: 'icon-source.svg', size: 192, monochrome: true },
]

await mkdir(iconsDir, { recursive: true })

for (const { name, source, size, monochrome } of sizes) {
  const input = path.join(iconsDir, source)
  let pipeline = sharp(input).resize(size, size)
  if (monochrome) {
    pipeline = pipeline.grayscale().threshold(128)
  }
  await pipeline.png({ quality: 90 }).toFile(path.join(iconsDir, name))
  console.log(`Generated ${name}`)
}

console.log('PWA icons generated.')
