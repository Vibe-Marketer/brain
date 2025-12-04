# Suggested Commands - Conversion Brain

## Development Server
```bash
npm run dev          # Start Vite dev server (http://localhost:8080)
npm run build        # Production build
npm run build:dev    # Development build
npm run preview      # Preview production build
```

## Code Quality
```bash
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking (tsc --noEmit)
```

## Testing
```bash
npx vitest           # Run tests
npx vitest --watch   # Run tests in watch mode
npm run test:rag     # Test RAG retrieval (tsx scripts/test-rag-retrieval.ts)
```

## Supabase Edge Functions
```bash
npx supabase functions serve                    # Local function development
npx supabase functions deploy <function-name>   # Deploy specific function
npx supabase functions deploy                   # Deploy all functions
```

## Database (Supabase)
```bash
npx supabase db diff    # Generate migration from changes
npx supabase db push    # Push migrations
npx supabase db reset   # Reset database
```

## Git (Standard)
```bash
git status              # Check working tree status
git diff                # View unstaged changes
git add .               # Stage all changes
git commit -m "message" # Commit changes
git push                # Push to remote
```

## macOS Utils (Darwin)
```bash
open <file>             # Open file with default app
pbcopy / pbpaste        # Clipboard copy/paste
lsof -i :8080           # Check what's using port 8080
pkill -f "vite"         # Kill Vite process
```
