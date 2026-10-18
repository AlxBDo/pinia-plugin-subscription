import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CustomConsole } from '../system/log'
import { pluginName } from '../utils/constants'

class PluginConsole extends CustomConsole {
    protected _pluginName = pluginName
}

const pluginConsole = new PluginConsole()

describe('CustomConsole', () => {
    let consoleSpy: any

    beforeEach(() => {
        consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    })

    afterEach(() => {
        consoleSpy.mockRestore()
    })

    it('should expose the plugin name', () => {
        expect((pluginConsole as any)._pluginName).toBe(pluginName)
    })

    it('generateStyle returns the expected CSS string', () => {
        const css = (pluginConsole as any).generateStyle({ bgColor: '#abc', color: '#123' })
        expect(css).toBe('background-color: #abc; color: #123; padding: 1px; margin-right: 5px; font-size: 12px')
    })

    it('formatMessage formats messages correctly', () => {
        const formatted = (pluginConsole as any).formatMessage('Test', '🔥')
        expect(formatted).toBe(` [🔥 ${pluginName}] \n Test \n`)
    })

    it('getStyleDefinition returns info by default and error when requested', () => {
        const info = (pluginConsole as any).getStyleDefinition()
        expect(info).toEqual({ bgColor: 'transparent', color: '#f2f286', icon: '🍍⚡' })

        const error = (pluginConsole as any).getStyleDefinition('error')
        expect(error).toEqual({ bgColor: '#d24545', color: 'white', icon: '🍍⚠️' })
    })

    it('rebuildArgs with a string returns a single formatted message', () => {
        const rebuilt = (pluginConsole as any).rebuildArgs('hello', '🔥')
        expect(rebuilt).toEqual(['hello'])
    })

    it('rebuildArgs with an array shifts the message and keeps extra args', () => {
        const rebuilt = (pluginConsole as any).rebuildArgs(['hello', 1, true], '🔥')
        expect(rebuilt).toEqual(['hello', 1, true])
    })

    it('log calls console.log with the info style and formatted message', () => {
        pluginConsole.log('Test message')
        expect(console.log).toHaveBeenCalledWith(
            '%c%s',
            'background-color: transparent; color: #f2f286; padding: 1px; margin-right: 5px; font-size: 12px',
            'Test message'
        )
    })

    it('error calls console.log with the error style and formatted message', () => {
        pluginConsole.error('Test error')
        expect(console.log).toHaveBeenCalledWith(
            '%c%s',
            'background-color: #d24545; color: white; padding: 1px; margin-right: 5px; font-size: 12px',
            'Test error'
        )
    })

    it('useLog works with array args and forwards extra args', () => {
        ; (pluginConsole as any).useLog({ bgColor: '#000', color: '#111', icon: '⭐' }, ['Hello', 'world', 42])
        expect(console.log).toHaveBeenCalledWith(
            '%c%s',
            'background-color: #000; color: #111; padding: 1px; margin-right: 5px; font-size: 12px',
            'Hello',
            'world',
            42
        )
    })
})
