# 08: Deploy and verify the first release

**What to build:** Reviewers can access a deployed, reliable portfolio demo with sample data and safely exercise the core workspace, project, task, and Guest workflows.

**Blocked by:** 01: Email/password accounts and workspace creation; 02: Google and GitHub sign-in; 03: Workspace invitations and member access; 04: Project management; 05: Task Kanban; 06: Guest account onboarding; 07: Guest limits, expiry, and upgrade.

**Status:** ready-for-agent

- [ ] The frontend and API are deployed on Render and connect to a persistent MongoDB deployment.
- [ ] Deployment uses an available service plan that does not require routine manual reactivation for the portfolio demo.
- [ ] Reviewers can access representative sample data without changing another user's data.
- [ ] Browser-level smoke tests pass for account access, invitations, projects, Kanban tasks, and Guest conversion.
- [ ] Authorization boundaries, email/invitation expiry, Guest cleanup, and secret handling are checked before release.
- [ ] Core pages are keyboard-usable and have labeled controls, visible focus, and clear error states.
- [ ] Deployment and recovery steps are documented; a backup or restore path is verified for the chosen database plan.
