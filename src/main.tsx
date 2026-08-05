import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"

import App from "./App"
import AuthProvider from "contexts/AuthProvider"
import RecipeProvider from "contexts/RecipeProvider"
import "react-toastify/dist/ReactToastify.css"
import "./index.css"

const container = document.getElementById("root")
if (!container) throw new Error("Missing #root element")

createRoot(container).render(
  <StrictMode>
    <AuthProvider>
      <RecipeProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </RecipeProvider>
    </AuthProvider>
  </StrictMode>
)
