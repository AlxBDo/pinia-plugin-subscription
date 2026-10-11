<script setup lang="ts">
defineProps({
    name: { type: String },
    value: { type: [Boolean, Number, String], required: true }
})
</script>

<template>
    <p>
        <span v-if="name">{{ name }} : </span>
        <span>{{ typeof value === 'boolean' ? value.toString() : value }}</span>
    </p>
</template>