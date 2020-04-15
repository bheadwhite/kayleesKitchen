import React from "react"
import { Paper } from "@material-ui/core"
import { Form } from "react-final-form"
import { TextField } from "components/finalForm"
import { Button } from "components"
import { makeStyles } from "@material-ui/core"

const useStyles = makeStyles((theme) => ({
  paper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(3),
    maxWidth: 800,
    height: 400,
    margin: "auto",
  },
}))

const Login = () => {
  const classes = useStyles()

  const onSubmit = () => {
    console.log("submit")
  }
  const validate = () => {
    console.log("validate")
  }

  return (
    <Form onSubmit={onSubmit} validate={validate}>
      {({ handleSubmit, values }) => {
        console.log("values", values)
        return (
          <form onSubmit={handleSubmit}>
            <Paper className={classes.paper}>
              <div style={{ width: "100%", maxWidth: 400 }}>
                <TextField name='email' label='Email' />
                <TextField name='password' label='Password' type='password' />
                <div>
                  <Button type='submit'>Submit</Button>
                </div>
              </div>
            </Paper>
          </form>
        )
      }}
    </Form>
  )
}

export default Login
