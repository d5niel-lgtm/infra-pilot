# Security Policy

## Reporting Security Vulnerabilities

Do **not** open public issues for security vulnerabilities.

If you discover a security vulnerability in Infra Pilot, please report it responsibly by emailing the maintainers directly instead of using the public issue tracker.

### Reporting Process

- Email the maintainers with details of the vulnerability
- Include:
  - Description of the vulnerability
  - Affected component(s) and version(s)
  - Steps to reproduce (if applicable)
  - Potential impact
  - Suggested fix (if you have one)
- Do not include full exploit code in the initial report

### Response

- We will acknowledge receipt of your report within **48 hours**
- We will work on a fix or mitigation with you as necessary
- We will provide a timeline for a patch release
- We request that you refrain from publicly disclosing the vulnerability until a fix has been released

## Security Best Practices

### For Users

- **Keep software updated** — always use the latest stable release
- **Use secrets management** — never hardcode credentials; use environment variables or secret vaults
- **Enable SSL/TLS** — use HTTPS in production
- **Restrict access** — use firewalls, VPNs, and proper authentication
- **Monitor logs** — regularly review application and infrastructure logs
- **Backup data** — maintain regular backups and test recovery procedures

### For Developers

- **Validate input** — always validate and sanitize user input
- **Parameterize queries** — use parameterized statements or ORMs to prevent SQL injection
- **Use strong auth** — implement strong authentication and authorization mechanisms
- **Secure credentials** — never commit secrets; use environment variables
- **Encrypt sensitive data** — use TLS for transport, encryption at rest for stored data
- **Update dependencies** — keep dependencies up to date and monitor for vulnerabilities
- **Code review** — use peer review before merging changes
- **Security testing** — include security checks in CI/CD pipelines

## Known Security Measures

| Measure | Implementation |
|---------|----------------|
| Input validation | All API inputs are validated and sanitized |
| Authentication | JWT-based with secure token handling |
| Authorization | Role-based access control (RBAC) |
| Secrets | Environment variable-based secret management |
| Dependencies | Regular vulnerability scanning with `safety` and `npm audit` |
| CI/CD | Security checks in GitHub Actions workflows |

## Vulnerability Scanning

| Ecosystem | Tools |
|-----------|-------|
| Python | `bandit`, `safety` |
| JavaScript | `npm audit`, ESLint security plugins |
| Java | Maven dependency-check plugin |
| Docker | Image scanning with `trivy` |

## Supported Versions

| Version | Support |
|---------|---------|
| Current release | All patches and minor updates |
| Previous major version | Critical security fixes only |
| Older versions | No support |

## Disclosure Timeline

| Day | Action |
|-----|--------|
| 0 | Vulnerability reported |
| 1–2 | Confirmed and assessed |
| 3–7 | Fix developed and tested |
| 7–14 | Patch released (depending on severity) |
| 14 | Public disclosure of the fixed vulnerability |

Thank you for helping us keep Infra Pilot secure.
