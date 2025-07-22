# Lattice

## Architecture

- **Backend**: FastAPI with WorkOS SSO integration
- **Frontend**: React + TypeScript + MUI Joy UI components
- **Authentication**: WorkOS SSO with JWT tokens
- **Development**: Hot reload for both frontend and backend

## Quick Start

### Prerequisites

- Python 3.8+
- Node.js 16+
- WorkOS account and application setup

### Setup Instructions

1. **WorkOS Setup**: Create a WorkOS account at [workos.com](https://workos.com) and configure your SSO connection
2. **Run Setup Script**: `./setup.sh` (installs all dependencies)
3. **Configure Environment**: Copy `backend/.env.example` to `backend/.env` and add your WorkOS credentials
4. **Start Development**: `npm run dev` (runs both frontend and backend)

That's it! 🎉

### WorkOS Configuration

1. Create a WorkOS account at [workos.com](https://workos.com)
2. Create a new WorkOS application
3. Configure your SSO connection (Google, Microsoft, etc.)
4. Note down your API Key and Client ID
5. Add redirect URI: `http://localhost:8000/auth/callback`

### Environment Variables

Update `backend/.env` with your WorkOS credentials:

```env
# Backend Environment Variables
WORKOS_API_KEY= #from workos dashboard
WORKOS_CLIENT_ID= #from workos dashboard
WORKOS_REDIRECT_URI=http://localhost:8000/auth/callback
WORKOS_COOKIE_PASSWORD= # can be generated with `openssl rand -base64 32`
```

## 🐳 Docker Deployment

### Method 1: Using `docker-run.sh` (Recommended)

**Best for:** Development, quick testing, and CI/CD pipelines

1. **Create environment file**: Copy `.env.docker.example` to `.env` and configure:
   ```env
   WORKOS_API_KEY=your_api_key_here
   WORKOS_CLIENT_ID=your_client_id_here
   WORKOS_REDIRECT_URI=http://localhost:8000/auth/callback
   WORKOS_COOKIE_PASSWORD=your_secure_cookie_password
   ```

2. **Run the helper script**:
   ```bash
   ./docker-run.sh [build|run|build-and-run|compose|stop|clean]
   ```

   - `build`          - Build the Docker image only
   - `run`            - Run the existing Docker image
   - `build-and-run`  - Build and run (default)
   - `compose`        - Use Docker Compose
   - `stop`           - Stop running containers
   - `clean`          - Stop and remove all containers and images

   Example:
   ```bash
   ./docker-run.sh build-and-run
   ```

   The script will print URLs for both frontend (`http://localhost:3000`) and backend (`http://localhost:8000`).

### Method 2: Docker Compose

**Best for:** Development, production, and most use cases

```bash
docker-compose up -d
```

### Method 3: Raw Docker Commands

**Best for:** Manual control or custom CI/CD

```bash
# Build the image
docker build -t lattice .

# Run with environment variables
docker run -p 8000:8000 -p 3000:3000 \
  -e WORKOS_API_KEY=your_api_key \
  -e WORKOS_CLIENT_ID=your_client_id \
  lattice
```

### Docker Environment Variables

The Docker container requires these environment variables:

- `WORKOS_API_KEY` (required): Your WorkOS API key
- `WORKOS_CLIENT_ID` (required): Your WorkOS Client ID  
- `WORKOS_REDIRECT_URI` (optional): Defaults to `http://localhost:8000/auth/callback`
- `WORKOS_COOKIE_PASSWORD` (optional): Auto-generated if not provided
- `DEBUG` (optional): Set to `true` for debug mode

### Production Considerations

For production deployment:
1. Use a proper reverse proxy (nginx, Traefik, etc.)
2. Set secure `WORKOS_COOKIE_PASSWORD`
3. Configure proper `WORKOS_REDIRECT_URI` for your domain
4. Use environment-specific `.env` files
5. Consider using Docker secrets for sensitive data

### URLs

- Frontend: <http://localhost:3000>
- Backend: <http://localhost:8000>
- API Docs: <http://localhost:8000/docs>

## 🔧 Development

### Backend API Endpoints

- `GET /` - Health check
- `GET /auth/login-url` - Get WorkOS login URL
- `POST /auth/callback` - Handle OAuth callback
- `GET /auth/me` - Get current user (requires auth)
- `POST /auth/logout` - Logout endpoint

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

### Authentication Flow

1. User clicks "Sign in with WorkOS"
2. Frontend gets login URL from backend
3. User is redirected to WorkOS
4. WorkOS redirects back to `/auth/callback`
5. Frontend exchanges code for JWT token
6. Token is stored in localStorage
7. User can access protected routes

## UI Components

The app uses MUI Joy components for a modern, accessible interface:

- **LoginPage**: Clean login interface with WorkOS branding
- **Dashboard**: User information and app features
- **Loading states**: Proper loading indicators
- **Error handling**: User-friendly error messages

## 📝 Environment Variables

### Backend (.env)
```env
WORKOS_API_KEY= #from workos dashboard
WORKOS_CLIENT_ID= #from workos dashboard
WORKOS_REDIRECT_URI=http://localhost:8000/auth/callback
WORKOS_COOKIE_PASSWORD= # can be generated with `openssl rand -base64 32``
```

### Frontend (.env.local)
```env
REACT_APP_API_URL=http://localhost:8000
```
