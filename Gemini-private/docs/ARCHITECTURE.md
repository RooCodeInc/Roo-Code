# System Architecture

## Overview

The Multi-User AI Chat Platform is built using a microservices architecture deployed on Google Cloud Platform (GCP), leveraging Kubernetes for orchestration and containerization for portability.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Users                                 │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│                   Cloud Load Balancer                         │
│                   (GCP Load Balancer)                         │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React SPA)                       │
│                  (Cloud Run / GKE)                            │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway                              │
│                    (Kong / Cloud Endpoints)                   │
└────────────┬────────────────────────────────────────────────┘
             │
    ┌────────┴────────┬────────────┬────────────┬──────────┐
    ▼                 ▼            ▼            ▼          ▼
┌────────┐     ┌──────────┐  ┌─────────┐  ┌─────────┐  ┌──────┐
│  Auth  │     │   Chat   │  │ Memory  │  │   RAG   │  │ Web  │
│Service │     │ Service  │  │ Service │  │ Service │  │Ground│
└───┬────┘     └────┬─────┘  └────┬────┘  └────┬────┘  └──┬───┘
    │               │              │            │           │
    └───────┬───────┴──────┬───────┴────────────┴───────────┘
            │              │
            ▼              ▼
    ┌──────────────┐  ┌──────────────┐
    │  PostgreSQL  │  │    Redis     │
    │  (Cloud SQL) │  │   (Cache)    │
    └──────────────┘  └──────────────┘
            │
            ▼
    ┌──────────────┐
    │Vector Database│
    │  (pgvector)  │
    └──────────────┘
```

## Microservices

### 1. Authentication Service
- **Purpose**: Handle user authentication and authorization
- **Technology**: Python/FastAPI
- **Features**:
  - Local account management
  - Ping SSO integration (OAuth 2.0)
  - Active Directory integration
  - Sailpoint IDM support
  - JWT token generation and validation
  - Session management

### 2. Chat Service
- **Purpose**: Manage chat sessions and AI model interactions
- **Technology**: Python/FastAPI
- **Features**:
  - Multi-model routing (Claude, Gemini, Gemma)
  - Chat history management
  - Real-time message streaming
  - Model parameter configuration
  - Extended thinking mode

### 3. Memory Service
- **Purpose**: Manage user and chat memory
- **Technology**: Python/FastAPI
- **Features**:
  - Per-user global memory
  - Per-chat contextual memory
  - Memory retrieval and ranking
  - Memory sharing between users
  - Automatic memory extraction

### 4. RAG Service
- **Purpose**: Retrieval-Augmented Generation
- **Technology**: Python/FastAPI
- **Features**:
  - Document ingestion and chunking
  - Embedding generation
  - Vector similarity search
  - Configurable retrieval strategies
  - Multiple vector store backends

### 5. Web Grounding Service
- **Purpose**: Provide real-time web search capabilities
- **Technology**: Python/FastAPI
- **Features**:
  - Google Search API integration
  - Result summarization
  - Source citation
  - Selectable grounding mode

### 6. Frontend Service
- **Purpose**: User interface
- **Technology**: React, TypeScript, Material-UI
- **Features**:
  - Chat interface
  - User profile management
  - Settings configuration
  - Memory browser
  - Sharing controls

## Data Layer

### PostgreSQL (Cloud SQL)
- **Tables**:
  - users
  - user_profiles
  - user_settings
  - groups
  - roles
  - permissions
  - chats
  - messages
  - memories
  - shared_resources
  - documents

### Redis (Memorystore)
- Session storage
- API response caching
- Rate limiting
- Real-time presence

### Vector Database (pgvector extension)
- Memory embeddings
- Document embeddings
- Semantic search

## External Services

### AI Model APIs
- **Anthropic API**: Claude models
- **Google AI API**: Gemini models
- **Vertex AI**: Gemma models

### Identity Providers
- **Ping Identity**: Enterprise SSO
- **Active Directory**: LDAP/Kerberos
- **Sailpoint**: Identity governance

### GCP Services
- **GKE**: Kubernetes orchestration
- **Cloud SQL**: Managed PostgreSQL
- **Memorystore**: Managed Redis
- **Cloud Storage**: Object storage
- **Cloud Pub/Sub**: Message queue
- **Cloud Load Balancing**: Traffic distribution
- **Cloud Monitoring**: Observability
- **Cloud Logging**: Log aggregation
- **Secret Manager**: Credentials management

## Security Architecture

### Authentication Flow
1. User initiates login
2. Auth service redirects to Ping SSO (or local auth)
3. User authenticates with IdP
4. IdP returns authorization code
5. Auth service exchanges code for tokens
6. JWT issued to client
7. All API requests include JWT
8. Services validate JWT signature

### Authorization Flow (RBAC)
1. Request includes JWT with user ID
2. Service extracts user ID from JWT
3. Load user roles and permissions from cache/DB
4. Check if user has required permission
5. Allow or deny request

### Data Security
- All data encrypted at rest (Cloud SQL encryption)
- All data encrypted in transit (TLS 1.3)
- Secrets stored in GCP Secret Manager
- Network isolation via VPC
- Private GKE cluster
- Cloud Armor for DDoS protection

## Scalability

### Horizontal Scaling
- All microservices are stateless
- Auto-scaling based on CPU/memory/custom metrics
- GKE Horizontal Pod Autoscaler (HPA)
- GKE Cluster Autoscaler

### Caching Strategy
- API responses cached in Redis (TTL-based)
- Memory embeddings cached
- User session data cached
- Database query results cached

### Database Scaling
- Cloud SQL read replicas
- Connection pooling (pgbouncer)
- Query optimization
- Indexed frequently accessed columns

## High Availability

### Redundancy
- Multi-zone GKE cluster
- Cloud SQL high availability configuration
- Redis with failover replica
- Multiple replicas per service (min 3)

### Disaster Recovery
- Automated database backups (daily + PITR)
- Cross-region backup replication
- Infrastructure as Code (Terraform)
- Documented recovery procedures

### Monitoring & Alerting
- Health check endpoints on all services
- Prometheus metrics collection
- Grafana dashboards
- PagerDuty integration for alerts
- SLO/SLA monitoring

## Deployment Architecture

### Environments
- **Development**: Single-zone, minimal resources
- **Staging**: Multi-zone, production-like
- **Production**: Multi-zone, HA configuration

### CI/CD Pipeline
1. Code commit triggers Cloud Build
2. Run tests (unit, integration)
3. Build Docker images
4. Push to Container Registry
5. Update Kubernetes manifests
6. Deploy to staging (automatic)
7. Run E2E tests
8. Deploy to production (manual approval)

## Network Architecture

```
┌─────────────────────────────────────────────────────┐
│                    VPC Network                      │
│                                                     │
│  ┌───────────────────────────────────────────┐    │
│  │         Public Subnet (DMZ)                │    │
│  │  - Load Balancer                           │    │
│  │  - NAT Gateway                             │    │
│  └───────────────────────────────────────────┘    │
│                                                     │
│  ┌───────────────────────────────────────────┐    │
│  │      Private Subnet (Application)          │    │
│  │  - GKE Cluster (Private nodes)             │    │
│  │  - Microservices                           │    │
│  └───────────────────────────────────────────┘    │
│                                                     │
│  ┌───────────────────────────────────────────┐    │
│  │         Private Subnet (Data)              │    │
│  │  - Cloud SQL                               │    │
│  │  - Memorystore Redis                       │    │
│  └───────────────────────────────────────────┘    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## API Design

### RESTful Endpoints
- `/api/v1/auth/*` - Authentication
- `/api/v1/users/*` - User management
- `/api/v1/chats/*` - Chat operations
- `/api/v1/messages/*` - Message operations
- `/api/v1/memories/*` - Memory management
- `/api/v1/documents/*` - Document management
- `/api/v1/settings/*` - User settings
- `/api/v1/sharing/*` - Resource sharing

### WebSocket
- `/ws/chat/{chat_id}` - Real-time chat streaming

## Technology Stack

### Backend
- **Language**: Python 3.11+
- **Framework**: FastAPI
- **ORM**: SQLAlchemy
- **Migrations**: Alembic
- **Validation**: Pydantic
- **Testing**: pytest
- **API Docs**: OpenAPI/Swagger

### Frontend
- **Framework**: React 18+
- **Language**: TypeScript
- **State Management**: Redux Toolkit
- **UI Library**: Material-UI (MUI)
- **HTTP Client**: Axios
- **WebSocket**: Socket.io-client
- **Testing**: Jest, React Testing Library

### Infrastructure
- **IaC**: Terraform
- **Containers**: Docker
- **Orchestration**: Kubernetes (GKE)
- **Package Management**: Helm
- **CI/CD**: Cloud Build
- **Monitoring**: Prometheus + Grafana
- **Logging**: Cloud Logging

### AI/ML
- **Embeddings**: Vertex AI, OpenAI
- **Vector Search**: pgvector
- **Model APIs**: Anthropic, Google AI

## Performance Targets

- **API Response Time**: p95 < 200ms
- **Chat Message Latency**: < 2s for first token
- **Uptime**: 99.9% SLA
- **Concurrent Users**: Support 10,000+
- **Database Queries**: p95 < 50ms
- **Cache Hit Rate**: > 80%
