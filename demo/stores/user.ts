import { ParentStore } from "pinia-plugin-extending-store"
import { useContactStore } from "./contact"
import type { User } from "../models/user"
import { defineAStoreCtx, getEnhancedStore } from "pinia-plugin-subscription";
import { computed, ref } from "vue"
import type { ContactState, ContactStore } from "./contact"
import type { List } from "../models/liste"


export interface UserStore extends ContactStore {
    setData: (data: Partial<UserState>) => void
    user: User
}

export interface UserState extends ContactState, Omit<User, 'id'> {
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


        function setData(data: Partial<UserState>) {
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