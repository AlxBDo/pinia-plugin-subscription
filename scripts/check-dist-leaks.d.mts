export interface DistLeak {
    file: string
    line: number
    packageName: string
    specifier: string
}

export interface DistFile {
    file: string
    source: string
}

export declare function toPackageName(specifier: string): string
export declare function isRelativeSpecifier(specifier: string): boolean
export declare function collectSpecifiers(source: string): Array<{ specifier: string, line: number }>
export declare function findLeaks(files: DistFile[], allowedPackages: string[]): DistLeak[]
