<script setup>
import Example from './components/Example.vue'
import EnhancedExample from './components/EnhancedExample.vue'
import HydrationEnvironmentExample from './components/HydrationEnvironmentExample.vue'
import Header from './components/header/Header.vue'

</script>

<template>
  <Header />
  <main>
    <Example />
    <EnhancedExample />
    <HydrationEnvironmentExample />
  </main>
</template>

<style scoped></style>
