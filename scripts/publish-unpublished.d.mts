export interface NpmViewResult {
    status: number | null
    stdout: string
    stderr: string
}

export declare function isVersionPublished(result: NpmViewResult): boolean
export declare function listPackageDirs(rootDir: string, workspaces?: string[]): string[]
export declare function parseDistTag(argv: string[]): string | undefined
export declare function buildPublishArgs(distTag?: string): string[]
