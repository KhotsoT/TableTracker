import { db } from '../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Function to send device status update
export const updateDeviceStatus = async (deviceData) => {
  try {
    const statusRef = collection(db, 'device_status');
    await addDoc(statusRef, {
      imei: deviceData.imei,
      timestamp: serverTimestamp(),
      battery_level: deviceData.batteryLevel,
      is_charging: deviceData.isCharging,
      network_type: deviceData.networkType,
      signal_strength: deviceData.signalStrength,
      location: deviceData.location,
      is_outside_geofence: deviceData.isOutsideGeofence,
      latitude: deviceData.latitude,
      longitude: deviceData.longitude
    });
  } catch (error) {
    console.error('Error updating device status:', error);
    throw error;
  }
};

// Function to send device heartbeat
export const sendDeviceHeartbeat = async (deviceData) => {
  try {
    const heartbeatRef = collection(db, 'device_heartbeats');
    await addDoc(heartbeatRef, {
      imei: deviceData.imei,
      timestamp: serverTimestamp(),
      battery_level: deviceData.batteryLevel,
      is_charging: deviceData.isCharging,
      network_type: deviceData.networkType,
      signal_strength: deviceData.signalStrength
    });
  } catch (error) {
    console.error('Error sending device heartbeat:', error);
    throw error;
  }
};

// Function to start device monitoring
export const startDeviceMonitoring = (deviceData) => {
  // Send initial status update
  updateDeviceStatus(deviceData);

  // Set up heartbeat interval (every minute)
  const heartbeatInterval = setInterval(() => {
    sendDeviceHeartbeat(deviceData);
  }, 60000);

  // Set up status update interval (every 5 minutes)
  const statusInterval = setInterval(() => {
    updateDeviceStatus(deviceData);
  }, 300000);

  // Return cleanup function
  return () => {
    clearInterval(heartbeatInterval);
    clearInterval(statusInterval);
  };
};

// Function to get device location
export const getDeviceLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  });
};

// Function to check if device is outside geofence
export const checkGeofence = (position, geofence) => {
  // Simple circular geofence check
  const distance = getDistance(
    position.latitude,
    position.longitude,
    geofence.latitude,
    geofence.longitude
  );
  return distance > geofence.radius;
};

// Helper function to calculate distance between two points
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
} 