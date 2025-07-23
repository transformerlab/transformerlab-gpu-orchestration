# Lattice Frontend

This is the React frontend for Lattice, a cluster management application built with SkyPilot.

## Environment Configuration

The frontend uses environment variables to configure API endpoints. Copy `.env.example` to `.env` and configure as needed:

```bash
cp .env.example .env
```

### Key Environment Variables

- `VITE_API_URL`: The base URL for API calls
  - Development (separate frontend): `http://localhost:8000/api/v1`  
  - Production (unified): `/api/v1` (or leave blank to use default)

## API Integration

All API calls use the `buildApiUrl` utility from `src/utils/api.ts` to ensure consistent URL construction. This allows the frontend to work in both development mode (with separate backend) and production mode (unified deployment).

## Available Scripts

Run `./start.sh` to build for production where the React app is compiled and served by the Python server

Run `./start.sh --dev` to build for development. This will start the backend server. Then you should open a separate window and run `npm start` in the frontend directory to have a frontend on port 3000 and the backend on port 8000, both with autoreload.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
