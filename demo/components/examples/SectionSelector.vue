<script setup lang="ts">
import type { PropType } from 'vue'

defineProps({
    activeSection: { type: String, required: true },
    sections: { type: Array as PropType<string[]>, required: true }
})
</script>

<template>
    <p class="section-selector">
        <a v-for="section in sections" :id="`show-${section}`"
            :class="{ 'is-active-section': activeSection === section }" @click="$emit('setActiveSection', section)">{{
                section }}</a>
    </p>
</template>

<style scoped>
.section-selector {
    display: flex;
    justify-content: space-between;
    font-size: 1.2em;

    a {
        &.is-active-section {
            font-weight: bolder;
            order: 0;
        }

        &:not(.is-active-section),
        &:not(:hover) {
            opacity: 0.65;
            font-size: smaller;
        }
    }
}
</style>