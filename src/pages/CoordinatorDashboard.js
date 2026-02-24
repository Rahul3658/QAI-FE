import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

const CoordinatorDashboard = () => {
  const { user } = useContext(AuthContext);

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">🎯 Coordinator Dashboard</h1>
        <p className="dashboard-subtitle">Welcome, {user?.name}</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">📅 Total Events</div>
          <div className="stat-value">0</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">✨ Active Events</div>
          <div className="stat-value">0</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">👥 Participants</div>
          <div className="stat-value">0</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">🏆 Completed</div>
          <div className="stat-value">0</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">⚡ Quick Actions</h2>
        </div>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', padding: '1.5rem'}}>
          <button className="btn btn-primary">📝 Create Event</button>
          <button className="btn btn-primary">🎪 Manage Events</button>
          <button className="btn btn-secondary">📊 View Reports</button>
          <button className="btn btn-secondary">⚙️ Settings</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">📋 Recent Activity</h2>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <p>No recent activity</p>
          <button className="btn btn-primary btn-sm" style={{marginTop: '1rem'}}>
            Create Your First Event
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoordinatorDashboard;
