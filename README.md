# Lattice

## Architecture

- **Backend**: FastAPI with WorkOS SSO integration serving API at `/api/v1/*`
- **Frontend**: React + TypeScript + MUI Joy UI components served from `/`
- **Authentication**: WorkOS SSO with session cookies
- **Unified Deployment**: Single port (8000) serves both frontend and backend
- **Development**: Hot reload support with optional separate frontend server

## Quick Start

### Prerequisites

- Python 3.8+
- Node.js 16+
- WorkOS account and application setup

### Setup Instructions

1. **WorkOS Setup**: Create a WorkOS account at [workos.com](https://workos.com) and configure your SSO connection
2. **Configure Environment**: Copy `.env.example` to `.env` and add your WorkOS credentials
3. **Run Setup Script**: `./setup.sh` (installs all dependencies and runs database migrations)

You are setup

### WorkOS Configuration

1. Create a WorkOS account at [workos.com](https://workos.com)
2. Create a new WorkOS application
3. Configure your SSO connection (Google, Microsoft, etc.)
4. Note down your API Key and Client ID
5. Add redirect URI: `http://localhost:8000/api/v1/auth/callback`

### Run in Dev:

1. Make sure your env files are correctly set in `/backend/.env` and in `/frontend/.env` and make sure the frontend env redirect is set to VITE_API_URL=http://localhost:8000/api/v1 (not VITE_API_URL=/api/v1 which is only appropriate for production with one server)
2. Run `./start.sh --dev` in one window
3. Run `npm start dev` in frontend in another window

## Database Migrations (Alembic)

This project uses Alembic with SQLAlchemy to manage database schema changes. Migrations live in `backend/alembic/versions` and target the metadata from `backend/config.py`.

### Typical workflow

1) Make model changes in `backend/db_models.py`.

2) Create a migration (autogenerate):

```bash
cd backend
source .venv/bin/activate
alembic revision --autogenerate -m "describe your change"
```

3) Apply migrations (This automatically happens when running start.sh):

```bash
alembic upgrade head
```

4) Verify/history (optional):

```bash
alembic current
alembic history --verbose
```

## 🐳 Docker Deployment

### Method 1: Using `docker-run.sh` (Recommended)

1. **Create environment file**: Copy `.env.example` to `.env` and configure:

   ```env
   # Preferred generic envs
   AUTH_API_KEY=your_api_key_here
   AUTH_CLIENT_ID=your_client_id_here
   AUTH_REDIRECT_URI=http://localhost:8000/api/v1/auth/callback
   AUTH_COOKIE_PASSWORD=your_secure_cookie_password
   BASE_URL=http://localhost:8000
   ```

Then run `docker-run.sh build-and-run`


## API Key Scopes

- admin: Full access to all write operations.
- compute:write: Launch, stop, and manage compute jobs/instances.
- nodepools:write: Create, update, or delete node pools.
- storage:write: Create, mount, or modify storage buckets.
- registries:write: Manage private container registries.

Notes:
- Scopes apply to API key-authenticated requests. Session-authenticated users are not scope-restricted.
- If an API key has no scopes, it cannot perform protected write actions that require scopes.
- Selecting the `admin` scope supersedes all others.
- The server exposes allowed scopes at `GET /api/v1/auth/allowed-scopes`.
- Scope values are case-insensitive on input; they are normalized to lowercase and `admin` is exclusive (cannot be combined).
