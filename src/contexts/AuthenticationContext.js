import React from "react"
import Authentication from "logic/Authentication"
import MockFirebaseAuth from "logic/MockFireBaseAuth"

export default React.createContext(new Authentication(new MockFirebaseAuth()))
