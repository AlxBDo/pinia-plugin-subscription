# Contributing to pinia-plugin-subscription

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

Please be respectful and constructive in all interactions with other contributors and maintainers.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/pinia-plugin-subscription.git
   cd pinia-plugin-subscription
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Running Tests

```bash
npm run test          # Run tests in watch mode
npm run test -- run   # Run tests once
npm run coverage      # Generate coverage report
```

### Building

```bash
npm run build         # Run tests, build, and generate types
```

### Preview Changes

```bash
npm run dev           # Start development server
npm run preview       # Preview production build
```

## Making Changes

### Code Style

- Follow the existing code style in the project
- Use TypeScript for all new code
- Ensure strict TypeScript compiler options are satisfied
- Write descriptive variable and function names

### Testing

- Write tests for all new features and bug fixes
- Ensure all existing tests pass before submitting
- Aim for >80% code coverage

### Commits

- Write clear, descriptive commit messages
- Use conventional commits format when possible:
  - `feat:` for new features
  - `fix:` for bug fixes
  - `docs:` for documentation
  - `test:` for tests
  - `refactor:` for code refactoring
  - `chore:` for build/dependencies

Example:
```
feat: add support for custom reset callbacks

- Implement resetStoreCallback in PluginSubscriberInterface
- Add tests for reset functionality
- Update documentation
```

## Submitting Changes

1. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```
2. **Create a Pull Request** on GitHub with:
   - Clear title describing the change
   - Detailed description of what changed and why
   - Reference to related issues if applicable
   - Test results showing coverage
3. **Address review feedback** respectfully and promptly

## Pull Request Guidelines

- Keep PRs focused on a single feature or bug fix
- Include tests for your changes
- Update documentation if needed
- Ensure CI checks pass
- Request review from maintainers

## Reporting Bugs

Found a bug? Please create an issue on GitHub with:

1. **Title:** Clear, concise description
2. **Environment:** Node.js version, npm version, OS
3. **Steps to Reproduce:** Minimal reproduction steps
4. **Expected Behavior:** What should happen
5. **Actual Behavior:** What actually happens
6. **Additional Context:** Screenshots, error traces, etc.

## Proposing Features

Have an idea? Open a GitHub issue with:

1. **Title:** Clear feature name
2. **Description:** What problem does it solve?
3. **Use Cases:** When would this be useful?
4. **Proposed Solution:** How might it work?
5. **Alternatives:** Other approaches considered

## Release Process

Maintainers will:

1. Update `CHANGELOG.md` with changes
2. Bump version in `package.json` following Semantic Versioning
3. Create a git tag
4. Publish to npm
5. Create a GitHub release

## Questions?

- Check existing issues and discussions
- Open a new GitHub discussion if needed
- Contact maintainers via email

Thank you for contributing! 🙏
