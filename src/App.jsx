import { BrowserRouter as Router } from 'react-router-dom'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { getAuth, signOut } from 'firebase/auth'
import { useEffect, useState } from 'react'
import Dashboard from './components/Dashboard'
import Messages from './components/Messages'
import Contacts from './components/Contacts'
import DeviceTracking from './components/DeviceTracking'
import Settings from './components/Settings'
import Sidebar from './components/Sidebar'
import Login from './components/Login'
import './App.css'
import { Toaster } from "sonner"

// TODO: Re-enable device tracking route when MDM integration is complete
// Steps to re-enable:
// 1. Uncomment the tracking route below
// 2. Test the tracking functionality
// 3. Remove this TODO comment

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const auth = getAuth()
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAuthenticated(!!user)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const handleLogout = async () => {
    const auth = getAuth()
    try {
      await signOut(auth)
      setIsAuthenticated(false)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <>
      <Toaster />
      <Router>
        <div className="flex min-h-screen bg-gray-100 overflow-x-hidden">
          {isAuthenticated && <Sidebar onLogout={handleLogout} />}
          <main className={`flex-1 ${isAuthenticated ? 'ml-64' : ''} w-full`}>
            <Routes>
              <Route path="/login" element={
                !isAuthenticated ? <Login /> : <Navigate to="/dashboard" replace />
              } />
              <Route path="/" element={
                isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
              } />
              {/* Protected Routes */}
              {isAuthenticated ? (
                <>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/contacts" element={<Contacts />} />
                  <Route path="/messages" element={<Messages />} />
                  {/* Temporarily disabled tracking route */}
                  {/* <Route path="/tracking" element={<DeviceTracking />} /> */}
                </>
              ) : (
                <Route path="*" element={<Navigate to="/login" replace />} />
              )}
            </Routes>
          </main>
        </div>
      </Router>
    </>
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
