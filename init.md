# init plan

this is just an initial plan, help me how should i start and improve the plan,
and things that i'm not aware-of

## what

I'm starting a project management project, im still not sure what are the features.

### core

- app should include the core features of a project management website.
- auth uses email/password
- project management (kanban), dashboards with charts, tracking, logging
- richtext editor
- integrate 3rd party cloud file storage platform
- can export files like pdf, excel, jsons, docs, etc

### later

- social logins (google, github)
- a "guest" login option (to access the app just to test the app,
but we may need to have some restrictions like rate limiting,
max 10 records per table, validate email,
and even delete the account after 3 days)
- a "guest - localstorage" login option, data is stored only memory, using localstorage.

#### branches - master versions

- master: its our main branch, default javascript version
- master-ts :i want a typescript version for both backend and frontend
- master-sql :i want an easy way to transition to an sql db (maybe use, neon? supabase?)
- master-sql-ts :same with master-sql branch but uses typescript

### project structure

root / [backend, frontend]
backend / [lib, models, controllers, middlewares, routes]
frontend / src / [app, components, utils]

### tech stack

auth: email/password, guest, otp (email, sms? (sms optional for now)), social login (google, github) using auth0?
backend: node js, express js, mongodb (mongoose)
frontend: next js, tailwind, shadcn, redux-toolkit
testing (for backend and frontend): not sure yet, jest? vitest? playwright?

optional transition: sql db (neon? supabase?)

3rd party packages:
email (resend? brevo?)
charts (charts js?),
richtext editor (@tiptap/react? @tinymce/tinymce-react?),
file storage (cloudinary for images, media files? Cloudflare for large files? supabase? uploadcare?)

im open to suggestions that is only easy to integrate, use, maintain,
and platform that does not need constant/often re-authenticates or re-enables/restarts projects,
(ex: appwrite pauses cloud storage after 1 week, then i need to re-enable it)
or atleast has a long duration before i re-auth/re-enable/-restart
(ex: mongodb.com only renables/restart project after 3 months)

### deployment

render

## how

### build

build backend (package.json)
build frontend (package.json)
root consolidates backend and frontend builds (package.json)

## why

### build-reason

easy deployment to render
