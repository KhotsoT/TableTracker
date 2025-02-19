import { useState, useEffect } from 'react'
import { AlertTriangle, History, MapPin, CheckCircle, Tablet, Users, Wallet } from 'lucide-react'
import { Card } from './ui/card'
import { db, SCHOOL_ID, SCHOOL_NAME } from '../config/firebase'
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { getSMSBalance } from '../services/smsService'
import { PageContainer, PageHeader } from './Layout'

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
    <div className="min-h-screen bg-gray-100">
      {/* Top Stats Bar */}
      <div className="bg-white border-b">
        <div className="h-16 flex items-center px-8">
          <div className="max-w-7xl mx-auto">
            <PageHeader
              title={SCHOOL_NAME}
              subtitle={schoolInfo.address}
            >
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>{new Date().toLocaleDateString()}</span>
                <span>•</span>
                <span>Credits: {stats.smsCredit}</span>
              </div>
            </PageHeader>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-8 py-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* SMS Credits Card */}
          <Card className="bg-white overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-purple-50">
                  <Wallet className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">SMS Credits</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.smsCredit}</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-3 bg-purple-50 border-t border-purple-100">
              <span className="text-sm text-purple-600">Available for messages</span>
            </div>
          </Card>

          {/* Students Card */}
          <Card className="bg-white overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-blue-50/50">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Students</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.totalStudents}</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-3 bg-blue-50 border-t border-blue-100">
              <span className="text-sm text-blue-600">Active enrollments</span>
            </div>
          </Card>

          {/* Devices Card */}
          <Card className="bg-white overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-green-50">
                  <Tablet className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Active Devices</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {stats.activeTablets}/{stats.totalTablets}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 py-3 bg-green-50 border-t border-green-100">
              <span className="text-sm text-green-600">Devices tracked</span>
            </div>
          </Card>
        </div>

        {/* Activity Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
              <span className="text-sm text-gray-500">Last 24 hours</span>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 px-6 py-4 hover:bg-gray-50 transition-colors">
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
                      <p className="font-medium text-gray-900 mb-1">{activity.device}</p>
                      <p className="text-gray-600 text-sm leading-relaxed">{activity.message}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {activity.student} - {activity.grade}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap ml-4">{activity.time}</span>
                  </div>
                </div>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <div className="px-6 py-12 text-center">
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