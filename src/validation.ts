import type { LoginValues, RegisterValues } from "@/types"

export type RegisterErrors = Partial<Record<keyof RegisterValues, string>>
export type LoginErrors = Partial<Record<keyof LoginValues, string>>

export const login = (values: LoginValues): LoginErrors => {
  const errors: LoginErrors = {}

  if (!values.email?.trim()) errors.email = "Please enter your email address."
  if (!values.password) errors.password = "Please enter your password."

  return errors
}

export const register = (values: RegisterValues): RegisterErrors => {
  const errors: RegisterErrors = {}

  if (!values.firstName) errors.firstName = "Please enter your first name."
  if (!values.lastName) errors.lastName = "Please enter your last name."
  if (!values.email) errors.email = "Please enter an email address."
  if (values.email && !values.email.match(/[^@]+@[^.]+\..+/)) {
    errors.email = "Email must be a valid email address."
  }
  if (!values.password) errors.password = "Please enter a password."
  if (values.password !== values.confirmPassword) {
    errors.confirmPassword = "Passwords don't match."
  }

  return errors
}
