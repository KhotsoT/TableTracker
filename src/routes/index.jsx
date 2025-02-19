import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from '../components/Dashboard';
import Contacts from '../components/Contacts';
import Messages from '../components/Messages';
import DeviceTracking from '../components/DeviceTracking';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/contacts" element={<Contacts />} />
      <Route path="/messages" element={<Messages />} />
      <Route path="/tracking" element={<DeviceTracking />} />
      {/* Redirect any unknown routes to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRoutes; 