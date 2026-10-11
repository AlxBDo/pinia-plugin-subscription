<script lang="ts" setup>
import { ref } from 'vue'
import { useListsStore } from '../../../stores/lists'

import AddList from './demo/AddList.vue'
import DisplayResult from '../displayResult/DisplayResult.vue'
import GetById from './demo/GetById.vue'
import GetItems from './demo/GetItems.vue'
import RemoveList from './demo/RemoveList.vue'
import SectionSelector from '../SectionSelector.vue'
import StoreCreation from './explanation/StoreCreation.vue'


const activeSection = ref<'explanation' | 'forms'>('explanation')
const listTypeLabels = ['wish', 'shopping', 'task']

function setActiveSection(section: 'explanation' | 'forms') {
    activeSection.value = section
}

function resetStore() {
    listsStore.$reset()
}


const listsStore = useListsStore()

if (!listsStore?.lists?.length) {
    listsStore.setItems([
        { id: 1, name: 'My first list', type: '0' },
        { id: 2, name: 'My second list', type: '1' },
        { id: 3, name: 'My third list', type: '2' }
    ])
}
</script>

<template>
    <div>
        <h2>Lists store</h2>
        <p>
            This page is an example of creating a collection store of lists. The store called <code>useListsStore</code>
            extends the <code>useCollectionStore</code> store to benefit from its state properties and methods.
        </p>
        <div id="container">
            <SectionSelector :active-section :sections="['explanation', 'forms']"
                @setActiveSection="setActiveSection" />

            <section v-if="activeSection === 'explanation'" id="explanation">
                <StoreCreation />
            </section>

            <section v-if="activeSection === 'forms'" id="forms">
                <div>
                    <h3>Lists contains in store</h3>
                    <DisplayResult :result="listsStore.lists" />
                    <button @click="resetStore">Reset Store</button>
                </div>
                <AddList :list-type-labels :lists-store />
                <RemoveList :lists="listsStore.lists" :remove-item="listsStore.removeItem" />
                <GetById :get-item="listsStore.getItem" />
                <GetItems :lists-store />
            </section>
        </div>
    </div>
</template>

<style scoped>
#forms {
    display: flex;
    justify-content: space-between;
    margin: auto;
    flex-wrap: wrap;

    div:first-of-type {
        width: 90%;
    }
}

#forms :deep(form) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    max-width: 550px;
    min-width: 320px;
    width: 100%;
    margin: 2% auto;

    h3 {
        width: 100%;
        margin: 0;
    }
}
</style>