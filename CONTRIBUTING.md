# Contributing to WhatsApp AI Agent

First off, thank you for considering contributing! This project is open source and welcomes improvements of all kinds.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it. Please report unacceptable behaviour to the maintainers via the contact listed in [SECURITY.md](SECURITY.md).

---

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/whatsapp-agent.git
   cd whatsapp-agent
   ```
3. **Install dependencies:**
   ```bash
   npm install
   ```
4. **Set up your environment:**
   ```bash
   cp env.example .env
   # Add your GROQ_API_KEY to .env
   ```

---

## How to Contribute

### Reporting Bugs

Use the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md). Include:
- Your OS and Node.js version (`node --version`)
- Steps to reproduce
- Expected vs actual behaviour
- Any relevant log output (redact your API key)

### Suggesting Features

Use the [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md). Please search existing issues first.

### Submitting Code

1. Open an issue discussing the change before starting work on anything large.
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes following the [Coding Standards](#coding-standards).
4. Add or update tests in `test/` if applicable.
5. Ensure all checks pass: `npm test && npm run lint`
6. Open a Pull Request using the [PR template](.github/PULL_REQUEST_TEMPLATE.md).

---

## Development Setup

```bash
# Run the agent
npm start

# Run all tests
npm test

# Lint source files
npm run lint

# Auto-fix lint issues
npm run lint:fix

# Format with Prettier
npm run format
```

**Tip:** For human-readable logs during development, install `pino-pretty` globally:
```bash
npm start | npx pino-pretty
```

---

## Pull Request Process

1. Ensure your branch is up to date with `main`.
2. All CI checks must pass.
3. At least one maintainer review is required before merging.
4. Squash commits before merging if there are many small WIP commits.
5. Update `CHANGELOG.md` with a brief description of your change.

---

## Coding Standards

- **Language:** Node.js (CommonJS, `'use strict'`)
- **Style:** Enforced by ESLint (`npm run lint`) and Prettier (`npm run format`)
- **Comments:** Use JSDoc for exported functions; inline comments for non-obvious logic
- **Error handling:** Always use try/catch for async operations; log errors, don't swallow them
- **Security:**
  - Never log secrets, API keys, or personal phone numbers
  - Validate and sanitize all external input
  - Keep `auth_info/` out of version control — always

---

## ⚠️ Important Security Notes for Contributors

- **Never commit `auth_info/`** — it contains live WhatsApp session credentials
- **Never commit `.env`** — it contains your Groq API key
- The `.gitignore` excludes both; please do not add workarounds

If you accidentally commit credentials, rotate them immediately and follow the steps in [SECURITY.md](SECURITY.md).

---

Thank you for your contribution! 🙏
