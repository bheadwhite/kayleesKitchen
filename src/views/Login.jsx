import React from "react"
import { Paper } from "@material-ui/core"
import { Form } from "react-final-form"
import { TextField } from "components/finalForm"
import { Button } from "components"
import { makeStyles } from "@material-ui/core"
import { toast } from "react-toastify"
import useAuth from "controllers/Auth/useAuth"

const useStyles = makeStyles((theme) => ({
  login: {
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
    width: "100%",
    height: "100%",
    padding: theme.spacing(3),
    margin: "auto",
    textAlign: "center",
    [theme.breakpoints.up("sm")]: {
      width: 530,
      maxWidth: 800,
      height: 310,
    },
  },
  form: {
    height: "100%",
  },
}))

const Login = (props) => {
  const classes = useStyles()
  const auth = useAuth()

  const onSubmit = (values) => {
    auth
      .logIn(values.email, values.password)
      .then(() => props.history.push("/recipes"))
      .catch((e) => {
        toast.error(e)
      })
  }
  const handleRegister = () => {
    props.history.push("/register")
  }

  return (
    <div className={classes.login}>
      <Form onSubmit={onSubmit}>
        {({ handleSubmit }) => {
          return (
            <form onSubmit={handleSubmit}>
              <Paper className={classes.paper}>
                <div style={{ width: "100%", maxWidth: 400 }}>
                  <h2>Please sign in.</h2>
                  <TextField name='email' label='Email' fullWidth />
                  <TextField
                    name='password'
                    label='Password'
                    type='password'
                    fullWidth
                  />
                  <div>
                    <Button onClick={handleRegister}>Register</Button>
                    <Button type='submit'>Submit</Button>
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

export default Login
