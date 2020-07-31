export const register = (values: any) => {
  const errors = {} as any
  if (!values.firstName) {
    errors.firstName = "Please enter your first name."
  }
  if (!values.lastName) {
    errors.lastName = "Please enter your last name."
  }
  if (!values.email) {
    errors.email = "Please enter an email address."
  }
  if (values.email && !values.email.match(/[^@]+@[^.]+\..+/)) {
    errors.email = "Email must be a valid email address."
  }
  if (!values.password) {
    errors.password = "Please enter a password."
  }
  if (values.password !== values.confirmPassword) {
    errors.confirmPassword = "passwords don't match"
  }
  return errors
}
