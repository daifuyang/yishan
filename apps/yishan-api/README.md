# yishan-api

This is the API service for Yishan project, built with Fastify and following the official Fastify demo patterns.

## Project Structure

This project follows the official Fastify demo structure:

```
src/
├── plugins/
│   ├── external/          # External plugins (security, cors, etc.)
│   └── app/              # Application plugins (business logic)
├── routes/               # Route definitions
└── app.ts               # Application entry point
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Edit .env file with your configuration
```

### Development

```bash
# Start development server with hot reload
pnpm run dev

# Build the project
pnpm run build:ts

# Start production server
pnpm start
```

### Available Scripts

- `pnpm run dev` - start the application in development mode
- `pnpm run build:ts` - build the TypeScript application
- `pnpm start` - start the built application
- `pnpm test` - run the tests

## API Documentation

When running in development mode, API documentation is available at:
- Swagger UI: http://localhost:3000/docs
- OpenAPI JSON: http://localhost:3000/docs/json

## Environment Variables

See `.env.example` for all available environment variables.

## Token清理服务

本项目包含Token清理服务，用于清理过期的用户认证Token。该服务专为Serverless环境设计，不包含内置的定时任务逻辑。

### 清理方式

Token清理通过外部中间件触发执行，支持以下方式：

1. **API调用**: 通过 `POST /api/v1/system/cleanup/tokens` 接口手动触发清理
2. **外部定时任务**: 建议使用云服务商的定时任务服务（如AWS Lambda、阿里云函数计算等）定期调用清理接口
3. **第三方调度工具**: 可使用cron服务、任务调度平台等外部工具定期触发

### 配置要求

- 需要设置 `CLEANUP_KEY` 环境变量作为清理服务的访问密钥
- 外部调用时需要在请求头中包含 `x-cleanup-key` 字段

### 清理策略

服务会自动清理同时满足以下条件的Token记录：
- 访问令牌(access_token)已过期
- 刷新令牌(refresh_token)已过期
