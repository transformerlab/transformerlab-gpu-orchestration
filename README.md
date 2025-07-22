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
