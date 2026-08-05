import { useState } from "react"
import { Form } from "react-final-form"
import { useNavigate } from "react-router-dom"
import { toast } from "react-toastify"

import { Button, Spinner } from "components"
import { TextField } from "components/finalForm"
import { addUser } from "fire/services"
import { register as validateRegister } from "@/validation"
import type { RegisterValues } from "@/types"

const Register = () => {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (values: RegisterValues) => {
    setIsSubmitting(true)
    try {
      await addUser(values)
      toast.success(
        "Thank you for registering. You will now be redirected to the login screen."
      )
      setTimeout(() => navigate("/login"), 4000)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not register.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className='flex h-full w-full items-center justify-center'>
      <Form<RegisterValues> onSubmit={onSubmit} validate={validateRegister}>
        {({ handleSubmit, errors }) => (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              const messages = Object.values(errors ?? {})
              if (messages.length > 0) {
                messages.forEach((message) => toast.info(String(message)))
                return
              }
              void handleSubmit()
            }}
            className='blueprint w-full bg-ground p-5 text-center sm:w-[480px] sm:p-7'>
            <h2 className='mb-5 font-heading text-3xl font-bold tracking-[0.02em]'>Register</h2>
            <div className='mx-auto w-full max-w-[400px] text-left'>
              <TextField
                name='firstName'
                label='First Name'
                autoComplete='given-name'
                autoCapitalize='words'
                fullWidth
              />
              <TextField
                name='lastName'
                label='Last Name'
                autoComplete='family-name'
                autoCapitalize='words'
                fullWidth
              />
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
                autoComplete='new-password'
                fullWidth
              />
              <TextField
                name='confirmPassword'
                label='Confirm Password'
                type='password'
                autoComplete='new-password'
                fullWidth
              />
              <div className='mt-4 flex justify-center max-sm:flex-col max-sm:items-stretch'>
                {isSubmitting ? (
                  <Spinner size={32} />
                ) : (
                  <Button type='submit' variant='primary'>
                    Create account
                  </Button>
                )}
              </div>
            </div>
          </form>
        )}
      </Form>
    </div>
  )
}

export default Register
