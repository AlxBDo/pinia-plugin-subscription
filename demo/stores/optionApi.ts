import { ParentStore, useResourceIdStore } from "pinia-plugin-extending-store";
import { defineAStore } from "../../src/utils/store";

import type { ResourceId, ResourceIdStore } from "pinia-plugin-extending-store";


export interface OptionApiState extends ResourceId {
    test?: string
}

export interface OptionApiStore extends ResourceIdStore {
    logTest: () => void
    setTest: (testData: OptionApiState) => void
}


export const useOptionApiStore = defineAStore<OptionApiStore, OptionApiState>(
    'optionApiStore',
    {
        state: () => ({
            test: undefined
        }),
        actions: {
            setTest(testData: OptionApiState) {
                if (testData.test) { this.test = testData.test }

                this.setData && this.setData(testData)
            }
        }
    },
    { parentsStores: [new ParentStore('optionApi', useResourceIdStore)] }
)