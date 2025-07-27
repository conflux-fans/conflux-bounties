# 🚀 Quick Start Guide

Get the AI Smart Contract Auditor running in less than 5 minutes!

## Prerequisites

- Node.js 18+ installed
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
   ```

4. **Start the application**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Go to [http://localhost:3000](http://localhost:3000)

## That's it! 🎉

Your local AI Smart Contract Auditor is now running with:
- ✅ Local JSON database (auto-created)
- ✅ No external services required
- ✅ Complete audit functionality
- ✅ Report persistence and history

## Test with a verified contract

Try auditing this verified Conflux contract:
```
0x1234567890123456789012345678901234567890
```

(Replace with an actual verified contract address from ConfluxScan)

## Next Steps

- Check out the full [README.md](README.md) for complete documentation
- Explore the API endpoints at `/api/*`
- View your audit history and reports
- Configure webhooks for notifications

## Need Help?

- Check the console logs for debugging
- Database is stored at `./data/database.json`
- All audit data persists locally