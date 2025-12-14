# CallVault Quick Start Guide

## Getting Started with the New Loop-Inspired Interface

This guide will help you get up and running with the completely redesigned CallVault system featuring Microsoft Loop-inspired UI and agentic AI knowledge extraction.

## Prerequisites

Before you begin, ensure you have the following installed and configured on your system:

- **Node.js** version 18 or higher
- **npm** or **yarn** package manager
- **Supabase** account with a project created
- **OpenAI API** key for AI processing

## Environment Setup

Create a `.env` file in the project root directory with the following variables:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_OPENAI_API_KEY=your-openai-api-key-here
```

These credentials are essential for the application to connect to your Supabase database and enable AI-powered features.

## Database Configuration

The application requires several database tables to function properly. Run the provided migration scripts to set up your database schema:

```bash
# Navigate to your Supabase project directory
cd supabase

# Apply the insights tables migration
supabase db push --file migrations/20251214_add_insights_tables.sql

# Apply the generated content migration
supabase db push --file migrations/20251214_add_generated_content.sql
```

These migrations create the necessary tables for storing calls, insights, workspaces, and AI-generated content, along with appropriate Row Level Security policies.

## Edge Functions Deployment

Deploy the serverless edge functions that power the AI processing:

```bash
# Deploy the knowledge extraction function
supabase functions deploy extract-knowledge --no-verify-jwt

# Deploy the content generation function
supabase functions deploy generate-content --no-verify-jwt
```

Ensure your Supabase project has the OpenAI API key configured in the function secrets.

## Installation

Install all required dependencies by running the following command in the project root:

```bash
npm install
```

This will install React, TypeScript, Vite, TanStack Query, shadcn/ui components, the Vercel AI SDK, and all other necessary packages.

## Running the Application

Start the development server to see the new interface in action:

```bash
npm run dev
```

The application will be available at `http://localhost:8080`. Open this URL in your web browser to access CallVault.

## First Steps in the Application

Once the application is running, follow these steps to explore the new features:

### 1. Sign In or Create an Account

Navigate to the login page and either sign in with your existing credentials or create a new account using Supabase authentication.

### 2. Explore the Workspaces Home

After logging in, you'll land on the Workspaces Home page, which displays all your workspaces in a beautiful grid layout inspired by Microsoft Loop. Each workspace features a gradient background, emoji icon, and member information.

### 3. Create Your First Workspace

Click the "New Workspace" button to create a workspace for organizing your calls. Choose an emoji, select a gradient color, and give it a meaningful name like "Sales Calls" or "Customer Support."

### 4. Upload a Call

Navigate to your workspace and upload your first call transcript. The system accepts various formats including plain text, JSON, and structured transcripts.

### 5. Enable Auto-Processing

Toggle the "Auto AI Processing" switch to automatically extract insights from new calls. Configure which processing steps you want enabled, such as extracting insights, generating summaries, detecting sentiment, and applying the PROFITS framework.

### 6. View AI Insights

Once a call is processed, navigate to the "AI Insights" page to see all extracted insights categorized by type: Pain Points, Success Stories, Objections, and Questions. Each insight includes a confidence score and source information.

### 7. Generate Content

Select one or more insights and click "Generate Content" to create marketing materials. Choose from Email, Social Post, Blog Outline, or Case Study formats. The AI will generate content based on your selected insights with real-time streaming.

### 8. Explore Analytics

Visit the Analytics dashboard to see trends across all your calls, including sentiment distribution, insight categories, top topics, and performance metrics.

## Key Features Overview

The redesigned CallVault offers several powerful features designed to make knowledge extraction and content creation effortless:

### Microsoft Loop-Inspired Interface

The new interface features a clean, modern design with a fixed top navigation bar, collapsible sidebar, and responsive layout. The sidebar provides quick access to workspaces, insights, analytics, and settings.

### Agentic AI Processing

The system automatically processes call transcripts using GPT-4 Turbo to extract valuable insights without manual intervention. Simply upload a call and let the AI do the work.

### PROFITS Framework

Every call is analyzed using the PROFITS framework, which identifies Pain points, Results, Obstacles, Fears, Identity statements, Triggers, and Success stories. This structured approach ensures comprehensive insight extraction.

### Content Generation

Transform insights into actionable content with one click. The AI generates professional emails, engaging social media posts, detailed blog outlines, and compelling case studies based on your selected insights.

### Workspace Organization

Organize calls into visual workspaces with emoji icons and gradient backgrounds. Collaborate with team members and track activity across all your workspaces.

### Real-Time Progress Tracking

The AI Status Widget shows real-time progress during processing, including current task, completion percentage, and any errors encountered.

## Troubleshooting

If you encounter issues while using CallVault, try these common solutions:

### Application Won't Start

Ensure all environment variables are correctly set in your `.env` file. Check that your Supabase URL and keys are valid.

### AI Processing Fails

Verify that your OpenAI API key is valid and has sufficient credits. Check the browser console for detailed error messages.

### Database Errors

Confirm that all migrations have been applied successfully. Check your Supabase dashboard to ensure tables exist and RLS policies are enabled.

### Build Errors

Clear your node_modules and reinstall dependencies:

```bash
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

Now that you're up and running, explore these advanced features:

- **Batch Processing**: Select multiple calls and process them all at once
- **Insight Filtering**: Use filters and search to find specific insights
- **Content Customization**: Adjust tone, audience, and context when generating content
- **Analytics Deep Dive**: Explore sentiment trends and topic distributions
- **Workspace Collaboration**: Invite team members to collaborate on workspaces

## Support and Documentation

For more detailed information, refer to the following documentation files:

- `LOOP_REDESIGN_SPEC.md` - Complete design specification
- `LOOP_REDESIGN_IMPLEMENTATION.md` - Technical implementation details
- `README.md` - Project overview and setup instructions

The new CallVault system represents a complete transformation of how you extract knowledge from calls and generate valuable content. The combination of beautiful design and powerful AI makes it easier than ever to turn conversations into actionable insights.
