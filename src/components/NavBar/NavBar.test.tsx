import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Auth } from "firebase/auth"

import NavBar from "./NavBar"
import AuthProvider from "contexts/AuthProvider"
import { AuthPresenter } from "presenters/AuthPresenter"

let emitAuthState: (user: unknown) => void = () => {}
const signOutMock = vi.fn().mockResolvedValue(undefined)

vi.mock("fire/firebase", () => ({ auth: {} }))

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: unknown) => void) => {
    emitAuthState = callback
    return () => {}
  },
  signInWithEmailAndPassword: vi.fn(),
  signOut: (...args: unknown[]) => signOutMock(...args),
}))

vi.mock("fire/services", () => ({
  getUserProfile: vi.fn().mockResolvedValue(null),
  loginWithGoogle: vi.fn(),
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
          <Route path='/profile' element={<p>profile</p>} />
          <Route path='/login' element={<p>login</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  )

  return presenter
}

const signIn = () =>
  emitAuthState({ uid: "u1", email: "cook@example.test", displayName: "Cook" })

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

    await user.click(await screen.findByRole("link", { name: "Recipe Editor" }))
    expect(screen.getByText("recipe editor")).toBeInTheDocument()

    await user.click(screen.getByRole("link", { name: "Recipes" }))
    expect(screen.getByText("recipe list")).toBeInTheDocument()

    presenter.dispose()
  })

  it("marks only the current tab as the current page", async () => {
    const presenter = renderNavBar("/recipes/new")
    signIn()

    // `end` on the /recipes tab: without it a NavLink to a path prefix stays
    // active on every child route, lighting up both tabs at once.
    expect(await screen.findByRole("link", { name: "Recipe Editor" })).toHaveAttribute(
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
