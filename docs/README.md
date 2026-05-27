# Documentation Index

Willkommen in der Infra-Pilot-Dokumentation. Dieser Index listet bewusst nur Dokumente, die aktuell im Repository vorhanden sind.

## Schnellstart

- [Quickstart](quickstart.md)
- [Local Development Setup](setup/local-development.md)
- [Management Panel README](../services/management-panel/README.md)
- [Docker Panel Quick Start](../services/management-panel/README-DOCKER-PANEL.md)
- [zero-native Management Panel Shell](desktop/zero-native-management-panel.md)

## Architektur

- [System Overview](architecture/overview.md)
- [Orchestrator Agent](architecture/orchestrator-agent.md)
- [Implementation Plan](implementation-plan.md)
- [Feature Implementation Plan v2](feature-implementation-plan-v2.md) (50 neue Features: AI, Developer Ecosystem, Advanced Infra, Collaboration, Observability, UX, Compliance)

## Development & CI

- [Development Workflow](development/development-workflow.md)
- [Code Standards](development/code-standards.md)
- [CI Architecture](development/ci-architecture.md)
- [AI Assistant Playbook](development/ai-assistant-playbook.md)
- [Contributing](../CONTRIBUTING.md)
- [Docs Contributing](CONTRIBUTING.md)

## Testing

- [Testing Overview](TESTING.md)
- [Testing Guidelines](testing-guidelines.md)
- [Running Tests](testing/running_tests.md)
- [Automated Test Suite](testing/automated-test-suite.md)
- [Test Plan](testing/test_plan.md)
- [Provider Neutral Mapping](testing/provider_neutral_mapping.md)
- [CI Demo Gate](CI_DEMO_GATE.md)

## Operations

- [Deployment Guide](operations/deployment-guide.md)
- [Workflow Optimization Audit](operations/workflow-optimization-audit.md)

> Hinweis: `docker-compose.yml` ist aktuell ein Stack-Scaffold. Für einen vollständigen Compose-Start fehlen derzeit noch mehrere Service-Dockerfiles und Monitoring-Konfigurationsdateien.

## Branding & Design

- [Branding](branding.md)
- [Branding Guidelines](branding-guidelines.md)
- [Design System](design-system.md)
- [Design Tokens](design-tokens.md)
- [Repository Branding](../branding/branding.md)

## Service-Dokumentation

- [Management Panel](../services/management-panel/README.md)
- [Management Panel Architecture](../services/management-panel/docs/ARCHITECTURE.md)
- [Management Panel Database Setup](../services/management-panel/docs/DATABASE_SETUP.md)
- [Management Panel Personal Mode](../services/management-panel/docs/PERSONAL_MODE.md)
- [Discord Service](../services/discord-service/README.md)
- [Orchestrator Agent](../services/orchestrator-agent/README.md)
- [Integration Service](../services/integration-service/README.md)
- [Service Core](../services/service-core/README.md) (Minecraft-Plugin mit Feature-Modulen: economy, worlds, statistics, gameplay, items, server, community)
- [Implementation Plan](implementation-plan.md) (Phasenplan für ~120 Features)

## Feature Plans v2

50 neue Features in 7 Kategorien — vollständig dokumentiert in `features-v2/`:

### AI & Intelligence
- [01 - AI Log Anomaly Detector](features-v2/01-ai-log-anomaly-detector.md)
- [02 - AI Resource Optimizer](features-v2/02-ai-resource-optimizer.md)
- [03 - AI Assistant Chatbot](features-v2/03-ai-assistant-chatbot.md)
- [04 - AI Threat Detection](features-v2/04-ai-threat-detection.md)
- [05 - AI Backup Validator](features-v2/05-ai-backup-validator.md)
- [06 - AI Config Advisor](features-v2/06-ai-config-advisor.md)
- [07 - AI Code Review Bot](features-v2/07-ai-code-review-bot.md)
- [08 - AI Performance Profiler](features-v2/08-ai-performance-profiler.md)
- [09 - AI Ticket Triage](features-v2/09-ai-ticket-triage.md)
- [10 - AI Capacity Forecaster](features-v2/10-ai-capacity-forecaster.md)

### Developer Ecosystem
- [11 - Infra Pilot CLI](features-v2/11-infra-pilot-cli.md)
- [12 - Terraform Provider](features-v2/12-terraform-provider.md)
- [13 - Webhook Event Bus](features-v2/13-webhook-event-bus.md)
- [14 - API Gateway & Rate Limiting](features-v2/14-api-gateway-rate-limiting.md)
- [15 - Plugin Marketplace](features-v2/15-plugin-marketplace.md)
- [16 - GitOps Sync](features-v2/16-gitops-sync.md)
- [17 - OpenTelemetry Export](features-v2/17-opentelemetry-export.md)
- [18 - GraphQL API](features-v2/18-graphql-api.md)

### Advanced Infrastructure
- [19 - Kubernetes Cluster Manager](features-v2/19-kubernetes-cluster-manager.md)
- [20 - Multi-Region Failover](features-v2/20-multi-region-failover.md)
- [21 - Edge Compute Nodes](features-v2/21-edge-compute-nodes.md)
- [22 - Serverless Functions (FaaS)](features-v2/22-serverless-functions-faas.md)
- [23 - CDN & WAF Integration](features-v2/23-cdn-waf-integration.md)
- [24 - Multi-Cloud Cost Optimizer](features-v2/24-multi-cloud-cost-optimizer.md)
- [25 - Disaster Recovery Orchestrator](features-v2/25-disaster-recovery-orchestrator.md)
- [26 - Service Mesh Integration](features-v2/26-service-mesh-integration.md)

### Collaboration & Team
- [27 - Collaborative Terminal](features-v2/27-collaborative-terminal.md)
- [28 - Team Workspaces](features-v2/28-team-workspaces.md)
- [29 - Change Approval Workflow](features-v2/29-change-approval-workflow.md)
- [30 - Incident Management](features-v2/30-incident-management.md)
- [31 - Runbook Automation](features-v2/31-runbook-automation.md)
- [32 - Internal Knowledge Base](features-v2/32-internal-knowledge-base.md)
- [33 - Team Activity Feed](features-v2/33-team-activity-feed.md)

### Advanced Observability
- [34 - Distributed Tracing](features-v2/34-distributed-tracing.md)
- [35 - Custom Dashboard Builder](features-v2/35-custom-dashboard-builder.md)
- [36 - SLA / SLO Tracking](features-v2/36-sla-slo-tracking.md)
- [37 - Synthetic Monitoring](features-v2/37-synthetic-monitoring.md)
- [38 - Cost Allocation & Chargeback](features-v2/38-cost-allocation-chargeback.md)
- [39 - Alert Fatigue Reduction](features-v2/39-alert-fatigue-reduction.md)

### User Experience & Platform
- [40 - Mobile App](features-v2/40-mobile-app.md)
- [41 - Desktop App](features-v2/41-desktop-app.md)
- [42 - i18n / l10n](features-v2/42-i18n-l10n.md)
- [43 - WCAG 2.1 AA Compliance](features-v2/43-wcag-21-aa-compliance.md)
- [44 - Theme Studio](features-v2/44-theme-studio.md)
- [45 - Bulk Operations Manager](features-v2/45-bulk-operations-manager.md)

### Security & Compliance
- [46 - Compliance Framework Reports](features-v2/46-compliance-framework-reports.md)
- [47 - Secrets Management](features-v2/47-secrets-management.md)
- [48 - Container Image Scanner](features-v2/48-container-image-scanner.md)
- [49 - SIEM Export](features-v2/49-siem-export.md)
- [50 - GDPR & Data Retention](features-v2/50-gdpr-data-retention.md)

## Security & Support

- [Security Policy](../SECURITY.md)
- [Security Review 2026-05-04](security/security-review-2026-05-04.md)
- [Code of Conduct](../CODE_OF_CONDUCT.md)
- [Owners](../OWNERS.md)

## License

Infra Pilot ist unter der [MIT License](../LICENSE) lizenziert.

---

**Last Updated:** May 2026 (v2 feature plans added)
