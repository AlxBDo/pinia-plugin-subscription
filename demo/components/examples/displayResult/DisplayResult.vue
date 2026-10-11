<script setup lang="ts">
import DisplayObject from './DisplayObject.vue';
import DisplayText from './DisplayText.vue';

defineProps({
    name: { type: String },
    result: { type: [Array, Boolean, Number, Object, String], required: true }
})
</script>

<template>
    <template v-if="Array.isArray(result)">
        <div class="code" v-if="result.length">
            <template v-for="(item, index) in result" :key="`${name ?? 'item'}-${index}`">
                <DisplayObject v-if="typeof item === 'object'" :name="name ? `${name} ${index + 1}` : undefined"
                    :value="item" />
                <DisplayText v-else :name="name ? `${name} ${index + 1}` : undefined" :value="item" />
            </template>
        </div>
        <div v-else class="code">
            No item found
        </div>
    </template>
    <div v-else class="code">
        <DisplayObject v-if="typeof result === 'object'" :name :value="result" />
        <DisplayText v-else :name :value="result" />
    </div>
</template>

<style scoped>
.code {
    flex-wrap: wrap;
    justify-content: space-between;
    margin: 2% auto;

    &>div {
        display: flex;
        justify-content: space-between;
        width: 45%;
        border-bottom: 1px dashed;
    }
}
</style>