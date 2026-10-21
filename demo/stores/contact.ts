import { ParentStore, useErrorsStore, useResourceIdStore } from "pinia-plugin-extending-store"
import { defineAStoreCtx, getEnhancedStore } from "pinia-plugin-subscription";
import { computed, ref } from "vue";
import { isEmpty } from "../../src/utils/validation";

import type { Contact } from "../models/contact"
import type { ErrorsStore, ResourceId, ResourceIdStore } from "pinia-plugin-extending-store"


export interface ContactStore extends ErrorsStore, Omit<ResourceIdStore, 'setData'> {
    contact: Contact
    setData: (data: ContactState) => void
}

export interface ContactState extends Omit<Contact, 'id'>, ResourceId {
}


export const useContactStore = (id?: string) => defineAStoreCtx<ContactStore, ContactState>(
    id ?? 'contact',
    (ctx) => {
        const email = ref<string>()
        const firstname = ref<string>()
        const lastname = ref<string>()

        const contact = computed(() => {
            const store = getStore()

            return {
                '@id': store['@id'],
                id: store.id,
                email: store.email,
                firstname: firstname.value,
                lastname: lastname.value
            }
        })

        function getStore() {
            return getEnhancedStore<ContactStore & ContactState>(ctx)
        }

        function setData(data: ContactState, strictValidation: boolean = true) {
            if (!isEmpty(data.email)) {
                //getStore().email = data.email;
                email.value = data.email;
            } else if (strictValidation) {
                getStore().addError({ id: id + '-email', message: 'Email is required' })
            }

            if (data.firstname) { firstname.value = data.firstname; }
            if (data.lastname) { lastname.value = data.lastname; }
        }

        return {
            contact,
            email,
            firstname,
            lastname,
            setData
        }
    },
    {
        parentsStores: [
            //new ParentStore(id + '-contact-information', useContactInformationStore),
            new ParentStore(id + '-resource-id', useResourceIdStore, { actionsToExtends: ['setData'] }),
            new ParentStore(id + '-error', useErrorsStore)
        ]
    }
)()