import React, { useState } from "react"
import {
  Menu as MUIMenu,
  IconButton,
  makeStyles,
  MenuItem,
} from "@material-ui/core"
import { Menu as MenuIcon } from "@material-ui/icons"
import useAuth from "controllers/Auth/useAuth"
import { toast } from "react-toastify"
import useAuthState from "controllers/Auth/useAuthState"
import { useHistory } from "react-router-dom"

const useStyles = makeStyles((theme) => ({
  menuButton: {},
}))

const Menu = (props) => {
  const authState = useAuthState()
  const classes = useStyles()
  const [anchorEl, setAnchorEl] = useState(null)
  const [open, setOpen] = useState(false)
  const auth = useAuth()
  const history = useHistory()

  const handleOpen = (e) => {
    anchorEl == null && e.target != null
      ? setAnchorEl(e.target)
      : setAnchorEl(null)
    setOpen((a) => !a)
  }
  const goTo = (location) => {
    handleOpen()
    history.push(location)
  }
  const handleLogin = () => goTo("/login")
  const handleRecipe = () => goTo("/recipes")
  const handleCreateRecipe = () => goTo("/recipes/new")

  const handleSignOut = () => {
    auth
      .logOut()
      .then(() => goTo("/login"))
      .catch((e) => toast.error(e))
  }

  const CleanMenu = ({ children }) => (
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
      {children}
    </MUIMenu>
  )

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
      {authState !== "loggedIn" ? (
        <CleanMenu>
          <MenuItem onClick={handleLogin}>Login</MenuItem>
        </CleanMenu>
      ) : (
        <CleanMenu>
          <MenuItem onClick={handleCreateRecipe}>Recipe Editor</MenuItem>
          <MenuItem onClick={handleRecipe}>Recipes</MenuItem>
          <MenuItem onClick={handleSignOut}>Signout</MenuItem>
        </CleanMenu>
      )}
    </React.Fragment>
  )
}

export default Menu
