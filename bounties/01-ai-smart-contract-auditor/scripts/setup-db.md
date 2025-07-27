# Database Setup Guide

This project has been migrated from a file-based JSON database to PostgreSQL with Prisma ORM.

## Local Development Setup

### Option 1: Using Docker (Recommended)

We've included a `docker-compose.yml` file in the project root:

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    container_name: nextjs-postgres-conflux
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: mypassword123
      POSTGRES_DB: audit_db
    ports:
      - "5555:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

**Setup steps:**

1. Start the database:
```bash
docker-compose up -d
```

2. Wait a few seconds for PostgreSQL to start, then run the migration:
```bash
npm run db:migrate
```

3. (Optional) If you have existing JSON data, migrate it:
```bash
npm run db:migrate-data
```

**Container management:**
```bash
# View logs
docker-compose logs postgres

# Stop the database
docker-compose down

# Reset data (removes all data!)
docker-compose down -v
```

### Option 2: Local PostgreSQL Installation

1. Install PostgreSQL on your system
2. Create a database named `audit_db`
3. Update the `DATABASE_URL` in `.env` if needed
4. Run the migration:
```bash
npm run db:migrate
```

## Vercel Deployment

### 1. Set up Vercel Postgres

1. Go to your Vercel project dashboard
2. Navigate to the **Storage** tab
3. Click **Create Database** and select **Postgres**
4. Follow the setup wizard

### 2. Configure Environment Variables

Vercel will automatically add these environment variables to your project:
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL` 
- `POSTGRES_URL_NON_POOLING`

Update your Vercel environment variables:
1. Go to **Settings** → **Environment Variables**
2. Set `DATABASE_URL` to the value of `POSTGRES_PRISMA_URL`
3. Add your other environment variables (API keys, etc.)

### 3. Deploy with Database Migration

Option A: **Automatic migration on build** (add to package.json):
```json
{
  "scripts": {
    "build": "prisma generate && next build"
  }
}
```

Option B: **Manual migration** (run locally before deploy):
```bash
# Set your Vercel DATABASE_URL locally
export DATABASE_URL="your-vercel-postgres-url"
npm run db:migrate
```

## Available Database Commands

```bash
# Generate Prisma client
npm run db:generate

# Create and apply migration
npm run db:migrate

# Deploy migrations (production)
npm run db:deploy

# Reset database (development only)
npm run db:reset

# View database in Prisma Studio
npm run db:studio
```

## Data Migration from JSON Database

If you have existing data in `/data/database.json`, use the migration script:

```bash
npm run db:migrate-data
```

This will:
1. Read data from the JSON file
2. Transform it to match the new schema
3. Insert it into PostgreSQL

## Environment Variables

Required environment variables:

```env
# Database
DATABASE_URL="postgresql://postgres:mypassword123@localhost:5555/audit_db?schema=public"

# AI APIs
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key

# Conflux Network
CONFLUXSCAN_API_KEY=your-conflux-scan-api-key
```

## Troubleshooting

### Migration Issues

If you encounter migration errors:

```bash
# Reset and recreate
npm run db:reset
npm run db:migrate
```

### Connection Issues

1. Check your `DATABASE_URL` format
2. Ensure PostgreSQL is running
3. Verify network connectivity

### Vercel Deployment Issues

1. Check environment variables are set correctly
2. Ensure `DATABASE_URL` uses the Prisma connection string
3. Check build logs for migration errors