import React, { useState } from "react"
import { Menu as MUIMenu, IconButton, makeStyles, MenuItem } from "@material-ui/core"
import { Menu as MenuIcon } from "@material-ui/icons"
import { withRouter } from "react-router-dom"

const useStyles = makeStyles((theme) => ({
  menuButton: {},
}))

const Menu = (props) => {
  const classes = useStyles()
  const [anchorEl, setAnchorEl] = useState(null)
  const [open, setOpen] = useState(false)

  const handleOpen = (e) => {
    anchorEl == null && e.target != null ? setAnchorEl(e.target) : setAnchorEl(null)
    setOpen((a) => !a)
  }
  const handleLogin = () => {
    handleOpen()
    props.history.push("/login")
  }

  return (
    <React.Fragment>
      <IconButton
        edge='end'
        className={classes.menuButton}
        color='inherit'
        aria-label='menu'
        onClick={handleOpen}>
        <MenuIcon />
      </IconButton>
      <MUIMenu
        id='menu-appbar'
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        keepMounted
        open={open}
        getContentAnchorEl={null}
        onClose={handleOpen}>
        <MenuItem onClick={handleLogin}>Login</MenuItem>
      </MUIMenu>
    </React.Fragment>
  )
}

export default withRouter(Menu)
