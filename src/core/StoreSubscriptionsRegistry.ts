import { Store } from "pinia";

export default class StoreSubscriptionsRegistry {
    constructor(
        private _subscriptions: Map<Store, Map<string, Set<string>>>
    ) { }
}