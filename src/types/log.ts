export interface Console {
    log(...args: any): void
    error(...args: any): void
}

export type LogType = 'error' | 'info'

export type StyleDefinition = Record<StyleDefinitionKeys, string>

export type StyleDefinitionKeys = 'bgColor' | 'color' | 'icon'

export type StyleDefinitions = Record<LogType, Record<StyleDefinitionKeys, string>>