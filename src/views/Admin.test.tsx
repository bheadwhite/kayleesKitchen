import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Auth } from "firebase/auth"

import Admin from "./Admin"
import AuthProvider from "contexts/AuthProvider"
import { AuthPresenter } from "presenters/AuthPresenter"
import { ADMIN_EMAIL, isAdmin } from "@/admin"
import { APP_COMMIT, APP_VERSION } from "@/version"
import type { AiUsageEvent, LoginEvent } from "@/types"

let emitAuthState: (user: unknown) => void = () => {}

vi.mock("fire/firebase", () => ({ auth: {} }))

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: unknown) => void) => {
    emitAuthState = callback
    return () => {}
  },
  GoogleAuthProvider: { credentialFromError: () => null },
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}))

const USAGE: AiUsageEvent[] = [
  {
    id: "u1",
    feature: "assistant",
    email: ADMIN_EMAIL,
    model: "claude-opus-5",
    ok: true,
    ms: 4200,
    inputTokens: 12_000,
    outputTokens: 3_000,
    cacheReadTokens: 8_000,
    cacheCreationTokens: 0,
    images: 2,
    at: new Date("2026-08-05T10:00:00Z"),
  },
  {
    id: "u2",
    feature: "image",
    email: "cook@example.test",
    model: "gemini-2.5-flash-image",
    ok: false,
    ms: 1500,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    images: 0,
    errorCode: "internal",
    at: new Date("2026-08-05T09:00:00Z"),
  },
]

const LOGINS: LoginEvent[] = [
  {
    id: "l1",
    uid: "u1",
    email: "cook@example.test",
    method: "google",
    at: new Date("2026-08-05T08:00:00Z"),
  },
]

vi.mock("fire/services", () => ({
  getUserProfile: vi.fn().mockResolvedValue(null),
  loginWithGoogle: vi.fn(),
  recordLogin: vi.fn(),
  linkGoogleToExistingAccount: vi.fn(),
  ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL: "auth/account-exists-with-different-credential",
  onAiUsageSnapshot: (callback: (events: AiUsageEvent[]) => void) => {
    callback(USAGE)
    return () => {}
  },
  onLoginEventsSnapshot: (callback: (events: LoginEvent[]) => void) => {
    callback(LOGINS)
    return () => {}
  },
}))

const renderAdmin = () => {
  const presenter = new AuthPresenter({} as Auth)
  render(
    <AuthProvider presenter={presenter}>
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path='/admin' element={<Admin />} />
          <Route path='/profile' element={<p>profile</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  )
  return presenter
}

const signInAs = (email: string) =>
  emitAuthState({ uid: "u1", email, displayName: "Admin", photoURL: null })

describe("isAdmin", () => {
  it("matches the one admin address, case-insensitively", () => {
    expect(isAdmin({ email: ADMIN_EMAIL })).toBe(true)
    expect(isAdmin({ email: ADMIN_EMAIL.toUpperCase() })).toBe(true)
    expect(isAdmin({ email: " bheadwhite@gmail.com " })).toBe(true)
    expect(isAdmin({ email: "someone@example.test" })).toBe(false)
    expect(isAdmin(null)).toBe(false)
  })
})

describe("Admin console", () => {
  beforeEach(() => {
    emitAuthState = () => {}
  })

  it("sends a non-admin back to their profile", async () => {
    const presenter = renderAdmin()
    signInAs("cook@example.test")

    expect(await screen.findByText("profile")).toBeInTheDocument()
    presenter.dispose()
  })

  it("totals AI usage for the admin", async () => {
    const presenter = renderAdmin()
    signInAs(ADMIN_EMAIL)

    expect(await screen.findByRole("heading", { name: "AI" })).toBeInTheDocument()
    // 12k in / 3k out across the two calls, one assistant and one image.
    expect(screen.getByText("12k")).toBeInTheDocument()
    expect(screen.getByText("3k")).toBeInTheDocument()
    // The failed image call is surfaced rather than quietly dropped from totals.
    expect(screen.getAllByText(/1 failed/).length).toBeGreaterThan(0)

    presenter.dispose()
  })

  it("breaks tokens down per person, input and output apart", async () => {
    const presenter = renderAdmin()
    signInAs(ADMIN_EMAIL)

    expect(
      await screen.findByRole("heading", { name: "Tokens by person" })
    ).toBeInTheDocument()
    // The admin's one assistant call: 12k in, 3k out — reported separately,
    // because output is priced several times higher than input.
    expect(screen.getByText(/12k in · 3k out/)).toBeInTheDocument()
    // The other cook only ran a failed image call: no tokens, but still listed.
    expect(screen.getAllByText("cook@example.test").length).toBeGreaterThan(0)
    expect(screen.getAllByText(/1 failed/).length).toBeGreaterThan(0)

    presenter.dispose()
  })

  it("lists recent sign-ins", async () => {
    const presenter = renderAdmin()
    signInAs(ADMIN_EMAIL)

    expect(await screen.findByRole("heading", { name: "Sign-ins" })).toBeInTheDocument()
    expect(screen.getByText(/google/)).toBeInTheDocument()

    presenter.dispose()
  })

  it("reports which build is running", async () => {
    const presenter = renderAdmin()
    signInAs(ADMIN_EMAIL)

    expect(await screen.findByRole("heading", { name: "Build" })).toBeInTheDocument()
    // Vitest reads the same vite.config.ts, so `define` applies here too: the
    // values are the real build stamp, not version.ts's dev fallbacks.
    expect(screen.getByText(APP_VERSION)).toBeInTheDocument()
    expect(screen.getByText(APP_COMMIT)).toBeInTheDocument()
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/)

    presenter.dispose()
  })
})
