# 09: Test coverage and release verification

**What to build:** Verify feature behavior, access boundaries, and release readiness with backend, browser, and deployment checks.

**Blocked by:** 01: Email/password accounts and workspace creation; 02: Google and GitHub sign-in; 03: Workspace invitations and member access; 04: Project management; 05: Task Kanban; 06: Guest account onboarding; 07: Guest limits, expiry, and upgrade; 08: Deploy the first release.

**Status:** ready-for-agent

- [x] Backend and browser tests cover invitation acceptance, expiry, revocation, member removal, and workspace access.
- [x] Backend and browser tests cover project workflows and denial of cross-workspace access.
- [x] Backend and browser tests cover task workflows, assignment, status changes, invalid assignments, and access control.
- [ ] Backend and browser tests cover Guest onboarding, core workflows, and data isolation.
- [ ] Backend tests cover Guest cap boundaries, expiry cleanup, conversion, and conflicting account identities.
- [ ] Browser smoke tests pass for account access, invitations, projects, Kanban tasks, and Guest conversion using isolated sample data.
- [ ] Authorization boundaries, email and invitation expiry, Guest cleanup, and secret handling are checked before release.
- [ ] Core pages are keyboard-usable, with labeled controls, visible focus, and clear error states.
- [ ] A backup or restore path is verified for the chosen database plan.
