# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] — 2026-07-20

### Added
- **Modular architecture**: codebase split into focused modules (`src/config.js`, `src/logger.js`, `src/memory.js`, `src/filters.js`, `src/ai.js`, `src/notifications.js`, `src/index.js`)
- **Rate limiting**: per-chat message rate limiting via `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` env vars to prevent API quota abuse
- **Memory eviction**: conversation history now evicts idle conversations after 24 hours and caps at 500 concurrent chats to prevent unbounded memory growth
- **Exponential backoff reconnect**: connection retries now use exponential backoff (1s → 2s → 4s … capped at 30s) with a max of 10 attempts, preventing the infinite recursive reconnect bug
- **Structured logging**: replaced all `console.log` calls with `pino`-based structured logging; `LOG_LEVEL` env var controls verbosity; optional `pino-pretty` for human-readable terminal output
- **Input sanitization**: user messages are now sanitized (null bytes removed, truncated to `MAX_MESSAGE_LENGTH`) before being sent to the AI
- **Configurable model names**: `GROQ_TEXT_MODEL`, `GROQ_VISION_MODEL`, and `GROQ_WHISPER_MODEL` are now configurable via `.env` instead of being hardcoded
- **Startup validation**: all config values are validated at startup with clear, actionable error messages; the process exits immediately rather than failing silently at runtime
- **Node.js version guard**: the process exits immediately with a clear message if running on Node.js < 18
- **`NOTIFY_NUMBER` format validation**: invalid phone number formats now cause a startup error instead of silent runtime failures
- **`auth_info/` safety check**: warns at startup if `auth_info/` is not in `.gitignore`
- **Quiet hours reset**: `quietHoursNotified` set now clears automatically when quiet hours end, so the one-time message fires again the next night
- **Unit tests**: `test/filters.test.js` and `test/memory.test.js` using Node.js built-in test runner (no additional test framework required)
- **ESLint + Prettier**: code quality tooling configured via `eslint.config.mjs` and `.prettierrc`
- **GitHub Actions CI**: `.github/workflows/ci.yml` runs tests and lint on push/PR
- **GitHub templates**: issue templates (bug report, feature request) and PR template
- **Community files**: `LICENSE` (MIT), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`
- **Updated `.gitignore`**: now also excludes log files, OS artifacts, and editor directories
- **Updated `env.example`**: documents all available config options with examples and comments

### Changed
- `package.json` description corrected (previously said "Gemini", project uses Groq)
- `package.json` version bumped to `1.1.0`
- `package.json` now includes `engines` field specifying `node >= 18.0.0`
- `pino-pretty` added as an optional dependency for better terminal DX

### Fixed
- Reconnect loop no longer recursively grows the call stack on flaky networks
- Conversation history no longer grows unboundedly in memory
- `quietHoursNotified` set no longer persists across multiple quiet-hours sessions
- Spacing inconsistency on line 69 of original `index.js` (`50+` → `50 +`)
- `package.json` description mismatch (said Gemini, uses Groq)

---

## [1.0.0] — Initial release

### Added
- WhatsApp connection via Baileys (unofficial WA Web protocol)
- AI text replies via Groq (Llama 3.3 70B)
- Voice note transcription via Groq Whisper
- Image understanding via Groq vision model (Llama 4 Scout)
- Typing simulation with configurable delay
- Emoji-only reactions for casual messages
- Quiet hours with optional one-time notification message
- Per-sender allowlist (`ALLOWED_NUMBERS`)
- Group chat filtering (`IGNORE_GROUPS`)
- Notification forwarding to a personal number (`NOTIFY_ENABLED`)
- Session persistence in `auth_info/` folder
- Per-chat conversation history (last 10 messages)
- Auto-reconnect on disconnect
