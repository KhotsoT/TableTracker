import { useState, useEffect } from 'react'
import { FaTablet, FaUserGraduate, FaExclamationTriangle, FaCheckCircle, FaHistory } from 'react-icons/fa'
import { MdLocationOn } from 'react-icons/md'

function Dashboard() {
  const [stats, setStats] = useState({
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
      student: 'John Smith - Grade 11A',
      message: 'Device left school premises',
      time: '2 minutes ago'
    },
    {
      id: 2,
      type: 'location',
      device: 'iPad-1578',
      student: 'Mary Johnson - Grade 10B',
      message: 'Location updated: Library',
      time: '5 minutes ago'
    },
    {
      id: 3,
      type: 'status',
      device: 'iPad-3642',
      student: 'David Brown - Grade 12C',
      message: 'Device back online',
      time: '10 minutes ago'
    }
  ])

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="school-info">
          <h1>{schoolInfo.name}</h1>
          <p className="school-details">
            {schoolInfo.address} | Principal: {schoolInfo.principalName}
          </p>
        </div>
        <div className="date-time">{new Date().toLocaleDateString()}</div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <FaTablet />
          </div>
          <div className="stat-content">
            <h3>School Tablets</h3>
            <p className="stat-number">{stats.totalTablets}</p>
            <p className="stat-detail">
              {stats.activeTablets} Active
            </p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <FaUserGraduate />
          </div>
          <div className="stat-content">
            <h3>Students</h3>
            <p className="stat-number">{stats.totalStudents}</p>
            <p className="stat-detail">
              Assigned Devices
            </p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon alert">
            <FaExclamationTriangle />
          </div>
          <div className="stat-content">
            <h3>Active Alerts</h3>
            <p className="stat-number">{stats.alerts}</p>
            <p className="stat-detail">
              Require Attention
            </p>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card activity-feed">
          <div className="card-header">
            <h2><FaHistory /> Recent Activity</h2>
          </div>
          <div className="activity-list">
            {recentActivity.map(activity => (
              <div key={activity.id} className={`activity-item ${activity.type}`}>
                <div className="activity-icon">
                  {activity.type === 'alert' && <FaExclamationTriangle />}
                  {activity.type === 'location' && <MdLocationOn />}
                  {activity.type === 'status' && <FaCheckCircle />}
                </div>
                <div className="activity-content">
                  <h4>{activity.device}</h4>
                  <p>{activity.message}</p>
                  <div className="activity-meta">
                    <span className="student">{activity.student}</span>
                    <span className="time">{activity.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-card quick-actions">
          <div className="card-header">
            <h2>Quick Actions</h2>
          </div>
          <div className="quick-actions-grid">
            <button className="action-button">
              <MdLocationOn />
              Track Device
            </button>
            <button className="action-button">
              <FaTablet />
              Assign Device
            </button>
            <button className="action-button">
              <FaUserGraduate />
              Add Student
            </button>
            <button className="action-button">
              <FaExclamationTriangle />
              View Alerts
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard 