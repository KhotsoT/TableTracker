import { db, SCHOOL_ID } from '../config/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { SCHOOL_CONFIG } from '../config/school';

// Constants for location tracking
export const IDEAL_ACCURACY = 100;
export const MAX_ACCURACY = 1500;
export const MIN_ACCURACY = 5;
export const MIN_UPDATE_INTERVAL = 10000;
export const THRESHOLD_COUNT = 3;
export const MAX_BUFFER_SIZE = 3;

// Accuracy thresholds for status indicators
export const ACCURACY_LEVELS = {
  HIGH: 50,
  MEDIUM: 200,
  LOW: 500,
  POOR: 1500
};

// Test device configuration - represents the actual iPad we're tracking
const TEST_DEVICE = {
  device_id: 'iPad-002',
  learner_name: 'Lintle',
  grade: '12B',
  // imei: '355088376177131',
  imei: '012924005351207',
  device_type: 'iPad'
};

// Function to update device status
export const updateDeviceStatus = async (deviceData) => {
  try {
    console.log('Updating device status with data:', deviceData);
    
    const deviceRef = doc(db, 'schools', SCHOOL_ID, 'devices', deviceData.device_id);
    
    const updateData = {
      // Core device data (iPad being tracked)
      device_id: TEST_DEVICE.device_id,
      learner_name: TEST_DEVICE.learner_name,
      grade: TEST_DEVICE.grade,
      imei: TEST_DEVICE.imei,
      device_type: TEST_DEVICE.device_type,
      last_seen: serverTimestamp(),
      
      // Device status (marked as pending until real data is received)
      status: 'AWAITING_DEVICE_DATA',
      battery_level: null,
      is_charging: null,
      network_type: 'pending',
      signal_strength: null,
      location: 'School Premises',
      is_outside_geofence: false,
      
      // Location data (using school location as default)
      latitude: SCHOOL_CONFIG.location.latitude,
      longitude: SCHOOL_CONFIG.location.longitude,
      accuracy: ACCURACY_LEVELS.LOW,
      
      // Location status
      location_status: {
        accuracy_level: 'PENDING',
        reliability_score: null,
        last_good_location: {
          latitude: SCHOOL_CONFIG.location.latitude,
          longitude: SCHOOL_CONFIG.location.longitude,
          accuracy: ACCURACY_LEVELS.LOW,
          timestamp: new Date().toISOString()
        }
      },

      // Device status metadata
      _device_status: {
        timestamp: serverTimestamp(),
        status: 'AWAITING_DEVICE_DATA',
        message: 'Waiting for real iPad data connection'
      }
    };

    await updateDoc(deviceRef, updateData);
    console.log('Device status updated successfully');
  } catch (error) {
    console.error('Error updating device status:', error);
    throw error;
  }
};

// Function to get current device status
export const getCurrentDeviceStatus = async () => {
  try {
    console.log('Getting current device status...');
    
    // Return device status with placeholder data
    // TODO: Replace with actual iPad data when device communication is implemented
    return {
      // Core device information
      ...TEST_DEVICE,
      
      // Status information (placeholder until real iPad data is received)
      batteryLevel: null,
      isCharging: null,
      networkType: 'pending',
      signalStrength: null,
      
      // Location information (using school location as default)
      latitude: SCHOOL_CONFIG.location.latitude,
      longitude: SCHOOL_CONFIG.location.longitude,
      accuracy: ACCURACY_LEVELS.LOW,
      accuracyLevel: 'PENDING',
      lastGoodLocation: {
        latitude: SCHOOL_CONFIG.location.latitude,
        longitude: SCHOOL_CONFIG.location.longitude,
        accuracy: ACCURACY_LEVELS.LOW,
        timestamp: new Date().toISOString()
      },
      
      // Device status metadata
      _device_status: {
        timestamp: new Date().toISOString(),
        status: 'AWAITING_DEVICE_DATA',
        message: 'Waiting for real iPad data connection'
      }
    };
  } catch (error) {
    console.error('Error getting device status:', error);
    
    // Return error status with default location
    return {
      ...TEST_DEVICE,
      error: error.message,
      latitude: SCHOOL_CONFIG.location.latitude,
      longitude: SCHOOL_CONFIG.location.longitude,
      accuracy: ACCURACY_LEVELS.LOW,
      _device_status: {
        timestamp: new Date().toISOString(),
        status: 'ERROR',
        message: 'Failed to get device status'
      }
    };
  }
};

// Helper function to determine accuracy level
function getAccuracyLevel(accuracy) {
  if (accuracy <= ACCURACY_LEVELS.HIGH) return 'HIGH';
  if (accuracy <= ACCURACY_LEVELS.MEDIUM) return 'MEDIUM';
  if (accuracy <= ACCURACY_LEVELS.LOW) return 'LOW';
  if (accuracy <= ACCURACY_LEVELS.POOR) return 'POOR';
  return 'UNRELIABLE';
}

// Start device monitoring
export const startDeviceMonitoring = (deviceData) => {
  console.log('Device monitoring started - waiting for iPad connection');
  
  // Set up heartbeat interval to check for device data
  const heartbeatInterval = setInterval(() => {
    getCurrentDeviceStatus().then(status => {
      updateDeviceStatus(status);
    });
  }, 60000);

  // Return cleanup function
  return () => {
    clearInterval(heartbeatInterval);
    console.log('Device monitoring stopped');
  };
}; 