import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Auth } from "firebase/auth"

import NavBar from "./NavBar"
import AuthProvider from "contexts/AuthProvider"
import { AuthPresenter } from "presenters/AuthPresenter"
import { ADMIN_EMAIL } from "@/admin"

let emitAuthState: (user: unknown) => void = () => {}
const signOutMock = vi.fn().mockResolvedValue(undefined)

vi.mock("fire/firebase", () => ({ auth: {} }))

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: unknown) => void) => {
    emitAuthState = callback
    return () => {}
  },
  GoogleAuthProvider: { credentialFromError: () => null },
  signInWithEmailAndPassword: vi.fn(),
  signOut: (...args: unknown[]) => signOutMock(...args),
}))

vi.mock("fire/services", () => ({
  getUserProfile: vi.fn().mockResolvedValue(null),
  loginWithGoogle: vi.fn(),
  recordLogin: vi.fn(),
  linkGoogleToExistingAccount: vi.fn(),
  ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL: "auth/account-exists-with-different-credential",
}))

const renderNavBar = (initialPath = "/recipes") => {
  const presenter = new AuthPresenter({} as Auth)

  render(
    <AuthProvider presenter={presenter}>
      <MemoryRouter initialEntries={[initialPath]}>
        <NavBar />
        {/* Somewhere for the tabs to land, so an assertion can name the page. */}
        <Routes>
          <Route path='/recipes' element={<p>recipe list</p>} />
          <Route path='/recipes/new' element={<p>recipe editor</p>} />
          <Route path='/plan' element={<p>meal plan</p>} />
          <Route path='/tags' element={<p>tag manager</p>} />
          <Route path='/profile' element={<p>profile</p>} />
          <Route path='/admin' element={<p>admin console</p>} />
          <Route path='/login' element={<p>login</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  )

  return presenter
}

const signIn = (email = "cook@example.test") =>
  emitAuthState({ uid: "u1", email, displayName: "Cook" })

describe("NavBar", () => {
  beforeEach(() => {
    emitAuthState = () => {}
    signOutMock.mockClear()
  })

  it("stays hidden until there is a session", async () => {
    const presenter = renderNavBar()
    emitAuthState(null)

    expect(await screen.findByText("recipe list")).toBeInTheDocument()
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument()

    presenter.dispose()
  })

  it("navigates to the editor and back to the list", async () => {
    const user = userEvent.setup()
    const presenter = renderNavBar()
    signIn()

    await user.click(await screen.findByRole("link", { name: "Editor" }))
    expect(screen.getByText("recipe editor")).toBeInTheDocument()

    await user.click(screen.getByRole("link", { name: "Recipes" }))
    expect(screen.getByText("recipe list")).toBeInTheDocument()

    presenter.dispose()
  })

  it("opens the meal plan", async () => {
    const user = userEvent.setup()
    const presenter = renderNavBar()
    signIn()

    await user.click(await screen.findByRole("link", { name: "Plan" }))
    expect(screen.getByText("meal plan")).toBeInTheDocument()

    presenter.dispose()
  })

  it("opens the tag manager", async () => {
    const user = userEvent.setup()
    const presenter = renderNavBar()
    signIn()

    await user.click(await screen.findByRole("link", { name: "Tags" }))
    expect(screen.getByText("tag manager")).toBeInTheDocument()

    presenter.dispose()
  })

  it("marks only the current tab as the current page", async () => {
    const presenter = renderNavBar("/recipes/new")
    signIn()

    // `end` on the /recipes tab: without it a NavLink to a path prefix stays
    // active on every child route, lighting up both tabs at once.
    expect(await screen.findByRole("link", { name: "Editor" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(screen.getByRole("link", { name: "Recipes" })).not.toHaveAttribute("aria-current")

    presenter.dispose()
  })

  it("shows the account tab as the signed-in user, and opens the profile", async () => {
    const user = userEvent.setup()
    const presenter = renderNavBar()
    signIn()

    const account = await screen.findByRole("link", { name: "Account: Cook" })
    expect(account).toHaveTextContent("Cook")

    await user.click(account)
    expect(screen.getByText("profile")).toBeInTheDocument()

    presenter.dispose()
  })

  it("offers no way to sign out — that lives on the profile page", async () => {
    const presenter = renderNavBar()
    signIn()

    await screen.findByRole("navigation", { name: "Main" })
    expect(screen.queryByRole("button", { name: /sign ?out|logout/i })).not.toBeInTheDocument()
    expect(signOutMock).not.toHaveBeenCalled()

    presenter.dispose()
  })
})

describe("NavBar — the admin tab", () => {
  beforeEach(() => {
    emitAuthState = () => {}
  })

  it("is hidden from everyone but the admin", async () => {
    const presenter = renderNavBar()
    signIn("cook@example.test")

    await screen.findByRole("navigation", { name: "Main" })
    // Not just unreachable — a non-admin should not learn the console exists.
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument()

    presenter.dispose()
  })

  it("takes the admin to the console", async () => {
    const user = userEvent.setup()
    const presenter = renderNavBar()
    signIn(ADMIN_EMAIL)

    await user.click(await screen.findByRole("link", { name: "Admin" }))
    expect(screen.getByText("admin console")).toBeInTheDocument()

    presenter.dispose()
  })
})
