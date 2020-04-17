import React from "react"
import { Paper } from "@material-ui/core"
import { Form } from "react-final-form"
import { TextField } from "components/finalForm"
import { Button } from "components"
import { makeStyles } from "@material-ui/core"
import { loginWithEmail } from "fire/services"
import { toast } from "react-toastify"

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

  const onSubmit = (values) => {
    loginWithEmail(values)
      .then((response) => {
        props.history.push("/recipes")
      })
      .catch((error) => {
        toast.error(error.message)
      })
  }
  const handleRegister = () => {
    props.history.push("/register")
  }

  return (
    <div className={classes.login}>
      <Form onSubmit={onSubmit}>
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
                    <Button style={{ marginLeft: "auto" }} onClick={handleRegister}>
                      Register
                    </Button>
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
