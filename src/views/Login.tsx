import { Form } from "react-final-form"
import { useNavigate } from "react-router-dom"
import { toast } from "react-toastify"

import { Button, Spinner } from "components"
import { TextField } from "components/finalForm"
import { useAuthPresenter, useAuthStatus } from "contexts/AuthProvider"

interface LoginValues {
  email?: string
  password?: string
}

const Login = () => {
  const auth = useAuthPresenter()
  const status = useAuthStatus()
  const navigate = useNavigate()
  const isSubmitting = status === "loggingIn"

  const onSubmit = async ({ email = "", password = "" }: LoginValues) => {
    try {
      await auth.logIn(email, password)
      navigate("/recipes")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign in.")
    }
  }

  return (
    <div className='flex h-full w-full items-center justify-center'>
      <Form<LoginValues> onSubmit={onSubmit}>
        {({ handleSubmit }) => (
          <form
            onSubmit={handleSubmit}
            className='w-full rounded bg-white p-6 text-center shadow sm:w-[530px]'>
            <h2 className='mb-4 text-2xl font-medium'>Please sign in.</h2>
            <div className='mx-auto w-full max-w-[400px] text-left'>
              <TextField name='email' label='Email' type='email' fullWidth />
              <TextField name='password' label='Password' type='password' fullWidth />
              <div className='mt-4 flex items-center justify-center gap-2'>
                {isSubmitting ? (
                  <Spinner size={32} />
                ) : (
                  <>
                    <Button onClick={() => navigate("/register")}>Register</Button>
                    <Button type='submit'>Submit</Button>
                  </>
                )}
              </div>
            </div>
          </form>
        )}
      </Form>
    </div>
  )
}

export default Login
