# 🛡️ ShieldOps — AI-Powered Zero Trust DevSecOps Pipeline

> **Team:** ShieldOps &nbsp;|&nbsp; Tejaswini P Unki · Soujanya M · Varshita Angadi

A full-stack, microservices-based application demonstrating a production-grade
**Zero Trust DevSecOps pipeline** with AI-powered anomaly detection.

---

## Architecture Overview

```
[Browser] → [Frontend: React]
                ↓
         [API Gateway :3000]  ← JWT Verify + Zero Trust + Rate Limit + Anomaly Detect
           /      |       \
    [Auth :3001] [Users :3002] [Data :3003]
                               ↑
                        [AI Module :5000]  ← Isolation Forest anomaly scoring
                               ↑
                        [MongoDB :27017]
                               
[Prometheus :9090] → [Grafana :3004]
```

---

## Tech Stack

| Layer            | Technology                              |
|------------------|-----------------------------------------|
| Frontend         | React 18, React Router v6               |
| API Gateway      | Node.js / Express + http-proxy-middleware|
| Microservices    | Node.js / Express (×3)                  |
| Database         | MongoDB 7 via Mongoose                  |
| AI Module        | Python 3.11, scikit-learn (IsolationForest), Flask, Gunicorn |
| Auth             | JWT (access 15m + refresh 7d), bcrypt, RBAC |
| Containerisation | Docker, Docker Compose                  |
| Orchestration    | Kubernetes (manifests in `k8s/`)        |
| CI/CD            | GitHub Actions                          |
| Security Tools   | SonarQube (SAST), OWASP Dep-Check, Trivy|
| Monitoring       | Prometheus, Grafana                     |

---

## Quick Start (Docker Compose)

```bash
# 1. Clone and configure
git clone <repo>
cd shieldops
cp .env.example .env        # Edit secrets before running in production

# 2. Start everything
docker-compose up --build

# 3. Access
#  Frontend   → http://localhost:3001
#  API Gateway→ http://localhost:3000
#  Grafana    → http://localhost:3004  (admin / shieldops123)
#  Prometheus → http://localhost:9090
```

**Default admin credentials:** `admin` / `Admin@123`  
*(Change immediately — the bcrypt hash is seeded in `scripts/mongo-init.js`)*

---

## Services & Ports

| Service       | Port  | Description                        |
|---------------|-------|------------------------------------|
| Frontend      | 3001  | React SPA served by Nginx          |
| API Gateway   | 3000  | Single entry point, Zero Trust     |
| Auth Service  | 3001* | Register / Login / Refresh         |
| User Service  | 3002* | CRUD + RBAC                        |
| Data Service  | 3003* | Process data + Security Alerts     |
| AI Module     | 5000* | Isolation Forest anomaly detector  |
| MongoDB       | 27017*| Persistent storage                 |
| Prometheus    | 9090  | Metrics collection                 |
| Grafana       | 3004  | Dashboards                         |

*Internal only — not exposed outside Docker network.*

---

## Security Features

### Zero Trust
Every request through the API Gateway is:
1. Validated with a JWT (`verifyToken` middleware)
2. Checked against RBAC route permissions (`zeroTrustCheck`)
3. Analysed for anomalous behaviour (`anomalyDetector`)

No implicit trust between services — each microservice re-checks the
forwarded `X-User-Id` and `X-User-Role` headers injected by the gateway.

### AI Anomaly Detection
The Python AI module (`ai-module/`) uses:
- **Heuristic scoring** — suspicious paths, known attack tool user-agents, request rate spikes
- **Isolation Forest** (scikit-learn) — trained on synthetic normal traffic at Docker build time
- Combined score (60% heuristic + 40% ML); threshold = 0.35

The model is pre-trained during the Docker build via `train_model.py` and can be
retrained at runtime by `POST /train` with new log data.

### JWT + Account Lockout
- Short-lived access tokens (15 min) + long-lived refresh tokens (7 days)
- Accounts lock for 30 minutes after 5 consecutive failed logins

### Secrets Management
- All secrets in `.env` (local) or Kubernetes Secrets (production)
- No hardcoded credentials in source code
- `.gitignore` excludes `.env` and `*.pkl` model files

---

## CI/CD Pipeline (GitHub Actions)

```
Code Push
   │
   ├─ 1. Unit Tests          (Jest × 4 services + pytest)
   ├─ 2. SAST                (SonarQube)
   ├─ 3. Dependency Scan     (OWASP Dependency-Check)
   ├─ 4. Build Docker Images (GHCR)
   ├─ 5. Container Scan      (Trivy — fails on CRITICAL/HIGH CVEs)
   └─ 6. Deploy to K8s       (kubectl apply + rollout status)
          └─ Post-deployment health check
             └─ Auto-rollback on failure
```

Required GitHub Secrets:
- `SONAR_TOKEN`, `SONAR_HOST_URL`
- `KUBECONFIG` (base64 encoded)

---

## Kubernetes Deployment

```bash
# Apply all manifests
kubectl apply -f k8s/base/ --recursive

# Watch rollout
kubectl get pods -n shieldops -w

# Verify
kubectl get svc -n shieldops
```

---

## Project Structure

```
shieldops/
├── frontend/               React SPA
├── backend/
│   ├── api-gateway/        Zero Trust entry point
│   ├── auth-service/       JWT authentication
│   ├── user-service/       User management + RBAC
│   └── data-service/       Data processing + Alerts
├── ai-module/              Python anomaly detector
├── k8s/                    Kubernetes manifests
├── monitoring/             Prometheus + Grafana configs
├── scripts/                DB seed scripts
├── .github/workflows/      GitHub Actions CI/CD
└── docker-compose.yml
```

---

## Team Responsibilities

| Member              | Role                                      |
|---------------------|-------------------------------------------|
| Tejaswini P Unki    | CI/CD Pipeline — GitHub Actions workflow  |
| Soujanya M          | Containerisation — Docker + Kubernetes    |
| Varshita Angadi     | Monitoring, Security & Threat Detection   |
