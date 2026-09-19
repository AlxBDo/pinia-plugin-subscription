import { toRaw } from 'vue'
import { deepClone } from '../utils/deep-clone'

import type { StateTree } from 'pinia'
import type { CreateStateSnapshotKeys } from '../types/plugin'


export function createStateSnapshot(state: StateTree, keys: CreateStateSnapshotKeys = 'all') {
    if (Array.isArray(keys)) {
        const clonedState: Partial<StateTree> = {}
        for (const key of keys) {
            if (key in state) {
                clonedState[key] = deepClone(toRaw(state[key]))
            }
        }
        return clonedState
    }

    if (keys !== 'all') {
        throw new Error(`Invalid keys parameter: ${keys}`)
    }

    return deepClone(toRaw(state))
}