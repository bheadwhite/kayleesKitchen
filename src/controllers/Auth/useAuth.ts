import { useContext } from "react";
import { AuthContext } from "src/contexts/auth_context";

export default () => {
  return useContext(AuthContext);
};
