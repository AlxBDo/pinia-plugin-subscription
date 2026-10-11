<script setup lang="ts">
import { ref, type PropType } from 'vue'
import MethodDemoForm from '../../../shared/form/MethodDemoForm.vue'
import type { } from '../../../../stores/collection'
import type { CollectionState, CollectionStoreMethods, ExtendedStore } from '../../../../types/store'
import type { List } from '../../../../models/liste'
import { ListsStoreMethods } from '../../../../stores/lists'

const props = defineProps({
    listsStore: {
        type: Object as PropType<ExtendedStore<ListsStoreMethods, CollectionState<List>>>,
        required: true
    }
})
const itemType = ref<string>('0')

function getItemsByType() {
    return { result: props.listsStore.getLists({ type: itemType.value }), name: 'List' }
}
</script>

<template>
    <MethodDemoForm :get-result="getItemsByType" title="Get items by type" submit-btn="Get Items">
        <template #inputs>
            <label for="itemType">Item Type:</label>
            <select id="itemType" v-model="itemType" required>
                <option value="0">Wish</option>
                <option value="1">Shopping</option>
                <option value="2">Task</option>
            </select>
        </template>
    </MethodDemoForm>
</template>