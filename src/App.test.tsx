import { render, screen } from "@testing-library/react"
import { StrictMode } from "react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import App from "./App"
import AuthProvider from "contexts/AuthProvider"
import ChefProvider from "contexts/ChefProvider"
import PlannerProvider from "contexts/PlannerProvider"
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
  loginWithGoogle: vi.fn(),
  recordLogin: vi.fn(),
  linkGoogleToExistingAccount: vi.fn(),
  ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL: "auth/account-exists-with-different-credential",
  onRecipesSnapshot: vi.fn(() => () => {}),
  onRecipesByEmailSnapshot: vi.fn(() => () => {}),
  onTagsSnapshot: vi.fn(() => () => {}),
  onRecipeVariantsSnapshot: vi.fn(() => () => {}),
  onRecipeYieldSnapshot: vi.fn(() => () => {}),
  saveRecipeVariant: vi.fn().mockResolvedValue(undefined),
  deleteRecipeVariant: vi.fn().mockResolvedValue(undefined),
  onUsersSnapshot: vi.fn(() => () => {}),
  onMySessionsSnapshot: vi.fn(() => () => {}),
  onMyInvitesSnapshot: vi.fn(() => () => {}),
  onSessionMealsSnapshot: vi.fn(() => () => {}),
  onSessionShoppingSnapshot: vi.fn(() => () => {}),
  onPantrySnapshot: vi.fn(() => () => {}),
}))

let emitAuthState: (user: unknown) => void = () => {}

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: unknown) => void) => {
    emitAuthState = callback
    return () => {}
  },
  GoogleAuthProvider: { credentialFromError: () => null },
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}))

const Tree = ({ initialPath }: { initialPath: string }) => (
  <AuthProvider>
    <RecipeProvider>
      <ChefProvider>
        <PlannerProvider>
          <MemoryRouter initialEntries={[initialPath]}>
            <App />
          </MemoryRouter>
        </PlannerProvider>
      </ChefProvider>
    </RecipeProvider>
  </AuthProvider>
)

const renderApp = (initialPath: string) => render(<Tree initialPath={initialPath} />)

/** main.tsx renders inside <StrictMode>, which mounts, tears down, and remounts
 *  every effect in development. Providers must survive that cycle. */
const renderAppStrict = (initialPath: string) =>
  render(
    <StrictMode>
      <Tree initialPath={initialPath} />
    </StrictMode>
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

    expect(await screen.findByLabelText("Filter recipes")).toBeInTheDocument()
  })

  it("still resolves auth state under StrictMode's mount/unmount/remount", async () => {
    renderAppStrict("/recipes")
    emitAuthState({ uid: "u1", email: "cook@example.test", displayName: null })

    expect(await screen.findByLabelText("Filter recipes")).toBeInTheDocument()
  })

  it("renders the app chrome", () => {
    renderApp("/login")
    expect(screen.getByRole("heading", { name: "Kitchen Help" })).toBeInTheDocument()
  })

  it("hides the nav bar on the login page — every entry needs a session", async () => {
    renderApp("/login")
    emitAuthState(null)

    expect(await screen.findByText("Please sign in.")).toBeInTheDocument()
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument()
  })

  it("shows the nav bar to a signed-in user", async () => {
    renderApp("/recipes")
    emitAuthState({ uid: "u1", email: "cook@example.test", displayName: null })

    expect(await screen.findByRole("navigation", { name: "Main" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Recipes" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Editor" })).toBeInTheDocument()
    // Signing out lives on /profile, not in the tab bar.
    expect(screen.getByRole("link", { name: /^Account:/ })).toBeInTheDocument()
  })

  it("routes a signed-in user to their profile", async () => {
    renderApp("/profile")
    emitAuthState({ uid: "u1", email: "cook@example.test", displayName: "Sam Cook" })

    expect(await screen.findByText("Sam Cook")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Your recipes" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument()
  })

  it("keeps the profile page behind the auth guard", async () => {
    renderApp("/profile")
    emitAuthState(null)

    expect(await screen.findByText("Please sign in.")).toBeInTheDocument()
  })
})
