# WhatsApp AI Agent

> Free, self-hosted AI auto-reply bot for WhatsApp — runs on your own machine, no Business API needed.

[![CI](https://github.com/Abhinavkumar-07/whatsapp-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/Abhinavkumar-07/whatsapp-agent/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Stack:** [Baileys](https://github.com/WhiskeySockets/Baileys) (unofficial WhatsApp Web protocol) + [Groq](https://console.groq.com/keys) (free-tier Llama / Whisper).

> [!WARNING]
> This project uses the **unofficial** WhatsApp Web protocol — the same one your browser uses. It is **not** the official Meta Business API. Using unofficial automation tools is against WhatsApp's Terms of Service and carries a small risk of your number being flagged, especially if messages are sent at high volume.
>
> **Recommendations:** Use a secondary number if you're cautious. Avoid bulk or spam-like behaviour. Use `ALLOWED_NUMBERS` to restrict the bot to trusted contacts.

---

## Features

| Feature | Description |
|---|---|
| 💬 **Text replies** | Automatic AI replies to incoming messages using Llama 3.3 70B |
| 🎤 **Voice notes** | Transcribes audio messages via Whisper and replies to the transcript |
| 🖼️ **Image understanding** | Describes images using a vision-capable model; captions are taken into account |
| ⏰ **Quiet hours** | Suppresses replies during configurable hours; optional one-time "away" message |
| 👍 **Emoji reactions** | Reacts with a single emoji for short casual messages instead of a full reply |
| ⌨️ **Typing simulation** | Waits a natural, length-scaled delay before sending — less robotic |
| 📬 **Notifications** | Forwards every incoming message + AI reply to your own number |
| 🚦 **Rate limiting** | Per-chat message cap prevents runaway API usage |
| 🔒 **Allowlist** | Restrict auto-replies to specific phone numbers |
| 💾 **Session persistence** | QR scan is required only once; session is saved in `auth_info/` |

---

## Quick Start (Windows)

### 1. Install Node.js

Download the **LTS installer** from [nodejs.org](https://nodejs.org) and run it (accept all defaults).

Open **Command Prompt** and verify:
```cmd
node -v
npm -v
```
Both should print a version number. If they say "not recognised", restart your computer and try again.

### 2. Get the project files

```cmd
git clone https://github.com/Abhinavkumar-07/whatsapp-agent.git
cd whatsapp-agent
```

Or [download the ZIP](https://github.com/Abhinavkumar-07/whatsapp-agent/archive/refs/heads/main.zip) and extract it.

### 3. Install dependencies

```cmd
npm install
```

### 4. Get a free Groq API key

1. Go to [console.groq.com/keys](https://console.groq.com/keys)
2. Sign up (free, no credit card)
3. Click **Create API Key** and copy it

### 5. Configure

```cmd
copy env.example .env
notepad .env
```

Paste your Groq API key after `GROQ_API_KEY=` and save. See the [Configuration Reference](#configuration-reference) for all options.

### 6. Run

```cmd
npm start
```

A QR code appears in your terminal. On your phone:
1. Open WhatsApp
2. Go to **Settings → Linked Devices → Link a Device**
3. Scan the QR code

The agent is now live. Keep the terminal window open.

---

## Quick Start (Linux / macOS)

```bash
# Install Node.js 18+ via nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc   # or ~/.zshrc
nvm install --lts

# Clone and set up
git clone https://github.com/Abhinavkumar-07/whatsapp-agent.git
cd whatsapp-agent
npm install
cp env.example .env
nano .env          # add your GROQ_API_KEY

npm start
```

---

## Keeping It Running 24/7

### Option A — pm2 (recommended)

```bash
npm install -g pm2
pm2 start index.js --name whatsapp-agent
pm2 save           # restart on system reboot
pm2 logs           # view live logs
```

### Option B — screen (Linux/macOS)

```bash
screen -S whatsapp
npm start
# Ctrl+A then D to detach; `screen -r whatsapp` to re-attach
```

### Option C — Windows Task Scheduler

Use Windows Task Scheduler to run `node index.js` at startup from the project folder.

> [!NOTE]
> If your PC goes to sleep, the agent stops until it wakes up. On Windows: **Settings → System → Power & Battery → Screen and Sleep** → set "sleep" to Never.

---

## Configuration Reference

All settings live in your `.env` file. Copy `env.example` to `.env` to get started.

### Required

| Variable | Description |
|---|---|
| `GROQ_API_KEY` | Your Groq API key from [console.groq.com/keys](https://console.groq.com/keys) |

### AI Models

| Variable | Default | Description |
|---|---|---|
| `GROQ_TEXT_MODEL` | `llama-3.3-70b-versatile` | Model used for text replies |
| `GROQ_VISION_MODEL` | `meta-llama/llama-4-scout-17b-16e-instruct` | Model used for image understanding |
| `GROQ_WHISPER_MODEL` | `whisper-large-v3-turbo` | Model used for voice transcription |

### AI Behaviour

| Variable | Default | Description |
|---|---|---|
| `SYSTEM_PROMPT` | *(see env.example)* | Personality and instructions for the AI |
| `MAX_CONVERSATION_HISTORY` | `10` | How many past messages the AI can see per chat |
| `MAX_MESSAGE_LENGTH` | `2000` | Max characters accepted from incoming messages |

### Filtering

| Variable | Default | Description |
|---|---|---|
| `ALLOWED_NUMBERS` | *(empty = everyone)* | Comma-separated list of numbers to reply to (country code, no +) |
| `IGNORE_GROUPS` | `true` | Set to `false` to also reply in group chats |

### Rate Limiting

| Variable | Default | Description |
|---|---|---|
| `RATE_LIMIT_MAX` | `10` | Max messages per chat per window |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window in milliseconds (60 000 = 1 minute) |

### Quiet Hours

| Variable | Default | Description |
|---|---|---|
| `QUIET_HOURS_ENABLED` | `false` | Enable quiet hours |
| `QUIET_HOURS_START` | `23` | Hour to start quiet period (24h, local time) |
| `QUIET_HOURS_END` | `7` | Hour to end quiet period (24h, local time) |
| `QUIET_HOURS_MESSAGE` | *(empty)* | One-time message to send instead of staying silent |

### Notifications

| Variable | Default | Description |
|---|---|---|
| `NOTIFY_ENABLED` | `false` | Forward all messages + replies to yourself |
| `NOTIFY_NUMBER` | *(required if enabled)* | Your number with country code, no + (e.g. `15551234567`) |

### Personality & Logging

| Variable | Default | Description |
|---|---|---|
| `EMOJI_REACTION_CHANCE` | `0.5` | Probability (0–1) of reacting with an emoji for short/casual messages |
| `LOG_LEVEL` | `info` | Log verbosity: `trace`, `debug`, `info`, `warn`, `error`, `fatal` |

---

## How It Works

```
Incoming WhatsApp message
        │
        ├─ Is it from me?          → Ignore
        ├─ Is it a group?          → Ignore (if IGNORE_GROUPS)
        ├─ Is sender in allowlist? → Ignore (if ALLOWED_NUMBERS set)
        ├─ Rate limited?           → Ignore (log warning)
        │
        ├─ Voice note?    → Transcribe (Whisper) → treat as text
        ├─ Image?         → Describe (Vision model) → send reply
        │
        ├─ Quiet hours?   → Skip AI; optionally send one-time message
        ├─ Casual phrase? → Maybe react with emoji (configurable chance)
        │
        └─ Default        → getAIReply (Llama) → send reply
```

Session credentials are stored in `auth_info/` and loaded on the next start, so you only need to scan the QR code once.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `❌ Missing GROQ_API_KEY` | Copy `env.example` to `.env` and add your key |
| `node is not recognized` | Restart your computer after installing Node.js |
| QR code expired before I scanned | Press `Ctrl+C` and run `npm start` again |
| Bot stopped responding | Check your terminal — it may have disconnected. Run `npm start` again, or use `pm2` |
| `auth_info/` is missing | Delete the folder and re-scan the QR code |
| AI replies are not in my language | Update `SYSTEM_PROMPT` in `.env` to specify your language |
| Voice notes not transcribed | Ensure the message is a WhatsApp voice note (not a forwarded audio file) |

---

## Project Structure

```
whatsapp-agent/
├── src/
│   ├── index.js         Main entry — Baileys setup, message handler
│   ├── config.js        Env parsing, startup validation
│   ├── logger.js        Pino-based structured logger
│   ├── memory.js        Conversation history + rate limiter
│   ├── filters.js       Quiet hours, emoji reactions, typing delay
│   ├── ai.js            Groq API: text, vision, audio transcription
│   └── notifications.js Forward-to-self notification helper
├── test/
│   ├── filters.test.js  Unit tests for pure filter functions
│   └── memory.test.js   Unit tests for conversation + rate limit
├── .github/
│   ├── workflows/ci.yml GitHub Actions CI
│   └── ISSUE_TEMPLATE/  Bug report & feature request templates
├── auth_info/           ⚠️ WhatsApp session (gitignored, never commit)
├── index.js             Entry shim (calls src/index.js)
├── env.example          Configuration template
├── .env                 ⚠️ Your secrets (gitignored, never commit)
└── README.md
```

---

## Development

```bash
npm test          # Run unit tests
npm run lint      # Lint with ESLint
npm run lint:fix  # Auto-fix lint issues
npm run format    # Format with Prettier

# Pretty-print logs (optional)
npm start | npx pino-pretty
```

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

---

## License

[MIT](LICENSE) — © 2026 Abhinav Kumar