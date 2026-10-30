<script setup lang="ts">
import { useEnhancedStore } from '../stores/enhanced-store'

const store = useEnhancedStore()
</script>

<template>
    <section>
        <h2>defineAStoreCtx</h2>
        <p>State: {{ store.label }}</p>
        <button type="button" @click="store.toggle()">Toggle plugin state</button>
    </section>
</template>
