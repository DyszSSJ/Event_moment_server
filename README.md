# Event Moments API

Backend foundation for Event Moments.

## Stack

- NestJS
- TypeScript
- PostgreSQL
- Prisma

## Requirements

- Node.js
- pnpm
- PostgreSQL

## Installation

```bash
pnpm install
```

## Environment

```bash
cp .env.example .env
```

Required variables:

```env
NODE_ENV=development
PORT=4000
DATABASE_URL=
FRONTEND_URL=http://localhost:3000
```

## Database

```bash
pnpm prisma generate
pnpm prisma migrate dev
```

## Development

```bash
pnpm dev
```

## Build

```bash
pnpm build
```

## Lint

```bash
pnpm lint
```

## Typecheck

```bash
pnpm typecheck
```

## Tests

```bash
pnpm test
```

## Health

```http
GET /api/v1/health
```

Expected response:

```json
{
  "service": "event-moments-api",
  "status": "ok"
}
```
