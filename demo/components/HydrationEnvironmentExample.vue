<script setup lang="ts">
import { useVisitorEnvironmentStore } from '../stores/visitor-environment'

const store = useVisitorEnvironmentStore()

// Fixed UTC format so the server HTML and the client render stay identical.
const formatTime = (isoDate: string) => `${isoDate.slice(11, 23)} UTC`
</script>

<template>
    <section class="environment">
        <h2>One store, hydrated by the right environment</h2>
        <p class="environment__intro">
            Two subscribers target the same store. The plugin runs each one <strong>only in its declared
                environment</strong>: the server fills what only a request can tell, the browser fills what only a
            browser can tell.
        </p>

        <div class="environment__panels">
            <article class="panel panel--server">
                <header>
                    <span class="badge badge--server">Server</span>
                    <code>execution: { environment: 'server' }</code>
                </header>
                <dl v-if="store.server">
                    <div>
                        <dt>Language (Accept-Language header)</dt>
                        <dd>{{ store.server.locale }}</dd>
                    </div>
                    <div>
                        <dt>Requested path</dt>
                        <dd>{{ store.server.pathname }}</dd>
                    </div>
                    <div>
                        <dt>Rendered at</dt>
                        <dd>{{ formatTime(store.server.renderedAt) }}</dd>
                    </div>
                </dl>
                <p v-else class="panel__empty">
                    No server data: this page was not server-rendered (SPA mode). Run <code>npm run dev:ssr</code>.
                </p>
            </article>

            <article class="panel panel--client">
                <header>
                    <span class="badge badge--client">Browser</span>
                    <code>execution: { environment: 'client', hydration: 'defer' }</code>
                </header>
                <dl v-if="store.browser">
                    <div>
                        <dt>Time zone</dt>
                        <dd>{{ store.browser.timezone }}</dd>
                    </div>
                    <div>
                        <dt>Viewport</dt>
                        <dd>{{ store.browser.viewport }}</dd>
                    </div>
                    <div>
                        <dt>Preferred color scheme</dt>
                        <dd>{{ store.browser.colorScheme }}</dd>
                    </div>
                </dl>
                <p v-else class="panel__empty panel__empty--waiting">
                    Waiting for the browser… These values are not in the server HTML.
                </p>
            </article>
        </div>

        <h3>Hydration timeline</h3>
        <ol class="timeline">
            <li v-for="(step, index) in store.steps" :key="index">
                <span class="badge" :class="step.environment === 'server' ? 'badge--server' : 'badge--client'">
                    {{ step.environment === 'server' ? 'Server' : 'Browser' }}
                </span>
                <span>{{ step.label }}</span>
                <time>{{ formatTime(step.at) }}</time>
            </li>
        </ol>
        <p class="environment__hint">
            Tip: open the page source (Ctrl+U). The server panel and its timeline step are already in the HTML; the
            browser panel only appears once the page is hydrated.
        </p>
    </section>
</template>

<style scoped>
.environment {
    margin-top: 2rem;
}

.environment__intro,
.environment__hint {
    margin: 0.5rem 0 1rem;
}

.environment__hint {
    font-size: 0.9rem;
    opacity: 0.75;
}

.environment__panels {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1rem;
}

.panel {
    padding: 1rem;
    border: 1px solid;
    border-radius: 12px;
}

.panel--server {
    border-color: #646cff;
    background: color-mix(in srgb, #646cff 8%, transparent);
}

.panel--client {
    border-color: #2fb67c;
    background: color-mix(in srgb, #2fb67c 8%, transparent);
}

.panel header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.4rem;
}

.panel header code {
    font-size: 0.75rem;
    opacity: 0.8;
}

.panel dl {
    margin: 1rem 0 0;
    display: grid;
    gap: 0.5rem;
}

.panel dt {
    font-size: 0.8rem;
    opacity: 0.7;
}

.panel dd {
    margin: 0;
    font-weight: 600;
}

.panel__empty {
    margin: 1rem 0 0;
    font-style: italic;
    opacity: 0.8;
}

.panel__empty--waiting {
    animation: pulse 1.4s ease-in-out infinite;
}

.badge {
    display: inline-block;
    padding: 0.15rem 0.6rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #fff;
}

.badge--server {
    background: #646cff;
}

.badge--client {
    background: #2fb67c;
}

.timeline {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.5rem;
}

.timeline li {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
}

.timeline time {
    margin-left: auto;
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    font-size: 0.8rem;
    opacity: 0.7;
}

@keyframes pulse {
    50% {
        opacity: 0.35;
    }
}
</style>
