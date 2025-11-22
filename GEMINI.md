# GEMINI.md

## Project Overview

This is a TypeScript/React project built with Vite. It uses Supabase as its backend for database, authentication, and serverless functions. The application features a rich user interface built with Radix UI, Tailwind CSS, and other modern UI libraries. It includes routing with React Router, data fetching and caching with TanStack Query, and client-side validation with Zod.

## Technologies Used

*   **Frontend:** React, TypeScript, Vite
*   **Styling:** Tailwind CSS, Shadcn UI, Radix UI
*   **State Management/Data Fetching:** TanStack Query, React Context (for Theme and Auth)
*   **Routing:** React Router DOM
*   **Backend:** Supabase (Database, Auth, Edge Functions)
*   **Validation:** Zod

## Building and Running

### Development

To run the project in a development environment, use the following command:

```bash
bun run dev
# or npm run dev
```

### Building

To create a production-ready build, use the following command:

```bash
bun run build
# or npm run build
```

### Linting and Type-Checking

To lint the code and check for type errors, use the following commands:

```bash
bun run lint
bun run type-check
# or npm run lint
# or npm run type-check
```

## Supabase Integration

This project is heavily integrated with Supabase for its backend needs.

### Environment Variables

Ensure your `.env` file in the root of the project contains the following Supabase credentials:

```
VITE_SUPABASE_PROJECT_ID="your_project_id"
VITE_SUPABASE_PUBLISHABLE_KEY="your_anon_key"
VITE_SUPABASE_URL="your_supabase_url"
```

These are used by the client-side application to connect to your Supabase project.

### Supabase CLI Usage

For local development and deploying changes to your Supabase project, you'll use the Supabase CLI.

1.  **Login to Supabase CLI:**
    If you haven't already, log in to the Supabase CLI:
    ```bash
    supabase login
    ```

2.  **Link your local project:**
    Link your local repository to your Supabase project using its reference ID:
    ```bash
    supabase link --project-ref your-project-id
    ```

3.  **Database Migrations:**
    The `supabase/migrations` directory contains SQL files for managing your database schema.
    *   To apply local migrations to your Supabase project:
        ```bash
        supabase db push
        ```
    *   To pull remote database schema changes to your local environment:
        ```bash
        supabase db pull
        ```

4.  **Edge Functions:**
    The `supabase/functions` directory contains your serverless Edge Functions.
    *   To deploy your Edge Functions to Supabase:
        ```bash
        supabase functions deploy
        ```

## Development Conventions

TODO: Add information about coding styles, testing practices, and contribution guidelines.