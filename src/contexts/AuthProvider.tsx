import { useMemo } from "react";
import { AuthContext } from "src/contexts/auth_context";
import MockFirebaseAuth from "src/logic/MockFireBaseAuth";

const AuthProvider = ({ auth, children }) => {
  const authentication = useMemo(() => {
    if (auth) {
      return auth;
    } else {
      return new MockFirebaseAuth();
    }
  }, [auth]);

  return (
    <AuthContext.Provider value={authentication}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
