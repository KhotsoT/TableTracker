import { useState, useEffect } from 'react';
import { MapPin, Search, AlertTriangle, Clock, CheckCircle, Tablet, RefreshCw, X, Battery, Wifi } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/select";
import { db, SCHOOL_ID } from '../config/firebase';
import { collection, query, getDocs, where, orderBy, onSnapshot, doc, limit, setDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from "./ui/use-toast";
import { startDeviceMonitoring, getCurrentDeviceStatus, ACCURACY_LEVELS } from '../services/deviceService';
import { SCHOOL_CONFIG } from '../config/school';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

// Add LocationStatus component
const LocationStatus = () => {
  const [permissionStatus, setPermissionStatus] = useState('checking');
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkPermission = async () => {
      try {
        // Check if geolocation is supported
        if (!navigator.geolocation) {
          setError('Geolocation is not supported by your browser');
          return;
        }

        // Check permission status
        if (navigator.permissions) {
          const result = await navigator.permissions.query({ name: 'geolocation' });
          setPermissionStatus(result.state);

          // Listen for changes
          result.addEventListener('change', () => {
            setPermissionStatus(result.state);
          });
        }

        // Test getting location
        navigator.geolocation.getCurrentPosition(
          () => setPermissionStatus('granted'),
          (error) => {
            console.error('Geolocation error:', error);
            if (error.code === 1) {
              setPermissionStatus('denied');
            } else if (error.code === 2) {
              setError('Location is not available');
            } else if (error.code === 3) {
              setError('Location request timed out');
            }
          }
        );
      } catch (err) {
        console.error('Permission check error:', err);
        setError(err.message);
      }
    };

    checkPermission();
  }, []);

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
        <AlertTriangle className="w-5 h-5" />
        <div>
          <p className="font-medium">Location Error</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (permissionStatus === 'denied') {
    return (
      <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          <p className="font-medium">Location Access Required</p>
        </div>
        <p className="mt-2 text-sm">
          This app needs location access to track devices. Please enable location access:
        </p>
        <ol className="mt-2 text-sm list-decimal list-inside">
          <li>Click the lock/info icon (🔒) in your browser's address bar</li>
          <li>Click on "Site settings" or "Permissions"</li>
          <li>Find "Location" and change it to "Allow"</li>
          <li>Refresh the page</li>
        </ol>
      </div>
    );
  }

  if (permissionStatus === 'prompt') {
    return (
      <div className="bg-blue-50 text-blue-800 p-4 rounded-lg flex items-center gap-2">
        <MapPin className="w-5 h-5" />
        <p>Please allow location access when prompted to enable device tracking.</p>
      </div>
    );
  }

  return null;
};

// Add this helper for position smoothing
const smoothPosition = (() => {
  const positions = [];
  const MAX_POSITIONS = 5;

  return (newPosition) => {
    positions.push(newPosition);
    if (positions.length > MAX_POSITIONS) {
      positions.shift();
    }

    // Calculate weighted average, giving more weight to newer positions
    const totalWeight = positions.reduce((sum, _, index) => sum + (index + 1), 0);
    const smoothed = positions.reduce((acc, pos, index) => {
      const weight = (index + 1) / totalWeight;
      return {
        latitude: acc.latitude + (pos.latitude * weight),
        longitude: acc.longitude + (pos.longitude * weight)
      };
    }, { latitude: 0, longitude: 0 });

    return smoothed;
  };
})();

function DeviceTracking() {
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [devices, setDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [error, setError] = useState(null);

  const addTestDevice = async () => {
    try {
      console.log('Starting addTestDevice process...');
      
      // Get current device status
      console.log('Fetching current device status...');
      const deviceStatus = await getCurrentDeviceStatus();
      console.log('Received device status:', deviceStatus);
      
      // Create device data with default values
      const deviceData = {
        // Core device info - only these are required for device identification
        device_id: 'iPad-002',
        learner_name: 'Lintle',
        grade: '12B',
        imei: '355088376177131',
        last_seen: serverTimestamp(),
        
        // Status information - with defaults
        battery_level: deviceStatus.batteryLevel || 0,
        is_charging: Boolean(deviceStatus.isCharging),
        is_outside_geofence: false, // Explicitly set default
        location: deviceStatus.location || 'Unknown',
        network_type: deviceStatus.networkType || 'unknown',
        signal_strength: deviceStatus.signalStrength || 0,
        
        // Location data - only include if present
        ...(deviceStatus.latitude && deviceStatus.longitude ? {
          latitude: deviceStatus.latitude,
          longitude: deviceStatus.longitude,
          accuracy: deviceStatus.accuracy || 0
        } : {}),
        
        // Device capabilities - with defaults
        webgl_support: Boolean(deviceStatus.webgl_support),
        canvas_support: Boolean(deviceStatus.canvas_support),
        local_storage: Boolean(deviceStatus.local_storage),
        session_storage: Boolean(deviceStatus.session_storage),
        
        // Browser details - with defaults
        user_agent: deviceStatus.user_agent || 'unknown',
        platform: deviceStatus.platform || 'unknown',
        language: deviceStatus.language || 'unknown',
        
        // Screen information - only include if present
        ...(deviceStatus.screen_width && deviceStatus.screen_height ? {
          screen_width: deviceStatus.screen_width,
          screen_height: deviceStatus.screen_height,
          color_depth: deviceStatus.color_depth || 0,
          pixel_ratio: deviceStatus.pixel_ratio || 1
        } : {}),
        
        // Connection details - with defaults
        connection_type: deviceStatus.connection_type || 'unknown',
        effective_type: deviceStatus.effective_type || 'unknown',
        downlink: deviceStatus.downlink || 0,
        rtt: deviceStatus.rtt || 0,
        
        // Device status metadata
        _device_status: {
          timestamp: serverTimestamp(),
          status: 'active',
          message: 'Test device added successfully'
        }
      };

      console.log('Adding device to Firestore with data:', deviceData);
      
      // Add device to Firestore
      const deviceRef = doc(db, 'schools', SCHOOL_ID, 'devices', deviceData.device_id);
      await setDoc(deviceRef, deviceData);
      
      console.log('Device added successfully');
      
      toast({
        title: "Success",
        description: "Test device added successfully",
        variant: "default"
      });

      // Start monitoring the device
      const stopMonitoring = startDeviceMonitoring(deviceData);
      window.deviceMonitoringCleanup = stopMonitoring;
      
    } catch (error) {
      console.error('Error in addTestDevice:', error);
      console.log('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      toast({
        title: "Error",
        description: "Failed to add test device: " + error.message,
        variant: "destructive"
      });
    }
  };

  const refreshDevice = async () => {
    try {
      setIsLoading(true);
      const deviceStatus = await getCurrentDeviceStatus();
      await addTestDevice();
      toast({
        title: "Success",
        description: "Device status refreshed successfully",
      });
    } catch (error) {
      console.error('Error refreshing device:', error);
      toast({
        title: "Error",
        description: "Failed to refresh device: " + error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Set up real-time listener for devices
    const devicesRef = collection(db, 'schools', SCHOOL_ID, 'devices');
    const devicesQuery = query(devicesRef);
    
    console.log('Setting up devices listener...', { SCHOOL_ID });
    
    const unsubscribe = onSnapshot(devicesQuery, async (snapshot) => {
      console.log('Received devices update:', snapshot.docs.length, 'devices');
      
      // If no devices exist, add a test device
      if (snapshot.docs.length === 0) {
        console.log('No devices found, adding test device...');
        await addTestDevice();
        return;
      }

      const devicesList = [];
      
      for (const doc of snapshot.docs) {
        const deviceData = doc.data();
        console.log('Raw device data:', deviceData);
        
        // Basic device status calculation
        const lastSeen = deviceData.last_seen?.toDate() || new Date(0);
        const timeDiff = Date.now() - lastSeen.getTime();
        const minutesDiff = Math.floor(timeDiff / (1000 * 60));
        
        let status = 'offline';
        let statusDetails = [];

        // If device was seen in last 30 minutes, consider it active
        if (minutesDiff <= 30) {
          status = deviceData.is_outside_geofence ? 'alert' : 'active';
        }

        // Process battery info
        const batteryLevel = deviceData.battery_level !== undefined ? deviceData.battery_level : 'Unknown';
        if (batteryLevel !== 'Unknown') {
          if (batteryLevel <= 20) {
            statusDetails.push('Low battery');
          }
          if (deviceData.is_charging) {
            statusDetails.push('Charging');
          }
        }

        // Process network info
        if (deviceData.network_type) {
          const networkInfo = deviceData.signal_strength 
            ? `${deviceData.network_type} (${deviceData.signal_strength}%)`
            : deviceData.network_type;
          statusDetails.push(networkInfo);
        }

        // Process location and geofence info
        if (status === 'offline') {
          statusDetails.push(`Last seen ${formatLastSeen(lastSeen)}`);
        } else if (deviceData.is_outside_geofence) {
          statusDetails.push('Outside school premises');
        }

        devicesList.push({
          id: doc.id,
          device_id: deviceData.device_id || 'Unknown Device',
          learner_name: deviceData.learner_name || 'Unknown Learner',
          grade: deviceData.grade || 'Unknown Grade',
          status,
          statusDetails: statusDetails.join(' • '),
          location: deviceData.location || 'Unknown',
          last_seen: lastSeen,
          imei: deviceData.imei || 'Unknown',
          battery_level: batteryLevel,
          is_charging: deviceData.is_charging || false,
          is_outside_geofence: deviceData.is_outside_geofence || false,
          latitude: deviceData.latitude,
          longitude: deviceData.longitude,
          network_type: deviceData.network_type || 'Unknown',
          signal_strength: deviceData.signal_strength,
          
          // Device capabilities
          webgl_support: deviceData.webgl_support || false,
          canvas_support: deviceData.canvas_support || false,
          local_storage: deviceData.local_storage || false,
          session_storage: deviceData.session_storage || false,
          
          // Browser details
          user_agent: deviceData.user_agent || 'Unknown',
          platform: deviceData.platform || 'Unknown',
          language: deviceData.language || 'Unknown',
          
          // Screen information
          screen_width: deviceData.screen_width,
          screen_height: deviceData.screen_height,
          color_depth: deviceData.color_depth,
          pixel_ratio: deviceData.pixel_ratio,
          
          // Connection details
          connection_type: deviceData.connection_type || 'Unknown',
          effective_type: deviceData.effective_type || 'Unknown',
          downlink: deviceData.downlink,
          rtt: deviceData.rtt,

          // Device details
          model: deviceData.model || 'Unknown',
          os_version: deviceData.os_version || 'Unknown',
          build_number: deviceData.build_number || 'Unknown',
          carrier: deviceData.carrier || 'Unknown',
          cellular_technology: deviceData.cellular_technology || 'Unknown',
          wifi_mac: deviceData.wifi_mac || 'Unknown',
          bluetooth_mac: deviceData.bluetooth_mac || 'Unknown',

          // Hardware capabilities
          has_cellular: deviceData.has_cellular || false,
          has_gps: deviceData.has_gps || false,
          has_compass: deviceData.has_compass || false,
          has_accelerometer: deviceData.has_accelerometer || false,
          has_gyroscope: deviceData.has_gyroscope || false,
          has_touch_id: deviceData.has_touch_id || false,
          has_face_id: deviceData.has_face_id || false,
          has_lidar: deviceData.has_lidar || false,

          // Storage & Memory
          total_storage: deviceData.total_storage,
          available_storage: deviceData.available_storage,
          total_memory: deviceData.total_memory,
          memory_usage: deviceData.memory_usage,

          // Battery details
          battery_health: deviceData.battery_health,
          battery_cycles: deviceData.battery_cycles,
          battery_temperature: deviceData.battery_temperature,

          // Network details
          wifi_ssid: deviceData.wifi_ssid || 'Unknown',
          wifi_strength: deviceData.wifi_strength,
          cellular_strength: deviceData.cellular_strength,

          // System status
          cpu_usage: deviceData.cpu_usage,
          gpu_usage: deviceData.gpu_usage,
          active_apps: deviceData.active_apps || [],
          background_apps: deviceData.background_apps || [],

          // Security status
          supervised: deviceData.supervised || false,
          mdm_enrolled: deviceData.mdm_enrolled || false,
          passcode_enabled: deviceData.passcode_enabled || false,
          activation_lock_enabled: deviceData.activation_lock_enabled || false,
          last_backup_date: deviceData.last_backup_date,

          // Additional metrics
          location_services_enabled: deviceData.location_services_enabled || false,
          gps_status: deviceData.gps_status || 'Unknown',
          compass_heading: deviceData.compass_heading,
          altitude: deviceData.altitude,
          speed: deviceData.speed,
          brightness: deviceData.brightness,
          true_tone_enabled: deviceData.true_tone_enabled || false,
          night_shift_enabled: deviceData.night_shift_enabled || false,
          uptime: deviceData.uptime,
          last_restart: deviceData.last_restart
        });
      }

      console.log('Processed devices:', devicesList);
      setDevices(devicesList);
      setIsLoading(false);
    }, (error) => {
      console.error('Error fetching devices:', error);
      setError('Failed to fetch devices: ' + error.message);
      toast({
        title: "Error",
        description: "Failed to fetch devices: " + error.message,
        variant: "destructive"
      });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredDevices = devices.filter(device => {
    const matchesSearch = searchQuery === '' || 
      device.device_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.learner_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.grade.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = selectedStatus === 'all' || device.status === selectedStatus;
    const matchesGrade = selectedGrade === 'all' || device.grade === selectedGrade;

    return matchesSearch && matchesStatus && matchesGrade;
  }).sort((a, b) => {
    // Extract numeric part and section part of grade
    const [, numA, sectionA = ''] = a.grade.match(/(\d+)([A-Z]*)/) || [null, '0', ''];
    const [, numB, sectionB = ''] = b.grade.match(/(\d+)([A-Z]*)/) || [null, '0', ''];
    
    // Compare grade numbers first
    const gradeCompare = parseInt(numA) - parseInt(numB);
    if (gradeCompare !== 0) return gradeCompare;
    
    // If same grade number, compare sections
    return sectionA.localeCompare(sectionB);
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
      const batteryText = `Battery: ${device.battery_level}%${device.is_charging ? ' (Charging)' : ''}`;
      const batteryStatus = device.battery_level <= 20 ? `⚠️ ${batteryText}` : batteryText;
      details.push(batteryStatus);
    }

    if (device.network_type) {
      const networkInfo = `${device.network_type}${device.signal_strength ? ` (${device.signal_strength}%)` : ''}`;
      details.push(networkInfo);
    }

    if (device.location) {
      details.push(device.location);
    }

    if (device.is_moving) {
      details.push('📍 In motion');
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

  const DeviceStatusCard = ({ device }) => {
    return (
      <Card 
        className="bg-white overflow-hidden hover:bg-gray-50 transition-colors cursor-pointer"
        onClick={() => {
          // Only pass through data that exists
          const deviceWithDetails = {
            ...device
          };
          console.log('Selected device with details:', deviceWithDetails);
          setSelectedDevice(deviceWithDetails);
        }}
      >
        <div className="p-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="font-medium text-gray-900">{device.device_id}</h3>
              <p className="text-sm text-gray-500">
                {device.learner_name} - Grade {device.grade}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={getStatusBadge(device.status)}>
                {device.status === 'active' ? 'Active' : device.status === 'alert' ? 'Alert' : 'Offline'}
              </span>
            </div>
          </div>
          
          {/* Only show battery info if available */}
          {device.battery_level !== undefined && (
            <div className="flex items-center gap-2 mt-3">
              <Battery className={`w-4 h-4 ${device.battery_level <= 20 ? 'text-red-400' : 'text-gray-400'}`} />
              <span className="text-sm text-gray-600">
                {device.battery_level}%{device.is_charging ? ' (Charging)' : ''}
              </span>
            </div>
          )}
          
          {/* Only show network info if available */}
          {device.network_type && (
            <div className="flex items-center gap-2 mt-2">
              <Wifi className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">
                {device.network_type}{device.signal_strength ? ` (${device.signal_strength}%)` : ''}
              </span>
            </div>
          )}
          
          {/* Only show location if available */}
          {device.location && (
            <div className="flex items-center gap-2 mt-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">{device.location}</span>
              {device.is_outside_geofence && (
                <span className="flex items-center gap-1 text-xs text-red-600">
                  <AlertTriangle className="w-3 h-3" />
                  Outside Geofence
                </span>
              )}
            </div>
          )}
          
          <div className="text-xs text-gray-400 mt-2">
            Last seen: {formatLastSeen(device.last_seen)}
          </div>
        </div>
      </Card>
    );
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
            onClick={refreshDevice}
            className="flex items-center gap-2 bg-white shadow-sm border border-gray-200"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <LocationStatus />

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

      {/* Device Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-gray-400" />
          <p className="mt-2 text-gray-600">Loading devices...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <AlertTriangle className="w-6 h-6 mx-auto text-red-500" />
          <p className="mt-2 text-red-600">{error}</p>
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="text-center py-12">
          <Tablet className="w-6 h-6 mx-auto text-gray-400" />
          <p className="mt-2 text-gray-600">No devices found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDevices.map((device) => (
            <DeviceStatusCard key={device.id} device={device} />
          ))}
        </div>
      )}

      {/* Device Details Dialog */}
      {selectedDevice && (
        <Dialog 
          open={!!selectedDevice} 
          onOpenChange={() => setSelectedDevice(null)}
        >
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Device Details - {selectedDevice.device_id}</DialogTitle>
              <DialogDescription>
                Device information from service provider
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Basic Info Section */}
              <div className="grid grid-cols-2 gap-4">
                {selectedDevice.device_id && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Device ID</p>
                    <p className="text-base text-gray-900">{selectedDevice.device_id}</p>
                  </div>
                )}
                {selectedDevice.imei && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">IMEI</p>
                    <p className="text-base text-gray-900">{selectedDevice.imei}</p>
                  </div>
                )}
              </div>

              {/* Status Section */}
              <div>
                <p className="text-sm font-medium text-gray-500">Status</p>
                <div className="flex items-center gap-2 mt-1">
                  {getStatusIcon(selectedDevice.status)}
                  <span className={getStatusBadge(selectedDevice.status)}>
                    {selectedDevice.status.charAt(0).toUpperCase() + selectedDevice.status.slice(1)}
                  </span>
                </div>
              </div>

              {/* Battery Section - only if data exists */}
              {selectedDevice.battery_level !== undefined && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Battery Status</p>
                  <div className="flex items-center gap-2">
                    <Battery className={`w-4 h-4 ${selectedDevice.battery_level <= 20 ? 'text-red-500' : 'text-green-500'}`} />
                    <p className="text-base text-gray-900">
                      {selectedDevice.battery_level}%{selectedDevice.is_charging ? ' (Charging)' : ''}
                    </p>
                  </div>
                </div>
              )}

              {/* Network Section - only if data exists */}
              {selectedDevice.network_type && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Network Status</p>
                  <div className="flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-blue-500" />
                    <p className="text-base text-gray-900">
                      {selectedDevice.network_type}
                      {selectedDevice.signal_strength ? ` (${selectedDevice.signal_strength}% signal)` : ''}
                    </p>
                  </div>
                </div>
              )}

              {/* Location Section - only if coordinates exist */}
              {(selectedDevice.latitude || selectedDevice.location) && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-500">Location</p>
                  <p className="text-base text-gray-900 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    {selectedDevice.location}
                    {selectedDevice.is_outside_geofence && (
                      <span className="text-red-500 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" />
                        Outside Geofence
                      </span>
                    )}
                  </p>
                  {selectedDevice.latitude && selectedDevice.longitude && selectedDevice.location !== 'School Premises' && (
                    <div className="relative h-[300px] w-full rounded-lg overflow-hidden border border-gray-200">
                      <MapContainer
                        key={`${selectedDevice.latitude}-${selectedDevice.longitude}`}
                        center={[selectedDevice.latitude, selectedDevice.longitude]}
                        zoom={15}
                        style={{ height: '100%', width: '100%' }}
                        scrollWheelZoom={false}
                      >
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <Marker position={[selectedDevice.latitude, selectedDevice.longitude]}>
                          <Popup>
                            <div className="text-sm space-y-1">
                              <p><strong>{selectedDevice.device_id}</strong></p>
                              <p>Last seen: {formatLastSeen(selectedDevice.last_seen)}</p>
                              {selectedDevice.accuracy && <p>Accuracy: {Math.round(selectedDevice.accuracy)}m</p>}
                              <p>Location: {selectedDevice.location}</p>
                            </div>
                          </Popup>
                        </Marker>
                      </MapContainer>
                    </div>
                  )}
                </div>
              )}

              {/* Last Seen Section */}
              <div>
                <p className="text-sm font-medium text-gray-500">Last Seen</p>
                <p className="text-base text-gray-900">
                  {selectedDevice.last_seen ? selectedDevice.last_seen.toLocaleString() : 'Never'}
                </p>
              </div>

              {/* Only show sections if they have data */}
              {selectedDevice.model && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Device Information</p>
                  <div className="mt-2 space-y-2">
                    <p className="text-sm text-gray-900">{selectedDevice.model}</p>
                    {selectedDevice.os_version && (
                      <p className="text-sm text-gray-900">OS Version: {selectedDevice.os_version}</p>
                    )}
              </div>
            </div>
              )}

              {/* Only show storage if data exists */}
              {(selectedDevice.available_storage !== undefined && selectedDevice.total_storage !== undefined) && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Storage</p>
                  <p className="text-sm text-gray-900">
                    {selectedDevice.available_storage}GB free of {selectedDevice.total_storage}GB
                  </p>
                </div>
              )}

              {/* Only show memory if data exists */}
              {(selectedDevice.memory_usage !== undefined && selectedDevice.total_memory !== undefined) && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Memory Usage</p>
                  <p className="text-sm text-gray-900">
                    {selectedDevice.memory_usage}GB used of {selectedDevice.total_memory}GB
                  </p>
                </div>
              )}

              {/* Only show security status if any security data exists */}
              {(selectedDevice.supervised || selectedDevice.mdm_enrolled) && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Security Status</p>
                  <div className="mt-2 flex flex-wrap gap-4">
                    {selectedDevice.supervised && (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-gray-600">Supervised</span>
                      </div>
                    )}
                    {selectedDevice.mdm_enrolled && (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-gray-600">MDM Enrolled</span>
                      </div>
                    )}
            </div>
          </div>
              )}
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