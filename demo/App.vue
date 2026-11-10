<script setup>
import Example from './components/Example.vue'
import EnhancedExample from './components/EnhancedExample.vue'
import HydrationEnvironmentExample from './components/HydrationEnvironmentExample.vue'
import Header from './components/header/Header.vue'

// `experiment` folders are git-ignored: the glob is simply empty when they are absent.
// Never import them statically from tracked files, or clones without them will not build.
const experiments = Object.values(
  import.meta.glob('./components/experiment/ExperimentIndex.vue', { eager: true, import: 'default' })
)
</script>

<template>
  <Header />
  <main>
    <Example />
    <EnhancedExample />
    <HydrationEnvironmentExample />
    <section v-if="experiments.length">
      <h2>Experiments (local)</h2>
      <component :is="experiment" v-for="(experiment, index) in experiments" :key="index" />
    </section>
  </main>
</template>

<style scoped></style>
