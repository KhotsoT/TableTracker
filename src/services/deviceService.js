import { db, SCHOOL_ID } from '../config/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { SCHOOL_CONFIG } from '../config/school';
import { getDeviceFromMDM, getDeviceLocation, getDeviceSecurityStatus } from './mdmService';

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

// Basic device identification - only include what we know for certain
const TEST_DEVICE = {
  device_id: 'iPad-002',
  learner_name: 'Lintle',
  grade: '12B',
  imei: '012924005351207',
  device_type: 'iPad'
};

// Function to update device status with actual provider data
export const updateDeviceStatus = async (deviceData) => {
  try {
    console.log('Updating device status with provider data:', deviceData);
    
    const deviceRef = doc(db, 'schools', SCHOOL_ID, 'devices', deviceData.device_id);
    
    // Only include fields that have valid values
    const updateData = {
      // Core device data - these should always be present
      ...TEST_DEVICE,
      last_seen: serverTimestamp(),
      
      // Status information
      status: deviceData.status || 'unknown',
      battery_level: deviceData.batteryLevel || 0,
      is_charging: Boolean(deviceData.isCharging),
      network_type: deviceData.networkType || 'unknown',
      signal_strength: deviceData.signalStrength || 0,
      
      // Location data
      location: deviceData.location || 'Unknown',
      is_outside_geofence: deviceData.isOutsideGeofence === true,
      
      // Only include location coordinates if both latitude and longitude are present
      ...(deviceData.latitude && deviceData.longitude ? {
        latitude: deviceData.latitude,
        longitude: deviceData.longitude,
        accuracy: deviceData.accuracy || 0
      } : {}),
      
      // Device capabilities
      webgl_support: Boolean(deviceData.webgl_support),
      canvas_support: Boolean(deviceData.canvas_support),
      local_storage: Boolean(deviceData.local_storage),
      session_storage: Boolean(deviceData.session_storage),
      
      // Browser details
      user_agent: deviceData.user_agent || 'unknown',
      platform: deviceData.platform || 'unknown',
      language: deviceData.language || 'unknown',
      
      // Screen information - only include if values are present
      ...(deviceData.screen_width && deviceData.screen_height ? {
        screen_width: deviceData.screen_width,
        screen_height: deviceData.screen_height,
        color_depth: deviceData.color_depth || 0,
        pixel_ratio: deviceData.pixel_ratio || 1
      } : {}),
      
      // Connection details
      connection_type: deviceData.connection_type || 'unknown',
      effective_type: deviceData.effective_type || 'unknown',
      downlink: deviceData.downlink || 0,
      rtt: deviceData.rtt || 0,
      
      // Location status - only include if we have location data
      ...(deviceData.latitude && deviceData.longitude ? {
        location_status: {
          accuracy_level: getAccuracyLevel(deviceData.accuracy),
          last_good_location: {
            latitude: deviceData.latitude,
            longitude: deviceData.longitude,
            accuracy: deviceData.accuracy || 0,
            timestamp: new Date().toISOString()
          }
        }
      } : {
        location_status: {
          accuracy_level: 'UNKNOWN',
          last_good_location: null
        }
      }),

      // Device status metadata
      _device_status: {
        timestamp: serverTimestamp(),
        status: deviceData.status || 'unknown',
        message: 'Device data updated from provider'
      }
    };

    console.log('Sending update data to Firestore:', updateData);
    await updateDoc(deviceRef, updateData);
    console.log('Device status updated with provider data');
    
    return {
      success: true,
      data: updateData
    };
  } catch (error) {
    console.error('Error updating device status:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Function to get current device status from provider
export const getCurrentDeviceStatus = async () => {
  try {
    console.log('Getting current device status from provider...');
    
    // Get device information using the Web APIs first
    const deviceInfo = {
      // Core device info
      ...TEST_DEVICE,
      
      // Browser and platform info
      user_agent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      
      // Network information
      networkType: navigator.connection?.type || 'unknown',
      effectiveType: navigator.connection?.effectiveType || 'unknown',
      downlink: navigator.connection?.downlink || 0,
      rtt: navigator.connection?.rtt || 0,
      
      // Screen information
      screen_width: window.screen.width,
      screen_height: window.screen.height,
      color_depth: window.screen.colorDepth,
      pixel_ratio: window.devicePixelRatio,
      
      // Battery information (if available)
      batteryLevel: 0,
      isCharging: false,
      
      // Location services
      location_services_enabled: 'geolocation' in navigator,
      
      // Device capabilities
      webgl_support: !!window.WebGLRenderingContext,
      canvas_support: !!document.createElement('canvas').getContext,
      local_storage: !!window.localStorage,
      session_storage: !!window.sessionStorage,
      
      // Status information
      status: 'active',
      is_outside_geofence: false,
      location: 'Unknown',
      
      _device_status: {
        timestamp: new Date().toISOString(),
        status: 'active',
        message: 'Device data retrieved from Web APIs'
      }
    };
    
    // Get battery information if available
    if ('getBattery' in navigator) {
      try {
        const battery = await navigator.getBattery();
        deviceInfo.batteryLevel = Math.round(battery.level * 100);
        deviceInfo.isCharging = battery.charging;
      } catch (batteryError) {
        console.warn('Battery API not available:', batteryError);
      }
    }

    // Try to get MDM information
    try {
      // Get detailed device info from MDM
      const mdmDeviceInfo = await getDeviceFromMDM(TEST_DEVICE.device_id);
      if (mdmDeviceInfo.success) {
        console.log('Retrieved MDM device information:', mdmDeviceInfo.data);
        
        // Merge MDM data with device info
        Object.assign(deviceInfo, {
          // Device identification
          serial_number: mdmDeviceInfo.data.serial_number,
          udid: mdmDeviceInfo.data.udid,
          imei: mdmDeviceInfo.data.imei || deviceInfo.imei,
          model: mdmDeviceInfo.data.model,
          model_name: mdmDeviceInfo.data.model_name,
          
          // OS information
          os_version: mdmDeviceInfo.data.os_version,
          build_version: mdmDeviceInfo.data.build_version,
          
          // Hardware details
          processor: mdmDeviceInfo.data.processor,
          total_ram: mdmDeviceInfo.data.total_ram,
          total_storage: mdmDeviceInfo.data.total_storage,
          available_storage: mdmDeviceInfo.data.available_storage,
          
          // Network information
          wifi_mac: mdmDeviceInfo.data.wifi_mac,
          bluetooth_mac: mdmDeviceInfo.data.bluetooth_mac,
          cellular_technology: mdmDeviceInfo.data.cellular_technology,
          carrier: mdmDeviceInfo.data.carrier,
          current_carrier_network: mdmDeviceInfo.data.current_carrier_network,
          sim_carrier_network: mdmDeviceInfo.data.sim_carrier_network,
          phone_number: mdmDeviceInfo.data.phone_number,
          cellular_signal_strength: mdmDeviceInfo.data.cellular_signal_strength,
          
          // Battery information (override Web API data if available)
          battery_level: mdmDeviceInfo.data.battery_level || deviceInfo.batteryLevel,
          battery_status: mdmDeviceInfo.data.battery_status,
          battery_health: mdmDeviceInfo.data.battery_health,
          battery_cycle_count: mdmDeviceInfo.data.battery_cycle_count,
          
          // Security status
          supervised: mdmDeviceInfo.data.supervised,
          managed: mdmDeviceInfo.data.managed,
          encrypted: mdmDeviceInfo.data.encrypted,
          activation_lock_enabled: mdmDeviceInfo.data.activation_lock_enabled,
          passcode_enabled: mdmDeviceInfo.data.passcode_enabled,
          
          // Management details
          enrollment_status: mdmDeviceInfo.data.enrollment_status,
          enrollment_date: mdmDeviceInfo.data.enrollment_date,
          last_check_in: mdmDeviceInfo.data.last_check_in,
          mdm_profile_installed: mdmDeviceInfo.data.mdm_profile_installed,
          
          // Apps and profiles
          installed_apps: mdmDeviceInfo.data.installed_apps,
          installed_profiles: mdmDeviceInfo.data.installed_profiles,
          
          // Additional hardware capabilities
          has_cellular: mdmDeviceInfo.data.has_cellular,
          has_wifi: mdmDeviceInfo.data.has_wifi,
          has_bluetooth: mdmDeviceInfo.data.has_bluetooth,
          has_camera: mdmDeviceInfo.data.has_camera,
          has_gps: mdmDeviceInfo.data.has_gps,
          has_touch_id: mdmDeviceInfo.data.has_touch_id,
          has_face_id: mdmDeviceInfo.data.has_face_id,
          
          // Device restrictions
          device_restrictions: mdmDeviceInfo.data.device_restrictions,
          
          // Update status information
          _device_status: {
            ...deviceInfo._device_status,
            mdm_status: mdmDeviceInfo.data.device_status,
            compliance_status: mdmDeviceInfo.data.compliance_status
          }
        });

        // Get device location from MDM if available
        const locationInfo = await getDeviceLocation(TEST_DEVICE.device_id);
        if (locationInfo.success && locationInfo.data) {
          deviceInfo.latitude = locationInfo.data.latitude;
          deviceInfo.longitude = locationInfo.data.longitude;
          deviceInfo.accuracy = locationInfo.data.accuracy;
          deviceInfo.altitude = locationInfo.data.altitude;
          deviceInfo.speed = locationInfo.data.speed;
          deviceInfo.location = locationInfo.data.location;
          deviceInfo.is_outside_geofence = locationInfo.data.is_outside_geofence;
        }

        // Get additional security status
        const securityInfo = await getDeviceSecurityStatus(TEST_DEVICE.device_id);
        if (securityInfo.success && securityInfo.data) {
          deviceInfo.security_status = securityInfo.data;
        }
      }
    } catch (mdmError) {
      console.warn('MDM data not available:', mdmError);
      // Continue with Web API data if MDM fails
    }
    
    // Fallback to Web API location if MDM location is not available
    if (!deviceInfo.latitude && navigator.geolocation) {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
          });
        });
        
        deviceInfo.latitude = position.coords.latitude;
        deviceInfo.longitude = position.coords.longitude;
        deviceInfo.accuracy = position.coords.accuracy;
        deviceInfo.altitude = position.coords.altitude;
        deviceInfo.speed = position.coords.speed;
        
        // Check if device is outside geofence
        if (SCHOOL_CONFIG.location) {
          const distance = calculateDistance(
            position.coords.latitude,
            position.coords.longitude,
            SCHOOL_CONFIG.location.latitude,
            SCHOOL_CONFIG.location.longitude
          );
          deviceInfo.is_outside_geofence = distance > SCHOOL_CONFIG.location.radius;
          deviceInfo.location = deviceInfo.is_outside_geofence ? 'Outside School' : 'School Premises';
        }
      } catch (locationError) {
        console.warn('Location not available:', locationError);
        deviceInfo.location = 'Unknown';
      }
    }

    console.log('Retrieved device information:', deviceInfo);
    return deviceInfo;
  } catch (error) {
    console.error('Error getting device status:', error);
    return {
      ...TEST_DEVICE,
      error: error.message,
      is_outside_geofence: false,
      _device_status: {
        timestamp: new Date().toISOString(),
        status: 'ERROR',
        message: 'Failed to get device status'
      }
    };
  }
};

// Helper function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

// Helper function to determine accuracy level
function getAccuracyLevel(accuracy) {
  if (!accuracy) return 'UNKNOWN';
  if (accuracy <= ACCURACY_LEVELS.HIGH) return 'HIGH';
  if (accuracy <= ACCURACY_LEVELS.MEDIUM) return 'MEDIUM';
  if (accuracy <= ACCURACY_LEVELS.LOW) return 'LOW';
  if (accuracy <= ACCURACY_LEVELS.POOR) return 'POOR';
  return 'UNRELIABLE';
}

// Start device monitoring - will connect to provider
export const startDeviceMonitoring = (deviceData) => {
  console.log('Device monitoring started - connecting to provider...');
  
  // TODO: Replace with actual provider connection setup
  const heartbeatInterval = setInterval(() => {
    getCurrentDeviceStatus().then(status => {
      updateDeviceStatus(status);
    });
  }, 60000);

  return () => {
    clearInterval(heartbeatInterval);
    console.log('Device monitoring stopped');
  };
}; 