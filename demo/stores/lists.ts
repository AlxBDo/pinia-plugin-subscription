import { defineAStore } from "../../src/utils/store"
import { ParentStore } from "pinia-plugin-extending-store"
import { useCollectionStore } from "pinia-plugin-extending-store/stores"

import type { CollectionStoreMethods, SearchCollectionCriteria } from "pinia-plugin-extending-store/types"
import type { List } from "../models/liste"


export interface ListsStoreMethods extends Omit<CollectionStoreMethods, 'getItems'> {
    getLists: (criteria?: SearchCollectionCriteria) => List[]
}

export interface ListsState { lists: List[] }


export const useListsStore = (id?: string) => defineAStore<ListsStoreMethods, ListsState>(
    id ?? 'lists',
    () => ({}),
    {
        active: true,
        demo: true,
        parentsStores: [
            new ParentStore('listsCollection', useCollectionStore, {
                actionsToRename: { getItems: 'getLists' },
                propertiesToRename: { items: 'lists' }
            })
        ]
    }
)()

export type ListsStore = ReturnType<typeof useListsStore>