import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Auth } from "firebase/auth"

import Profile from "./Profile"
import AuthProvider from "contexts/AuthProvider"
import { AuthPresenter } from "presenters/AuthPresenter"
import type { Recipe } from "@/types"

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

const MY_RECIPES: Recipe[] = [
  {
    id: "biscuits",
    title: "Buttermilk Biscuits",
    contributor: "Sam Cook",
    ingredients: [{ name: "flour", amount: "2 cups" }],
    directions: [{ sectionTitle: "Bake", steps: ["Fold", "Cut"] }],
  },
]

const ALL_RECIPES: Recipe[] = [
  ...MY_RECIPES,
  { id: "dal", title: "Dal Tadka", contributor: "Dev", ingredients: [], directions: [] },
  { id: "adobo", title: "Chicken Adobo", contributor: "Dev", ingredients: [], directions: [] },
]

vi.mock("fire/services", () => ({
  getUserProfile: vi.fn().mockResolvedValue(null),
  loginWithGoogle: vi.fn(),
  linkGoogleToExistingAccount: vi.fn(),
  ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL: "auth/account-exists-with-different-credential",
  onRecipesSnapshot: (callback: (recipes: Recipe[]) => void) => {
    callback(ALL_RECIPES)
    return () => {}
  },
  onRecipesByEmailSnapshot: (_email: string, callback: (recipes: Recipe[]) => void) => {
    callback(MY_RECIPES)
    return () => {}
  },
}))

const renderProfile = () => {
  const presenter = new AuthPresenter({} as Auth)

  render(
    <AuthProvider presenter={presenter}>
      <MemoryRouter initialEntries={["/profile"]}>
        <Routes>
          <Route path='/profile' element={<Profile />} />
          <Route path='/login' element={<p>login</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  )

  return presenter
}

const signIn = (user: Record<string, unknown> = {}) =>
  emitAuthState({
    uid: "u1",
    email: "sam.cook@example.test",
    displayName: "Sam Cook",
    photoURL: null,
    ...user,
  })

describe("Profile", () => {
  beforeEach(() => {
    emitAuthState = () => {}
    signOutMock.mockClear()
  })

  it("shows who is signed in", async () => {
    const presenter = renderProfile()
    signIn()

    expect(await screen.findByText("Sam Cook")).toBeInTheDocument()
    expect(screen.getByText("sam.cook@example.test")).toBeInTheDocument()

    presenter.dispose()
  })

  it("lists your own recipes", async () => {
    const presenter = renderProfile()
    signIn()

    expect(await screen.findByText("Buttermilk Biscuits")).toBeInTheDocument()
    // The recipes of everyone else belong to the household section, not this one.
    expect(screen.queryByText("Dal Tadka")).not.toBeInTheDocument()

    presenter.dispose()
  })

  it("counts every cook in the household", async () => {
    const presenter = renderProfile()
    signIn()

    expect(await screen.findByText("Dev")).toBeInTheDocument()
    expect(screen.getByText("2 recipes")).toBeInTheDocument()
    // "1 recipe" also appears in the header and the section count, so the
    // signed-in cook's own row is identified by its marker instead.
    expect(screen.getByText(/\(you\)/)).toBeInTheDocument()

    presenter.dispose()
  })

  it("falls back to initials when the account has no picture", async () => {
    const presenter = renderProfile()
    signIn()

    expect(await screen.findByText("SC")).toBeInTheDocument()
    expect(screen.queryByRole("img")).not.toBeInTheDocument()

    presenter.dispose()
  })

  it("confirms before signing out", async () => {
    const user = userEvent.setup()
    const presenter = renderProfile()
    signIn()

    await user.click(await screen.findByRole("button", { name: "Sign out" }))
    expect(signOutMock).not.toHaveBeenCalled()

    const dialog = screen.getByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(signOutMock).not.toHaveBeenCalled()

    presenter.dispose()
  })

  it("signs out and returns to the login screen once confirmed", async () => {
    const user = userEvent.setup()
    const presenter = renderProfile()
    signIn()

    await user.click(await screen.findByRole("button", { name: "Sign out" }))
    await user.click(screen.getByRole("button", { name: "Yes, sign out" }))

    expect(signOutMock).toHaveBeenCalled()
    expect(await screen.findByText("login")).toBeInTheDocument()

    presenter.dispose()
  })
})
