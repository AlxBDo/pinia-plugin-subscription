import { PluginSubscriber } from 'pinia-plugin-subscription/helpers'
import DemoStore from '../core/DemoStore'


class DemoPluginSubscriber extends PluginSubscriber<DemoStore> {

    constructor() {
        super(
            'demo-plugin-class',
            DemoStore.customizeStore.bind(DemoStore)
        )
    }
}

export function createDemoPluginClass(): DemoPluginSubscriber {
    return new DemoPluginSubscriber()
}