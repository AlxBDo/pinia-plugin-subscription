<script setup lang="ts">
import { ref, type PropType } from 'vue'
import MethodDemoForm from '../../../shared/form/MethodDemoForm.vue'
import type { CustomStore } from '../../../../types/store'
import { ListStoreMethods } from '../../../../stores/list'
import { ListsState } from '../../../../stores/lists'

const props = defineProps({
    listTypeLabels: {
        type: Array as PropType<string[]>,
        required: true
    },
    listsStore: {
        type: Object as PropType<CustomStore<ListStoreMethods, ListsState>>,
        required: true
    }
})

const newListName = ref('')
const newListType = ref('0')

function addNewList() {
    const newId = props.listsStore.lists.length + 1
    props.listsStore.addItem({ id: newId, name: newListName.value, type: newListType.value })

    initForm()
}

function initForm() {
    newListName.value = ''
    newListType.value = '0'
}
</script>

<template>
    <MethodDemoForm :get-result="addNewList" title="Add a list" submit-btn="Add">
        <template #inputs>
            <div>
                <label for="name">List name:</label>
                <input id="name" v-model="newListName" type="text" required>
            </div>
            <div>
                <label for="type">List type:</label>
                <select id="type" v-model="newListType" required>
                    <option v-for="type, index of listTypeLabels" :value="index">{{ type }}</option>
                </select>
            </div>
        </template>
    </MethodDemoForm>
</template>