import clsx from "clsx"
import { Navigate, Outlet, Route, Routes } from "react-router-dom"
import { ToastContainer } from "react-toastify"

import { Spinner } from "components"
import NavBar from "components/NavBar"
import Toolbar from "components/Toolbar"
import { useAuthStatus } from "contexts/AuthProvider"
import { Login, Profile, RecipeEditor, Recipes, Register } from "views"

/**
 * Route guard. `initializing` covers the first Firebase auth round-trip, so a
 * signed-in user reloading the page is not bounced to /login.
 */
const RequireAuth = () => {
  const status = useAuthStatus()

  if (status === "loggedIn") return <Outlet />
  if (status === "loggedOut") return <Navigate to='/login' replace />

  return (
    // `h-full` has no effect here — the parent chain is auto-height — so the
    // spinner needs its own box to sit in the middle of.
    <div className='flex min-h-[50dvh] items-center justify-center'>
      <Spinner />
    </div>
  )
}

const App = () => {
  // The nav bar hides itself when there is no session; the content column has to
  // know the same thing, or signed-out pages reserve room for a bar that is not
  // there.
  const signedIn = useAuthStatus() === "loggedIn"

  return (
    // `dvh`, not `vh`: mobile browsers report `100vh` as the height *without* the
    // address bar, so `min-h-screen` overflows the visible viewport on a phone.
    <div className='flex min-h-dvh flex-col items-center'>
      <Toolbar />
      {/* Both bars are fixed, so they are out of flow — the scrolling column
       *  pads itself past each one plus the safe-area inset it sits under. */}
      <div
        className={clsx(
          "w-full max-w-[900px] px-3 pt-[calc(var(--header-h)+var(--sai-top)+0.75rem)] sm:px-2.5",
          signedIn
            ? "pb-[calc(var(--navbar-h)+var(--sai-bottom)+1rem)]"
            : "pb-[calc(var(--sai-bottom)+1rem)]"
        )}>
        <Routes>
          <Route path='/login' element={<Login />} />
          <Route path='/register' element={<Register />} />
          <Route element={<RequireAuth />}>
            <Route path='/recipes' element={<Recipes />} />
            <Route path='/recipes/new' element={<RecipeEditor />} />
            <Route path='/profile' element={<Profile />} />
            <Route path='*' element={<Recipes />} />
          </Route>
        </Routes>
      </div>
      <NavBar />
      <ToastContainer autoClose={4000} hideProgressBar />
    </div>
  )
}

export default App
