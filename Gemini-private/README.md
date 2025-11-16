# Multi-User AI Chat Platform

A comprehensive container-based multi-user AI chat platform for GCP with support for multiple AI models, advanced memory management, RAG, and enterprise SSO.

## Features

### AI Model Support
- **Claude Models**: Sonnet 4.5, Opus 4.1
- **Gemini Models**: 2.5 Flash, 2.5 Pro
- **Gemma Models**: Open-source alternatives

### Core Capabilities
- **Memory Management**: Long-term general and per-chat memory
- **Web Grounding**: Selectable web search integration
- **Extended Thinking**: Advanced reasoning capabilities
- **RAG System**: Configurable Retrieval-Augmented Generation

### User Management
- Personal user profiles with configurable settings
- Private per-user global memory
- Per-chat memory spaces
- Selective sharing of chats and memory with other users

### Authentication & Authorization
- Local account support
- Enterprise Ping SSO integration
- OAuth 2.0 support
- Active Directory integration
- Sailpoint IDM compatibility
- Role-Based Access Control (RBAC)
- Groups and permissions management

## Architecture

The platform follows a microservices architecture deployed on Google Cloud Platform (GCP):

- **Frontend**: React-based web application
- **Backend API**: FastAPI/Python microservices
- **Authentication Service**: OAuth2/OIDC with Ping SSO
- **Chat Service**: Multi-model AI integration
- **Memory Service**: Long-term and contextual memory
- **RAG Service**: Vector database with embedding generation
- **Web Grounding Service**: Real-time web search integration
- **Database**: PostgreSQL (Cloud SQL)
- **Vector Store**: Pinecone/Weaviate/pgvector
- **Cache**: Redis
- **Message Queue**: Cloud Pub/Sub
- **Container Orchestration**: Google Kubernetes Engine (GKE)

## Project Structure

```
Gemini-private/
├── backend/              # Backend microservices
├── frontend/             # React frontend application
├── infrastructure/       # Terraform and GCP configs
├── kubernetes/          # K8s manifests and Helm charts
├── docker/              # Dockerfiles and compose
├── database/            # Schema and migrations
├── scripts/             # Deployment and maintenance scripts
├── docs/                # Documentation
├── tests/               # Testing suite
└── config/              # Configuration templates
```

## Quick Start

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed deployment instructions.

```bash
# Quick deployment
cd scripts
./deploy.sh production
```

## Documentation

- [Deployment Guide](docs/DEPLOYMENT.md)
- [User Guide](docs/USER_GUIDE.md)
- [Support Documentation](docs/SUPPORT.md)
- [Architecture Overview](docs/ARCHITECTURE.md)
- [API Documentation](docs/API.md)
- [Runbooks](docs/runbooks/)

## License

Proprietary - Internal Use Only
