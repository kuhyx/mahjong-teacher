import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { NAME, ORIGIN, ROUTES, SUMMARY } from '../src/site/routes.ts'

// Post-build: write robots.txt, sitemap.xml, llms.txt, the ai-catalog, the
// markdown mirrors and 404.html into dist/, all from src/site/routes.ts.
const dist = join(import.meta.dirname, '../dist')
const w = (rel: string, text: string): void => {
  const file = join(dist, rel)
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(file, text)
}

w('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`)
w('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${ROUTES.map((r) => `  <url><loc>${ORIGIN}${r.path}</loc></url>`).join('\n')}\n</urlset>\n`)
w('llms.txt', `# ${NAME}\n\n> ${SUMMARY}\n\n## Pages\n\n${ROUTES.map((r) => `- [${r.title}](${ORIGIN}${r.path}index.md): ${r.description}`).join('\n')}\n`)
w('.well-known/ai-catalog.json', `${JSON.stringify({
  specVersion: '0.1',
  host: { displayName: NAME, url: ORIGIN },
  entries: [
    { identifier: 'llms-txt', type: 'llms.txt', url: `${ORIGIN}/llms.txt` },
    ...ROUTES.map((r) => ({ identifier: `page${r.path === '/' ? '-home' : r.path.replaceAll('/', '-')}`, type: 'text/markdown', url: `${ORIGIN}${r.path}index.md` })),
  ],
}, null, 2)}\n`)
for (const r of ROUTES) w(`${r.path.slice(1)}index.md`, r.markdown())
w('404.html', `<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>Not found - ${NAME}</title></head><body><h1>Page not found</h1><p>This address is not part of ${NAME}. The game lives on the <a href="/">home page</a>.</p></body></html>\n`)
process.stdout.write('agent artifacts written\n')
