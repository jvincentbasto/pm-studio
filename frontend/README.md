# PM Studio

Next.js frontend for PM Studio. The Express API and MongoDB hold account and workspace data.

## Local setup

1. Copy `backend/.env.example` to `backend/.env.local`.
2. Set `LOCAL_MONGO_URI`, `JWT_SECRET_KEY`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`, and `APP_URL`.
3. Copy `.env.example` to `frontend/.env.local`.
4. Install dependencies from the repository root with `npm run app:install`.
5. Start the API with `npm run dev --prefix backend`.
6. Start the frontend in another terminal with `npm run dev --prefix frontend`.

The SMTP settings can use any compatible mail service. Keep secrets in local environment files, not source control.

## Checks

- Backend account and workspace tests: `npm test --prefix backend`
- Browser signup-to-workspace test: `npm run test:e2e --prefix frontend`
- Frontend production build: `npm run build --prefix frontend`
