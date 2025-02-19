import { useState } from 'react'
import { Tablet, Users, AlertTriangle, History, MapPin, CheckCircle } from 'lucide-react'
import { Card } from './ui/card'

function Dashboard() {
  const [stats] = useState({
    totalTablets: 247,
    activeTablets: 243,
    totalStudents: 250,
    alerts: 4,
  })

  const [schoolInfo] = useState({
    name: "St. Mary's High School",
    address: "123 Education Street, Pretoria",
    principalName: "Dr. Sarah Johnson"
  })

  const [recentActivity] = useState([
    {
      id: 1,
      type: 'alert',
      device: 'iPad-2389',
      student: 'John Smith',
      grade: 'Grade 11A',
      message: 'Device left school premises',
      time: '2 minutes ago'
    },
    {
      id: 2,
      type: 'location',
      device: 'iPad-1578',
      student: 'Mary Johnson',
      grade: 'Grade 10B',
      message: 'Location updated: Library',
      time: '5 minutes ago'
    },
    {
      id: 3,
      type: 'status',
      device: 'iPad-3642',
      student: 'David Brown',
      grade: 'Grade 12C',
      message: 'Device back online',
      time: '10 minutes ago'
    }
  ])

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-gray-900">{schoolInfo.name}</h1>
        <p className="text-gray-500">
          {schoolInfo.address} | Principal: {schoolInfo.principalName}
        </p>
        <p className="text-sm text-gray-400">{new Date().toLocaleDateString()}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-6">
        <Card className="p-6 space-y-4">
          <div className="flex items-center space-x-3">
            <Tablet className="w-6 h-6 text-blue-500" />
            <h3 className="text-lg font-medium text-gray-700">School Tablets</h3>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">{stats.totalTablets}</p>
            <p className="text-sm text-gray-500">{stats.activeTablets} Active</p>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center space-x-3">
            <Users className="w-6 h-6 text-green-500" />
            <h3 className="text-lg font-medium text-gray-700">Students</h3>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">{stats.totalStudents}</p>
            <p className="text-sm text-gray-500">Assigned Devices</p>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <h3 className="text-lg font-medium text-gray-700">Active Alerts</h3>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">{stats.alerts}</p>
            <p className="text-sm text-gray-500">Require Attention</p>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="p-6">
        <div className="flex items-center space-x-2 mb-6">
          <History className="w-5 h-5 text-gray-500" />
          <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
        </div>
        <div className="space-y-4">
          {recentActivity.map((activity) => (
            <div key={activity.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
              {activity.type === 'alert' && <AlertTriangle className="w-5 h-5 text-red-500 mt-1" />}
              {activity.type === 'location' && <MapPin className="w-5 h-5 text-blue-500 mt-1" />}
              {activity.type === 'status' && <CheckCircle className="w-5 h-5 text-green-500 mt-1" />}
              
              <div className="flex-1">
                <div className="flex justify-between">
                  <p className="font-medium text-gray-900">{activity.device}</p>
                  <span className="text-sm text-gray-500">{activity.time}</span>
                </div>
                <p className="text-gray-600">{activity.message}</p>
                <p className="text-sm text-gray-500">
                  {activity.student} - {activity.grade}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

export default Dashboard 