import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Disable browser context menu everywhere
document.addEventListener('contextmenu', e => e.preventDefault())

// Disable drag
document.addEventListener('dragstart', e => e.preventDefault())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
