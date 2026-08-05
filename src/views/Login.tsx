import { useEffect, useState, type FormEvent } from "react"
import { Form } from "react-final-form"
import { useNavigate } from "react-router-dom"
import { toast } from "react-toastify"

import { Button, GoogleIcon, Spinner } from "components"
import { TextField } from "components/finalForm"
import { useAuthPresenter, useAuthStatus, usePendingLinkEmail } from "contexts/AuthProvider"
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

/** What a wrong password looks like. Newer projects collapse them into one. */
const BAD_CREDENTIAL_CODES = [
  "auth/invalid-credential",
  "auth/wrong-password",
  "auth/user-not-found",
]

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
  const pendingLinkEmail = usePendingLinkEmail()
  const [linkPassword, setLinkPassword] = useState("")

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
      // The other half of the two-ways-in problem: an account created *through*
      // Google has no password, and Firebase reports that as an ordinary bad
      // credential. It cannot tell us which it was — email enumeration
      // protection exists precisely to stop that — so the message names both.
      const isBadCredential =
        typeof error === "object" &&
        error != null &&
        "code" in error &&
        BAD_CREDENTIAL_CODES.includes((error as { code: string }).code)

      toast.error(
        isBadCredential
          ? "Wrong email or password. If you first signed up with Google, use the Google button instead."
          : error instanceof Error
            ? error.message
            : "Could not sign in."
      )
    }
  }

  const onGoogleSignIn = async () => {
    setAwaitingGoogle(true)
    try {
      await auth.logInWithGoogle()
      // A pending link means the sign-in stopped one step short on purpose:
      // this email already has a password, and the panel below asks for it.
      if (auth.getPendingLinkEmail() == null) navigate("/recipes")
    } catch (error) {
      if (isCancelledSignIn(error)) return
      toast.error(error instanceof Error ? error.message : "Could not sign in with Google.")
    } finally {
      setAwaitingGoogle(false)
    }
  }

  const onLink = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await auth.completeGoogleLink(linkPassword)
      setLinkPassword("")
      navigate("/recipes")
    } catch {
      // The password is the only thing that can be wrong here, and the pending
      // credential survives, so this stays on the panel for another go.
      toast.error("That password did not match. Try again, or cancel to go back.")
    }
  }

  // One account, two ways in. Google stopped short because this email already
  // has a password; entering it once joins them, and the Google button works on
  // its own from then on.
  if (pendingLinkEmail != null) {
    return (
      <div className='flex h-full w-full items-center justify-center'>
        <form
          onSubmit={onLink}
          className='blueprint w-full bg-ground p-5 sm:w-[480px] sm:p-7'
          aria-label='Link your Google account'>
          <h2 className='mb-3 font-heading text-3xl font-bold tracking-[0.02em]'>
            One more step.
          </h2>
          <p className='mb-5 text-ink/80'>
            <span className='font-medium'>{pendingLinkEmail}</span> already signs in with a
            password. Enter it once and your Google account will be joined to it — after
            that either way works.
          </p>

          <label
            htmlFor='link-password'
            className='mb-1 block font-mono text-[11px] tracking-[0.14em] text-muted uppercase'>
            Password
          </label>
          <input
            id='link-password'
            type='password'
            autoComplete='current-password'
            autoFocus
            value={linkPassword}
            onChange={(event) => setLinkPassword(event.target.value)}
            className='w-full border border-divider bg-surface px-3 py-2.5 text-base hover:border-ink/45 focus-visible:border-steel focus-visible:outline-offset-0'
          />

          <div className='mt-4 flex gap-2 max-sm:flex-col max-sm:[&>button]:mr-0'>
            {isSubmitting ? (
              <Spinner size={32} />
            ) : (
              <>
                <Button type='submit' variant='primary' disabled={linkPassword === ""}>
                  Link and sign in
                </Button>
                <Button
                  onClick={() => {
                    auth.cancelGoogleLink()
                    setLinkPassword("")
                  }}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className='flex h-full w-full items-center justify-center'>
      <Form<LoginValues> onSubmit={onSubmit} validate={validateLogin}>
        {({ handleSubmit }) => (
          <form
            onSubmit={handleSubmit}
            className='blueprint w-full bg-ground p-5 text-center sm:w-[480px] sm:p-7'>
            <h2 className='mb-5 font-heading text-3xl font-bold tracking-[0.02em]'>
              Please sign in.
            </h2>
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
                    <Button type='submit' variant='primary'>
                      Sign in
                    </Button>
                    <Button onClick={() => navigate("/register")}>Register</Button>
                  </>
                )}
              </div>
              {!isSubmitting && (
                <>
                  <div className='my-4 flex items-center gap-3 font-mono text-[11px] tracking-[0.14em] text-muted uppercase'>
                    <span className='h-px flex-1 bg-divider' />
                    or
                    <span className='h-px flex-1 bg-divider' />
                  </div>
                  <Button onClick={onGoogleSignIn} className='mt-0! mr-0! w-full'>
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
