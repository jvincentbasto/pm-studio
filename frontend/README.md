# PM Studio

Next.js frontend for PM Studio. The Express API and MongoDB hold account and workspace data.

## Local setup

1. Copy `backend/.env.example` to `backend/.env.local`.
2. Set `LOCAL_MONGO_URI`, `JWT_SECRET_KEY`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`, and `APP_URL`.
3. For Google/GitHub sign-in, create an Auth0 Regular Web Application and enable its Google and GitHub connections. Set `AUTH0_ISSUER_BASE_URL`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, and `AUTH0_SESSION_SECRET` in `backend/.env.local`.
4. In Auth0, allow `http://localhost:8000/api/auth/callback` as a callback URL and `http://localhost:8000/api/auth/signed-out` as a logout URL. Configure provider credentials for the Google and GitHub connections if Auth0 does not provide development keys.
5. Copy `.env.example` to `frontend/.env.local`.
6. Install dependencies from the repository root with `npm run app:install`.
7. Start the API with `npm run dev --prefix backend`.
8. Start the frontend in another terminal with `npm run dev --prefix frontend`.

The SMTP settings can use any compatible mail service. Keep secrets in local environment files, not source control.

## Checks

- Backend account and workspace tests: `npm test --prefix backend`
- Browser signup-to-workspace test: `npm run test:e2e --prefix frontend`
- Frontend production build: `npm run build --prefix frontend`
