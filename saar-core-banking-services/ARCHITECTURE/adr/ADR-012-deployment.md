# ADR-012: Deployment & Infrastructure

| Field | Value |
|-------|-------|
| Status | **Accepted** |
| Date | 2026-03-29 |
| Deciders | SaaR Architecture Team |
| Regulatory Ref | IDRBT Annexure II — 15-min RPO, 1-hr RTO, Data Centre requirements; RBI Cloud Computing guidelines (India region only) |

---

## Context

SaaR CBS needs a deployment strategy that:
- Works for a startup team (simple enough to manage)
- Can scale to multi-bank, high-availability as business grows
- Keeps all data within India (RBI regulatory requirement)
- Supports zero-downtime deployments
- Enables rapid iteration during development

Two phases are planned:
- **Phase 1:** Docker Compose on a Hetzner VPS (current — demobank.saaritsolutions.com)
- **Phase 2:** Kubernetes on Azure India or on-premises (when bank goes live)

---

## Phase 1: Docker Compose (Current)

### Container Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│  Hetzner VPS (Ubuntu 22.04, 8 vCPU, 16 GB RAM, 100 GB SSD)     │
│  Location: Helsinki (Phase 1 demo) → Bangalore (Phase 2 prod)  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Docker Compose Stack                                      │  │
│  │                                                            │  │
│  │  nginx:443 ─────────────────────────────────────────┐     │  │
│  │                                                      │     │  │
│  │  frontend (React SPA)          ◄──── nginx /        │     │  │
│  │  identityservice:5001          ◄──── nginx /api/    │     │  │
│  │  customerservice:5200          ◄──── nginx /api/    │     │  │
│  │  loanservice:5130              ◄──── nginx /api/    │     │  │
│  │  workfloworchestration:5012    ◄──── nginx /api/    │     │  │
│  │  expressionbuilder:5004        ◄──── nginx /api/    │     │  │
│  │  dynamicfields:5013            ◄──── nginx /api/    │     │  │
│  │  transactionservice:5245       ◄──── nginx /api/    │     │  │
│  │                                                      │     │  │
│  │  postgres:5432 (named volume: pgdata)                │     │  │
│  │  redis:6379    (named volume: redisdata)             │     │  │
│  └──────────────────────────────────────────────────────┘     │  │
│                                                                  │
│  SSL: Let's Encrypt (certbot, auto-renewal)                     │
│  Backup: pg_basebackup → Hetzner Object Storage (daily)         │
└─────────────────────────────────────────────────────────────────┘
```

### docker-compose.yml (Key Design Decisions)
```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./db/init:/docker-entrypoint-initdb.d  # schema creation scripts
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: saar
    restart: unless-stopped
    networks: [internal]
    # NOT exposed on host ports — only accessible within Docker network

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data
    command: redis-server --appendonly yes  # persistence enabled
    restart: unless-stopped
    networks: [internal]

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./nginx/ssl:/etc/letsencrypt:ro
    depends_on: [frontend, loanservice, customerservice]
    restart: unless-stopped
    networks: [internal, external]

  frontend:
    build:
      context: ./frontend-react
      args:
        REACT_APP_API_BASE_URL: https://${DOMAIN}
    restart: unless-stopped
    networks: [internal]

  loanservice:
    build: ./LoanService
    environment:
      ASPNETCORE_ENVIRONMENT: Production
      ConnectionStrings__DefaultConnection: "Host=postgres;..."
      Services__ExpressionBaseUrl: "http://expressionbuilder:5004"
      CORS__AllowedOrigins: "https://${DOMAIN}"
    restart: unless-stopped
    networks: [internal]

  # ... other services follow same pattern

volumes:
  pgdata:
  redisdata:

networks:
  internal:
    driver: bridge
  external:
    driver: bridge
```

### CI/CD Pipeline (GitHub Actions)
```yaml
# .github/workflows/deploy.yml
name: Deploy to Demo

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Build and test
        run: |
          dotnet build
          dotnet test

      - name: SSH to server and deploy
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.HETZNER_HOST }}
          username: ubuntu
          key: ${{ secrets.HETZNER_SSH_KEY }}
          script: |
            cd /opt/saar-banking
            git pull origin main
            docker compose build --no-cache
            docker compose up -d --force-recreate
            docker compose ps
```

---

## Phase 2: Kubernetes (Production)

### When to Migrate
```
Trigger: First bank goes live (production use, real customer data)

Requirements driving Kubernetes:
  - High availability: no single point of failure
  - Rolling deployments: zero downtime during updates
  - Auto-scaling: EOD batch needs more pods than OLTP daytime
  - Multi-cluster: primary site + DR site (15-min RPO requirement)
  - Secret management: Kubernetes secrets + Azure Key Vault
  - Resource isolation: guarantee CPU/memory per service
```

### Kubernetes Architecture (Target State)
```
Azure Kubernetes Service (AKS) — Central India region

Namespace: saar-prod
├── Deployments (each with HPA):
│   ├── identity-service      (min: 2, max: 5 pods)
│   ├── customer-service      (min: 2, max: 5 pods)
│   ├── loan-service          (min: 2, max: 10 pods)
│   ├── workflow-service      (min: 2, max: 5 pods)
│   ├── expression-builder    (min: 2, max: 20 pods) ← CPU-intensive, scales most
│   ├── frontend              (min: 2, max: 5 pods)
│   └── nginx-ingress         (via ingress controller)
│
├── StatefulSets:
│   ├── postgres-primary      (dedicated node, 32 GB RAM, fast SSD)
│   ├── postgres-replica      (dedicated node)
│   └── redis-cluster         (3-node cluster)
│
└── CronJobs:
    ├── eod-trigger            (daily at 22:00 IST)
    ├── bod-trigger            (daily at 07:00 IST)
    └── report-scheduler       (daily at 06:00 IST)
```

### Disaster Recovery Setup
```
Primary: AKS cluster — Central India (Mumbai)
DR Site: AKS cluster — South India (Chennai)

Replication:
  PostgreSQL: streaming replication, DR replica < 30s lag → RPO < 1 min
  Redis: Redis replication to DR site (sessions can be re-authenticated)

Failover:
  Azure Traffic Manager → DNS failover to DR site
  RTO target: < 45 minutes (within IDRBT 1-hour requirement)
  RPO target: < 5 minutes (better than IDRBT 15-minute requirement)

Failover procedure:
  1. Detect primary failure (monitoring alert)
  2. Promote DR PostgreSQL replica to primary
  3. Update DNS (Azure Traffic Manager) → 5 min TTL
  4. DR AKS cluster has all images pre-pulled → cold start in < 5 min
  5. Verify: smoke test all service health endpoints
  6. Bank is operational on DR site
```

---

## Infrastructure as Code

### Phase 1 (Hetzner — bash scripts)
```bash
# server-setup.sh
apt-get update && apt-get install -y docker.io docker-compose-v2 certbot
systemctl enable docker

# Create app directory and clone repo
mkdir -p /opt/saar-banking
cd /opt/saar-banking
git clone https://github.com/saaritsolutions/saar-core-banking .

# Setup SSL
certbot certonly --standalone -d demobank.saaritsolutions.com

# Create .env from template
cp .env.example .env
# Edit .env with production values

# Start
docker compose up -d
```

### Phase 2 (Azure — Terraform)
```hcl
# main.tf
resource "azurerm_kubernetes_cluster" "saar_prod" {
  name                = "saar-prod-aks"
  location            = "centralindia"
  resource_group_name = "saar-banking-rg"

  default_node_pool {
    name       = "system"
    node_count = 3
    vm_size    = "Standard_D4s_v3"
  }

  # Dedicated node pool for PostgreSQL
  # ...
}

resource "azurerm_key_vault" "saar_secrets" {
  name     = "saar-banking-kv"
  location = "centralindia"
  # India region for regulatory compliance
}
```

---

## Secrets Management

```
Phase 1: .env file on server (gitignored, manual rotation)
  - DB password
  - OpenAI API key
  - JWT signing key
  - PII encryption key

Phase 2: Azure Key Vault (India region)
  - All secrets stored in Key Vault
  - Applications use managed identity (no passwords in config)
  - Automatic rotation for DB credentials
  - Audit log of all secret accesses (RBI requirement)
```

---

## Monitoring Stack

```
Logs:
  Services → Serilog JSON → stdout
  Docker: json-file driver → Fluent Bit → Elasticsearch
  Kibana: log search and alerting

Metrics:
  Services → OpenTelemetry → Prometheus
  Grafana: dashboards (TPS, latency, EOD progress, NPA count)

Traces:
  Services → OpenTelemetry → Jaeger
  Use: debugging slow transactions, EOD step profiling

Alerts:
  Grafana Alertmanager → SMS (bank admin) + PagerDuty (SaaR ops)
  Alert triggers:
    - Service down > 1 min
    - EOD not completed by 01:00
    - PostgreSQL replication lag > 60s
    - Any 5xx error rate > 1%
    - Redis memory usage > 80%
```

---

## Consequences

### Positive
- Phase 1 is simple enough for a 2-person team to operate
- Phase 2 migration path is well-defined (same Docker images → Kubernetes)
- Both phases meet IDRBT RTO/RPO requirements
- GitHub Actions provides automated CI/CD from day 1

### Negative / Mitigations
- **Risk:** Phase 1 Hetzner VPS is a single server (no HA)
  - **Mitigation:** Acceptable for demo/UAT; migrate to Phase 2 before bank goes live
- **Risk:** Hetzner is in Finland, not India (RBI may object)
  - **Mitigation:** Hetzner has Bangalore servers; move to Hetzner Bangalore or Azure India for production
- **Risk:** docker-compose.yml secrets in .env file on disk
  - **Mitigation:** Encrypted disk (LUKS), restrict SSH access, add Phase 2 Key Vault as soon as possible

---

## Related Decisions
- ADR-006: Database Strategy (PostgreSQL topology: Primary + Replicas + DR)
- ADR-007: Security Framework (Secrets management, Key Vault)
- ADR-011: API Gateway (nginx configuration lives in this deployment)
