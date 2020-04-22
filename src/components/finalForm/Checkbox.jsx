import React from "react"
import { useForm, useField } from "react-final-form"
import { Checkbox as MUICheckbox, makeStyles } from "@material-ui/core"

const useStyles = makeStyles((theme) => ({
  checkbox: {},
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
  const handleChange = (e) => {
    console.log("hit =>", e.target.checked)
    change(props.name, e.target.checked)
  }

  return (
    <React.Fragment>
      {props.label && <label>{props.label}:</label>}
      <MUICheckbox
        error={error && touched}
        autoComplete={props.name}
        onBlur={(e) => onBlur(e)}
        onFocus={onFocus}
        onChange={handleChange}
        className={classes.checkbox}
        {...props}
      />
    </React.Fragment>
  )
}

export default TextField
