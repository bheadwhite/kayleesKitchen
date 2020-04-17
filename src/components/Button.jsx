import React from "react"
import { Button as MUIButton, makeStyles } from "@material-ui/core"

const useStyles = makeStyles((theme) => ({
  button: {
    margin: theme.spacing(1, 1, 0, 0),
    background: theme.palette.baseColors.blue,
    color: theme.palette.baseColors.white,
    border: "none",
    textTransform: "none",
    "&:hover": {
      color: theme.palette.baseColors.blue,
    },
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
