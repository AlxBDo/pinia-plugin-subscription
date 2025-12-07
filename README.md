# Pinia Plugin Subscription

This project is a Pinia plugin for Vue.js designed to enhance the functionality of Pinia stores by providing subscription capabilities. It allows developers to subscribe to store changes and execute custom logic when the store state changes.

## Features

- **Store Subscriptions**: Subscribe to Pinia store changes and execute custom logic.
- **Debugging Support**: Enable debug mode to log store changes and subscriptions.
- **Reset Store**: Reset the store to its initial state with custom callbacks.

## Installation

To install the plugin, you can use npm or yarn:

```bash
npm install pinia-plugin-subscription
```

or

```bash
yarn add pinia-plugin-subscription
```

## Usage

### Basic Usage

1. **Import the Plugin**: Import the `createPlugin` function from the plugin.

```typescript
import { createPlugin } from 'pinia-plugin-subscription';
```

2. **Create a Subscriber**: Create a subscriber object with an `invoke` method that will be called when the store changes.

```typescript
const subscriber = {
  invoke: (context, debug) => {
    console.log('Store changed:', context.store.$state);
  }
};
```

3. **Use the Plugin**: Use the plugin in your Pinia instance.

```typescript
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';

const app = createApp(App);
const pinia = createPinia();

pinia.use(createPlugin([subscriber]));

app.use(pinia);
app.mount('#app');
```

### Advanced Usage

#### Debug Mode

Enable debug mode to log store changes and subscriptions.

```typescript
pinia.use(createPlugin([subscriber], true));
```

#### Reset Store Callbacks

Add custom callbacks to be executed when the store is reset.

```typescript
const subscriber = {
  invoke: (context, debug) => {
    console.log('Store changed:', context.store.$state);
  },
  resetStoreCallback: (store) => {
    console.log('Store reset:', store);
  }
};
```

## API

### `createPlugin(subscribers: PluginSubscriber[], debug?: boolean): PiniaPlugin`

Creates a Pinia plugin with the given subscribers and debug mode.

- **subscribers**: An array of subscriber objects with an `invoke` method.
- **debug**: Optional boolean to enable debug mode.

### `PluginSubscriber`

An interface for subscriber objects.

- **invoke**: A method that will be called when the store changes. It receives the Pinia plugin context and debug mode as arguments.
- **resetStoreCallback**: Optional method that will be called when the store is reset. It receives the store as an argument.


