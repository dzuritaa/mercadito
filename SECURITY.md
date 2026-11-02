# Security

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use GitHub's private reporting instead: go to the repository's **Security** tab and choose **Report a vulnerability**.

Include what you found, how to reproduce it, and what an attacker could do. You can write in English or Spanish. You will get a reply as soon as possible; this is a volunteer project, so please allow some time.

## Supported versions

Only the latest code on `main` receives fixes.

## How the app protects a household

- One account per installation; passwords are hashed with scrypt.
- Sessions are random tokens in an HttpOnly cookie; only a hash is stored. The cookie is marked `Secure` when served over HTTPS.
- Every page, data request, and form action checks the session.
- After 5 failed sign-ins the account is locked for 5 minutes.
- By default the app only listens on `127.0.0.1`. Over plain HTTP on a network, traffic is not encrypted; use HTTPS ([docs/https.md](docs/https.md)) before exposing it beyond your home.
- A fresh installation lets the first visitor create the account. Finish setup before opening the app to a network.
