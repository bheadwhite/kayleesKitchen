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
  dangerButton: {
    margin: theme.spacing(1, 1, 0, 0),
    background: theme.palette.baseColors.red,
    color: theme.palette.baseColors.white,
    border: "none",
    textTransform: "none",
    "&:hover": {
      color: theme.palette.baseColors.red,
    },
  },
}))

interface IDangerProps {
  children?: React.ReactNode
}

const DangerButton: React.FC<IDangerProps> = ({ children, ...props }) => {
  const classes = useStyles()
  return (
    <MUIButton {...props} className={classes.dangerButton}>
      {children}
    </MUIButton>
  )
}

interface IProps {
  children?: React.ReactNode
  danger?: boolean
  style?: React.CSSProperties
  onClick?: () => void
}

const Button: React.FC<IProps> = ({ children, ...props }) => {
  const classes = useStyles()
  if (props.danger) {
    return <DangerButton {...props}>{children}</DangerButton>
  }
  return (
    <MUIButton className={classes.button} {...props}>
      {children}
    </MUIButton>
  )
}

export default Button
