import { Link, useLocation } from 'react-router-dom';
import { Home, Users, MessageSquare, Calendar, LogOut } from 'lucide-react';

function Navigation() {
  const location = useLocation();
  
  return (
    <div className="flex flex-col h-screen bg-white">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">TabletTracker</h1>
      </div>
      
      <div className="flex-1 space-y-1 px-3">
        <NavLink 
          to="/" 
          icon={<Home className="w-5 h-5" />} 
          label="Dashboard" 
        />
        <NavLink 
          to="/contacts" 
          icon={<Users className="w-5 h-5" />} 
          label="Contacts" 
        />
        <NavLink 
          to="/messages" 
          icon={<MessageSquare className="w-5 h-5" />} 
          label="Messages" 
        />
        <NavLink 
          to="/tracking" 
          icon={<Calendar className="w-5 h-5" />} 
          label="Tracking" 
        />
      </div>

      <div className="p-3">
        <Link
          to="/logout"
          className="flex items-center text-red-500 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-5 h-5 mr-3" />
          <span>Logout</span>
        </Link>
      </div>
    </div>
  );
}

// Helper component for nav links
function NavLink({ to, icon, label }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link
      to={to}
      className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
        isActive 
          ? 'bg-blue-50 text-blue-600' 
          : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      <span className="mr-3">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

export default Navigation; 