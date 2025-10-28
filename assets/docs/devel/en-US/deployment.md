# Project Introduction

# CoStrict Backend Deployment Tool

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-required-blue.svg)](https://docs.docker.com/get-docker/)
[![Docker Compose](https://img.shields.io/badge/docker--compose-required-blue.svg)](https://docs.docker.com/compose/install/)

## Project Overview

CoStrict Backend Deployment Tool is an enterprise-grade AI code assistant backend service deployment solution based on Docker Compose. This project provides a complete microservices architecture, including core components such as AI gateway, identity authentication, code analysis, chat services, supporting both private deployment and cloud service modes.

### Core Features

- **Microservices Architecture**: Container-based distributed service architecture
- **AI Gateway Integration**: Support for multiple large language model access
- **Identity Authentication System**: Integrated Casdoor for enterprise-grade identity management
- **Intelligent Code Analysis**: Provides code review, completion, optimization and other functions
- **Scalable Design**: Supports horizontal scaling and custom plugins

### System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   VSCode Plugin │────│   API Gateway   │────│   Backend       │
│   (CoStrict)    │    │  (Apache APISIX) │    │  Services       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                       ┌─────────────────┐    ┌─────────────────┐
                       │   AI Gateway    │    │   Database      │
                       │   (Higress)     │    │   Cluster       │
                       └─────────────────┘    └─────────────────┘
```

## System Requirements

### Self-deployed Model Instance Environment

**Hardware Requirements**:

- CPU: Intel x64 architecture, minimum 16 cores
- Memory: Minimum 32GB RAM
- Storage: Minimum 512GB available storage space
- GPU: CUDA-supported graphics card (Code completion/analysis recommended configuration: 2×RTX 4090 or 1×A800, Conversational model recommended configuration: 8\*H20)

**Software Requirements**:

- Operating System: CentOS 7+ or Ubuntu 18.04+ (WSL supported)
- Container Runtime: Docker 20.10+
- Orchestration Tool: Docker Compose 2.0+
- NVIDIA Drivers: nvidia-docker support

### Third-party API Service Environment

**Hardware Requirements**:

- CPU: Intel x64 architecture, minimum 16 cores
- Memory: Minimum 32GB RAM
- Storage: Minimum 512GB available storage space

**Software Requirements**:

- Operating System: CentOS 7+ or Ubuntu 18.04+
- Container Runtime: Docker 20.10+
- Orchestration Tool: Docker Compose 2.0+

## Quick Start

### 1. Get Deployment Code

```bash
git clone https://github.com/zgsm-ai/zgsm-backend-deploy.git
cd zgsm-backend-deploy
```

### 2. Environment Configuration

Edit configuration file:

```bash
vim configure.sh
```

**Key Configuration Parameters**:

| Parameter Name             | Description                        | Default Value | Required |
| -------------------------- | ---------------------------------- | ------------- | -------- |
| `COSTRICT_BACKEND_BASEURL` | Backend service base URL           | -             | ✅       |
| `COSTRICT_BACKEND`         | Backend service host address       | -             | ✅       |
| `PORT_APISIX_ENTRY`        | API gateway entry port             | 9080          | ❌       |
| `PORT_HIGRESS_CONTROL`     | Higress console port               | 8001          | ❌       |
| `PORT_CASDOOR`             | Casdoor authentication system port | 9009          | ❌       |

### 3. Service Deployment

Execute automated deployment script:

```bash
bash deploy.sh
```

The deployment process includes the following steps:

1. Environment check and dependency verification
2. Docker image pulling and building
3. Database initialization
4. Service container startup
5. Health check and status verification

## Service Configuration

### AI Gateway Configuration (Higress)

After deployment completion, access the Higress console through the following address:

```
http://{COSTRICT_BACKEND}:{PORT_HIGRESS_CONTROL}
```

Configuration steps:

1. Access Higress management interface
2. Configure upstream LLM service providers
3. Set routing rules and load balancing strategies
4. Configure rate limiting and security policies

Detailed configuration guide: [Higress Configuration Documentation](./docs/higress.zh-CN.md)

### Identity Authentication System Configuration (Casdoor)

Access the Casdoor management interface through the following address:

```
http://{COSTRICT_BACKEND}:{PORT_CASDOOR}
```

**Test Account** (for development and testing environments only):

```
Username: demo
Password: test123
```

Configuration features:

- User management and permission control
- Third-party identity provider integration (OIDC/SAML)
- Multi-factor authentication (MFA)
- Session management and security policies

## Client Integration

### VSCode Plugin Configuration

1. Install CoStrict VSCode extension
2. Open the "Provider" page in extension settings
3. Select API provider as "CoStrict"
4. Configure backend service address:
    ```
    CoStrict Base URL: {COSTRICT_BACKEND_BASEURL}
    ```
5. Click "Login to CoStrict" to complete authentication

**Service Access Address**:

```
Default backend entry: http://{COSTRICT_BACKEND}:{PORT_APISIX_ENTRY}
```

### Domain Binding and Load Balancing

For production environments, it is recommended to access services through reverse proxy or load balancer:

```bash
# Nginx configuration example
upstream costrict_backend {
    server {COSTRICT_BACKEND}:{PORT_APISIX_ENTRY};
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    location / {
        proxy_pass http://costrict_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Operations Management

### Service Status Monitoring

Check service running status:

```bash
# View all service status
docker-compose ps

# View service logs
docker-compose logs -f [service_name]

# View resource usage
docker stats
```

### Data Backup and Recovery

```bash
# Database backup
bash ./scripts/backup.sh

# Database recovery
bash ./scripts/restore.sh [backup_file]
```

### Service Scaling

```bash
# Scale service instances
docker-compose up -d --scale chatgpt=3

# Update service configuration
docker-compose up -d --force-recreate [service_name]
```

## Troubleshooting

### Common Issues

**1. Container startup failure**

```bash
# Check port usage
netstat -tlnp | grep {port}

# Check disk space
df -h

# View detailed error logs
docker-compose logs [service_name]
```

**2. Network connection issues**

```bash
# Test service connectivity
curl -v http://{COSTRICT_BACKEND}:{PORT_APISIX_ENTRY}/health

# Check Docker network
docker network ls
docker network inspect {network_name}
```

**3. Database connection issues**

```bash
# Check database service status
docker-compose exec postgres pg_isready

# View database logs
docker-compose logs postgres
```

### Log Collection

System log locations:

- Application logs: `./logs/`
- Database logs: `/var/log/postgresql/` in container
- Gateway logs: `/var/log/apisix/` in container

## Security Considerations

1. **Production Environment Deployment**:

    - Change all default passwords
    - Configure HTTPS certificates
    - Enable firewall and access control
    - Regularly update system and dependency packages

2. **Network Security**:

    - Only open necessary ports
    - Configure VPN or internal network access
    - Enable API rate limiting and protection

3. **Data Protection**:
    - Regularly backup important data
    - Enable database encryption
    - Configure access audit logs

## License

This project is open source under the Apache 2.0 license. See the [LICENSE](LICENSE) file for details.

## Support and Contribution

- **Issue Reports**: [GitHub Issues](https://github.com/zgsm-ai/zgsm-backend-deploy/issues)

---

**CoStrict** - Let AI assist your code development journey
