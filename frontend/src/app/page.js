"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import WorkspaceProjects from "./WorkspaceProjects";

const apiOrigin = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${apiOrigin}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(body.error ?? "Request failed. Try again.");
    error.status = response.status;
    throw error;
  }

  return body;
}

export default function Home() {
  const [mode, setMode] = useState("login");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [user, setUser] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [pendingInviteToken, setPendingInviteToken] = useState("");
  const [inviteEmails, setInviteEmails] = useState({});
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const acceptingInvite = useRef(null);

  async function loadWorkspaces() {
    const { workspaces: currentWorkspaces } = await request("/api/workspaces");
    setWorkspaces(currentWorkspaces);
  }

  const acceptInvitation = useCallback(async (token) => {
    if (acceptingInvite.current?.token === token) {
      return acceptingInvite.current.promise;
    }

    const promise = request("/api/workspaces/invitations/accept", {
      method: "POST",
      body: JSON.stringify({ token }),
    }).then((body) => {
      window.localStorage.removeItem("pm-studio-invite");
      setPendingInviteToken("");
      const url = new URL(window.location.href);
      url.searchParams.delete("invite");
      window.history.replaceState({}, "", url);
      setMessage({ type: "success", text: body.message });
      return body;
    });
    acceptingInvite.current = { token, promise };
    try {
      return await promise;
    } catch (error) {
      if (acceptingInvite.current?.promise === promise) {
        acceptingInvite.current = null;
      }
      throw error;
    }
  }, []);

  useEffect(() => {
    let active = true;
    const url = new URL(window.location.href);
    const verificationToken = url.searchParams.get("verify");
    const requestedResetToken = url.searchParams.get("reset");
    const inviteToken =
      url.searchParams.get("invite") ??
      window.localStorage.getItem("pm-studio-invite");

    if (inviteToken) {
      window.localStorage.setItem("pm-studio-invite", inviteToken);
      setPendingInviteToken(inviteToken);
    }

    if (requestedResetToken) {
      setResetToken(requestedResetToken);
      setMode("reset");
    } else if (verificationToken) {
      setBusy(true);
      request("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ token: verificationToken }),
      })
        .then((body) => {
          if (!active) return;
          setMode("login");
          setMessage({ type: "success", text: body.message });
          url.searchParams.delete("verify");
          window.history.replaceState({}, "", url);
        })
        .catch((error) => {
          if (active) setMessage({ type: "error", text: error.message });
        })
        .finally(() => {
          if (active) setBusy(false);
        });
    } else {
      request("/api/auth/me")
        .then(async ({ user: currentUser }) => {
          if (!active) return;
          setUser(currentUser);
          if (inviteToken) {
            try {
              await acceptInvitation(inviteToken);
            } catch (error) {
              if (active) setMessage({ type: "error", text: error.message });
            }
          }
          const { workspaces: currentWorkspaces } =
            await request("/api/workspaces");
          if (active) {
            setWorkspaces(currentWorkspaces);
            setMode("workspace");
          }
        })
        .catch((error) => {
          if (active && error.status !== 401) {
            setMessage({ type: "error", text: error.message });
          }
        });
    }

    return () => {
      active = false;
    };
  }, [acceptInvitation]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      if (mode === "signup") {
        const body = await request("/api/auth/signup", {
          method: "POST",
          body: JSON.stringify({ firstName, lastName, email, password }),
        });
        setMode("verification");
        setMessage({ type: "success", text: body.message });
      } else if (mode === "login") {
        const body = await request("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        setUser(body.user);
        if (pendingInviteToken) {
          try {
            await acceptInvitation(pendingInviteToken);
          } catch (error) {
            setMessage({ type: "error", text: error.message });
          }
        }
        const workspaceBody = await request("/api/workspaces");
        setWorkspaces(workspaceBody.workspaces);
        setMode("workspace");
      } else if (mode === "verification") {
        const body = await request("/api/auth/request-email-verification", {
          method: "POST",
          body: JSON.stringify({ email }),
        });
        setMessage({ type: "success", text: body.message });
      } else if (mode === "forgot") {
        const body = await request("/api/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify({ email }),
        });
        setMessage({ type: "success", text: body.message });
      } else if (mode === "reset") {
        const body = await request("/api/auth/reset-password", {
          method: "POST",
          body: JSON.stringify({ token: resetToken, password }),
        });
        setMode("login");
        setPassword("");
        const url = new URL(window.location.href);
        url.searchParams.delete("reset");
        window.history.replaceState({}, "", url);
        setMessage({ type: "success", text: body.message });
      } else if (mode === "workspace") {
        await request("/api/workspaces", {
          method: "POST",
          body: JSON.stringify({ name: workspaceName }),
        });
        await loadWorkspaces();
        setWorkspaceName("");
        setMode("workspace");
        setMessage({ type: "success", text: "Workspace created." });
      }
    } catch (error) {
      if (mode === "signup" && error.status === 503) {
        setMode("verification");
      }
      setMessage({ type: "error", text: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function inviteMember(event, workspaceId) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await request(`/api/workspaces/${workspaceId}/invitations`, {
        method: "POST",
        body: JSON.stringify({ email: inviteEmails[workspaceId] }),
      });
      setInviteEmails((current) => ({ ...current, [workspaceId]: "" }));
      await loadWorkspaces();
      setMessage({ type: "success", text: "Invitation sent." });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function revokeInvitation(workspaceId, invitationId) {
    setBusy(true);
    setMessage(null);
    try {
      await request(
        `/api/workspaces/${workspaceId}/invitations/${invitationId}`,
        { method: "DELETE" },
      );
      await loadWorkspaces();
      setMessage({ type: "success", text: "Invitation revoked." });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(workspaceId, memberId) {
    if (!window.confirm("Remove this member from the workspace?")) return;
    setBusy(true);
    setMessage(null);
    try {
      await request(`/api/workspaces/${workspaceId}/members/${memberId}`, {
        method: "DELETE",
      });
      await loadWorkspaces();
      setMessage({ type: "success", text: "Workspace member removed." });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    window.location.assign(`${apiOrigin}/api/auth/logout`);
  }

  const isSignup = mode === "signup";
  const isAccountForm = ["login", "signup", "forgot", "reset"].includes(mode);

  return (
    <main
      className={`flex min-h-screen justify-center bg-slate-950 px-4 text-slate-100 ${
        user ? "items-start py-8" : "items-center py-10"
      }`}
    >
      <section
        className={`w-full rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl sm:p-10 ${
          user ? "max-w-7xl" : "max-w-lg"
        }`}
      >
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
          PM Studio
        </p>

        {user ? (
          <div className="mt-8 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">
                  Welcome, {user.firstName}
                </h1>
                <p className="mt-2 text-sm text-slate-300">{user.email}</p>
              </div>
              <button
                className="rounded-lg border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-60"
                disabled={busy}
                onClick={signOut}
                type="button"
              >
                Sign out
              </button>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Your workspaces</h2>
              {workspaces.length ? (
                <ul className="space-y-2">
                  {workspaces.map((workspace) => (
                    <li
                      className="space-y-4 rounded-lg border border-slate-700 bg-slate-950/60 p-4"
                      key={workspace.id}
                    >
                      <h3 className="font-semibold">{workspace.name}</h3>
                      <div>
                        <h4 className="text-sm font-medium">Members</h4>
                        <ul className="mt-2 space-y-2 text-sm text-slate-300">
                          {workspace.members.map((member) => {
                            const memberName = [
                              member.firstName,
                              member.lastName,
                            ]
                              .filter(Boolean)
                              .join(" ");
                            return (
                              <li
                                className="flex items-center justify-between gap-3"
                                key={member.id}
                              >
                                <span>
                                  {memberName || member.email || "Member"}
                                  {member.role === "owner" ? " (owner)" : ""}
                                </span>
                                {workspace.owner === user.id &&
                                  member.role === "member" && (
                                    <button
                                      className="text-xs text-rose-300 underline underline-offset-2"
                                      disabled={busy}
                                      onClick={() =>
                                        removeMember(workspace.id, member.id)
                                      }
                                      type="button"
                                    >
                                      Remove {memberName}
                                    </button>
                                  )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>

                      {workspace.owner === user.id && (
                        <>
                          <form
                            className="flex flex-col gap-2 sm:flex-row"
                            onSubmit={(event) =>
                              inviteMember(event, workspace.id)
                            }
                          >
                            <label
                              className="sr-only"
                              htmlFor={`invite-${workspace.id}`}
                            >
                              Invite email for {workspace.name}
                            </label>
                            <input
                              className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30"
                              id={`invite-${workspace.id}`}
                              maxLength={254}
                              onChange={(event) =>
                                setInviteEmails((current) => ({
                                  ...current,
                                  [workspace.id]: event.target.value,
                                }))
                              }
                              required
                              type="email"
                              value={inviteEmails[workspace.id] ?? ""}
                            />
                            <button
                              className="rounded-lg bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-60"
                              disabled={busy}
                              type="submit"
                            >
                              Send invitation
                            </button>
                          </form>

                          <div>
                            <h4 className="text-sm font-medium">
                              Pending invitations
                            </h4>
                            {workspace.invitations.length ? (
                              <ul className="mt-2 space-y-2 text-sm text-slate-300">
                                {workspace.invitations.map((invitation) => (
                                  <li
                                    className="flex items-center justify-between gap-3"
                                    key={invitation.id}
                                  >
                                    <span>{invitation.email}</span>
                                    <button
                                      className="text-xs text-rose-300 underline underline-offset-2"
                                      disabled={busy}
                                      onClick={() =>
                                        revokeInvitation(
                                          workspace.id,
                                          invitation.id,
                                        )
                                      }
                                      type="button"
                                    >
                                      Revoke invitation
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-2 text-sm text-slate-400">
                                No pending invitations.
                              </p>
                            )}
                          </div>
                        </>
                      )}
                      <WorkspaceProjects
                        request={request}
                        workspace={workspace}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-300">
                  Create a workspace to start organizing team projects.
                </p>
              )}
            </div>

            <form className="space-y-3" onSubmit={submit}>
              <label className="block text-sm font-medium" htmlFor="workspace">
                Workspace name
              </label>
              <input
                autoComplete="organization"
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30"
                id="workspace"
                maxLength={80}
                minLength={2}
                onChange={(event) => setWorkspaceName(event.target.value)}
                required
                value={workspaceName}
              />
              <button
                className="w-full rounded-lg bg-cyan-300 px-4 py-2.5 font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-60"
                disabled={busy}
                type="submit"
              >
                Create workspace
              </button>
            </form>
          </div>
        ) : (
          <>
            <h1 className="mt-4 text-3xl font-bold">
              {mode === "signup" && "Create your account"}
              {mode === "login" && "Sign in"}
              {mode === "verification" && "Verify your email"}
              {mode === "forgot" && "Recover your account"}
              {mode === "reset" && "Choose a new password"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {mode === "signup" &&
                "Create an account to start a shared workspace."}
              {mode === "login" &&
                (pendingInviteToken
                  ? "Sign in with the invited email address to accept your workspace invitation."
                  : "Sign in to continue to your workspaces.")}
              {mode === "verification" &&
                "Enter your email to receive a fresh verification link."}
              {mode === "forgot" &&
                "If your account exists, we’ll email a password reset link."}
              {mode === "reset" &&
                "Use at least eight characters and no more than 72 UTF-8 bytes."}
            </p>

            <form className="mt-8 space-y-4" onSubmit={submit}>
              {isSignup && (
                <>
                  <div>
                    <label
                      className="mb-1 block text-sm font-medium"
                      htmlFor="firstName"
                    >
                      First name
                    </label>
                    <input
                      autoComplete="given-name"
                      className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30"
                      id="firstName"
                      maxLength={80}
                      onChange={(event) => setFirstName(event.target.value)}
                      required
                      value={firstName}
                    />
                  </div>
                  <div>
                    <label
                      className="mb-1 block text-sm font-medium"
                      htmlFor="lastName"
                    >
                      Last name
                    </label>
                    <input
                      autoComplete="family-name"
                      className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30"
                      id="lastName"
                      maxLength={80}
                      onChange={(event) => setLastName(event.target.value)}
                      required
                      value={lastName}
                    />
                  </div>
                </>
              )}

              {mode !== "reset" && (
                <div>
                  <label
                    className="mb-1 block text-sm font-medium"
                    htmlFor="email"
                  >
                    Email
                  </label>
                  <input
                    autoComplete="email"
                    className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30"
                    id="email"
                    maxLength={254}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    type="email"
                    value={email}
                  />
                </div>
              )}

              {isAccountForm && mode !== "forgot" && (
                <div>
                  <label
                    className="mb-1 block text-sm font-medium"
                    htmlFor="password"
                  >
                    {mode === "reset" ? "New password" : "Password"}
                  </label>
                  <input
                    autoComplete={
                      mode === "reset"
                        ? "new-password"
                        : isSignup
                          ? "new-password"
                          : "current-password"
                    }
                    className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30"
                    id="password"
                    maxLength={72}
                    minLength={8}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    type="password"
                    value={password}
                  />
                </div>
              )}

              {mode === "login" && (
                <button
                  className="text-sm text-cyan-300 underline underline-offset-4 hover:text-cyan-200"
                  onClick={() => {
                    setMode("forgot");
                    setMessage(null);
                  }}
                  type="button"
                >
                  Forgot password?
                </button>
              )}

              <button
                className="w-full rounded-lg bg-cyan-300 px-4 py-2.5 font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-60"
                disabled={busy}
                type="submit"
              >
                {busy
                  ? "Please wait…"
                  : mode === "signup"
                    ? "Create account"
                    : mode === "login"
                      ? "Sign in"
                      : mode === "verification"
                        ? "Resend verification email"
                        : mode === "forgot"
                          ? "Send reset link"
                          : "Reset password"}
              </button>
            </form>

            {(mode === "login" || mode === "signup") && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <a
                  className="rounded-lg border border-slate-600 px-4 py-2.5 text-center text-sm font-medium hover:bg-slate-800"
                  href={`${apiOrigin}/api/auth/google`}
                >
                  Continue with Google
                </a>
                <a
                  className="rounded-lg border border-slate-600 px-4 py-2.5 text-center text-sm font-medium hover:bg-slate-800"
                  href={`${apiOrigin}/api/auth/github`}
                >
                  Continue with GitHub
                </a>
              </div>
            )}

            {(mode === "login" || mode === "signup") && (
              <button
                className="mt-5 w-full text-sm text-slate-300 underline underline-offset-4 hover:text-white"
                onClick={() => {
                  setMode(isSignup ? "login" : "signup");
                  setMessage(null);
                }}
                type="button"
              >
                {isSignup
                  ? "Already have an account? Sign in"
                  : "New here? Create account"}
              </button>
            )}

            {mode === "verification" && (
              <button
                className="mt-5 w-full text-sm text-slate-300 underline underline-offset-4 hover:text-white"
                onClick={() => {
                  setMode("login");
                  setMessage(null);
                }}
                type="button"
              >
                Back to sign in
              </button>
            )}

            {(mode === "forgot" || mode === "reset") && (
              <button
                className="mt-5 w-full text-sm text-slate-300 underline underline-offset-4 hover:text-white"
                onClick={() => {
                  setMode("login");
                  setMessage(null);
                }}
                type="button"
              >
                Back to sign in
              </button>
            )}
          </>
        )}

        {message && (
          <output
            aria-live="polite"
            className={`mt-6 rounded-lg border px-3 py-2 text-sm ${
              message.type === "error"
                ? "border-red-400/50 bg-red-950/40 text-red-200"
                : "border-emerald-400/50 bg-emerald-950/40 text-emerald-200"
            }`}
          >
            {message.text}
          </output>
        )}
      </section>
    </main>
  );
}
