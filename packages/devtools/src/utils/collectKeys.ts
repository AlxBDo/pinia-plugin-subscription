/** Own enumerable keys, plus accessors/methods inherited from class prototypes (e.g. getters of subclassed stores). */
export function collectKeys(object: object): string[] {
    const keys = new Set(Object.keys(object))
    let proto = Object.getPrototypeOf(object)
    while (proto && proto !== Object.prototype && proto !== Array.prototype) {
        for (const key of Object.getOwnPropertyNames(proto)) {
            if (key !== 'constructor') { keys.add(key) }
        }
        proto = Object.getPrototypeOf(proto)
    }
    return [...keys]
}
