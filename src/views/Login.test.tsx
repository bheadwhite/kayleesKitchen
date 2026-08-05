import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import Login from "./Login"
import AuthProvider from "contexts/AuthProvider"
import { AuthPresenter } from "presenters/AuthPresenter"

vi.mock("fire/firebase", () => ({ auth: {}, db: {}, storage: {}, userRef: {}, recipesRef: {} }))

const loginWithGoogle = vi.fn()

vi.mock("fire/services", () => ({
  getUserProfile: vi.fn().mockResolvedValue(null),
  loginWithGoogle: (...args: unknown[]) => loginWithGoogle(...args),
}))

const signInWithEmailAndPassword = vi.fn()

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: unknown) => void) => {
    callback(null)
    return () => {}
  },
  signInWithEmailAndPassword: (...args: unknown[]) => signInWithEmailAndPassword(...args),
  signOut: vi.fn(),
}))

const renderLogin = () => {
  const presenter = new AuthPresenter({} as never)
  render(
    <AuthProvider presenter={presenter}>
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    </AuthProvider>
  )
  return presenter
}

describe("Login validation", () => {
  it("flags both fields when the form is submitted empty", async () => {
    const user = userEvent.setup()
    const presenter = renderLogin()

    await user.click(screen.getByRole("button", { name: "Submit" }))

    expect(await screen.findByText("Please enter your email address.")).toBeInTheDocument()
    expect(screen.getByText("Please enter your password.")).toBeInTheDocument()
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true")
    expect(signInWithEmailAndPassword).not.toHaveBeenCalled()

    presenter.dispose()
  })

  it("flags only the missing field", async () => {
    const user = userEvent.setup()
    const presenter = renderLogin()

    await user.type(screen.getByLabelText("Email"), "cook@example.test")
    await user.click(screen.getByRole("button", { name: "Submit" }))

    expect(await screen.findByText("Please enter your password.")).toBeInTheDocument()
    expect(screen.queryByText("Please enter your email address.")).not.toBeInTheDocument()
    expect(signInWithEmailAndPassword).not.toHaveBeenCalled()

    presenter.dispose()
  })

  it("submits once both fields are filled in", async () => {
    const user = userEvent.setup()
    const presenter = renderLogin()

    await user.type(screen.getByLabelText("Email"), "cook@example.test")
    await user.type(screen.getByLabelText("Password"), "hunter2")
    await user.click(screen.getByRole("button", { name: "Submit" }))

    await waitFor(() =>
      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        "cook@example.test",
        "hunter2"
      )
    )
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()

    presenter.dispose()
  })
})

/**
 * Dismissing the Google window does not reliably reject `signInWithPopup`, so
 * these cover the page getting itself out of a sign-in that never settles.
 */
describe("Login abandoned Google sign-in", () => {
  const hangForever = () => loginWithGoogle.mockReturnValue(new Promise(() => {}))

  it("can be cancelled by hand", async () => {
    const user = userEvent.setup()
    hangForever()
    const presenter = renderLogin()

    await user.click(screen.getByRole("button", { name: /sign in with google/i }))
    await user.click(await screen.findByRole("button", { name: "Cancel" }))

    expect(await screen.findByRole("button", { name: "Submit" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument()

    presenter.dispose()
  })

  /**
   * `userEvent` waits on real timers, so these drive the DOM with `fireEvent`
   * and advance the clock by hand. `tick` also flushes the microtask `derive()`
   * batches the status change on.
   */
  const tick = (ms = 0) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))

  const startHangingSignIn = async () => {
    hangForever()
    const presenter = renderLogin()
    fireEvent.click(screen.getByRole("button", { name: /sign in with google/i }))
    await tick()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument()
    return presenter
  }

  it("gives up on its own once the window is back in front", async () => {
    vi.useFakeTimers()
    const presenter = await startHangingSignIn()

    fireEvent(window, new Event("focus"))
    await tick(3000)

    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument()

    presenter.dispose()
    vi.useRealTimers()
  })

  it("stays put while the sign-in window still has focus", async () => {
    vi.useFakeTimers()
    const presenter = await startHangingSignIn()

    // No focus event — the user is still over on Google's screen.
    await tick(10_000)

    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument()

    presenter.dispose()
    vi.useRealTimers()
  })
})
