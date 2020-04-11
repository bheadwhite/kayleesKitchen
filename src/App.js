import React from "react"
import { Switch, Route } from "react-router-dom"
import Home from "./Home"
import "./App.css"

function App() {
  return (
    <div className='Kays Kitchen'>
      <header></header>
      <Switch>
        <Route path='/' exact component={Home} />
      </Switch>
    </div>
  )
}

export default App
