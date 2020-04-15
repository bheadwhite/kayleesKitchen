import React from "react"
import { Button as MUIButton, makeStyles } from "@material-ui/core"

const useStyles = makeStyles((theme) => ({
  button: {
    margin: theme.spacing(1, 1, 0, 0),
    border: `1px solid ${theme.palette.baseColors.grayBorder}`,
  },
}))

const Button = ({ children, ...props }) => {
  const classes = useStyles()
  return (
    <MUIButton className={classes.button} {...props}>
      {children}
    </MUIButton>
  )
}

export default Button
