import { Analytics } from '@vercel/analytics/react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { TooltipProvider } from '@/components/ui/tooltip'
import './index.css'

createRoot(document.getElementById('root')).render(<TooltipProvider><App />{import.meta.env.VITE_HOSTED === 'true' && <Analytics />}</TooltipProvider>)
