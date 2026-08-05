import { useEffect, useState } from "react"
import { Form } from "react-final-form"
import { useNavigate } from "react-router-dom"
import { toast } from "react-toastify"

import { Button, GoogleIcon, Spinner } from "components"
import { TextField } from "components/finalForm"
import { useAuthPresenter, useAuthStatus } from "contexts/AuthProvider"
import { SIGN_IN_CANCELLED } from "presenters/AuthPresenter"
import { login as validateLogin } from "@/validation"
import type { LoginValues } from "@/types"

/** Closing the Google popup is a normal action, not an error worth a toast. */
const CANCELLED_POPUP_CODES = [
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/user-cancelled",
]

/**
 * How long to wait, after this window is back in front, before deciding a Google
 * sign-in was abandoned. Long enough that a genuine sign-in finishing just as
 * focus returns is not cut off.
 */
const ABANDONED_SIGN_IN_MS = 2500

const isCancelledSignIn = (error: unknown) => {
  if (typeof error !== "object" || error == null) return false
  if ("code" in error && CANCELLED_POPUP_CODES.includes((error as { code: string }).code)) {
    return true
  }
  return error instanceof Error && error.message === SIGN_IN_CANCELLED
}

const Login = () => {
  const auth = useAuthPresenter()
  const status = useAuthStatus()
  const navigate = useNavigate()
  const isSubmitting = status === "loggingIn"
  const [awaitingGoogle, setAwaitingGoogle] = useState(false)

  // Firebase does not always reject when the Google window is dismissed, which
  // used to leave this page spinning with no way back. Getting focus again
  // without a completed sign-in is the signal that the user backed out.
  // Scoped to the Google flow — an email/password login never leaves the page.
  useEffect(() => {
    if (!awaitingGoogle) return

    let timer: ReturnType<typeof setTimeout> | undefined
    const armCancel = () => {
      if (document.visibilityState !== "visible") return
      clearTimeout(timer)
      timer = setTimeout(() => auth.cancelLogin(), ABANDONED_SIGN_IN_MS)
    }

    window.addEventListener("focus", armCancel)
    document.addEventListener("visibilitychange", armCancel)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("focus", armCancel)
      document.removeEventListener("visibilitychange", armCancel)
    }
  }, [awaitingGoogle, auth])

  const onSubmit = async ({ email = "", password = "" }: LoginValues) => {
    try {
      await auth.logIn(email, password)
      navigate("/recipes")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign in.")
    }
  }

  const onGoogleSignIn = async () => {
    setAwaitingGoogle(true)
    try {
      await auth.logInWithGoogle()
      navigate("/recipes")
    } catch (error) {
      if (isCancelledSignIn(error)) return
      toast.error(error instanceof Error ? error.message : "Could not sign in with Google.")
    } finally {
      setAwaitingGoogle(false)
    }
  }

  return (
    <div className='flex h-full w-full items-center justify-center'>
      <Form<LoginValues> onSubmit={onSubmit} validate={validateLogin}>
        {({ handleSubmit }) => (
          <form
            onSubmit={handleSubmit}
            className='w-full rounded bg-white p-4 text-center shadow sm:w-[530px] sm:p-6'>
            <h2 className='mb-4 text-2xl font-medium'>Please sign in.</h2>
            <div className='mx-auto w-full max-w-[400px] text-left'>
              <TextField
                name='email'
                label='Email'
                type='email'
                inputMode='email'
                autoComplete='email'
                autoCapitalize='none'
                autoCorrect='off'
                fullWidth
              />
              <TextField
                name='password'
                label='Password'
                type='password'
                autoComplete='current-password'
                fullWidth
              />
              <div className='mt-4 flex items-center justify-center gap-2 max-sm:flex-col max-sm:items-stretch max-sm:[&>button]:mr-0'>
                {isSubmitting ? (
                  // Always an escape hatch: the automatic recovery above depends
                  // on focus events the browser may never send.
                  <div className='flex w-full flex-col items-center gap-1'>
                    <Spinner size={32} />
                    <Button onClick={() => auth.cancelLogin()} className='mr-0'>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button type='submit'>Submit</Button>
                    <Button onClick={() => navigate("/register")}>Register</Button>
                  </>
                )}
              </div>
              {!isSubmitting && (
                <>
                  <div className='my-4 flex items-center gap-3 text-xs text-gray-500'>
                    <span className='border-brand-border h-px flex-1 border-t' />
                    or
                    <span className='border-brand-border h-px flex-1 border-t' />
                  </div>
                  <Button
                    onClick={onGoogleSignIn}
                    className='border-brand-border mt-0! mr-0! w-full border bg-white! py-2 text-gray-700! hover:bg-gray-50! focus-visible:ring-brand-blue!'>
                    <GoogleIcon />
                    Sign in with Google
                  </Button>
                </>
              )}
            </div>
          </form>
        )}
      </Form>
    </div>
  )
}

export default Login
