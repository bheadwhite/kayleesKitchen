import React from "react"
import { useForm, useField } from "react-final-form"
import { TextField as MUITextField, makeStyles } from "@material-ui/core"

const useStyles = makeStyles((theme) => ({
  textField: {
    maxWidth: 380,
    margin: theme.spacing(1, 0),
    "& input": {
      padding: theme.spacing(3),
    },
    "& label": {
      transform: "translate(14px, 18px) scale(1)",
    },
  },
}))

const TextField = (props) => {
  const classes = useStyles()
  const { change } = useForm()
  const {
    input: { onFocus, onBlur },
    meta: { touched, error },
  } = useField(props.name, {
    subscription: { touched: true, error: true, value: true },
  })
  const handleChange = (e) => change(props.name, e.target.value)

  return (
    <div>
      <MUITextField
        error={error && touched}
        variant='outlined'
        fullWidth={true}
        autoComplete={props.name}
        onBlur={(e) => onBlur(e)}
        onFocus={onFocus}
        onChange={handleChange}
        className={classes.textField}
        {...props}
      />
    </div>
  )
}

export default TextField
