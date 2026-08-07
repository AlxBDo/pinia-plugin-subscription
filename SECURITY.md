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
4. **Debug Mode:** Disable debug mode in production (set `false` when calling `createPlugin`)

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
