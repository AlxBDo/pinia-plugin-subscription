<script setup lang="ts">
import { useOptionApiStore } from '../../../stores/optionApi'
import { useContactStore } from '../../../stores/contact';
import { useErrorsStore } from 'pinia-plugin-extending-store';
import { useRollbackSnapshotStore } from '../../../stores/rollback-snapshot'


const rollbackSnapshotStoreWithRollback = useRollbackSnapshotStore(true)
rollbackSnapshotStoreWithRollback.increment()
setTimeout(() => {
    rollbackSnapshotStoreWithRollback.codeError('rollbackSnapshotStore', 'WithRollback', 25)
    console.log('rollbackSnapshotStoreWithRollback - after codeError - count:', rollbackSnapshotStoreWithRollback.count)
}, 1000)
setTimeout(() => {
    rollbackSnapshotStoreWithRollback.increment()
    console.log('rollbackSnapshotStoreWithRollback - after increment - count:', rollbackSnapshotStoreWithRollback.count)
    rollbackSnapshotStoreWithRollback.throwError()
    console.log('rollbackSnapshotStoreWithRollback - after throwError - count:', rollbackSnapshotStoreWithRollback.count)
}, 2000)

console.log('rollbackSnapshotStoreWithRollback - count:', rollbackSnapshotStoreWithRollback.count, rollbackSnapshotStoreWithRollback)


const rollbackSnapshotStoreWithoutRollback = useRollbackSnapshotStore(false)
rollbackSnapshotStoreWithoutRollback.increment()
setTimeout(() => {
    rollbackSnapshotStoreWithoutRollback.$rollbackAfterFailure({
        action: 'codeError',
        stateKeys: ['count']
    },
        ['useRollbackSnapshotStore', 'using $rollbackAfterFailure', 50]
    )
    console.log('rollbackSnapshotStoreWithoutRollback.$rollbackAfterFailure - after codeError - count:', rollbackSnapshotStoreWithoutRollback.count)
}, 3000)
setTimeout(() => {
    rollbackSnapshotStoreWithoutRollback.increment()
    console.log('rollbackSnapshotStoreWithoutRollback - after increment - count:', rollbackSnapshotStoreWithoutRollback.count)

    rollbackSnapshotStoreWithoutRollback.$rollbackAfterFailure({
        action: 'throwError',
        stateKeys: ['count']
    })
    console.log('rollbackSnapshotStoreWithoutRollback.$rollbackAfterFailure - after throwError - count:', rollbackSnapshotStoreWithoutRollback.count)
}, 4000)
setTimeout(() => {
    rollbackSnapshotStoreWithoutRollback.increment()
    console.log('rollbackSnapshotStoreWithoutRollback - after increment - count:', rollbackSnapshotStoreWithoutRollback.count)
    try {
        rollbackSnapshotStoreWithoutRollback.throwError()
    } catch (error) {
        console.log('rollbackSnapshotStoreWithoutRollback - after throwError - count:', rollbackSnapshotStoreWithoutRollback.count)
    }
}, 5000)

console.log('rollbackSnapshotStoreWithoutRollback - count:', rollbackSnapshotStoreWithoutRollback.count, rollbackSnapshotStoreWithoutRollback)



const errorStore = useErrorsStore('test-error')

errorStore.errors = [
    { id: 'test-error-1', level: 1, message: 'Error 1 ' },
    { id: 'test-error-2', level: 2, message: 'Error 2' },
    { id: 'test-error-3', level: 3, message: 'Error 3' },
    { id: 'test-error-4', level: 4, message: 'Error 4' },
    { id: 'test-error-5', level: 5, message: 'Error 5' },
    { id: 'test-error-6', level: 6, message: 'Error 6' },
]

errorStore.removeError({ id: 'test-error-3' })

console.log('errors', errorStore.getErrors({ level: 1 }, '>='), errorStore.getErrorsByLevel(5), errorStore.getErrors(), errorStore)


const contactStore = useContactStore('newContactStore')
contactStore.setData({
    id: 2,
    firstname: 'contact',
    email: 'mycontact@mail.com',
})

contactStore.addError({ id: 'contact-error', message: 'Contact error' })

console.log('contactStore', [contactStore.getError({ id: 'contact-error' }), contactStore])


const optionApiStore = useOptionApiStore()
optionApiStore.setTest({ id: 1, test: 'my test string' })

setTimeout(async () => {
    console.log('optionApiStore', optionApiStore.id, optionApiStore)
    optionApiStore.test = 'An another test string'
}, 3000)

</script>

<template>
    <p>optionApiStore test: {{ optionApiStore.test }}</p>
</template>