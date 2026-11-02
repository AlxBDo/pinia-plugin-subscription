declare const process: { env: { NODE_ENV?: string } } | undefined

/**
 * Tells whether the host application is built for production.
 * The literal `process.env.NODE_ENV` expression is kept on purpose: consumer bundlers
 * (Vite, webpack, Nuxt...) replace it statically. Without a bundler `process` may be
 * undefined, in which case the environment is not considered production.
 */
export function isProductionEnvironment(): boolean {
    try {
        return process!.env.NODE_ENV === 'production'
    } catch {
        return false
    }
}
