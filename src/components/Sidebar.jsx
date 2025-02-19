import { Link, useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../config/firebase';
import { signOut } from 'firebase/auth';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <div className="w-64 bg-white border-r min-h-screen p-6">
      <div className="flex flex-col h-full">
        <h1 className="text-xl font-bold mb-8">TabletTracker</h1>
        
        <nav className="space-y-2 flex-1">
          <Link 
            to="/"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors",
              location.pathname === "/" && "bg-blue-50 text-blue-600"
            )}
          >
            <span className="text-sm">Dashboard</span>
          </Link>
          <Link 
            to="/contacts"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors",
              location.pathname === "/contacts" && "bg-blue-50 text-blue-600"
            )}
          >
            <span className="text-sm">Contacts</span>
          </Link>
          <Link 
            to="/messages"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors",
              location.pathname === "/messages" && "bg-blue-50 text-blue-600"
            )}
          >
            <span className="text-sm">Messages</span>
          </Link>
          <Link 
            to="/tracking"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors",
              location.pathname === "/tracking" && "bg-blue-50 text-blue-600"
            )}
          >
            <span className="text-sm">Tracking</span>
          </Link>
        </nav>

        <Link
          to="/logout"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors mt-auto"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm">Logout</span>
        </Link>
      </div>
    </div>
  );
}

export default Sidebar; 