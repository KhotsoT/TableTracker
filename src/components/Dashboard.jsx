import { useState, useEffect } from 'react'
import { AlertTriangle, History, MapPin, CheckCircle, Tablet, Users, Wallet } from 'lucide-react'
import { Card } from './ui/card'
import { db, SCHOOL_ID, SCHOOL_NAME } from '../config/firebase'
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { getSMSBalance } from '../services/smsService'

function Dashboard() {
  const [stats, setStats] = useState({
    totalTablets: 0,
    activeTablets: 0,
    totalStudents: 0,
    smsCredit: 0,
  })

  const [schoolInfo, setSchoolInfo] = useState({
    name: '',
    address: '',
  })

  const [recentActivity, setRecentActivity] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true)
      
      // Fetch school info
      const schoolRef = doc(db, 'schools', SCHOOL_ID)
      const schoolDoc = await getDoc(schoolRef)
      if (schoolDoc.exists()) {
        setSchoolInfo(schoolDoc.data())
      }
      
      // Fetch contacts for student count
      const contactsRef = collection(db, 'schools', SCHOOL_ID, 'contacts')
      const contactsSnap = await getDocs(contactsRef)
      const totalStudents = contactsSnap.size
      
      // Fetch devices
      const devicesRef = collection(db, 'schools', SCHOOL_ID, 'devices')
      const devicesSnap = await getDocs(devicesRef)
      const devices = devicesSnap.docs.map(doc => doc.data())
      const activeDevices = devices.filter(device => device.status === 'active')
      
      // Fetch real SMS credit from API
      const smsCredit = await getSMSBalance()
      
      setStats({
        totalTablets: devices.length,
        activeTablets: activeDevices.length,
        totalStudents,
        smsCredit
      })
      
      // Fetch alerts
      const alertsRef = collection(db, 'schools', SCHOOL_ID, 'alerts')
      const alertsQuery = query(alertsRef, orderBy('createdAt', 'desc'), limit(10))
      const alertsSnap = await getDocs(alertsQuery)
      
      // Format recent activity
      const activity = alertsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        time: formatTime(doc.data().createdAt?.toDate())
      }))
      setRecentActivity(activity)
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      setError('Failed to load dashboard data')
    } finally {
      setIsLoading(false)
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

  if (isLoading) {
    return <div className="p-6">Loading dashboard...</div>
  }

  if (error) {
    return <div className="p-6 text-red-600">{error}</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/50 to-white">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-gray-200 pb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{SCHOOL_NAME}</h1>
            <p className="text-gray-600 mt-1">
              {schoolInfo.address}
            </p>
          </div>
          <p className="text-sm text-gray-500">{new Date().toLocaleDateString()}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-600">SMS Credit</h3>
                <p className="text-2xl font-semibold text-gray-900 mt-1">{stats.smsCredit}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-600">Total Students</h3>
                <p className="text-2xl font-semibold text-gray-900 mt-1">{stats.totalStudents}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Tablet className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-600">Active Devices</h3>
                <p className="text-2xl font-semibold text-gray-900 mt-1">
                  {stats.activeTablets}/{stats.totalTablets}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="border-0 shadow-none bg-white/50 backdrop-blur-sm">
          <div className="flex items-center space-x-2 p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors">
                {activity.type === 'alert' && 
                  <AlertTriangle className="w-4 h-4 text-red-500 mt-1 shrink-0" />
                }
                {activity.type === 'location' && 
                  <MapPin className="w-4 h-4 text-blue-500 mt-1 shrink-0" />
                }
                {activity.type === 'status' && 
                  <CheckCircle className="w-4 h-4 text-green-500 mt-1 shrink-0" />
                }
                
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900 mb-0.5">{activity.device}</p>
                      <p className="text-gray-600 mt-0.5">{activity.message}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {activity.student} - {activity.grade}
                      </p>
                    </div>
                    <span className="text-sm text-gray-500">{activity.time}</span>
                  </div>
                </div>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <div className="p-8 text-center">
                <History className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No recent activity</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

export default Dashboard 