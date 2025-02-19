import { BrowserRouter as Router } from 'react-router-dom'
import Navigation from './components/Navigation'
import AppRoutes from './routes'

function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-gray-50">
        <div className="w-64 border-r border-gray-200">
          <Navigation />
        </div>
        <div className="flex-1">
          <AppRoutes />
        </div>
      </div>
    </Router>
  )
}

export default App
