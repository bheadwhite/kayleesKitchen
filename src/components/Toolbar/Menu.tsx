import React, { useState } from "react";
import {
  Menu as MUIMenu,
  IconButton,
  makeStyles,
  MenuItem,
} from "@material-ui/core";
import { Menu as MenuIcon } from "@material-ui/icons";
import useAuth from "src/controllers/Auth/useAuth";
import { toast } from "react-toastify";
import useAuthState from "src/controllers/Auth/useAuthState";
import { useNavigate } from "react-router-dom";

const useStyles = makeStyles(() => ({
  menuButton: {},
}));

const Menu = () => {
  const authState = useAuthState();
  const classes = useStyles();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const auth = useAuth();
  const navigate = useNavigate();

  const handleOpen = (e?: React.ChangeEvent<HTMLElement>) => {
    if (e?.target != null && anchorEl != null) {
      setAnchorEl(e.target);
    } else {
      setAnchorEl(null);
    }

    setOpen((a) => !a);
  };

  const goTo = (location) => {
    handleOpen();
    navigate(location);
  };
  const handleLogin = () => goTo("/login");
  const handleRecipe = () => goTo("/recipes");
  const handleCreateRecipe = () => goTo("/recipes/new");

  const handleSignOut = () => {
    auth
      .logOut()
      .then(() => goTo("/login"))
      .catch((e) => toast.error(e));
  };

  const CleanMenu = ({ children }) => (
    <MUIMenu
      id="menu-appbar"
      anchorEl={anchorEl}
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "right",
      }}
      keepMounted
      open={open}
      getContentAnchorEl={null}
      onClose={() => handleOpen()}
    >
      {children}
    </MUIMenu>
  );

  return (
    <React.Fragment>
      <IconButton
        edge="end"
        className={classes.menuButton}
        color="inherit"
        aria-label="menu"
        onClick={() => handleOpen()}
      >
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
  );
};

export default Menu;
