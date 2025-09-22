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
