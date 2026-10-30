import { ref } from 'vue'
import { defineAStore } from 'pinia-plugin-subscription'

export const useRollbackSnapshotStore = (rollback = false) => defineAStore(
    'rollbackSnapshotStore' + (rollback ? 'WithRollback' : ''),
    () => {
        const count = ref(0)
        const anotherRef = ref('initial value')

        function codeError(arg1: string, arg2: string, i: number = 100) {
            increment(i)
            if (arg1 || arg2) {
                anotherRef.value = `${arg1 ?? ''}${arg2 ? ` - ${arg2}` : ''}`
            }
            // Voluntary runtime failure: triggers the rollback of `count`
            throw new ReferenceError('codeError: undefined variable')
        }

        function increment(i: number = 1) {
            count.value += i
        }

        function throwError() {
            increment(24)
            anotherRef.value = 'error happened'
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
    demo: true,
    rollbackAfterFailure: rollback ? {
        codeError: ['count'],
        throwError: ['all']
    } : undefined
})()