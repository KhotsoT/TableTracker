import { BrowserRouter as Router } from 'react-router-dom'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { getAuth, signOut } from 'firebase/auth'
import { useEffect } from 'react'
import Dashboard from './components/Dashboard'
import Messages from './components/Messages'
import Contacts from './components/Contacts'
import DeviceTracking from './components/DeviceTracking'
import Settings from './components/Settings'
import Sidebar from './components/Sidebar'
import Login from './components/Login'
import './App.css'

function App() {
  const handleLogout = async () => {
    const auth = getAuth()
    try {
      await signOut(auth)
      window.location.href = '/'
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <Router>
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <main className="flex-1 overflow-y-auto ml-64">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/tracking" element={<DeviceTracking />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

// Private layout component with authentication check
function PrivateLayout({ children }) {
  const auth = getAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        navigate('/login');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}

export default App
