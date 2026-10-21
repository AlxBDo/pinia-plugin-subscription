//import { PluginSubscriber } from 'pinia-plugin-subscription/helpers'
import PluginSubscriber from '../../src/core/PluginSubscriber'
import DemoStore from '../core/DemoStore'


class DemoPluginSubscriber extends PluginSubscriber<DemoStore> {

    constructor() {
        super(
            'demo-plugin-class',
            DemoStore.customizeStore.bind(DemoStore)
        )
    }
}

export const DemoPluginClass = new DemoPluginSubscriber()