<script setup lang="ts">
import DisplayText from './DisplayText.vue';

defineProps({
    name: { type: String },
    value: { type: [Object], required: true }
})
</script>

<template>
    <div>
        <p v-if="name">{{ name }}</p>
        <DisplayText v-for="(property, index) in Object.keys(value)" :key="`${property}-${index}`" :name="property"
            :value="value[property]" />
    </div>
</template>