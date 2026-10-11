<script setup lang="ts">
import { useSlots } from 'vue'

const slots = useSlots()
</script>

<template>
    <div>
        <div class="code-explanation">
            <slot name="explanation"></slot>
        </div>
        <div class="code">
            <code>
                <slot name="code"></slot> 
            </code>
        </div>
        <slot name="tips"></slot>
    </div>
</template>

<style scoped>
div {
    margin: 15px auto;
    padding: 5px;

    div {
        margin: 10px;
        padding: 5px;
    }
}
</style>