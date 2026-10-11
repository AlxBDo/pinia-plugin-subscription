<script setup lang="ts">
import CodeExplanation from '../../../shared/CodeExplanation.vue'

</script>

<template>
    <h3>Lists Store creation</h3>
    <CodeExplanation>
        <template #explanation>
            <small>
                We create an instance of the lists store using <code>useListsStore</code> and type it
                with the appropriate methods and state.
            </small>
        </template>

        <template #code>
            <pre>
                {{`
import { defineAStore } from "../../../utils/store"
import { ParentStore, useCollectionStore } from "pinia-plugin-extending-store"

import type { CollectionStoreMethods, SearchCollectionCriteria } from "pinia-plugin-extending-store"
import type { List } from "../../models/liste"


export interface ListsStoreMethods extends Omit<CollectionStoreMethods, 'getItems'> {
    getLists: (criteria?: SearchCollectionCriteria) => List[]
}

export interface ListsState { lists: List[] }

export const useListsStore = (id?: string) => defineAStore<ListsStoreMethods, ListsState>(
    id ?? 'lists',
    () => ({}),
    {
        parentsStores: [
            new ParentStore('listsCollection', useCollectionStore, { actionsToRename: { getItems: 'getLists' } })
        ]
    }
)()`}}
            </pre>
        </template>
    </CodeExplanation>
</template>