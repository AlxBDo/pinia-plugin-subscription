<script setup lang="ts">
import { PropType, ref } from 'vue'
import MethodDemoForm from '../../../shared/form/MethodDemoForm.vue'
import { List } from '../../../../models/liste'

const props = defineProps({
    lists: { type: Array as PropType<List[]> },
    removeItem: { type: Function, required: true }
})

const listId = ref<number>()

function getResult() {
    if (!listId.value) { return }

    props.removeItem({ id: listId.value })
}
</script>

<template>
    <MethodDemoForm v-if="lists && lists.length" :get-result title="Remove a list" submit-btn="Remove">
        <template #inputs>
            <div>
                <label for="itemId">Lists :</label>
                <select v-model="listId" required>
                    <option v-for="list in lists" :key="`list-rm-opt-${list.id}`" :value="list.id">
                        {{ list.name }}
                    </option>
                </select>
            </div>
        </template>
    </MethodDemoForm>
</template>