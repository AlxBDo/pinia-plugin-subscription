<script setup lang="ts">
import { ref } from 'vue'
import MethodDemoForm from '../../../shared/form/MethodDemoForm.vue'

const props = defineProps({
    getItem: { type: Function, required: true }
})

const listId = ref<number>()

function getResult() {
    if (!listId.value) { return }

    return { result: props.getItem({ id: listId.value }), name: `List - ${listId.value}` }
}
</script>

<template>
    <MethodDemoForm :get-result title="Get List by Id" submit-btn="Get List">
        <template #inputs>
            <div>
                <label for="itemId">Item ID:</label>
                <input id="itemId" v-model="listId" type="number" required>
            </div>
        </template>
    </MethodDemoForm>
</template>