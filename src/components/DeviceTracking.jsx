import { useState, useEffect } from 'react';
import { MapPin, Search, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/select";

function DeviceTracking() {
  const [selectedDevice, setSelectedDevice] = useState('');
  const [devices, setDevices] = useState([
    { id: 'iPad-2389', student: 'John Smith', grade: '11A', status: 'alert', location: 'Outside School Premises', lastSeen: '2 minutes ago' },
    { id: 'iPad-1578', student: 'Mary Johnson', grade: '10B', status: 'active', location: 'Library', lastSeen: '1 minute ago' },
    { id: 'iPad-3642', student: 'David Brown', grade: '12C', status: 'offline', location: 'Last seen: Classroom 12C', lastSeen: '15 minutes ago' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDevices = devices.filter(device => 
    device.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    device.student.toLowerCase().includes(searchQuery.toLowerCase()) ||
    device.grade.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'alert':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'offline':
        return <Clock className="w-4 h-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      alert: 'bg-red-100 text-red-800',
      offline: 'bg-gray-100 text-gray-800'
    };
    return `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`;
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Device Tracking</h1>
        <div className="text-sm text-gray-600">
          Total Devices: <span className="font-medium">{devices.length}</span>
        </div>
      </div>

      {/* Search and Filter */}
      <Card className="p-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search devices, students or grades..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Select value={selectedDevice} onValueChange={setSelectedDevice}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Devices</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="alert">Alert</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Devices List */}
      <Card className="divide-y divide-gray-100">
        {filteredDevices.map((device) => (
          <div key={device.id} className="p-4 hover:bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-blue-500" />
                <div>
                  <h3 className="text-sm font-medium text-gray-900">{device.id}</h3>
                  <p className="text-sm text-gray-500">
                    {device.student} - Grade {device.grade}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={getStatusBadge(device.status)}>
                  {device.status.charAt(0).toUpperCase() + device.status.slice(1)}
                </span>
                <Button variant="outline" size="sm">
                  Track
                </Button>
              </div>
            </div>
            <div className="ml-8 text-sm text-gray-500">
              <p>{device.location}</p>
              <p className="text-xs">Last updated: {device.lastSeen}</p>
            </div>
          </div>
        ))}
        {filteredDevices.length === 0 && (
          <div className="p-8 text-center">
            <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No devices found</p>
          </div>
        )}
      </Card>

      {isLoading && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            Loading...
          </div>
        </div>
      )}
    </div>
  );
}

export default DeviceTracking; 