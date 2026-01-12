# CloudVault

A secure, multi-tenant file storage API with S3-compatible storage and background processing.

![Node.js](https://img.shields.io/badge/Node.js-20-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue)
![Redis](https://img.shields.io/badge/Redis-7-red)

## Features

- 🔐 **Multi-tenant authentication** with API keys
- 📁 **Pre-signed URL uploads** for direct S3/R2 uploads
- ⚡ **Background processing** with BullMQ
- 📊 **Comprehensive audit logging**
- 🏥 **Health checks & metrics** endpoints
- 🐳 **Docker ready** with multi-stage builds

## Tech Stack

| Layer | Technology |
|-------|------------|
| API | Express.js, TypeScript |
| Database | PostgreSQL, Prisma |
| Queue | Redis, BullMQ |
| Storage | S3-compatible (AWS S3, Cloudflare R2) |
| Logging | Pino |

## Quick Start

```bash
# Install dependencies
npm install

# Start Redis & LocalStack (S3 mock)
docker compose up -d

# Setup database
cd packages/api
npx prisma db push
npx prisma generate

# Run services
npm run dev
```

## API Overview

| Endpoint | Description |
|----------|-------------|
| `POST /api/v1/admin/organizations` | Create organization |
| `POST /api/v1/admin/api-keys` | Create API key |
| `POST /api/v1/files/upload-url` | Get pre-signed upload URL |
| `GET /api/v1/files` | List files |
| `GET /api/v1/files/:id/download-url` | Get download URL |
| `GET /health/ready` | Health check |

## Project Structure

```
cloudvault/
├── packages/
│   ├── api/          # REST API service
│   ├── worker/       # Background job processor
│   └── shared/       # Shared utilities
└── docker-compose.yml
```

## License

MIT
