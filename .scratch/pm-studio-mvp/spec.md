# First-release project management MVP

**Status:** ready-for-agent

## Problem Statement

Small software and product teams lose track of project work, owners, due dates, and progress across disconnected tools. This portfolio project needs a deployed, end-to-end product that demonstrates how a small team can coordinate work in one shared place.

## Solution

Build a deployed project-management app for software and product teams of 2–10. Members work in shared workspaces, create projects and tasks, assign task owners and due dates, and track progress on a Kanban board with fixed statuses.

The first release also includes a constrained, database-backed Guest account so portfolio reviewers can try real CRUD workflows without creating a full account. Guest data is isolated, seeded, limited, temporary, and preserved when the Guest becomes a full account.

## User Stories

1. As a visitor, I want to register with email and password so that I can create a full account.
2. As a visitor, I want to sign in with Google so that I can access the app without creating another password.
3. As a visitor, I want to sign in with GitHub so that I can use an existing identity.
4. As a visitor, I want to verify my email so that the app can limit fake or disposable accounts.
5. As a registered user, I want to log in and log out securely so that I control access to my account.
6. As a new user, I want to create a workspace so that my team has a shared boundary for projects and membership.
7. As a workspace owner, I want to invite teammates by email so that we can collaborate.
8. As an invited user, I want to accept an unexpired invitation so that I can join the intended workspace.
9. As a workspace owner, I want to revoke an invitation so that an unused link no longer grants access.
10. As a workspace owner, I want to remove a workspace member so that former members lose access.
11. As a workspace member, I want to see projects in my workspace so that I can find the work my team coordinates.
12. As a workspace member, I want to create, edit, and delete a project so that the project list reflects current team work.
13. As a workspace member, I want to create, view, edit, and delete tasks so that the project board stays useful.
14. As a workspace member, I want to assign a task to a workspace member so that ownership is clear.
15. As a workspace member, I want to set an optional due date so that time-sensitive work is visible.
16. As a workspace member, I want to move tasks among Backlog, Todo, In Progress, and Done so that the board shows current progress.
17. As a workspace member, I want to see task status on a Kanban board so that the team can understand project progress at a glance.
18. As a portfolio reviewer, I want to start a Guest account after verifying my email so that I can try the deployed product without a full registration.
19. As a Guest, I want an isolated workspace with seeded data so that my edits do not affect another visitor's work.
20. As a Guest, I want to create, edit, and delete projects and tasks so that I can experience the core workflow.
21. As a Guest, I want clear usage and expiry information so that I understand the limits of the temporary account.
22. As a Guest who reaches a limit or expiry, I want to register or sign in and retain my workspace data so that I can continue using my work.
23. As an app operator, I want expired Guest data removed so that temporary accounts do not grow the database indefinitely.
24. As a portfolio reviewer, I want a deployed demo with representative data so that I can evaluate the product without local setup.

## Implementation Decisions

- The first audience is software and product teams of 2–10. This is a portfolio build, not a claim that the product-market fit is validated.
- The canonical stack remains JavaScript, Next.js, Express, and MongoDB. TypeScript and PostgreSQL are optional experiments after the first release, not parallel versions developed before it.
- Keep one canonical main branch and use short-lived feature branches for implementation.
- A Workspace contains members and Projects. A Workspace has owner and member roles. Every operation on a workspace, project, task, invitation, or Guest resource must enforce the actor's access on the server.
- A Project belongs to a Workspace. A Task belongs to a Project and can have an owner, optional due date, and one fixed status: Backlog, Todo, In Progress, or Done.
- Workspace owners send member invitations by email. Invitation links expire and can be revoked. Invitation expiry duration, duplicate invitation behavior, and member-removal handling are ticket-level decisions.
- Authentication must support Google and GitHub sign-in, email/password fallback, and email verification. SMS verification is out of scope. Use provider verification information where available; do not allow an unverified email to bypass the verification requirement.
- The existing Express auth scaffold is starting material, not a required provider choice. The managed auth provider, account-linking behavior, email verification/OTP mechanism, and email delivery service remain open pending research and ticket decisions.
- A Guest account is email-verified and database-backed. Each Guest receives an isolated Workspace with seeded data and can perform CRUD on Projects and Tasks.
- Guest limits of 10 records per resource and 3 days are provisional examples, not final values. Exact caps, expiry start, cleanup schedule, behavior at limits, and email-verification flow must be decided before implementation.
- Guest-to-full-account conversion preserves the Guest's Workspace and Project/Task data. Identity linking and collision handling remain to be specified.
- The Browser sandbox is a later option: anonymous, localStorage-only, with no server account, database writes, or cloud storage.
- Deploy the first release on Render with MongoDB. Select service plans after verifying current provider behavior and cost; avoid committing to a plan that routinely pauses or requires manual reactivation.
- Deferred from this release: dashboards/charts, activity logs, rich-text documents, cloud file storage, exports, SMS verification, Browser sandbox, and TypeScript/PostgreSQL variants.

## Testing Decisions

- Test observable behavior through a browser-level seam for complete user journeys: account access, workspace invitation and membership, project/task Kanban use, Guest limits/expiry, and Guest conversion.
- Use focused backend tests for authorization boundaries, invitation expiry/revocation, Guest limits and cleanup, email verification, and conversion behavior. Test data isolation across workspaces and Guest accounts.
- Cover failure paths, not only successful flows: unauthorized workspace access, expired/revoked invitations, invalid verification, reached Guest limits, expired Guest sessions, and conflicting account identities.
- Prefer tests of externally observable behavior over internal implementation details.
- The frontend and backend currently have no evident test scripts or test files. The exact test runner and browser automation packages remain a ticket-level decision; compare and choose them before adding tooling.
- No existing test suite was found in the inspected frontend/backend starting points to reuse.

## Out of Scope

- Dashboards, charts, activity logs, rich-text documents, third-party file storage, and exports.
- SMS verification.
- The Browser sandbox.
- Custom workspace roles, configurable Kanban columns, and industry-specific workflows.
- Parallel `master-ts`, `master-sql`, or `master-sql-ts` product branches before the JavaScript/MongoDB release.
- Exact Guest quota and expiry values until their behavior is specified.

## Further Notes

- The repository already has a JavaScript Next.js frontend and an Express/Mongoose backend with a User model and basic signup/login/logout routes. The frontend is still the default Next.js starter page. Treat the current code as a scaffold; inspect and repair it as part of implementation rather than assuming it is production-ready.
- The first release is complete when a reviewer can reach the deployed app, use a Guest account to modify isolated sample data, and a registered small team can collaborate on projects and tasks with enforced workspace access.
- The user prefers services that are easy to maintain and do not routinely pause, expire, or require manual reactivation.
