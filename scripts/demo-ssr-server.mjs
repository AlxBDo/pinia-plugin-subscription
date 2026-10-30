import { createServer as createHttpServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer as createViteServer } from 'vite'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const demoRoot = resolve(projectRoot, 'demo')
const vite = await createViteServer({
    configFile: resolve(projectRoot, 'vite.demo.config.ts'),
    server: { middlewareMode: true },
    appType: 'custom'
})

async function renderRequest(request, response) {
    try {
        const url = request.url ?? '/'
        const pathname = new URL(url, 'http://localhost').pathname
        const template = await readFile(resolve(demoRoot, 'index.html'), 'utf-8')
        const transformedTemplate = await vite.transformIndexHtml(url, template)
        const { renderDemo } = await vite.ssrLoadModule('/entry-server.ts')
        const { html, state } = await renderDemo(pathname, {
            acceptLanguage: request.headers['accept-language']
        })
        const serializedState = JSON.stringify(state)
            .replace(/</g, '\\u003c')
            .replace(/\u2028/g, '\\u2028')
            .replace(/\u2029/g, '\\u2029')
        const page = transformedTemplate
            .replace('<!--ssr-outlet-->', html)
            .replace(
                '<script type="application/json" id="pinia-state">null</script>',
                `<script type="application/json" id="pinia-state">${serializedState}</script>`
            )

        response.statusCode = 200
        response.setHeader('Content-Type', 'text/html; charset=utf-8')
        response.end(page)
    } catch (error) {
        if (error instanceof Error) {
            vite.ssrFixStacktrace(error)
        }
        console.error('SSR demo request failed:', error)
        response.statusCode = 500
        response.end('Internal Server Error')
    }
}

const server = createHttpServer((request, response) => {
    const requestPath = new URL(request.url ?? '/', 'http://localhost').pathname
    const isDocumentRequest = request.headers.accept?.includes('text/html') || requestPath === '/'

    if (request.method === 'GET' && isDocumentRequest) {
        void renderRequest(request, response)
        return
    }

    vite.middlewares(request, response, () => {
        response.statusCode = 404
        response.end('Not Found')
    })
})
const port = Number(process.env.PORT ?? 5174)
const host = process.env.HOST ?? 'localhost'

await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(port, host, resolveListen)
})

console.info(`SSR demo running at http://${host}:${port}`)

async function closeServers() {
    await new Promise((resolveClose, rejectClose) => {
        server.close((error) => error ? rejectClose(error) : resolveClose())
    })
    await vite.close()
}

process.once('SIGINT', () => void closeServers())
process.once('SIGTERM', () => void closeServers())
