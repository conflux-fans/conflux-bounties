# 🚀 Quick Start Guide

Get the AI Smart Contract Auditor running in less than 5 minutes!

## Prerequisites

- Node.js 18+ installed
- Docker installed (for database)
- AI API key (OpenAI or Anthropic)
- ConfluxScan API key

## Setup

1. **Clone and install**
   ```bash
   git clone <repository-url>
   cd 01-ai-smart-contract-auditor
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env.local
   ```

3. **Add your API keys to `.env.local`**
   ```env
   # Required: At least one AI provider
   OPENAI_API_KEY=sk-your-openai-key
   # OR
   ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
   
   # Required: Conflux network access
   CONFLUX_SCAN_API_KEY=your-conflux-scan-key
   
   # Database (already configured for Docker)
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/audit_db
   ```

4. **Start the database**
   ```bash
   docker-compose up -d
   npm run db:migrate
   ```

5. **Start the application**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Go to [http://localhost:3000](http://localhost:3000)

## That's it! 🎉

Your local AI Smart Contract Auditor is now running with:
- ✅ PostgreSQL database (via Docker)
- ✅ Prisma ORM for type-safe database operations
- ✅ Complete audit functionality
- ✅ Report persistence and history
- ✅ Production-ready database setup

## Test with a verified contract

Try auditing this verified Conflux contract:
```
0x1234567890123456789012345678901234567890
```

(Replace with an actual verified contract address from ConfluxScan)

## Alternative Setup (without Docker)

If you prefer not to use Docker:

1. **Install PostgreSQL locally**
2. **Create database**
   ```bash
   createdb audit_db
   ```
3. **Update DATABASE_URL in .env.local** with your local PostgreSQL connection
4. **Run migration**
   ```bash
   npm run db:migrate
   ```

## Database Commands

```bash
# Generate Prisma client
npm run db:generate

# Create and apply migrations
npm run db:migrate

# View database in Prisma Studio
npm run db:studio

# Migrate existing JSON data
npm run db:migrate-data
```

## Next Steps

- Check out the full [README.md](README.md) for complete documentation
- View the [Database Setup Guide](scripts/setup-db.md) for detailed database instructions
- Explore the API endpoints at `/api/*`
- View your audit history and reports
- Configure webhooks for notifications

## Need Help?

- Check the console logs for debugging
- Database runs in Docker container (`docker-compose logs postgres`)
- Use `npm run db:studio` to inspect database visually
- All audit data persists in PostgreSQL