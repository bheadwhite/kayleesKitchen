import React, { useState } from "react"
import { Menu as MUIMenu, IconButton, makeStyles, MenuItem } from "@material-ui/core"
import { Menu as MenuIcon } from "@material-ui/icons"
import useAuth from "hooks/useAuth"
import { signOut } from "fire/services"
import { withRouter } from "react-router-dom"

const useStyles = makeStyles((theme) => ({
  menuButton: {},
}))

const Menu = (props) => {
  const classes = useStyles()
  const [anchorEl, setAnchorEl] = useState(null)
  const [open, setOpen] = useState(false)
  const { user } = useAuth()

  const handleOpen = (e) => {
    anchorEl == null && e.target != null ? setAnchorEl(e.target) : setAnchorEl(null)
    setOpen((a) => !a)
  }
  const handleLogin = () => {
    handleOpen()
    props.history.push("/login")
  }

  const handleSignOut = () => {
    handleOpen()
    signOut()
      .then(props.history.push("/login"))
      .catch((e) => console.log(e))
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
        {user == null && <MenuItem onClick={handleLogin}>Login</MenuItem>}
        {user != null && <MenuItem onClick={handleSignOut}>Signout</MenuItem>}
      </MUIMenu>
    </React.Fragment>
  )
}

export default withRouter(Menu)
