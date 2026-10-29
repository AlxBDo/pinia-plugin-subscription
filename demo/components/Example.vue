<script setup lang="ts">
import { ref } from 'vue'
import { useRollbackSnapshotStore } from '../stores/rollback-snapshot'

const rollbackSnapshotStoreHistory = ref<string[]>([])
const withoutRollbackSnapshotStoreHistory = ref<string[]>([])
const rollbackSnapshotStoreWithRollback = useRollbackSnapshotStore(true)

setTimeout(() => {
    rollbackSnapshotStoreHistory.value.push(`increment +1`)
    rollbackSnapshotStoreWithRollback.increment()
}, 500)
setTimeout(() => {
    try {
        rollbackSnapshotStoreHistory.value.push(`increment +25 & codeError`)
        rollbackSnapshotStoreWithRollback.codeError('rollbackSnapshotStore', 'WithRollback', 25)
    } catch (error) {
    }
}, 1000)
setTimeout(() => {
    rollbackSnapshotStoreHistory.value.push(`increment +1`)
    rollbackSnapshotStoreWithRollback.increment()
    try {
        rollbackSnapshotStoreHistory.value.push(`increment +24 & throwError`)
        rollbackSnapshotStoreWithRollback.throwError()
    } catch (error) {
    }
}, 2000)


const rollbackSnapshotStoreWithoutRollback = useRollbackSnapshotStore(false)

setTimeout(() => {
    rollbackSnapshotStoreWithoutRollback.increment()
}, 2500)
setTimeout(() => {
    withoutRollbackSnapshotStoreHistory.value.push(`$rollbackAfterFailure & increment +1 & codeError`)
    rollbackSnapshotStoreWithoutRollback.$rollbackAfterFailure({
        action: 'codeError',
        stateKeys: ['count']
    },
        ['useRollbackSnapshotStore', 'using $rollbackAfterFailure', 50]
    )
}, 3000)
setTimeout(() => {
    withoutRollbackSnapshotStoreHistory.value.push(`increment +1`)
    rollbackSnapshotStoreWithoutRollback.increment()

    withoutRollbackSnapshotStoreHistory.value.push(`$rollbackAfterFailure & increment +24 & throwError`)
    rollbackSnapshotStoreWithoutRollback.$rollbackAfterFailure({
        action: 'throwError',
        stateKeys: ['count']
    })
}, 4000)
setTimeout(() => {
    withoutRollbackSnapshotStoreHistory.value.push(`increment +1`)
    rollbackSnapshotStoreWithoutRollback.increment()
    try {
        withoutRollbackSnapshotStoreHistory.value.push(`increment +24 & throwError`)
        rollbackSnapshotStoreWithoutRollback.throwError()
    } catch (error) { }
}, 5000)
</script>

<template>
    <div>
        <h2>Examples</h2>

        <p>
            This page explains how to use the $state rollback feature after a failure.<br />
            One store uses storeOptions, and the other store uses the $rollbackAfterFailure function — except
            for one instance.<br />
            The console displays the logs from the useRollbackSnapshotStore store.<br />
        </p>

        <article>
            <h3>Store with rollback</h3>
            <p>$state.count: {{ rollbackSnapshotStoreWithRollback.count }}</p>
            <div>
                <p>Actions history:</p>
                <ul>
                    <li v-for="(entry, index) in rollbackSnapshotStoreHistory" :key="index">{{ entry }}</li>
                </ul>
            </div>
        </article>
        <article v-if="withoutRollbackSnapshotStoreHistory.length > 0">
            <h3>Store without rollback</h3>
            <p>$state.count: {{ rollbackSnapshotStoreWithoutRollback.count }}</p>
            <div>
                <p>Actions history:</p>
                <ul>
                    <li v-for="(entry, index) in withoutRollbackSnapshotStoreHistory" :key="index">{{ entry }}</li>
                </ul>
            </div>
        </article>
    </div>
</template>