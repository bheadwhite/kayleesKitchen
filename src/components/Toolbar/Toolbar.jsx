import React from "react"
import { makeStyles } from "@material-ui/core/styles"
import AppBar from "@material-ui/core/AppBar"
import MUIToolbar from "@material-ui/core/Toolbar"
import Typography from "@material-ui/core/Typography"
import Menu from "./Menu"

const useStyles = makeStyles((theme) => ({
  root: {
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
    <div className={classes.root}>
      <AppBar position='static'>
        <MUIToolbar>
          <Typography variant='h6' className={classes.title}>
            My Kitchen App
          </Typography>
          <Menu />
        </MUIToolbar>
      </AppBar>
    </div>
  )
}
