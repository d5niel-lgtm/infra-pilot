# Infra Pilot

<p align="center">
  <img src="branding/logo.svg" alt="Infra Pilot Logo" width="120"/>
</p>

<p align="center">

[![CI](https://img.shields.io/github/actions/workflow/status/d5niel-lgtm/infra-pilot/ci.yml?branch=main&style=flat-square&label=CI&logo=github)](https://github.com/d5niel-lgtm/infra-pilot/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/d5niel-lgtm/infra-pilot?style=flat-square)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.9%2B-blue?style=flat-square&logo=python)](https://www.python.org/)
[![Node](https://img.shields.io/badge/node-18%2B-339933?style=flat-square&logo=nodedotjs)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-19-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Docker](https://img.shields.io/badge/docker-compose-2496ED?style=flat-square&logo=docker)](https://www.docker.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](CONTRIBUTING.md)

</p>

**Infra Pilot** is a self-hosted infrastructure orchestration platform. It provides a unified dashboard, CLI, Discord bot, and mobile app for managing containers, cloud resources, and game servers across providers.

## Features

- **Web Dashboard** — React 19 management panel with real-time metrics, logs, and container management
- **CLI Tool** — `ipilot` command-line interface for scripting and automation
- **Discord Bot** — Provision and manage servers directly from Discord
- **Orchestrator Agent** — Python-based provisioning, monitoring, and auto-remediation
- **Multi-Cloud** — Unified API for AWS, Azure, GCP, Hetzner, DigitalOcean, and more
- **Green Computing** — Energy tracking, carbon dashboard, and sustainable scheduling
- **Edge & IoT** — Device management, function runtime, mesh networking, and ML inference
- **Identity & Security** — OIDC/SSO, WebAuthn passkeys, RBAC, audit trails, and breach notification
- **FinOps** — Cost tracking, multi-cloud pricing comparison, and chargeback reports
- **Mobile App** — React Native (Expo) with push notifications and device management

## Quick Start

```bash
git clone https://github.com/DaaanielTV/infra-pilot.git
cd infra-pilot
cp .env.example .env
docker compose up -d
```

| Service | URL |
|---------|-----|
| Management Panel (Frontend) | http://localhost:5173 |
| Management Panel (API) | http://localhost:3001 |
| Orchestrator Health | http://localhost:8500/health |
| Integration Service API | http://localhost:9000 |

## Services

| Service | Stack | Purpose |
|---------|-------|---------|
| **management-panel** | React 19, Express, PostgreSQL | Web dashboard for server and container management |
| **orchestrator-agent** | Python (discord.py) | Server provisioning, health monitoring, and automation |
| **discord-service** | Node.js (discord.js) | Discord bot for server creation and management |
| **integration-service** | Python (aiohttp) | Cross-service communication and API gateway |
| **service-core** | Java (Paper/Bukkit) | Minecraft server plugin |

## Repository Structure

```
.
├── services/
│   ├── management-panel/     # React + Express dashboard
│   ├── orchestrator-agent/   # Python provisioning agent
│   ├── discord-service/      # Discord bot
│   ├── integration-service/  # Cross-platform hub
│   └── service-core/         # Minecraft plugin (Java)
├── cli/                      # Python CLI tool (ipilot)
├── mobile/                   # React Native (Expo) mobile app
├── infra/                    # Provider-neutral naming, Terraform
├── infrastructure/           # Monitoring configs (Prometheus, Grafana)
├── tests/                    # Unit, integration, and smoke tests
├── docs/                     # Architecture and development docs
├── wiki/                     # User-facing documentation
└── scripts/                  # Build, test, and setup helpers
```

## Requirements

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) (for stack deployment)
- Node.js 18+ (management panel, discord service)
- Python 3.9+ (orchestrator agent, integration service)
- Java 21 / Maven (service core)

## Documentation

| Resource | Description |
|----------|-------------|
| [Wiki](wiki/Home.md) | User-facing guides (installation, configuration, CLI reference) |
| [Docs](docs/README.md) | Architecture, API references, development guides |
| [Contributing](CONTRIBUTING.md) | Branch naming, commit style, PR workflow |
| [Security](SECURITY.md) | Vulnerability reporting and security best practices |
| [Code of Conduct](CODE_OF_CONDUCT.md) | Community guidelines |

## License

[MIT](LICENSE)
