# Chunk Daddy

A RAG (Retrieval-Augmented Generation) content chunking and optimization tool that helps you analyze, chunk, and optimize content for better AI retrieval performance.

## Features

- **Content Chunking**: Multiple chunking strategies (fixed size, sentence-based, semantic, layout-aware)
- **Embedding Generation**: Generate embeddings using OpenAI's text-embedding-3-large model
- **Content Optimization**: AI-powered content analysis and optimization suggestions
- **Similarity Analysis**: Compare chunks and analyze semantic similarity
- **CSV Export**: Export chunked content for use in other systems

## Quick Start

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to the project directory
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm install

# Start the development server
npm run dev
```

## Setting Up Your Own Backend (For Contributors)

If you're forking or cloning this project, you'll need to set up your own backend services.

### Prerequisites

- [Supabase](https://supabase.com) account (free tier available)
- [OpenAI](https://platform.openai.com) API key (required for embeddings and optimization)
- Node.js 18+ and npm

### 1. Supabase Project Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Navigate to **Settings > API** to get your credentials
3. Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

### 2. Deploy Edge Functions

Install the Supabase CLI and deploy the required edge functions:

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your_project_id

# Deploy edge functions
supabase functions deploy generate-embeddings
supabase functions deploy optimize-content
```

### 3. Configure API Keys

Add your OpenAI API key as a Supabase secret:

```bash
supabase secrets set OPENAI_API_KEY=sk-your-openai-key
```

### 4. Authentication Setup (Optional)

If you want to use authentication:

1. In Supabase Dashboard: **Authentication > Providers > Enable Email**
2. For development: Disable "Confirm email" in Email settings

### Environment Variables Reference

| Variable | Source | Required |
|----------|--------|----------|
| `VITE_SUPABASE_URL` | Supabase Dashboard > Settings > API | Yes |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase Dashboard > Settings > API | Yes |
| `VITE_SUPABASE_PROJECT_ID` | Supabase Dashboard > Settings > General | Yes |
| `OPENAI_API_KEY` | OpenAI Platform (set as Supabase secret) | Yes |

### Edge Functions Reference

| Function | Description |
|----------|-------------|
| `generate-embeddings` | Generates text embeddings using OpenAI's `text-embedding-3-large` model |
| `optimize-content` | AI-powered content analysis and optimization using GPT models |

## Security

- The `.env` file is in `.gitignore` - never commit it
- API keys are stored as Supabase secrets, not in the codebase
- See [SECURITY.md](SECURITY.md) for reporting vulnerabilities

## Tech Stack

- [Vite](https://vitejs.dev) - Build tool
- [React](https://react.dev) - UI framework
- [TypeScript](https://typescriptlang.org) - Type safety
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [shadcn/ui](https://ui.shadcn.com) - UI components
- [Supabase](https://supabase.com) - Backend (Edge Functions)
- [OpenAI](https://openai.com) - Embeddings & AI optimization

## License

MIT
