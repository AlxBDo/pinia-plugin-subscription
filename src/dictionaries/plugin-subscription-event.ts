function namespacesToString(namespaces: string[]) {
    return namespaces.join(':')
}


function plugin(namespaces: string[]) {
    return namespacesToString(['plugin', ...namespaces])
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


export const PLUGIN = {
    EXECUTION: {
        END: plugin(['execution', 'end']),
        ERROR: plugin(['execution', 'error']),
        START: plugin(['execution', 'start'])
    }
}

export const STORE = {
    ACTION_AFTER,
    ACTION_BEFORE,
    ACTION_ERROR,
    ACTION_ON_ERROR,
    DISPOSE: store(['dispose']),
    MUTATION: store(['mutation']),
    RESET: store(['reset'])
}

export const SUBSCRIBER = {
    INVOKED: subscriber(['invoked'])
}
