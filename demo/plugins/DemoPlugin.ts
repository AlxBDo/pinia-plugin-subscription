import { PluginSubscriber } from 'pinia-plugin-subscription'
import DemoStore from '../core/DemoStore'


class DemoPluginSubscriber extends PluginSubscriber<DemoStore> {

    constructor() {
        super(
            'demo-plugin',
            DemoStore.customizeStore.bind(DemoStore)
        )
    }
}

export const DemoPlugin = new DemoPluginSubscriber()