# Lattice

## 🏗️ Architecture

- **Backend**: FastAPI with WorkOS SSO integration
- **Frontend**: React + TypeScript + MUI Joy UI components
- **Authentication**: WorkOS SSO with JWT tokens
- **Development**: Hot reload for both frontend and backend

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- Node.js 16+
- WorkOS account and application setup

### 1. WorkOS Setup

1. Create a WorkOS account at [workos.com](https://workos.com)
2. Create a new WorkOS application
3. Configure your SSO connection (Google, Microsoft, etc.)
4. Note down your:
   - API Key
   - Client ID
5. Add a redirect URI in WorkOS:
   - `http://localhost:8000/auth/callback`

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file and configure
cp .env.example .env
# Edit .env with your WorkOS credentials
```

Update `backend/.env` with your WorkOS credentials:

```env
# Backend Environment Variables
WORKOS_API_KEY= #from workos dashboard
WORKOS_CLIENT_ID= #from workos dashboard
WORKOS_REDIRECT_URI=http://localhost:8000/auth/callback
WORKOS_COOKIE_PASSWORD= # can be generated with `openssl rand -base64 32``
```

### 3. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local
# No changes needed for development
```

### 4. Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
python main.py
# Backend will run on http://localhost:8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
# Frontend will run on http://localhost:3000
```

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

## 🎨 UI Components

The app uses MUI Joy components for a modern, accessible interface:

- **LoginPage**: Clean login interface with WorkOS branding
- **Dashboard**: User information and app features
- **Loading states**: Proper loading indicators
- **Error handling**: User-friendly error messages

## 🔒 Security Features

- JWT token-based authentication
- Automatic token refresh handling
- Protected routes
- CORS configuration
- Environment variable configuration

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

## 🚧 Next Steps

The authentication foundation is complete! You can now add:

1. **Database integration** (PostgreSQL, MongoDB, etc.)
2. **User management** (profiles, preferences)
3. **Business logic** (your app's core features)
4. **Additional UI pages** (settings, admin panel)
5. **API endpoints** (CRUD operations)
6. **Deployment configuration** (Docker, cloud providers)
