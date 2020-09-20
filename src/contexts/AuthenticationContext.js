import React from "react"
import Auth from "controllers/Auth"
import MockFirebaseAuth from "logic/MockFireBaseAuth"

export default React.createContext(new Auth(new MockFirebaseAuth()))
