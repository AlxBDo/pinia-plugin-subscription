export function isEmpty(value: any): boolean {
    if (!value) {
        return (typeof value === 'boolean' || typeof value === 'number') ? false : true
    }

    if (Array.isArray(value)) {
        return value.length === 0
    }

    if (typeof value === 'object') {
        return Object.keys(value).length === 0
    }

    if (typeof value === 'string') {
        return value.trim() === ''
    }

    return false
}