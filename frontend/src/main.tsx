import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './functional.css'

const Study = import.meta.env.VITE_STUDY_MODE === 'true' ? lazy(() => import('./study/Study')) : null

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    {Study && <Suspense fallback={null}><Study /></Suspense>}
  </React.StrictMode>,
)
