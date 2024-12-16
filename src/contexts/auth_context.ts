import React from "react";
import Auth from "src/controllers/Auth";
import MockFirebaseAuth from "src/logic/MockFireBaseAuth";

export const AuthContext = React.createContext(
  new Auth(new MockFirebaseAuth()),
);
