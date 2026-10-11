import { ParentStore } from "pinia-plugin-extending-store"
import { ContactState, ContactStore, useContactStore } from "./contact"
import type { User } from "../models/user"
import { defineAStoreCtx, getEnhancedStore } from "pinia-plugin-subscription";
import { computed, ref } from "vue"
import { List } from "../models/liste"


export interface UserStore extends ContactStore {
    setData: (data: Partial<UserState>) => void
    user: User
}

export interface UserState extends ContactState, User {
    lists?: List[]
    password: string
}


export const useUserStore = (id?: string) => defineAStoreCtx<UserStore, UserState>(
    id ?? 'user',
    (ctx) => {
        const lists = ref<List[]>()
        const password = ref<string>()

        const user = computed(() => ({
            ...(getEnhancedStore<ContactStore & ContactState>(ctx)?.contact ?? {}),
            password: password.value
        }))


        function setData(data: UserState) {
            if (data.lists) { lists.value = data.lists; }
            if (data.password) { password.value = data.password; }
        }

        return {
            lists,
            password,
            setData,
            user
        }
    },
    {
        parentsStores: [
            new ParentStore('userContact', useContactStore, { actionsToExtends: ['setData'] })
        ]
    }
)()