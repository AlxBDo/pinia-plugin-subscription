import { isRef, toRaw } from 'vue'
import { deepClone } from '../utils/deep-clone'

import type { StateTree } from 'pinia'
import type { Ref } from 'vue'
import type { CreateStateSnapshotKeys, StateSnapshot } from '../types/plugin'

export function createStateSnapshot(state: StateTree, keys: CreateStateSnapshotKeys = 'all'): StateSnapshot {
    if (keys !== 'all' && !Array.isArray(keys)) {
        throw new TypeError(`Invalid snapshot keys: ${String(keys)}`)
    }

    const all = keys === 'all'
    const rawState = toRaw(state)
    if (all) {
        for (const key of Reflect.ownKeys(rawState)) {
            const descriptor = Object.getOwnPropertyDescriptor(rawState, key)
            if (typeof key === 'symbol' || key === '__proto__' || !descriptor?.enumerable || !('value' in descriptor)) {
                throw new TypeError(`Unsupported snapshot property: ${String(key)}`)
            }
        }
    }
    const selectedKeys: string[] = (all ? Object.keys(state) : keys).map(key => {
        if ((typeof key !== 'string' && typeof key !== 'number') || key === '__proto__') {
            throw new TypeError(`Unsupported snapshot property: ${String(key)}`)
        }
        return String(key)
    })
    const values: StateTree = {}
    const refs = new Map<string, Ref>()
    const seen = new WeakMap<object, unknown>([[rawState, values]])

    for (const key of selectedKeys) {
        if (Object.prototype.hasOwnProperty.call(state, key)) {
            const descriptor = Object.getOwnPropertyDescriptor(rawState, key)
            if (!descriptor?.enumerable || !('value' in descriptor)) {
                throw new TypeError(`Unsupported snapshot property descriptor: ${key}`)
            }
            if (isRef(descriptor.value)) {
                refs.set(key, descriptor.value)
            }
            Object.defineProperty(values, key, {
                value: deepClone(state[key], seen),
                enumerable: true,
                configurable: true,
                writable: true
            })
        }
    }
    return { all, keys: selectedKeys, refs, values }
}

export function restoreStateSnapshot(state: StateTree, snapshot: StateSnapshot): void {
    const restored: StateTree = {}
    const seen = new WeakMap<object, unknown>([[snapshot.values, state]])
    for (const key of Object.keys(snapshot.values)) {
        Object.defineProperty(restored, key, {
            value: deepClone(snapshot.values[key], seen),
            enumerable: true,
            configurable: true,
            writable: true
        })
    }

    const keys = snapshot.all ? Reflect.ownKeys(toRaw(state)) : snapshot.keys
    for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(restored, key) && !Reflect.deleteProperty(state, key)) {
            throw new TypeError(`Cannot remove state property: ${String(key)}`)
        }
    }
    for (const key of Object.keys(restored)) {
        const originalRef = snapshot.refs.get(key)
        if (originalRef && Reflect.get(toRaw(state), key) !== originalRef && !Reflect.set(state, key, originalRef)) {
            throw new TypeError(`Cannot reattach state ref: ${key}`)
        }
        if (!Reflect.set(state, key, restored[key])) {
            throw new TypeError(`Cannot restore state property: ${key}`)
        }
    }
}
