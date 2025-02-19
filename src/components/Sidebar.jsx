import { Link, useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../config/firebase';
import { signOut } from 'firebase/auth';
import { 
  LogOut, 
  Home,
  Users, 
  MessageSquare, 
  MapPin 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <div className="fixed top-0 left-0 w-64 h-full bg-white border-r shadow-sm z-10">
      {/* Header/Logo Section */}
      <div className="h-16 flex items-center px-6 border-b bg-white">
        <h1 className="text-xl font-bold text-gray-900">SchoolConnect</h1>
      </div>
      
      {/* Navigation Section */}
      <div className="p-4">
        <nav className="space-y-1">
          <Link 
            to="/dashboard" 
            className={cn(
              "flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors",
              location.pathname === "/dashboard" 
                ? "bg-blue-50 text-blue-600" 
                : "text-gray-700 hover:bg-gray-50"
            )}
          >
            <Home className="w-5 h-5" />
            <span>Dashboard</span>
          </Link>
          <Link 
            to="/contacts"
            className={cn(
              "flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors",
              location.pathname === "/contacts" 
                ? "bg-blue-50 text-blue-600" 
                : "text-gray-700 hover:bg-gray-50"
            )}
          >
            <Users className="w-5 h-5" />
            <span>Contacts</span>
          </Link>
          <Link 
            to="/messages"
            className={cn(
              "flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors",
              location.pathname === "/messages" 
                ? "bg-blue-50 text-blue-600" 
                : "text-gray-700 hover:bg-gray-50"
            )}
          >
            <MessageSquare className="w-5 h-5" />
            <span>Messages</span>
          </Link>
          <Link 
            to="/tracking"
            className={cn(
              "flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors",
              location.pathname === "/tracking" 
                ? "bg-blue-50 text-blue-600" 
                : "text-gray-700 hover:bg-gray-50"
            )}
          >
            <MapPin className="w-5 h-5" />
            <span>Tracking</span>
          </Link>
        </nav>
      </div>
      
      {/* Footer/Logout Section */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-white">
        <button
          onClick={handleLogout}
          className="flex items-center justify-center w-full gap-2 px-4 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}

export default Sidebar; 