import { ref } from 'vue'
import { defineAStore } from '../../src/utils/store'
import { useItemStore } from './item'
import { ParentStore } from "pinia-plugin-extending-store"

export const useRollbackSnapshotStore = (rollback = false) => defineAStore(
    'rollbackSnapshotStore' + (rollback ? 'WithRollback' : ''),
    () => {
        const count = ref(0)
        const anotherRef = ref('initial value')

        function codeError(arg1: string, arg2: string, i: number = 100) {
            increment(i)
            console.log('useRollbackSnapshotStore.codeError - before error - count:', count.value, arg1, arg2)
            if (arg1 || arg2) {
                anotherRef.value = arg1 ?? "" + arg2 ? ` - ${arg2}` : ''
            }
            return error
        }

        function increment(i: number = 1) {
            count.value += i
        }

        function throwError() {
            increment(24)
            console.log('useRollbackSnapshotStore.throwError - before error - count:', count.value)
            throw new Error('This is a test error')
        }

        return {
            codeError,
            count,
            anotherRef,
            increment,
            throwError
        }
    }, {
    active: true,
    parentsStores: [new ParentStore('rollbackItem', useItemStore)],
    rollbackAfterFailure: rollback ? {
        codeError: ['count'],
        throwError: ['count']
    } : undefined
})()