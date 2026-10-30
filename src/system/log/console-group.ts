/**
 * Utility function to create console groups with different styles.
 * @param groupType The type of console group: 'collapsed', 'expanded', or 'none'.
 * @param args The arguments to be passed to the console group.
 * @returns void
 * 
 */
export function consoleGroup(groupType: 'collapsed' | 'expanded' | 'none' = 'none', ...args: any[]) {
    if (groupType === 'collapsed') {
        console.groupCollapsed(
            '%c%s',
            'color: #f7f7b0; padding: 1px; margin-right: 5px; font-size: 11px',
            ...args)
    } else if (groupType === 'expanded') {
        console.group(
            '%c%s',
            'color: #f7f7b0; padding: 1px; margin-right: 5px; font-size: 11px',
            ...args)
    }
}