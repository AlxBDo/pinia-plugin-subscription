import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '../dist')

const bundles = readdirSync(distDir)
  .filter(file => /\.(js|cjs|mjs)$/.test(file))
  .map(file => {
    const filePath = path.join(distDir, file)
    const bytes = statSync(filePath).size
    return {
      file,
      bytes,
      kb: Number((bytes / 1024).toFixed(2)),
    }
  })
  .sort((a, b) => a.bytes - b.bytes)

console.log('Bundle sizes (dist):')
for (const entry of bundles) {
  console.log(`- ${entry.file}: ${entry.kb} KB`)
}
