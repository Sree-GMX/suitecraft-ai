# SuiteCraft.ai

SuiteCraft.ai is an AI-assisted QA release workspace built for hackathon judging and product demos. It helps teams move from release scope to regression planning, approval, and execution tracking in one place instead of juggling spreadsheets, ticket exports, and disconnected test tools.

## Problem

Release teams often know what changed, but they still spend too much time answering the same hard questions:

- Which tickets actually matter for this release?
- What regression coverage already exists?
- Which tests are mandatory vs. optional?
- Which QA environment is the safest place to execute?
- How do we keep everyone aligned once execution starts?

SuiteCraft.ai turns that into a guided workflow.

## What The Product Does

- Imports and scopes release work from Jira-style ticket data rom api/CSV data
- Maps release changes to available TestRail-style test cases from api/CSV data
- Generates a risk-based regression plan using deterministic rules plus optional AI insights
- Gives teams a review and approval step before execution begins
- Tracks release readiness, coverage, confidence, bugs, and execution progress
- Includes a QABot assistant for common QA workspace actions and questions

## Core Workflow

The main product journey lives in the unified release workflow:

1. Scope the release by selecting tickets and impacted areas
2. Generate a focused regression strategy
3. Review and approve the execution set
4. Run and track execution progress

This is supported by a release dashboard, org recommendations, authentication, and AI-assisted planning APIs.

## Why It’s Useful

- Reduces manual regression planning effort
- Makes release risk visible earlier
- Keeps QA, release managers, and stakeholders aligned in one workflow
- Combines deterministic coverage rules with AI-generated reasoning instead of relying on AI alone
- Works well for a hackathon demo because sample data is already included in the repo

## Tech Stack

- Frontend: React, TypeScript, Vite, Material UI, React Query
- Backend: FastAPI, SQLAlchemy, Alembic
- Auth: JWT-based authentication
- Database: PostgreSQL in deployment, any SQLAlchemy-compatible database URL for local setup
- AI: Groq when configured, Ollama as a local fallback
- Demo data: Jira CSV and TestRail CSV files in the repo

## Repository Layout

- [frontend](/Users/admin/Documents/suitecraft.ai/frontend) - React web app
- [backend](/Users/admin/Documents/suitecraft.ai/backend) - FastAPI API, services, models, and migrations
- [backend/jira_data.csv](/Users/admin/Documents/suitecraft.ai/backend/jira_data.csv) - sample release ticket data
- [backend/testrail_testcases.csv](/Users/admin/Documents/suitecraft.ai/backend/testrail_testcases.csv) - sample test case data
- [frontend/src/pages/UnifiedReleaseWorkflow.tsx](/Users/admin/Documents/suitecraft.ai/frontend/src/pages/UnifiedReleaseWorkflow.tsx) - primary user workflow

## Local Setup

### Prerequisites

- Node.js 18+
- Python 3.11+
- A database reachable through `DATABASE_URL`

PostgreSQL is the intended setup for local development because the deployed app uses Postgres as well.

### 1. Backend Setup

```bash
cd /Users/admin/Documents/suitecraft.ai/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create `/Users/admin/Documents/suitecraft.ai/backend/.env` with values like:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/suitecraft
SECRET_KEY=change-me-to-a-long-random-string
ENCRYPTION_KEY=change-me-to-a-long-random-string
STARTUP_CREATE_SCHEMA=false

USE_GROQ=false
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
GROQ_API_KEY=
GROQ_MODEL=llama-3.1-8b-instant

CORS_ORIGINS=["http://localhost:5173","http://localhost:3000"]
FRONTEND_URL=http://localhost:5173
```

Run migrations:

```bash
cd /Users/admin/Documents/suitecraft.ai/backend
source venv/bin/activate
alembic upgrade head
```

Seed demo data:

```bash
cd /Users/admin/Documents/suitecraft.ai/backend
source venv/bin/activate
python scripts/init_db.py
```

Start the API:

```bash
cd /Users/admin/Documents/suitecraft.ai/backend
source venv/bin/activate
uvicorn app.main:app --reload
```

Backend runs at `http://localhost:8000`.

### 2. Frontend Setup

```bash
cd /Users/admin/Documents/suitecraft.ai/frontend
npm install
```

Create `/Users/admin/Documents/suitecraft.ai/frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
```

Start the frontend:

```bash
cd /Users/admin/Documents/suitecraft.ai/frontend
npm run dev
```

Frontend runs at `http://localhost:5173`.

## Demo Login

After seeding the database with `python scripts/init_db.py`, you can use:

- Email: `admin@suitecraft.ai`
- Password: `admin123`

You can also register a new account from the UI.

## Suggested Demo Flow For Judges

1. Log in with the demo account
2. Open the releases area and select a release
3. Walk through the unified workflow from release scope to execution
4. Show the release dashboard and readiness metrics
5. Open QABot to demonstrate assisted QA operations

## API Notes

- Health check: `GET /health`
- Root status: `GET /`
- Auth routes: `/api/v1/auth/*`
- Regression planning routes: `/api/v1/regression-test-plan/*`
- AI-enhanced planning routes: `/api/v1/ai-enhanced-test-plan/*`

Most planning endpoints require authentication.

## Deployment

The repo includes Render configuration in [render.yaml](/Users/admin/Documents/suitecraft.ai/render.yaml):

- Backend: FastAPI service with Alembic migrations on startup
- Frontend: static Vite build
- Database: managed PostgreSQL

## Current Scope And Limitations

- The hackathon setup currently relies on CSV-backed demo data for Jira and TestRail scenarios
- Some legacy pages still exist, but the main submission flow is the unified release workflow
- AI features depend on either Groq configuration or a reachable local Ollama instance
- Password reset email delivery requires SMTP settings

## Build Commands

```bash
cd /Users/admin/Documents/suitecraft.ai/frontend
npm run build

cd /Users/admin/Documents/suitecraft.ai/backend
python3 -m compileall app
```

## Submission Summary

SuiteCraft.ai is a release intelligence and QA planning platform that helps teams decide what to test, why it matters, where to run it, and how to track progress through release signoff. For the hackathon, the project demonstrates a full-stack workflow with authentication, release dashboards, deterministic plus AI-assisted test planning, seeded demo data, and a polished frontend experience.
