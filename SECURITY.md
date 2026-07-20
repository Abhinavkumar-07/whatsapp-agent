# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | ✅ Yes     |

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

To report a security issue, please email the maintainer directly or use GitHub's private security advisory feature:

1. Go to the repository on GitHub
2. Click **Security** → **Advisories** → **New draft security advisory**
3. Fill in the details and submit

You can expect a response within **48 hours**. We will work with you to understand the issue and coordinate a fix before any public disclosure.

## Scope

The following are in scope for security reports:

- Remote code execution or command injection
- Authentication bypass or session hijacking
- Information disclosure (API keys, phone numbers, session credentials)
- Dependency vulnerabilities with a direct attack vector

The following are out of scope:

- WhatsApp ToS violations (these are a known and documented trade-off of using an unofficial protocol)
- Issues in upstream dependencies that have no exploitable path through this project
- Social engineering attacks

## Security Best Practices for Users

1. **Never commit `auth_info/`** — this folder contains your live WhatsApp session
2. **Never commit `.env`** — this file contains your Groq API key
3. **Use `ALLOWED_NUMBERS`** to restrict the bot to trusted senders
4. **Rotate your Groq API key** immediately if you suspect it has been exposed
5. **Use a secondary WhatsApp number** if you are cautious about ToS risk

## Credential Rotation

If you accidentally expose credentials:

| Credential | Action |
|------------|--------|
| Groq API key | Delete at https://console.groq.com/keys and generate a new one |
| WhatsApp session (`auth_info/`) | Delete the `auth_info/` folder and re-scan the QR code |
