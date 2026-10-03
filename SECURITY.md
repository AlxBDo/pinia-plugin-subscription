# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability in pinia-plugin-subscription, please do **NOT** open a public GitHub issue. Instead, please email the maintainers privately.

**Email:** [Security Contact - reach out via GitHub profile]

Please include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if available)

We will:

1. Acknowledge your report within 48 hours
2. Investigate the issue thoroughly
3. Work on a fix
4. Release a patched version
5. Credit you (if desired) in the release notes

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅ Yes    |
| < 0.1   | ❌ No     |

## Security Best Practices

When using pinia-plugin-subscription:

1. **Keep Dependencies Updated:** Regularly update Pinia, Vue, and other dependencies to the latest versions
2. **Review Plugin Code:** Always review subscriber code before using in production
3. **Validate Store Data:** Validate data before storing in Pinia stores

### Tracing and Production Logging

Normal trace events are opt-in: the plugin requires an explicitly configured `createTracer` factory and matching listeners to deliver them. The plugin does not automatically detect production environments or block tracing in production. Production tracing can be useful for incident diagnosis, but should only be enabled deliberately and with controlled access to its output.

Trace events are not automatically sanitized or redacted. Depending on the event, they may contain action arguments, store state, mutations, plugin options, subscriptions, or error details. These values can include application secrets or personal data. A listener can expose them through the browser console, server logs, or an external logging service. The absence of a production block is not, by itself, a vulnerability; the disclosure risk depends on the data emitted, the logging destination, and who can access it.

When configuring tracing:

1. **Disable Normal Tracing in Production by Default:** Use the application's environment configuration to omit `createTracer` or avoid registering normal trace listeners. Enable production diagnostics only when needed and limit their duration and scope.
2. **Minimize Logged Data:** Select an explicit allowlist of fields and redact sensitive values before writing or forwarding events. Avoid logging complete stores, action arguments, plugin options, or raw error objects.
3. **Do Not Treat Filters as Redaction:** Filters only select events using metadata; a matching handler receives the full event, including its resolved payload and error. Sanitize data in the handler before passing it to a logging destination.
4. **Protect Logging Destinations:** Review external logging services, restrict access to logs, and define appropriate retention periods. Do not assume browser console output or server logs are private.

**Error reporting is separate from normal tracing.** Without a tracer, plugin and store error reporting falls back to `console.error`. With a tracer, error events also fall back to `console.error` when no listener matches, including when all filters reject the event. Exceptions thrown by listener filters or handlers are reported to `console.error` as well. Removing listeners, clearing a registry, or omitting `createTracer` therefore does not guarantee that no errors will be logged.

For production, handle error events with a matching listener that reports only sanitized details, and ensure listener filters and handlers do not throw sensitive errors. Review the application's console and error logging policy as well; do not silently discard operational errors to prevent disclosure.

See [Tracing](./README.md#tracing) for configuration and event details.

## Dependencies Security

This project depends on:

- **Pinia** - Vue state management
- **Vue** - JavaScript framework

We monitor these dependencies for vulnerabilities and recommend keeping them updated.

## Vulnerability Disclosure Timeline

- **Day 0:** Report received
- **Day 1-2:** Initial assessment
- **Day 3-7:** Fix development
- **Day 7-14:** Security release
- **Day 14:** Public disclosure

## Scope

This policy covers:

- ✅ Code in the pinia-plugin-subscription repository
- ✅ Published npm packages
- ✅ Security of the plugin API

This policy does NOT cover:

- ❌ Security of Pinia or Vue (report to their respective projects)
- ❌ Security of applications using this plugin
- ❌ Social engineering attacks

## Questions

For general security questions or concerns, open a private security advisory on GitHub.

Thank you for helping keep pinia-plugin-subscription secure! 🔒
