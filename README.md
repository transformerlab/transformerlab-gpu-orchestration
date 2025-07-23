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
2. **Run Setup Script**: `./setup.sh` (installs all dependencies)
3. **Configure Environment**: Copy `.env.example` to `.env` and add your WorkOS credentials
4. **Configure Environment for Frontend**: Copy `./frontend/.env.example` to `./frontend/.env` following the instructions there

You are setup

### WorkOS Configuration

1. Create a WorkOS account at [workos.com](https://workos.com)
2. Create a new WorkOS application
3. Configure your SSO connection (Google, Microsoft, etc.)
4. Note down your API Key and Client ID
5. Add redirect URI: `http://localhost:8000/api/v1/auth/callback`

### Run in Dev:

1. Make sure your env files are set in the `/.env` and in `/frontend/.env` and make sure the frontend env redirect is set to VITE_API_URL=http://localhost:8000/api/v1 (not VITE_API_URL=/api/v1 which is only appropriate for production with one server)
2. Run `./setup.sh --dev` in one window
3. Run `npm start` in frontend in another window



## 🐳 Docker Deployment

### Method 1: Using `docker-run.sh` (Recommended)

1. **Create environment file**: Copy `.env.example` to `.env` and configure:

   ```env
   WORKOS_API_KEY=your_api_key_here
   WORKOS_CLIENT_ID=your_client_id_here
   BASE_URL=http://localhost:8000
   WORKOS_REDIRECT_URI=http://localhost:8000/api/v1/auth/callback
   WORKOS_COOKIE_PASSWORD=your_secure_cookie_password
   ```

### Frontend Structure

```
src/
├── components/
│   ├── LoginPage.tsx      # Login page with WorkOS
│   ├── AuthCallback.tsx   # OAuth callback handler
│   ├── Dashboard.tsx      # Main dashboard
│   └── ProtectedRoute.tsx # Route protection
├── context/
│   └── AuthContext.tsx    # Authentication state management
└── App.tsx               # Main app with routing
```
