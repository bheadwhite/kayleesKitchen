import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"

import App from "./App"
import AiDraftProvider from "contexts/AiDraftProvider"
import AuthProvider from "contexts/AuthProvider"
import ChefProvider from "contexts/ChefProvider"
import PlannerProvider from "contexts/PlannerProvider"
import RecipeProvider from "contexts/RecipeProvider"
import "react-toastify/dist/ReactToastify.css"
import "./index.css"
import { registerServiceWorker } from "./pwa"

const container = document.getElementById("root")
if (!container) throw new Error("Missing #root element")

createRoot(container).render(
  <StrictMode>
    <AuthProvider>
      <RecipeProvider>
        <AiDraftProvider>
          <ChefProvider>
            <PlannerProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </PlannerProvider>
          </ChefProvider>
        </AiDraftProvider>
      </RecipeProvider>
    </AuthProvider>
  </StrictMode>
)

registerServiceWorker()
