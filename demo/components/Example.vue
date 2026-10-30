<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRollbackSnapshotStore } from '../stores/rollback-snapshot'

const rollbackSnapshotStoreHistory = ref<string[]>([])
const withoutRollbackSnapshotStoreHistory = ref<string[]>([])
const rollbackSnapshotStoreWithRollback = useRollbackSnapshotStore(true)
const rollbackSnapshotStoreWithoutRollback = useRollbackSnapshotStore(false)
const timers = new Set<ReturnType<typeof setTimeout>>()

function schedule(callback: () => void, delay: number): void {
    const timer = setTimeout(() => {
        timers.delete(timer)
        callback()
    }, delay)
    timers.add(timer)
}

onMounted(() => {
    schedule(() => {
        rollbackSnapshotStoreHistory.value.push(`increment +1`)
        rollbackSnapshotStoreWithRollback.increment()
    }, 500)
    schedule(() => {
        try {
            rollbackSnapshotStoreHistory.value.push(`increment +25 & codeError`)
            rollbackSnapshotStoreWithRollback.codeError('rollbackSnapshotStore', 'WithRollback', 25)
        } catch (error) {
        }
    }, 1000)
    schedule(() => {
        rollbackSnapshotStoreHistory.value.push(`increment +1`)
        rollbackSnapshotStoreWithRollback.increment()
        try {
            rollbackSnapshotStoreHistory.value.push(`increment +24 & throwError`)
            rollbackSnapshotStoreWithRollback.throwError()
        } catch (error) {
        }
    }, 2000)
    schedule(() => rollbackSnapshotStoreWithoutRollback.increment(), 2500)
    schedule(() => {
        withoutRollbackSnapshotStoreHistory.value.push(`$rollbackAfterFailure & increment +1 & codeError`)
        rollbackSnapshotStoreWithoutRollback.$rollbackAfterFailure({
            action: 'codeError',
            stateKeys: ['count']
        }, ['useRollbackSnapshotStore', 'using $rollbackAfterFailure', 50])
    }, 3000)
    schedule(() => {
        withoutRollbackSnapshotStoreHistory.value.push(`increment +1`)
        rollbackSnapshotStoreWithoutRollback.increment()

        withoutRollbackSnapshotStoreHistory.value.push(`$rollbackAfterFailure & increment +24 & throwError`)
        rollbackSnapshotStoreWithoutRollback.$rollbackAfterFailure({
            action: 'throwError',
            stateKeys: ['count']
        })
    }, 4000)
    schedule(() => {
        withoutRollbackSnapshotStoreHistory.value.push(`increment +1`)
        rollbackSnapshotStoreWithoutRollback.increment()
        try {
            withoutRollbackSnapshotStoreHistory.value.push(`increment +24 & throwError`)
            rollbackSnapshotStoreWithoutRollback.throwError()
        } catch (error) { }
    }, 5000)
})

onBeforeUnmount(() => timers.forEach(clearTimeout))
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

        <div id="stores">
            <article class="panel panel--option">
                <header>
                    <span class="badge badge--option">storeOptions</span>
                    <h3>Store with rollback</h3>
                </header>
                <dl>
                    <dt>$state.count</dt>
                    <dd>{{ rollbackSnapshotStoreWithRollback.count }}</dd>
                </dl>
                <p class="panel__label">Actions history</p>
                <ul>
                    <li v-for="(entry, index) in rollbackSnapshotStoreHistory" :key="index">{{ entry }}</li>
                </ul>
            </article>
            <article class="panel panel--method">
                <header>
                    <span class="badge badge--method">$rollbackAfterFailure()</span>
                    <h3>Store without rollback</h3>
                </header>
                <dl>
                    <dt>$state.count</dt>
                    <dd>{{ rollbackSnapshotStoreWithoutRollback.count }}</dd>
                </dl>
                <p class="panel__label">Actions history</p>
                <ul>
                    <li v-for="(entry, index) in withoutRollbackSnapshotStoreHistory" :key="index">{{ entry }}</li>
                </ul>
            </article>
        </div>
    </div>
</template>

<style scoped>
#stores {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1rem;
}

.panel {
    padding: 1rem;
    border: 1px solid;
    border-radius: 12px;
}

.panel--option {
    border-color: #2fb67c;
    background: color-mix(in srgb, #2fb67c 8%, transparent);
}

.panel--method {
    border-color: #646cff;
    background: color-mix(in srgb, #646cff 8%, transparent);
}

.panel header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.4rem;
}

.panel h3 {
    margin: 0;
}

.panel dl {
    margin: 1rem 0 0;
}

.panel dt {
    font-size: 0.8rem;
    opacity: 0.7;
}

.panel dd {
    margin: 0;
    font-weight: 600;
}

.panel__label {
    margin: 1rem 0 0.25rem;
    font-size: 0.8rem;
    opacity: 0.7;
}

.panel ul {
    margin: 0;
    padding-left: 1.25rem;
}

.badge {
    display: inline-block;
    padding: 0.15rem 0.6rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: #fff;
}

.badge--option {
    background: #2fb67c;
}

.badge--method {
    background: #646cff;
}
</style>