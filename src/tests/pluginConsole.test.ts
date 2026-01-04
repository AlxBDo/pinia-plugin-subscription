import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PluginConsole } from '../system/log'
import { pluginName } from '../utils/constantes'

describe('PluginConsole', () => {
    let consoleSpy: any

    beforeEach(() => {
        consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    })

    afterEach(() => {
        consoleSpy.mockRestore()
    })

    it('should expose the plugin name', () => {
        expect((PluginConsole as any)._pluginName).toBe(pluginName)
    })

    it('generateStyle returns the expected CSS string', () => {
        const css = (PluginConsole as any).generateStyle({ bgColor: '#abc', color: '#123' })
        expect(css).toBe('background-color: #abc; color: #123; padding: 1px; margin-right: 5px; font-size: 12px')
    })

    it('formatMessage formats messages correctly', () => {
        const formatted = (PluginConsole as any).formatMessage('Test', '🔥')
        expect(formatted).toBe(` [🔥 ${pluginName}] - Test `)
    })

    it('getStyleDefinition returns info by default and error when requested', () => {
        const info = (PluginConsole as any).getStyleDefinition()
        expect(info).toEqual({ bgColor: '#ffec73', color: 'green', icon: '🍍⚡' })

        const error = (PluginConsole as any).getStyleDefinition('error')
        expect(error).toEqual({ bgColor: '#d24545', color: 'white', icon: '🍍⚠️' })
    })

    it('rebuildArgs with a string returns a single formatted message', () => {
        const rebuilt = (PluginConsole as any).rebuildArgs('hello', '🔥')
        expect(rebuilt).toEqual([` [🔥 ${pluginName}] - hello `])
    })

    it('rebuildArgs with an array shifts the message and keeps extra args', () => {
        const rebuilt = (PluginConsole as any).rebuildArgs(['hello', 1, true], '🔥')
        expect(rebuilt).toEqual([` [🔥 ${pluginName}] - hello `, 1, true])
    })

    it('log calls console.log with the info style and formatted message', () => {
        PluginConsole.log('Test message')
        expect(console.log).toHaveBeenCalledWith(
            '%c%s',
            'background-color: #ffec73; color: green; padding: 1px; margin-right: 5px; font-size: 12px',
            ` [🍍⚡ ${pluginName}] - Test message `
        )
    })

    it('error calls console.log with the error style and formatted message', () => {
        PluginConsole.error('Test error')
        expect(console.log).toHaveBeenCalledWith(
            '%c%s',
            'background-color: #d24545; color: white; padding: 1px; margin-right: 5px; font-size: 12px',
            ` [🍍⚠️ ${pluginName}] - Test error `
        )
    })

    it('useLog works with array args and forwards extra args', () => {
        ; (PluginConsole as any).useLog({ bgColor: '#000', color: '#111', icon: '⭐' }, ['Hello', 'world', 42])
        expect(console.log).toHaveBeenCalledWith(
            '%c%s',
            'background-color: #000; color: #111; padding: 1px; margin-right: 5px; font-size: 12px',
            ` [⭐ ${pluginName}] - Hello `,
            'world',
            42
        )
    })
})
