import React from "react"
import { useForm, useField } from "react-final-form"
import { makeStyles } from "@material-ui/core"
import ReactSelect from "react-select"

const useStyles = makeStyles((theme) => ({
  select: {},
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
    <ReactSelect
      error={error && touched}
      variant='outlined'
      fullWidth={true}
      autoComplete={props.name}
      onBlur={(e) => onBlur(e)}
      onFocus={onFocus}
      onChange={handleChange}
      className={classes.select}
      {...props}
    />
  )
}

export default TextField
