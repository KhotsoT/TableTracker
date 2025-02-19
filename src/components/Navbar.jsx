import { Link } from 'react-router-dom'
import { auth } from '../config/firebase'
import { useNavigate } from 'react-router-dom'
import { FaHome, FaAddressBook, FaEnvelope, FaMapMarkerAlt, FaSignOutAlt } from 'react-icons/fa'

function Navbar() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await auth.signOut()
      navigate('/')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <h1>TabletTracker</h1>
      </div>
      <ul className="nav-links">
        <li>
          <Link to="/dashboard">
            <FaHome className="nav-icon" />
            <span className="nav-text">Dashboard</span>
          </Link>
        </li>
        <li>
          <Link to="/contacts">
            <FaAddressBook className="nav-icon" />
            <span className="nav-text">Contacts</span>
          </Link>
        </li>
        <li>
          <Link to="/messages">
            <FaEnvelope className="nav-icon" />
            <span className="nav-text">Messages</span>
          </Link>
        </li>
        <li>
          <Link to="/tracking">
            <FaMapMarkerAlt className="nav-icon" />
            <span className="nav-text">Tracking</span>
          </Link>
        </li>
        <li>
          <button onClick={handleLogout} className="logout-btn">
            <FaSignOutAlt className="nav-icon" />
            <span className="nav-text">Logout</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}

export default Navbar 