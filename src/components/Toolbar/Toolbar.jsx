import React from "react"
import { makeStyles } from "@material-ui/core/styles"
import AppBar from "@material-ui/core/AppBar"
import MUIToolbar from "@material-ui/core/Toolbar"
import Typography from "@material-ui/core/Typography"
import Menu from "./Menu"

const useStyles = makeStyles((theme) => ({
  appBar: {
    flexGrow: 1,
    marginBottom: theme.spacing(2),
  },
  title: {
    flexGrow: 1,
  },
}))

export default function Toolbar() {
  const classes = useStyles()

  return (
    <AppBar position='static' className={classes.appBar}>
      <MUIToolbar>
        <Typography variant='h6' className={classes.title}>
          My Kitchen App
        </Typography>
        <Menu />
      </MUIToolbar>
    </AppBar>
  )
}
