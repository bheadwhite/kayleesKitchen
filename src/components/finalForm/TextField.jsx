import React from "react"
import { useForm } from "react-final-form"
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
  const handleChange = (e) => change(props.name, e.target.value)
  return (
    <div>
      <MUITextField
        variant='outlined'
        fullWidth={true}
        onChange={handleChange}
        className={classes.textField}
        {...props}
      />
    </div>
  )
}

export default TextField
