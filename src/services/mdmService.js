import axios from 'axios';

const MDM_API_URL = import.meta.env.VITE_MDM_API_URL;
const MDM_API_KEY = import.meta.env.VITE_MDM_API_KEY;

// Configure axios instance for Miradore
const mdmApi = axios.create({
  baseURL: MDM_API_URL,
  headers: {
    'Authorization': `Bearer ${MDM_API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Helper function to handle API responses
const handleResponse = (response) => {
  if (response.status === 200 || response.status === 201) {
    return { success: true, data: response.data };
  }
  return { 
    success: false, 
    error: response.data?.message || 'Failed to get data from MDM'
  };
};

// Helper function to handle API errors
const handleError = (error) => {
  console.error('MDM API Error:', error);
  return {
    success: false,
    error: error.response?.data?.message || error.message || 'MDM API Error'
  };
};

/**
 * Get device information from Miradore MDM
 */
export const getDeviceFromMDM = async (deviceId) => {
  try {
    // First try to find the device by IMEI/Serial
    const searchResponse = await mdmApi.get(`/api/v1/devices`, {
      params: {
        $filter: `imei eq '${deviceId}' or serialnumber eq '${deviceId}'`
      }
    });

    if (!searchResponse.data?.value?.[0]) {
      return {
        success: false,
        error: 'Device not found in MDM'
      };
    }

    const device = searchResponse.data.value[0];
    
    // Get detailed device info
    const detailResponse = await mdmApi.get(`/api/v1/devices/${device.id}`);
    const deviceDetails = detailResponse.data;

    return {
      success: true,
      data: {
        // Device identification
        device_id: deviceDetails.id,
        serial_number: deviceDetails.serialNumber,
        imei: deviceDetails.imei,
        model: deviceDetails.model,
        model_name: deviceDetails.modelName,
        
        // OS information
        os_version: deviceDetails.osVersion,
        build_version: deviceDetails.buildVersion,
        
        // Hardware details
        total_storage: deviceDetails.totalStorage,
        available_storage: deviceDetails.availableStorage,
        
        // Network information
        wifi_mac: deviceDetails.wifiMacAddress,
        cellular_technology: deviceDetails.cellularTechnology,
        carrier: deviceDetails.carrier,
        
        // Battery information
        battery_level: deviceDetails.batteryLevel,
        battery_status: deviceDetails.batteryStatus,
        
        // Security status
        supervised: deviceDetails.isSupervised,
        managed: deviceDetails.isManaged,
        encrypted: deviceDetails.isEncrypted,
        passcode_enabled: deviceDetails.hasPasscode,
        
        // Management details
        enrollment_status: deviceDetails.enrollmentStatus,
        last_check_in: deviceDetails.lastCheckIn,
        
        // Device status
        device_status: deviceDetails.status,
        compliance_status: deviceDetails.complianceStatus
      }
    };
  } catch (error) {
    return handleError(error);
  }
};

/**
 * Get device location from Miradore MDM
 */
export const getDeviceLocation = async (deviceId) => {
  try {
    // First get device ID from IMEI/Serial
    const searchResponse = await mdmApi.get(`/api/v1/devices`, {
      params: {
        $filter: `imei eq '${deviceId}' or serialnumber eq '${deviceId}'`
      }
    });

    if (!searchResponse.data?.value?.[0]) {
      return {
        success: false,
        error: 'Device not found in MDM'
      };
    }

    const device = searchResponse.data.value[0];
    
    // Get location information
    const locationResponse = await mdmApi.get(`/api/v1/devices/${device.id}/location`);
    const location = locationResponse.data;

    return {
      success: true,
      data: {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        timestamp: location.timestamp,
        is_outside_geofence: false // Will be calculated by deviceService
      }
    };
  } catch (error) {
    return handleError(error);
  }
};

/**
 * Get device security status from Miradore MDM
 */
export const getDeviceSecurityStatus = async (deviceId) => {
  try {
    // First get device ID from IMEI/Serial
    const searchResponse = await mdmApi.get(`/api/v1/devices`, {
      params: {
        $filter: `imei eq '${deviceId}' or serialnumber eq '${deviceId}'`
      }
    });

    if (!searchResponse.data?.value?.[0]) {
      return {
        success: false,
        error: 'Device not found in MDM'
      };
    }

    const device = searchResponse.data.value[0];
    
    // Get security information
    const securityResponse = await mdmApi.get(`/api/v1/devices/${device.id}/security`);
    const security = securityResponse.data;

    return {
      success: true,
      data: {
        passcode_enabled: security.hasPasscode,
        encrypted: security.isEncrypted,
        jailbroken: security.isJailbroken,
        threats_detected: security.threatsDetected,
        last_security_scan: security.lastSecurityScan
      }
    };
  } catch (error) {
    return handleError(error);
  }
};

// Export additional helper functions
export const isMDMConfigured = () => {
  return Boolean(MDM_API_URL && MDM_API_KEY);
};

export const getMDMStatus = () => {
  if (!isMDMConfigured()) {
    return {
      configured: false,
      message: 'MDM not configured'
    };
  }
  return {
    configured: true,
    provider: 'Miradore',
    apiUrl: MDM_API_URL
  };
}; 