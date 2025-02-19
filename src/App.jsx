import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
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
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/logout" element={<Navigate to="/" />} />
        <Route
          path="/dashboard/*"
          element={
            <PrivateLayout>
              <Routes>
                <Route path="" element={<Dashboard />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/contacts" element={<Contacts />} />
                <Route path="/tracking" element={<DeviceTracking />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </PrivateLayout>
          }
        />
      </Routes>
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
