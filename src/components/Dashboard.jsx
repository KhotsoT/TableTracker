import { useState, useEffect } from 'react'
import { AlertTriangle, History, MapPin, CheckCircle, Tablet, Users, Wallet, Battery, Wifi } from 'lucide-react'
import { Card } from './ui/card'
import { db, SCHOOL_ID, SCHOOL_NAME } from '../config/firebase'
import { doc, getDoc, collection, query, orderBy, limit, getDocs, setDoc, onSnapshot, where } from 'firebase/firestore'
import { getSMSBalance } from '../services/smsService'
import { PageContainer, PageHeader } from './Layout'
import { getAuth } from 'firebase/auth'

function Dashboard() {
  const [stats, setStats] = useState({
    totalTablets: 0,
    activeTablets: 0,
    totalStudents: 0,
    smsCredit: 0,
    activeDevices: 0
  })

  const [schoolInfo, setSchoolInfo] = useState({
    name: '',
    address: '',
  })

  const [recentActivity, setRecentActivity] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [schoolExists, setSchoolExists] = useState(false)

  const getDeviceStatus = async (deviceData) => {
    if (!deviceData.imei) return false;
    
    try {
      // First check our device_status collection for the most recent status
      const statusRef = collection(db, 'device_status');
      const statusQuery = query(
        statusRef,
        where('imei', '==', deviceData.imei),
        where('timestamp', '>=', new Date(Date.now() - 5 * 60 * 1000)), // Last 5 minutes
        orderBy('timestamp', 'desc'),
        limit(1)
      );
      
      const statusSnap = await getDocs(statusQuery);
      
      if (!statusSnap.empty) {
        const latestStatus = statusSnap.docs[0].data();
        return {
          isActive: true,
          batteryLevel: latestStatus.battery_level,
          isCharging: latestStatus.is_charging,
          networkType: latestStatus.network_type,
          signalStrength: latestStatus.signal_strength,
          location: latestStatus.location,
          isOutsideGeofence: latestStatus.is_outside_geofence,
          lastUpdate: latestStatus.timestamp?.toDate()
        };
      }

      // If no recent status, check device heartbeat collection
      const heartbeatRef = collection(db, 'device_heartbeats');
      const heartbeatQuery = query(
        heartbeatRef,
        where('imei', '==', deviceData.imei),
        where('timestamp', '>=', new Date(Date.now() - 5 * 60 * 1000)),
        orderBy('timestamp', 'desc'),
        limit(1)
      );

      const heartbeatSnap = await getDocs(heartbeatQuery);
      
      if (!heartbeatSnap.empty) {
        const latestHeartbeat = heartbeatSnap.docs[0].data();
        return {
          isActive: true,
          batteryLevel: latestHeartbeat.battery_level,
          isCharging: latestHeartbeat.is_charging,
          networkType: latestHeartbeat.network_type,
          signalStrength: latestHeartbeat.signal_strength,
          location: latestHeartbeat.location,
          isOutsideGeofence: latestHeartbeat.is_outside_geofence,
          lastUpdate: latestHeartbeat.timestamp?.toDate()
        };
      }

      // If no recent data found in either collection, device is considered offline
      return {
        isActive: false,
        lastUpdate: deviceData.last_seen?.toDate() || null
      };
    } catch (error) {
      console.error('Error checking device status:', error);
      return {
        isActive: false,
        error: error.message
      };
    }
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Check if user is authenticated
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) {
          throw new Error('User not authenticated');
        }
        
        // Check if school exists first
        const exists = await checkSchoolExists();
        setSchoolExists(exists);
        
        if (!exists) {
          setError('School not initialized');
          return;
        }
        
        // Fetch school info
        const schoolRef = doc(db, 'schools', SCHOOL_ID);
        const schoolDoc = await getDoc(schoolRef);
        if (schoolDoc.exists()) {
          setSchoolInfo(schoolDoc.data());
        }
        
        // Set up real-time listeners
        const contactsRef = collection(db, 'schools', SCHOOL_ID, 'contacts');
        const devicesRef = collection(db, 'schools', SCHOOL_ID, 'devices');
        const alertsRef = collection(db, 'schools', SCHOOL_ID, 'alerts');
        
        // Real-time contacts listener
        const unsubContacts = onSnapshot(contactsRef, (snapshot) => {
          const totalStudents = snapshot.docs.length;
          setStats(prev => ({ ...prev, totalStudents }));
        });

        // Real-time devices listener with enhanced status check
        const unsubDevices = onSnapshot(devicesRef, async (snapshot) => {
          const devices = snapshot.docs.map(doc => doc.data());
          const deviceStatuses = await Promise.all(
            devices.map(async device => {
              const status = await getDeviceStatus(device);
              return {
                ...device,
                ...status
              };
            })
          );
          
          const activeDevices = deviceStatuses.filter(d => d.isActive);
          
          setStats(prev => ({
            ...prev,
            totalTablets: devices.length,
            activeTablets: activeDevices.length,
            activeDevices: activeDevices.length,
            deviceStatuses // Store full status information
          }));
        });

        // Real-time alerts listener
        const alertsQuery = query(alertsRef, orderBy('createdAt', 'desc'), limit(10));
        const unsubAlerts = onSnapshot(alertsQuery, (snapshot) => {
          const activity = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            time: formatTime(doc.data().createdAt?.toDate())
          }));
          setRecentActivity(activity);
        });

        // Fetch SMS balance
        const smsBalance = await getSMSBalance();
        setStats(prev => ({ ...prev, smsCredit: smsBalance }));
        
        setIsLoading(false);

        // Cleanup function
        return () => {
          unsubContacts();
          unsubDevices();
          unsubAlerts();
        };
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setError(error.message);
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const checkSchoolExists = async () => {
    try {
      const schoolRef = doc(db, 'schools', SCHOOL_ID)
      const schoolSnap = await getDoc(schoolRef)
      return schoolSnap.exists()
    } catch (error) {
      console.error('Error checking school:', error)
      return false
    }
  }

  const formatTime = (date) => {
    if (!date) return 'Unknown'
    const minutes = Math.floor((new Date() - date) / 60000)
    if (minutes < 60) return `${minutes} minutes ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} hours ago`
    return date.toLocaleDateString()
  }

  const initializeSchool = async () => {
    try {
      const schoolRef = doc(db, 'schools', SCHOOL_ID)
      await setDoc(schoolRef, {
        name: "Curtis Nkondo SoS",
        createdAt: new Date()
      }, { merge: true })  // merge: true will not overwrite if doc exists
      
      console.log('School document initialized')
      // Refresh the dashboard data
      fetchDashboardData()
    } catch (error) {
      console.error('Error initializing school:', error)
    }
  }

  const DeviceStatusCard = ({ device }) => {
    return (
      <div className="p-4 border-b last:border-b-0 hover:bg-gray-50">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-medium text-gray-900">{device.device_id}</h3>
            <p className="text-sm text-gray-500">{device.learner_name} - Grade {device.grade}</p>
          </div>
          <div className="flex items-center gap-2">
            {device.isActive ? (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                Active
              </span>
            ) : (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                Offline
              </span>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mt-3">
          <div className="flex items-center gap-2">
            <Battery className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">
              {device.batteryLevel}% {device.isCharging && '(Charging)'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">
              {device.networkType} ({device.signalStrength}%)
            </span>
          </div>
        </div>
        
        {device.location && (
          <div className="flex items-center gap-2 mt-2">
            <MapPin className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">{device.location}</span>
            {device.isOutsideGeofence && (
              <span className="flex items-center gap-1 text-xs text-red-600">
                <AlertTriangle className="w-3 h-3" />
                Outside Geofence
              </span>
            )}
          </div>
        )}
        
        <div className="text-xs text-gray-400 mt-2">
          Last updated: {formatTime(device.lastUpdate)}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return <div className="p-6">Loading dashboard...</div>
  }

  if (!schoolExists) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">School Not Initialized</h2>
          <button 
            onClick={initializeSchool}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Initialize School Data
          </button>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100">
        {/* Top Stats Bar */}
        <div className="bg-white border-b">
          <div className="min-h-[5rem] flex items-center px-4 sm:px-8 py-4">
            <div className="max-w-7xl mx-auto w-full space-y-1">
              <PageHeader
                title={SCHOOL_NAME}
              >
                <div className="hidden sm:flex items-center gap-4 text-sm text-gray-500">
                  <span>{new Date().toLocaleDateString()}</span>
                </div>
              </PageHeader>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-8 space-y-4 sm:space-y-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
            {/* SMS Credits Card */}
            <Card className="bg-white overflow-hidden">
              <div className="p-4 sm:p-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-green-50">
                    <Wallet className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">SMS Credits</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {isLoading ? (
                        <span className="inline-block w-12 h-8 bg-gray-200 animate-pulse rounded" />
                      ) : (
                        stats.smsCredit || '0'
                      )}
                    </p>
                  </div>
                </div>
              </div>
              <div className="px-4 sm:px-8 py-3 sm:py-4 bg-green-50 border-t border-green-100">
                <span className="text-sm text-green-600">Available for messages</span>
              </div>
            </Card>

            {/* Students Card */}
            <Card className="bg-white overflow-hidden">
              <div className="p-4 sm:p-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-blue-50/50">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Total Students</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {isLoading ? (
                        <span className="inline-block w-12 h-8 bg-gray-200 animate-pulse rounded" />
                      ) : (
                        stats.totalStudents
                      )}
                    </p>
                  </div>
                </div>
              </div>
              <div className="px-4 sm:px-8 py-3 sm:py-4 bg-blue-50 border-t border-blue-100">
                <span className="text-sm text-blue-600">Active enrollments</span>
              </div>
            </Card>

            {/* Devices Card */}
            <Card className="bg-white overflow-hidden">
              <div className="p-4 sm:p-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-green-50">
                    <Tablet className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Active Devices</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {isLoading ? (
                        <span className="inline-block w-20 h-8 bg-gray-200 animate-pulse rounded" />
                      ) : (
                        `${stats.activeTablets}/${stats.totalTablets}`
                      )}
                    </p>
                  </div>
                </div>
              </div>
              <div className="px-4 sm:px-8 py-3 sm:py-4 bg-green-50 border-t border-green-100">
                <span className="text-sm text-green-600">Devices tracked</span>
              </div>
            </Card>
          </div>

          {/* Activity Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-4 sm:px-8 py-4 sm:py-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
                <span className="text-xs sm:text-sm text-gray-500">Last 24 hours</span>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 sm:gap-4 px-4 sm:px-8 py-4 sm:py-6 hover:bg-gray-50 transition-colors">
                  {activity.type === 'alert' && 
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-1 shrink-0" />
                  }
                  {activity.type === 'location' && 
                    <MapPin className="w-4 h-4 text-blue-500 mt-1 shrink-0" />
                  }
                  {activity.type === 'status' && 
                    <CheckCircle className="w-4 h-4 text-green-500 mt-1 shrink-0" />
                  }
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
                      <div>
                        <p className="font-medium text-gray-900 mb-2">{activity.device}</p>
                        <p className="text-gray-600 text-sm leading-relaxed line-clamp-2 sm:line-clamp-none">{activity.message}</p>
                        <p className="text-sm text-gray-500 mt-2">
                          {activity.student} - {activity.grade}
                        </p>
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap mt-2 sm:mt-0 sm:ml-4">{activity.time}</span>
                    </div>
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <div className="px-4 sm:px-8 py-12 sm:py-16 text-center">
                  <History className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No recent activity to show</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top Stats Bar */}
      <div className="bg-white border-b">
        <div className="min-h-[5rem] flex items-center px-4 sm:px-8 py-4">
          <div className="max-w-7xl mx-auto w-full space-y-1">
            <PageHeader
              title={SCHOOL_NAME}
            >
              <div className="hidden sm:flex items-center gap-4 text-sm text-gray-500">
                <span>{new Date().toLocaleDateString()}</span>
              </div>
            </PageHeader>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-8 space-y-4 sm:space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
          {/* SMS Credits Card */}
          <Card className="bg-white overflow-hidden">
            <div className="p-4 sm:p-8">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-green-50">
                  <Wallet className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">SMS Credits</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {isLoading ? (
                      <span className="inline-block w-12 h-8 bg-gray-200 animate-pulse rounded" />
                    ) : (
                      stats.smsCredit || '0'
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-4 sm:px-8 py-3 sm:py-4 bg-green-50 border-t border-green-100">
              <span className="text-sm text-green-600">Available for messages</span>
            </div>
          </Card>

          {/* Students Card */}
          <Card className="bg-white overflow-hidden">
            <div className="p-4 sm:p-8">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-blue-50/50">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Students</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {isLoading ? (
                      <span className="inline-block w-12 h-8 bg-gray-200 animate-pulse rounded" />
                    ) : (
                      stats.totalStudents
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-4 sm:px-8 py-3 sm:py-4 bg-blue-50 border-t border-blue-100">
              <span className="text-sm text-blue-600">Active enrollments</span>
            </div>
          </Card>

          {/* Devices Card */}
          <Card className="bg-white overflow-hidden">
            <div className="p-4 sm:p-8">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-green-50">
                  <Tablet className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Active Devices</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {isLoading ? (
                      <span className="inline-block w-20 h-8 bg-gray-200 animate-pulse rounded" />
                    ) : (
                      `${stats.activeTablets}/${stats.totalTablets}`
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-4 sm:px-8 py-3 sm:py-4 bg-green-50 border-t border-green-100">
              <span className="text-sm text-green-600">Devices tracked</span>
            </div>
          </Card>
        </div>

        {/* Activity Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-4 sm:px-8 py-4 sm:py-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
              <span className="text-xs sm:text-sm text-gray-500">Last 24 hours</span>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 sm:gap-4 px-4 sm:px-8 py-4 sm:py-6 hover:bg-gray-50 transition-colors">
                {activity.type === 'alert' && 
                  <AlertTriangle className="w-4 h-4 text-red-500 mt-1 shrink-0" />
                }
                {activity.type === 'location' && 
                  <MapPin className="w-4 h-4 text-blue-500 mt-1 shrink-0" />
                }
                {activity.type === 'status' && 
                  <CheckCircle className="w-4 h-4 text-green-500 mt-1 shrink-0" />
                }
                
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
                    <div>
                      <p className="font-medium text-gray-900 mb-2">{activity.device}</p>
                      <p className="text-gray-600 text-sm leading-relaxed line-clamp-2 sm:line-clamp-none">{activity.message}</p>
                      <p className="text-sm text-gray-500 mt-2">
                        {activity.student} - {activity.grade}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap mt-2 sm:mt-0 sm:ml-4">{activity.time}</span>
                  </div>
                </div>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <div className="px-4 sm:px-8 py-12 sm:py-16 text-center">
                <History className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No recent activity to show</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard 