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
  const handleRecipe = () => {
    handleOpen()
    props.history.push("/recipes")
  }
  const handleCreateRecipe = () => {
    handleOpen()
    props.history.push("/recipes/new")
  }

  const handleSignOut = () => {
    handleOpen()
    signOut()
      .then(props.history.push("/login"))
      .catch((e) => console.log(e))
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
      {user == null ? (
        <CleanMenu>
          <MenuItem onClick={handleLogin}>Login</MenuItem>
        </CleanMenu>
      ) : (
        <CleanMenu>
          <MenuItem onClick={handleCreateRecipe}>Create New Recipe</MenuItem>
          <MenuItem onClick={handleRecipe}>Recipes</MenuItem>
          <MenuItem onClick={handleSignOut}>Signout</MenuItem>
        </CleanMenu>
      )}
    </React.Fragment>
  )
}

export default withRouter(Menu)
