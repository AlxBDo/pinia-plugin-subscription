import { PluginSubscriber } from 'pinia-plugin-subscription/helpers'
import DemoStore from '../core/DemoStore'


class DemoPluginSubscriber extends PluginSubscriber<DemoStore> {
    protected _name: string = 'DemoPluginSubscriber'

    constructor() {
        super(
            DemoStore.customizeStore.bind(DemoStore)
        )
    }
}

export function createDemoPluginClass(): DemoPluginSubscriber {
    return new DemoPluginSubscriber()
}