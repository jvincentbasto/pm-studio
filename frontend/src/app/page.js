"use client";

import { useEffect, useState } from "react";

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
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const url = new URL(window.location.href);
    const verificationToken = url.searchParams.get("verify");
    const requestedResetToken = url.searchParams.get("reset");

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
  }, []);

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
        const body = await request("/api/workspaces", {
          method: "POST",
          body: JSON.stringify({ name: workspaceName }),
        });
        setWorkspaces((current) => [...current, body.workspace]);
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

  async function signOut() {
    setBusy(true);
    setMessage(null);
    try {
      await request("/api/auth/logout", { method: "POST" });
      setUser(null);
      setWorkspaces([]);
      setMode("login");
      setMessage({ type: "success", text: "Signed out." });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setBusy(false);
    }
  }

  const isSignup = mode === "signup";
  const isAccountForm = ["login", "signup", "forgot", "reset"].includes(mode);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <section className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl sm:p-10">
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
                      className="rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-3"
                      key={workspace._id ?? workspace.id}
                    >
                      {workspace.name}
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
              {mode === "login" && "Sign in to continue to your workspaces."}
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
