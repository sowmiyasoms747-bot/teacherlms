import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@fontsource-variable/bricolage-grotesque/index.css'
import '@fontsource-variable/instrument-sans/index.css'
import './styles.css'
import { StoreProvider } from './store'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <HashRouter><StoreProvider><App /></StoreProvider></HashRouter>,
)
