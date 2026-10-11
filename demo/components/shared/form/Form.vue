<script setup lang="ts">
defineProps({
    cancelBtn: { type: [Boolean, String], default: false },
    submitBtn: { type: [Boolean, String], default: false },
    title: { type: String }
})
</script>

<template>
    <form @submit.prevent="$emit('onSubmit')">
        <slot name="title">
            <h3 v-if="title">{{ title }}</h3>
        </slot>

        <slot name="inputs"></slot>

        <slot name="actions">
            <div v-if="cancelBtn || submitBtn">
                <button v-if="cancelBtn" type="button" @click="$emit('onCancel')">{{ cancelBtn }}</button>
                <button v-if="submitBtn" type="submit">{{ submitBtn }}</button>
            </div>
        </slot>
    </form>
</template>