import { defineStore } from "pinia";
import type { Item } from "../models/item";

export interface IItemStore {
    setData: (data: Item) => void
}

export interface IItemStoreState extends Item {
    name?: string
}

export const useItemStore = (id?: string) => defineStore(id ?? 'item', {
    state: (): IItemStoreState => ({
        "@id": undefined,
        id: undefined,
        name: undefined
    }),

    actions: {
        setData(data: Partial<IItemStoreState>) {
            if (data['@id']) { this['@id'] = data['@id'] }

            if (data.id) { this.id = data.id }

            if (data.name) { this.name = data.name }
        }
    }
})()