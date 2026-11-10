import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Keypad } from './ui/Keypad'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Keypad />
  </StrictMode>,
)
