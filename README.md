# WhatsApp AI Agent (Free)

Automatically replies to your WhatsApp messages using AI. Runs on your own computer, no WhatsApp Business API needed.

**Stack:** [Baileys](https://github.com/WhiskeySockets/Baileys) (unofficial WhatsApp Web protocol library) + [Groq](https://console.groq.com/keys) (free tier, fast Llama models).

⚠️ **Important:** This uses an unofficial connection method (the same protocol WhatsApp Web uses), not Meta's official API. It's free and works well for personal use, but it's against WhatsApp's Terms of Service, so there's a small risk of the number being flagged if used heavily. Use a secondary number if you're cautious, and avoid sending bulk/spammy messages.

## Setup (Windows)

### 1. Install Node.js
Download the **LTS version** installer from [nodejs.org](https://nodejs.org) and run it (accept all the defaults — just keep clicking Next).

Then open **Command Prompt** (search "cmd" in the Start menu) and check it installed correctly:
```bash
node -v
npm -v
```
Both should print a version number. If they say "not recognized," restart your computer (Windows needs a restart to pick up the new PATH) and try again.

### 2. Put the project files in a folder
Create a folder, e.g. `C:\whatsapp-agent`, and put the 4 downloaded files (`index.js`, `package.json`, `.env.example`, `README.md`) inside it.

### 3. Open that folder in Command Prompt
```bash
cd C:\whatsapp-agent
```

### 4. Install dependencies
```bash
npm install
```
This creates a `node_modules` folder — that's normal, leave it alone.

### 5. Get a free Groq API key
Go to https://console.groq.com/keys, sign up (free, no credit card), and click "Create API Key". Copy it — you won't be able to see it again after closing the popup.

### 6. Configure
Copy the example env file (in Command Prompt):
```bash
copy .env.example .env
```
Open `.env` in Notepad:
```bash
notepad .env
```
Paste in your Groq API key after `GROQ_API_KEY=`. While you're here, you can also set up:

- `SYSTEM_PROMPT` — how you want the AI to behave/reply
- `ALLOWED_NUMBERS` — restrict auto-replies to specific numbers only
- `IGNORE_GROUPS` — set to `false` if you want it to also reply in group chats
- **Quiet hours** — set `QUIET_HOURS_ENABLED=true` and adjust `QUIET_HOURS_START` / `QUIET_HOURS_END` (24hr format, your computer's local time) to pause AI auto-replies during those hours. Optionally set `QUIET_HOURS_MESSAGE` to send a one-time "I'll reply later" note instead of staying silent.
- **Forward notifications to yourself** — set `NOTIFY_ENABLED=true` and `NOTIFY_NUMBER=` to your own number (country code + number, no `+` or spaces, e.g. `919876543210`). You'll get a WhatsApp message to yourself for every incoming message, showing who wrote and what the AI replied — handy for keeping an eye on things without reading every chat.

Save and close Notepad.

### 7. Run it
```bash
npm start
```
A QR code will appear in your terminal. On your phone:
1. Open WhatsApp
2. Go to **Settings → Linked Devices → Link a Device**
3. Scan the QR code

Once connected, it stays running and will auto-reply to incoming messages using AI. Keep the terminal window open (or run it on a computer that stays on) for it to keep working.

## Notes
- Conversation history is kept in memory per chat (last 10 messages) so replies have context. It resets if you restart the script.
- Your WhatsApp session is saved in the `auth_info` folder after the first scan — you won't need to scan the QR code again unless you log out or delete that folder.
- To stop the agent, close the Command Prompt window or press `Ctrl+C`.
- To swap in a different AI model later (OpenAI, Claude API, etc.), you only need to edit the `getAIReply` function in `index.js`.
- **Windows sleep mode**: if your PC goes to sleep, the agent stops responding until it wakes up. Go to Settings → System → Power & battery and turn off sleep (or set it to a long time) if you want this running 24/7.