# Documentation Index

Welcome to the Infra Pilot Infrastructure Orchestration Platform documentation.

## 📑 Quick Navigation

### 🏗️ Architecture & Design
- [System Overview](architecture/overview.md) - High-level architecture
- [Service Specifications](architecture/) - Individual service docs
- [Data Flow & Integration](architecture/data-flow.md)
- [Integration Patterns](architecture/integration-patterns.md)

### 🚀 Setup & Installation
- [zero-native Management Panel Shell](desktop/zero-native-management-panel.md) - Native desktop WebView shell for the management panel
- [Local Development Setup](setup/local-development.md) - Get started locally
- [Docker Deployment](setup/docker-setup.md) - Using Docker Compose
- [Kubernetes Deployment](setup/kubernetes-deploy.md) - K8s manifests
- [Environment Configuration](setup/environment-config.md) - Config reference
- [SSL/TLS Setup](setup/ssl-tls-setup.md) - Secure connections

### 🛠️ Operations & Deployment
- [Deployment Guide](operations/deployment-guide.md) - Prod deployment
- [Scaling Strategy](operations/scaling-strategy.md) - Horizontal/vertical scaling
- [Monitoring & Observability](operations/monitoring-observability.md) - Metrics, logs, traces
- [Troubleshooting](operations/troubleshooting.md) - Common issues & solutions
- [Backup & Recovery](operations/backup-recovery.md) - Data protection
- [Security Hardening](operations/security-hardening.md) - Production security

### 👨‍💻 Development
- [Development Workflow](development/development-workflow.md) - Contributing guidelines
- [Testing Strategy](development/testing-strategy.md) - Testing best practices
- [Code Standards](development/code-standards.md) - Coding conventions
- [Debugging Tips](development/debugging-tips.md) - Troubleshooting dev issues
- [AI Assistant Playbook](development/ai-assistant-playbook.md) - Practical guardrails for AI contributors

### 📡 API Documentation
- [Service Core API](api/service-core-api.md)
- [Orchestrator Agent API](api/orchestrator-api.md)
- [Discord Webhooks](api/discord-webhooks.md)
- [Dashboard API](api/dashboard-api.md)

Branding
- Cosmic Infra branding documented at docs/branding.md


## 🎯 Getting Started

**New to Infra Pilot?** Start here:

1. [Local Development Setup](setup/local-development.md) - 15 minutes
2. [System Overview](architecture/overview.md) - Understand the architecture
3. [Development Workflow](development/development-workflow.md) - Ready to code?

**Deploying to production?**

1. [Deployment Guide](operations/deployment-guide.md)
2. [Scaling Strategy](operations/scaling-strategy.md)
3. [Monitoring & Observability](operations/monitoring-observability.md)
4. [Security Hardening](operations/security-hardening.md)

---

## 📚 Key Concepts

### Services
- **Management Dashboard** - Web UI for operations
- **Orchestrator Agent** - Core provisioning engine
- **Discord Service** - Bot interface
- **Service Core** - Game server management

### Architecture Pattern
Multi-service architecture with clear boundaries, API-first design, and event-driven integrations.

### Deployment Options
- Docker Compose (dev/test)
- Kubernetes (prod)
- Terraform (infrastructure as code)

---

## 🔍 Glossary

| Term | Definition |
|------|-----------|
| **Orchestrator** | Core service managing provisioning and resource allocation |
| **Service Core** | Game server lifecycle management module |
| **Provisioning** | Automated creation and configuration of infrastructure |
| **RPC** | Remote Procedure Call - service-to-service communication |
| **Webhook** | Event-driven HTTP callback |

See [GLOSSARY.md](GLOSSARY.md) for complete terminology.

---

## ❓ FAQ

**Q: How do I set up a local development environment?**  
A: Follow [Local Development Setup](setup/local-development.md)

**Q: Where's the API documentation?**  
A: See [API Documentation](api/)

**Q: How do I deploy to production?**  
A: Read [Deployment Guide](operations/deployment-guide.md)

**Q: What are the system requirements?**  
A: See [Environment Configuration](setup/environment-config.md)

**Q: How do I report a security issue?**  
A: See [SECURITY.md](../SECURITY.md)

---

## 🆘 Getting Help

- **Issues:** [GitHub Issues](https://github.com/DaaanielTV/infra-pilot/issues)
- **Discussions:** [GitHub Discussions](https://github.com/DaaanielTV/infra-pilot/discussions)
- **Contributing:** [CONTRIBUTING.md](../CONTRIBUTING.md)

---

**Last Updated:** April 2026  
**Documentation Version:** 1.0
