const callIdSuffix = /#\d+$/

/**
 * Human readable name of a group: its last segment, without the call counter.
 * Group ids are built by the plugin, see `traceGroups` in `pinia-plugin-subscription/helpers`.
 */
export function getTraceGroupName(groupId: string): string {
    const segment = groupId.slice(groupId.lastIndexOf('/') + 1)
    if (segment === 'plugin') { return 'Plugin setup' }
    return segment.replace(callIdSuffix, '').replace(':', ' · ')
}
