import React, { useState } from "react"
import { Form } from "react-final-form"
import { Paper, CircularProgress } from "@material-ui/core"
import { TextField } from "components/finalForm"
import { Button } from "components"
import { makeStyles } from "@material-ui/core"
import { addUser } from "fire/services"
import { toast } from "react-toastify"
import { register } from "validation"

const useStyles = makeStyles((theme) => ({
  register: {
    height: "100%",
    width: "100%",
    [theme.breakpoints.up("sm")]: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    },
    "& form": {
      height: "100%",
      display: "flex",
    },
  },
  paper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(3),
    textAlign: "center",
    height: "100%",
    [theme.breakpoints.up("sm")]: {
      width: 530,
      height: 440,
      maxWidth: 800,
      margin: "auto",
    },
  },
}))

const Register = (props) => {
  const classes = useStyles()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = (values) => {
    addUser(values)
      .then((res) => {
        toast.success(
          "Thank you for registering. \nYou will now be redirected to the login screen."
        )
        setTimeout(() => {
          props.history.push("/login")
        }, 4000)
      })
      .catch((err) => {
        console.log(err)
        toast.error(err.message)
      })
      .finally(() => {
        setIsSubmitting(false)
      })
  }

  return (
    <div className={classes.register}>
      <Form onSubmit={onSubmit} validate={register}>
        {({ handleSubmit, values, errors, submitting }) => {
          return (
            <form
              onSubmit={(e) => {
                setIsSubmitting(true)
                e.preventDefault()
                const registerErrors = Object.values(errors)

                if (registerErrors.length > 0) {
                  registerErrors.forEach((error) => {
                    setIsSubmitting(false)
                    toast.info(error)
                  })
                } else {
                  handleSubmit(values)
                }
              }}>
              <Paper className={classes.paper}>
                <div style={{ width: "100%", maxWidth: 400 }}>
                  <h2>Register</h2>
                  <TextField name='firstName' label='First Name' />
                  <TextField name='lastName' label='Last Name' />
                  <TextField name='email' label='Email' />
                  <TextField name='password' label='Password' type='password' />
                  <TextField name='confirmPassword' label='Confirm Password' type='password' />
                  <div>
                    {isSubmitting ? <CircularProgress /> : <Button type='submit'>Submit</Button>}
                  </div>
                </div>
              </Paper>
            </form>
          )
        }}
      </Form>
    </div>
  )
}

export default Register
