# Security Policy

## Supported Versions

Currently, only the latest commit on the `main` branch receives security updates. Once stable releases are tagged, this section will list supported versions.

| Version | Supported |
|---------|-----------|
| main (unreleased) | ✅ |
| < 1.0.0 | ❌ |

## Reporting a Vulnerability

Biryani handles authentication (JWT, Argon2), Docker container management, and file system access — making security a top priority.

If you discover a security vulnerability, please **do not open a public issue**. Instead, report it privately:

- **GitHub:** Use the **Security** tab → **Report a vulnerability**

Please include:

- A description of the vulnerability
- Steps to reproduce
- Affected versions
- Any potential mitigations you've identified

### What to Expect

- **Acknowledgment** within 48 hours
- **Status update** within 5 business days
- A coordinated disclosure timeline once a fix is ready

We believe in responsible disclosure and will credit you in the release notes once the fix is published (unless you prefer to remain anonymous).

## Security Measures

Biryani implements the following security measures out of the box:

- **Password hashing** — Argon2id (memory-hard, tuned parameters)
- **JWT authentication** — Tokens expire every 24 hours
- **CORS** — Disabled by default in production; opt-in via `CORS_ORIGIN` env var
- **Security headers** — CSP, HSTS, X-Content-Type-Options, X-Frame-Options in production
- **Input validation** — Zod schemas on critical endpoints
- **Shell injection prevention** — All Docker exec commands use parameterized APIs
- **Error sanitization** — No stack traces leaked in production 500 responses
