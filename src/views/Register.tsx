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
            className='w-full rounded bg-white p-6 text-center shadow sm:w-[530px]'>
            <h2 className='mb-4 text-2xl font-medium'>Register</h2>
            <div className='mx-auto w-full max-w-[400px] text-left'>
              <TextField name='firstName' label='First Name' fullWidth />
              <TextField name='lastName' label='Last Name' fullWidth />
              <TextField name='email' label='Email' type='email' fullWidth />
              <TextField name='password' label='Password' type='password' fullWidth />
              <TextField
                name='confirmPassword'
                label='Confirm Password'
                type='password'
                fullWidth
              />
              <div className='mt-4 flex justify-center'>
                {isSubmitting ? <Spinner size={32} /> : <Button type='submit'>Submit</Button>}
              </div>
            </div>
          </form>
        )}
      </Form>
    </div>
  )
}

export default Register
