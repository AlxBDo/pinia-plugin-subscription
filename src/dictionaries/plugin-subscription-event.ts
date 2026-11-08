function namespacesToString(namespaces: string[]) {
    return namespaces.join(':')
}

function store(namespaces: string[]) {
    return namespacesToString(['store', ...namespaces])
}

function subscriber(namespaces: string[]) {
    return namespacesToString(['subscriber', ...namespaces])
}

const ACTION_AFTER = store(['action', 'after'])
const ACTION_BEFORE = store(['action', 'before'])
const ACTION_ERROR = store(['action', 'error'])
const ACTION_ON_ERROR = store(['action', 'onError'])

export const STORE = {
    ACTION_AFTER,
    ACTION_BEFORE,
    ACTION_ERROR,
    ACTION_ON_ERROR
}

export const SUBSCRIBER = {
    INVOKED: subscriber(['invoked'])
}
