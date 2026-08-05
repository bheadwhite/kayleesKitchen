import { Navigate, Outlet, Route, Routes } from "react-router-dom"
import { ToastContainer } from "react-toastify"

import { Spinner } from "components"
import Toolbar from "components/Toolbar"
import { useAuthStatus } from "contexts/AuthProvider"
import { Login, RecipeEditor, Recipes, Register } from "views"

/**
 * Route guard. `initializing` covers the first Firebase auth round-trip, so a
 * signed-in user reloading the page is not bounced to /login.
 */
const RequireAuth = () => {
  const status = useAuthStatus()

  if (status === "loggedIn") return <Outlet />
  if (status === "loggedOut") return <Navigate to='/login' replace />

  return (
    <div className='flex h-full items-center justify-center'>
      <Spinner />
    </div>
  )
}

const App = () => (
  <div className='flex min-h-screen flex-col items-center'>
    <Toolbar />
    <div className='h-full w-full max-w-[900px] px-2.5 pt-[75px]'>
      <Routes>
        <Route path='/login' element={<Login />} />
        <Route path='/register' element={<Register />} />
        <Route element={<RequireAuth />}>
          <Route path='/recipes' element={<Recipes />} />
          <Route path='/recipes/new' element={<RecipeEditor />} />
          <Route path='*' element={<Recipes />} />
        </Route>
      </Routes>
    </div>
    <ToastContainer autoClose={4000} hideProgressBar />
  </div>
)

export default App
