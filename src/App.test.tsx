import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import App from "./App"
import AuthProvider from "contexts/AuthProvider"
import RecipeProvider from "contexts/RecipeProvider"

/** Firebase is stubbed out at the edges — these tests cover wiring, not the SDK. */
vi.mock("fire/firebase", () => ({
  app: {},
  auth: {},
  db: {},
  storage: {},
  userRef: {},
  recipesRef: {},
}))

vi.mock("fire/services", () => ({
  getUserProfile: vi.fn().mockResolvedValue(null),
  onRecipesSnapshot: vi.fn(() => () => {}),
  onRecipesByEmailSnapshot: vi.fn(() => () => {}),
}))

let emitAuthState: (user: unknown) => void = () => {}

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: unknown) => void) => {
    emitAuthState = callback
    return () => {}
  },
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}))

const renderApp = (initialPath: string) =>
  render(
    <AuthProvider>
      <RecipeProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <App />
        </MemoryRouter>
      </RecipeProvider>
    </AuthProvider>
  )

describe("App", () => {
  beforeEach(() => {
    emitAuthState = () => {}
  })

  it("shows a spinner until Firebase reports the initial auth state", () => {
    renderApp("/recipes")
    expect(screen.getByRole("progressbar")).toBeInTheDocument()
  })

  it("redirects an anonymous visitor to the login screen", async () => {
    renderApp("/recipes")
    emitAuthState(null)

    expect(await screen.findByText("Please sign in.")).toBeInTheDocument()
  })

  it("lets a signed-in user reach the recipes page", async () => {
    renderApp("/recipes")
    emitAuthState({ uid: "u1", email: "cook@example.test", displayName: null })

    expect(await screen.findByText("Select a Recipe...")).toBeInTheDocument()
  })

  it("renders the app chrome", () => {
    renderApp("/login")
    expect(screen.getByRole("heading", { name: "Kitchen Help" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "menu" })).toBeInTheDocument()
  })
})
