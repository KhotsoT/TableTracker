import { useState, useEffect } from 'react';
import { MapPin, Search, AlertTriangle, Clock, CheckCircle, Tablet, RefreshCw, X } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/select";
import { db, SCHOOL_ID } from '../config/firebase';
import { collection, query, getDocs, where, orderBy } from 'firebase/firestore';
import { toast } from "./ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

function DeviceTracking() {
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [devices, setDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const devicesRef = collection(db, 'schools', SCHOOL_ID, 'devices');
      const devicesQuery = query(devicesRef, orderBy('last_seen', 'desc'));
      const devicesSnap = await getDocs(devicesQuery);
      
      const devicesList = [];
      
      for (const deviceDoc of devicesSnap.docs) {
        const deviceData = deviceDoc.data();
        
        // Calculate device status based on last_seen timestamp
        const lastSeen = deviceData.last_seen?.toDate() || new Date(0);
        const timeDiff = Date.now() - lastSeen.getTime();
        const minutesDiff = Math.floor(timeDiff / (1000 * 60));
        
        let status = 'active';
        if (minutesDiff > 30) {
          status = 'offline';
        } else if (deviceData.is_outside_geofence) {
          status = 'alert';
        }

        devicesList.push({
          id: deviceDoc.id,
          device_id: deviceData.device_id,
          learner_name: deviceData.learner_name,
          grade: deviceData.grade,
          status: status,
          location: deviceData.location || 'Unknown',
          last_seen: lastSeen,
          imei: deviceData.imei,
          battery_level: deviceData.battery_level || 'Unknown',
          is_charging: deviceData.is_charging || false,
          is_outside_geofence: deviceData.is_outside_geofence || false,
          latitude: deviceData.latitude,
          longitude: deviceData.longitude
        });
      }

      setDevices(devicesList);
    } catch (error) {
      console.error('Error fetching devices:', error);
      setError('Failed to fetch devices: ' + error.message);
      toast({
        title: "Error",
        description: "Failed to fetch devices: " + error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredDevices = devices.filter(device => {
    const matchesSearch = searchQuery === '' || 
      device.device_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.learner_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.grade.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = selectedStatus === 'all' || device.status === selectedStatus;
    const matchesGrade = selectedGrade === 'all' || device.grade === selectedGrade;

    return matchesSearch && matchesStatus && matchesGrade;
  });

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

  const formatLastSeen = (date) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minutes ago`;
    if (hours < 24) return `${hours} hours ago`;
    if (days === 1) return 'Yesterday';
    return date.toLocaleDateString();
  };

  const getDeviceDetails = (device) => {
    const details = [];

    if (device.battery_level !== 'Unknown') {
      details.push(`Battery: ${device.battery_level}%${device.is_charging ? ' (Charging)' : ''}`);
    }

    if (device.location) {
      details.push(device.location);
    }

    if (device.is_outside_geofence) {
      details.push('⚠️ Outside school premises');
    }

    return details.join(' • ');
  };

  const getUniqueGrades = () => {
    const grades = new Set(devices.map(device => device.grade));
    return ['all', ...Array.from(grades).sort((a, b) => {
      // Extract numeric part for comparison
      const numA = parseInt(a.match(/\d+/)?.[0] || 0);
      const numB = parseInt(b.match(/\d+/)?.[0] || 0);
      if (numA !== numB) return numA - numB;
      return a.localeCompare(b);
    })];
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Device Tracking</h1>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            Active Devices: <span className="font-medium">{devices.filter(d => d.status === 'active').length}/{devices.length}</span>
          </div>
          <Button
            variant="secondary"
            onClick={fetchDevices}
            className="flex items-center gap-2 bg-white shadow-sm border border-gray-200"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search devices, learners or grades..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 w-full border-gray-200 focus:border-gray-300 focus:ring-gray-300"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 min-w-[200px]">
            <div className="relative">
              <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                <SelectTrigger className="flex items-center justify-between w-full sm:w-[200px] h-10 px-3 py-2 bg-white border border-gray-200 rounded-md text-sm text-gray-900 shadow-sm hover:bg-gray-50">
                  <SelectValue placeholder="All Grades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grades</SelectItem>
                  {getUniqueGrades().filter(grade => grade !== 'all').map(grade => (
                    <SelectItem key={grade} value={grade}>
                      Grade {grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="flex items-center justify-between w-full sm:w-[200px] h-10 px-3 py-2 bg-white border border-gray-200 rounded-md text-sm text-gray-900 shadow-sm hover:bg-gray-50">
                  <SelectValue placeholder="All Devices" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Devices</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="alert">Alert</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </Card>

      {/* Devices List */}
      <Card className="divide-y divide-gray-100">
        {filteredDevices.map((device) => (
          <div 
            key={device.id} 
            className="p-4 hover:bg-gray-50 cursor-pointer"
            onClick={() => setSelectedDevice(device)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <Tablet className="w-5 h-5 text-blue-500" />
                <div>
                  <h3 className="text-sm font-medium text-gray-900">{device.device_id}</h3>
                  <p className="text-sm text-gray-500">
                    {device.learner_name} - Grade {device.grade}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={getStatusBadge(device.status)}>
                  {device.status.charAt(0).toUpperCase() + device.status.slice(1)}
                </span>
                <Button 
                  variant="secondary" 
                  size="sm"
                  className="bg-white shadow-sm border border-gray-200 hover:bg-gray-50"
                >
                  Details
                </Button>
              </div>
            </div>
            <div className="ml-8 text-sm text-gray-500">
              <p>{getDeviceDetails(device)}</p>
              <p className="text-xs mt-1">Last seen: {formatLastSeen(device.last_seen)}</p>
            </div>
          </div>
        ))}
        {filteredDevices.length === 0 && (
          <div className="p-8 text-center">
            <Tablet className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No devices found</p>
          </div>
        )}
      </Card>

      {/* Device Details Dialog */}
      {selectedDevice && (
        <Dialog open={!!selectedDevice} onOpenChange={() => setSelectedDevice(null)}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Device Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Device ID</p>
                  <p className="text-base text-gray-900">{selectedDevice.device_id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">IMEI</p>
                  <p className="text-base text-gray-900">{selectedDevice.imei}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Learner</p>
                  <p className="text-base text-gray-900">{selectedDevice.learner_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Grade</p>
                  <p className="text-base text-gray-900">{selectedDevice.grade}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500">Status</p>
                <div className="flex items-center gap-2 mt-1">
                  {getStatusIcon(selectedDevice.status)}
                  <span className={getStatusBadge(selectedDevice.status)}>
                    {selectedDevice.status.charAt(0).toUpperCase() + selectedDevice.status.slice(1)}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500">Battery Status</p>
                <p className="text-base text-gray-900">
                  {selectedDevice.battery_level === 'Unknown' ? 
                    'Unknown' : 
                    `${selectedDevice.battery_level}%${selectedDevice.is_charging ? ' (Charging)' : ''}`
                  }
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500">Location</p>
                <p className="text-base text-gray-900">{selectedDevice.location || 'Unknown'}</p>
                {selectedDevice.latitude && selectedDevice.longitude && (
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedDevice.latitude}, {selectedDevice.longitude}
                  </p>
                )}
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500">Last Seen</p>
                <p className="text-base text-gray-900">
                  {selectedDevice.last_seen ? selectedDevice.last_seen.toLocaleString() : 'Never'}
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

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