import React from "react"
import { Paper } from "@material-ui/core"
import { Form } from "react-final-form"
import { TextField } from "components/finalForm"
import { Button } from "components"
import { makeStyles } from "@material-ui/core"
import { loginWithEmail } from "fire/services"

const useStyles = makeStyles((theme) => ({
  login: {
    height: "100%",
    width: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  paper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(3),
    maxWidth: 800,
    height: 310,
    margin: "auto",
    width: 530,
    textAlign: "center",
  },
  form: {
    height: "100%",
  },
}))

const Login = () => {
  const classes = useStyles()

  const onSubmit = (values) => {
    loginWithEmail(values)
      .then((response) => {
        console.log(response)
      })
      .catch((error) => {
        console.log(error)
      })
  }
  const validate = () => {
    console.log("validate")
  }

  return (
    <div className={classes.login}>
      <Form onSubmit={onSubmit} validate={validate}>
        {({ handleSubmit, values }) => {
          return (
            <form onSubmit={handleSubmit}>
              <Paper className={classes.paper}>
                <div style={{ width: "100%", maxWidth: 400 }}>
                  <h2>Please sign in.</h2>
                  <TextField name='email' label='Email' />
                  <TextField name='password' label='Password' type='password' />
                  <div>
                    <Button type='submit'>Submit</Button>
                    <Button style={{ marginLeft: "auto" }}>Register</Button>
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
