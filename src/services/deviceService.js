import { db, SCHOOL_ID } from '../config/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { SCHOOL_CONFIG } from '../config/school';

// Function to send device status update
export const updateDeviceStatus = async (deviceData) => {
  try {
    console.log('Updating device status with data:', deviceData);
    
    // Update the device document with consistent field names
    const deviceRef = doc(db, 'schools', SCHOOL_ID, 'devices', deviceData.device_id);
    
    const updateData = {
      last_seen: serverTimestamp(),
      battery_level: deviceData.batteryLevel || deviceData.battery_level || 0,
      is_charging: deviceData.isCharging || deviceData.is_charging || false,
      network_type: deviceData.networkType || deviceData.network_type || 'unknown',
      signal_strength: deviceData.signalStrength || deviceData.signal_strength || 0,
      location: deviceData.location || 'School Premises',
      is_outside_geofence: deviceData.isOutsideGeofence || deviceData.is_outside_geofence || false
    };

    // Only add coordinates if they are valid numbers
    if (typeof deviceData.latitude === 'number' && typeof deviceData.longitude === 'number') {
      updateData.latitude = deviceData.latitude;
      updateData.longitude = deviceData.longitude;
      console.log('Updating location:', { lat: deviceData.latitude, lng: deviceData.longitude });
    }

    await updateDoc(deviceRef, updateData);
    console.log('Device status updated successfully with data:', updateData);
  } catch (error) {
    console.error('Error updating device status:', error);
    throw error;
  }
};

// Function to send device heartbeat
export const sendDeviceHeartbeat = async (deviceData) => {
  try {
    const heartbeatRef = collection(db, 'schools', SCHOOL_ID, 'devices', deviceData.device_id, 'heartbeats');
    
    // Ensure all fields have valid values before sending to Firestore
    const heartbeatData = {
      timestamp: serverTimestamp(),
      battery_level: deviceData.batteryLevel || deviceData.battery_level || 0,
      is_charging: deviceData.isCharging || deviceData.is_charging || false,
      network_type: deviceData.networkType || deviceData.network_type || 'unknown',
      signal_strength: deviceData.signalStrength || deviceData.signal_strength || 0
    };

    // Only add coordinates if they are valid numbers
    if (typeof deviceData.latitude === 'number' && typeof deviceData.longitude === 'number') {
      heartbeatData.latitude = deviceData.latitude;
      heartbeatData.longitude = deviceData.longitude;
    }

    await addDoc(heartbeatRef, heartbeatData);
    console.log('Device heartbeat sent successfully:', heartbeatData);
  } catch (error) {
    console.error('Error sending device heartbeat:', error);
    throw error;
  }
};

// Function to get current device status
export const getCurrentDeviceStatus = async (imei = '355088376177131') => {
  try {
    console.log('Getting current device status...');
    
    // Get initial position
    console.log('Getting initial position...');
    let position;
    try {
      position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            console.log('Initial position received:', {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy
            });
            resolve(pos);
          },
          (error) => {
            console.error('Error getting initial position:', error);
            // Use school coordinates as fallback
            resolve({
              coords: {
                latitude: SCHOOL_CONFIG.location.latitude,
                longitude: SCHOOL_CONFIG.location.longitude,
                accuracy: 100 // Default accuracy of 100 meters
              }
            });
          },
          {
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 0
          }
        );
      });
    } catch (locationError) {
      console.error('Failed to get position:', locationError);
      // Use school coordinates as fallback
      position = {
        coords: {
          latitude: SCHOOL_CONFIG.location.latitude,
          longitude: SCHOOL_CONFIG.location.longitude,
          accuracy: 100 // Default accuracy of 100 meters
        }
      };
    }
    
    // Get battery information with more detailed monitoring
    console.log('Requesting battery info...');
    const batteryInfo = await navigator.getBattery();
    console.log('Battery info received:', {
      level: batteryInfo.level,
      charging: batteryInfo.charging,
      chargingTime: batteryInfo.chargingTime,
      dischargingTime: batteryInfo.dischargingTime
    });

    // Add battery change listeners for more accurate updates
    batteryInfo.addEventListener('levelchange', () => {
      console.log('Battery level changed:', batteryInfo.level);
    });
    batteryInfo.addEventListener('chargingchange', () => {
      console.log('Battery charging status changed:', batteryInfo.charging);
    });

    // Get network information with enhanced signal strength calculation
    console.log('Getting network info...');
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    // Calculate signal strength more accurately
    let signalStrength = 0;
    let networkType = 'unknown';
    
    if (connection) {
      networkType = connection.effectiveType || connection.type || 'unknown';
      
      // Calculate signal strength based on connection quality metrics
      if (connection.downlink && connection.rtt) {
        // Use both download speed and latency for better accuracy
        const maxDownlink = {
          'slow-2g': 0.1,  // Mbps
          '2g': 0.384,     // Mbps
          '3g': 7.2,       // Mbps
          '4g': 100        // Mbps
        }[networkType] || 100;

        const maxRTT = {
          'slow-2g': 2000,  // ms
          '2g': 1000,       // ms
          '3g': 100,        // ms
          '4g': 50          // ms
        }[networkType] || 50;

        // Calculate strength based on both metrics
        const downloadQuality = Math.min((connection.downlink / maxDownlink) * 100, 100);
        const latencyQuality = Math.min(((maxRTT - connection.rtt) / maxRTT) * 100, 100);
        
        // Weighted average favoring download speed
        signalStrength = Math.round((downloadQuality * 0.7) + (latencyQuality * 0.3));
      } else if (connection.downlink) {
        // Fallback to simple downlink-based calculation
        signalStrength = Math.min(Math.round((connection.downlink / 10) * 100), 100);
      }

      // Ensure signal strength is within valid range
      signalStrength = Math.max(0, Math.min(100, signalStrength));
    }

    console.log('Enhanced network info:', {
      type: networkType,
      downlink: connection?.downlink,
      rtt: connection?.rtt,
      effectiveType: connection?.effectiveType,
      calculatedSignalStrength: signalStrength
    });

    // Combine device info with enhanced status
    const deviceStatus = {
      batteryLevel: Math.round(batteryInfo.level * 100),
      isCharging: batteryInfo.charging,
      networkType,
      signalStrength,
      // Add location data
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      // Add estimated battery time
      batteryTimeRemaining: batteryInfo.charging ? 
        (batteryInfo.chargingTime === Infinity ? null : batteryInfo.chargingTime) :
        (batteryInfo.dischargingTime === Infinity ? null : batteryInfo.dischargingTime)
    };

    console.log('Final enhanced device status:', deviceStatus);
    return deviceStatus;
  } catch (error) {
    console.error('Error getting device status:', error);
    console.log('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });

    // Return default values with error indication
    const fallbackStatus = {
      batteryLevel: 'Unknown',
      isCharging: false,
      networkType: 'unknown',
      signalStrength: 0,
      model: 'Unknown',
      brand: 'Unknown',
      deviceType: 'tablet',
      latitude: SCHOOL_CONFIG.location.latitude,
      longitude: SCHOOL_CONFIG.location.longitude,
      accuracy: 100, // Default accuracy of 100 meters
      error: error.message
    };
    console.log('Using fallback status:', fallbackStatus);
    return fallbackStatus;
  }
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

// Update checkGeofence function
function checkGeofence(position, geofence) {
  if (!position || !geofence) {
    console.warn('Missing position or geofence data:', { position, geofence });
    return { isOutside: true, distance: Infinity };
  }

  console.log('Checking geofence with position:', position, 'and geofence:', geofence);

  // Calculate distance from school
  const distance = getDistance(
    position.latitude,
    position.longitude,
    geofence.latitude,
    geofence.longitude
  );

  // Account for position accuracy in geofence calculation
  const effectiveRadius = (geofence.radius || 100) + (position.accuracy || 0);
  const isOutside = distance > effectiveRadius;

  console.log('Geofence calculation:', {
    distance,
    effectiveRadius,
    isOutside,
    position,
    geofence,
    distanceInKm: distance / 1000
  });

  return {
    isOutside,
    distance,
    effectiveRadius
  };
}

// Update the startDeviceMonitoring function
export const startDeviceMonitoring = (deviceData) => {
  let locationWatcher = null;
  let lastValidPosition = null;
  let positionUpdateCount = 0;
  let positionBuffer = [];
  const MAX_BUFFER_SIZE = 5;
  const MAX_ACCURACY = 1500; // Increased to handle less accurate positions
  const MIN_ACCURACY = 5;  // Minimum required accuracy in meters

  // Debug logging for geolocation support
  console.log('Geolocation support check:', {
    isSupported: !!navigator.geolocation,
    protocol: window.location.protocol,
    hostname: window.location.hostname
  });

  // Start watching location with enhanced settings
  if (navigator.geolocation) {
    console.log('Requesting location permission with high accuracy...');
    
    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 0, // Always get fresh position
    };
    
    // Get initial position immediately
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        console.log('Initial position received:', {
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          }
        });

        // Update device with initial position
        const initialUpdate = {
          ...deviceData,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          location: 'School Premises'
        };

        await updateDeviceStatus(initialUpdate);
      },
      (error) => {
        console.error('Error getting initial position:', error);
      },
      geoOptions
    );
    
    // Then start watching for updates
    locationWatcher = navigator.geolocation.watchPosition(
      async (position) => {
        // Log raw position data
        console.log('Position update received:', {
          count: ++positionUpdateCount,
          accuracy: position.coords.accuracy,
          timestamp: new Date(position.timestamp).toISOString(),
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          }
        });

        // Enhanced accuracy filtering
        if (position.coords.accuracy > MAX_ACCURACY) {
          console.warn(`Position skipped - insufficient accuracy: ${position.coords.accuracy} meters (max allowed: ${MAX_ACCURACY} meters)`);
          return;
        }

        if (position.coords.accuracy < MIN_ACCURACY) {
          console.log(`Extremely accurate position received: ${position.coords.accuracy} meters`);
        }

        // Add to position buffer with quality weight
        const qualityWeight = Math.max(0, 1 - (position.coords.accuracy / MAX_ACCURACY));
        positionBuffer.push({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          weight: qualityWeight
        });

        // Keep buffer size limited
        if (positionBuffer.length > MAX_BUFFER_SIZE) {
          positionBuffer.shift();
        }

        // Calculate smoothed position using quality-weighted average
        const totalWeight = positionBuffer.reduce((sum, pos) => sum + pos.weight, 0);
        const smoothedPosition = positionBuffer.reduce((acc, pos) => {
          const weight = pos.weight / totalWeight;
          return {
            latitude: acc.latitude + (pos.latitude * weight),
            longitude: acc.longitude + (pos.longitude * weight),
            accuracy: acc.accuracy + (pos.accuracy * weight)
          };
        }, { latitude: 0, longitude: 0, accuracy: 0 });

        // Update last valid position
        lastValidPosition = {
          coords: {
            latitude: smoothedPosition.latitude,
            longitude: smoothedPosition.longitude,
            accuracy: smoothedPosition.accuracy
          },
          timestamp: position.timestamp
        };

        // Calculate position quality metrics
        const qualityMetrics = {
          accuracy: smoothedPosition.accuracy,
          age: Date.now() - position.timestamp,
          confidence: Math.max(0, Math.min(100, 100 - (smoothedPosition.accuracy / 2))),
          sampleSize: positionBuffer.length,
          averageWeight: totalWeight / positionBuffer.length
        };

        console.log('Position quality metrics:', qualityMetrics);
        console.log('Smoothed position:', smoothedPosition);

        const updatedData = {
          ...deviceData,
          latitude: smoothedPosition.latitude,
          longitude: smoothedPosition.longitude,
          accuracy: smoothedPosition.accuracy,
          location: 'School Premises',
          location_accuracy: smoothedPosition.accuracy,
          location_timestamp: position.timestamp,
          location_confidence: qualityMetrics.confidence,
          location_samples: qualityMetrics.sampleSize
        };

        // Check geofence with improved accuracy
        if (deviceData.geofence) {
          const geofenceResult = checkGeofence(
            { 
              latitude: smoothedPosition.latitude, 
              longitude: smoothedPosition.longitude,
              accuracy: smoothedPosition.accuracy
            },
            deviceData.geofence
          );
          
          updatedData.is_outside_geofence = geofenceResult.isOutside;
          updatedData.location = geofenceResult.isOutside ? 'Outside School Premises' : 'School Premises';
          
          console.log('Geofence check result:', {
            isOutside: geofenceResult.isOutside,
            distance: geofenceResult.distance,
            accuracy: smoothedPosition.accuracy,
            effectiveRadius: geofenceResult.effectiveRadius
          });
        }

        // Update device status with smoothed location
        await updateDeviceStatus(updatedData);
      },
      (error) => {
        console.error('Geolocation error:', {
          code: error.code,
          message: error.message,
          PERMISSION_DENIED: error.code === 1,
          POSITION_UNAVAILABLE: error.code === 2,
          TIMEOUT: error.code === 3
        });
        
        // Update device status with error information
        updateDeviceStatus({
          ...deviceData,
          location: 'Location Error: ' + error.message,
          location_error: error.code
        });
      },
      geoOptions
    );

    // Add permission state monitoring
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        console.log('Geolocation permission status:', result.state);
        
        result.addEventListener('change', () => {
          console.log('Geolocation permission changed:', result.state);
        });
      });
    }
  } else {
    console.error('Geolocation is not supported by this browser');
    updateDeviceStatus({
      ...deviceData,
      location: 'Location Not Supported'
    });
  }

  // Send initial status update
  updateDeviceStatus(deviceData);

  // Set up heartbeat interval (every minute)
  const heartbeatInterval = setInterval(() => {
    if (lastValidPosition) {
      const updatedHeartbeatData = {
        ...deviceData,
        latitude: lastValidPosition.coords.latitude,
        longitude: lastValidPosition.coords.longitude,
        accuracy: lastValidPosition.coords.accuracy
      };
      sendDeviceHeartbeat(updatedHeartbeatData);
    } else {
      sendDeviceHeartbeat(deviceData);
    }
  }, 60000);

  // Return cleanup function
  return () => {
    if (locationWatcher !== null) {
      navigator.geolocation.clearWatch(locationWatcher);
    }
    clearInterval(heartbeatInterval);
  };
}; 