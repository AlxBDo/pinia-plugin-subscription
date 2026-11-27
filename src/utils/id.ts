const idCount = new Map<string, number>()
const instanceToId = new WeakMap<Object, string>();

/**
 * Generate a unique ID for a given string.
 * @param id The base string to generate a unique ID for.
 * @returns A unique ID string.
 */
export function generateUniqueId(id: string): string {
    const count = (idCount.get(id) ?? 0) + 1
    idCount.set(id, count)
    return `${id}-${count}`
}

/**
 * Get the unique ID assigned to an instance.
 * @param instance The instance to get the unique ID for.
 * @returns The unique ID of the instance, or undefined if not registered.
 */
export function getInstanceUid(instance: object) {
    return instanceToId.get(instance);
}

/**
 * Register an instance with a unique ID.
 * @param id The base string to generate a unique ID for.
 * @param instance The instance to register.
 * @returns The unique ID assigned to the instance.
 */
export function registerInstance(id: string, instance: object): string {
    if (!instanceToId.has(instance)) {
        instanceToId.set(instance, generateUniqueId(id));
    }
    return instanceToId.get(instance)!;
}

export function unregisterInstance(instance: object) {
    instanceToId.delete(instance);
}