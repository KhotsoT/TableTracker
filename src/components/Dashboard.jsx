import { useState, useEffect } from 'react'
import { AlertTriangle, History, MapPin, CheckCircle, Tablet, Users } from 'lucide-react'
import { Card } from './ui/card'
import { db } from '../config/firebase'
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore'

function Dashboard() {
  const [stats, setStats] = useState({
    totalTablets: 0,
    activeTablets: 0,
    totalStudents: 0,
    alerts: 0,
  })

  const [schoolInfo, setSchoolInfo] = useState({
    name: '',
    address: '',
    principalName: ''
  })

  const [recentActivity, setRecentActivity] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const SCHOOL_ID = 'st-marys'

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
      
      // Fetch alerts
      const alertsRef = collection(db, 'schools', SCHOOL_ID, 'alerts')
      const alertsQuery = query(alertsRef, orderBy('createdAt', 'desc'), limit(10))
      const alertsSnap = await getDocs(alertsQuery)
      
      setStats({
        totalTablets: devices.length,
        activeTablets: activeDevices.length,
        totalStudents,
        alerts: alertsSnap.size
      })
      
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{schoolInfo.name}</h1>
        <p className="text-gray-600">
          {schoolInfo.address} | Principal: {schoolInfo.principalName}
        </p>
        <p className="text-sm text-gray-500 mt-1">{new Date().toLocaleDateString()}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-6 space-y-4">
          <div className="flex items-center space-x-3">
            <Tablet className="w-6 h-6 text-blue-500" />
            <h3 className="text-lg font-medium text-gray-900">School Tablets</h3>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">{stats.totalTablets}</p>
            <p className="text-sm text-gray-600">{stats.activeTablets} Active</p>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center space-x-3">
            <Users className="w-6 h-6 text-green-500" />
            <h3 className="text-lg font-medium text-gray-900">Students</h3>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">{stats.totalStudents}</p>
            <p className="text-sm text-gray-600">Assigned Devices</p>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <h3 className="text-lg font-medium text-gray-900">Active Alerts</h3>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">{stats.alerts}</p>
            <p className="text-sm text-gray-600">Require Attention</p>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <div className="flex items-center space-x-2 p-4 border-b">
          <History className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-medium text-gray-900">Recent Activity</h2>
        </div>
        <div className="divide-y">
          {recentActivity.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3 p-4">
              {activity.type === 'alert' && <AlertTriangle className="w-4 h-4 text-red-500 mt-1 shrink-0" />}
              {activity.type === 'location' && <MapPin className="w-4 h-4 text-blue-500 mt-1 shrink-0" />}
              {activity.type === 'status' && <CheckCircle className="w-4 h-4 text-green-500 mt-1 shrink-0" />}
              
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">{activity.device}</p>
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
        </div>
      </Card>
    </div>
  )
}

export default Dashboard 