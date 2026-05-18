import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataService, alertService } from '../services/authService';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, alertsData] = await Promise.all([
          dataService.getStats(),
          alertService.getAlerts(),
        ]);
        setStats(statsData);
        setAlerts(alertsData.alerts?.slice(0, 5) || []);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="loading">Loading dashboard...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Welcome, {user?.username} 👋</h2>
        <span className="role-badge">{user?.role}</span>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🔐</div>
          <div className="stat-info">
            <h3>{stats?.totalRequests ?? '--'}</h3>
            <p>Total Requests</p>
          </div>
        </div>
        <div className="stat-card danger">
          <div className="stat-icon">⚠️</div>
          <div className="stat-info">
            <h3>{stats?.anomaliesDetected ?? '--'}</h3>
            <p>Anomalies Detected</p>
          </div>
        </div>
        <div className="stat-card success">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <h3>{stats?.successfulAuths ?? '--'}</h3>
            <p>Auth Successes</p>
          </div>
        </div>
        <div className="stat-card warning">
          <div className="stat-icon">🚫</div>
          <div className="stat-info">
            <h3>{stats?.blockedRequests ?? '--'}</h3>
            <p>Blocked Requests</p>
          </div>
        </div>
      </div>

      <div className="section">
        <h3>Recent Security Alerts</h3>
        {alerts.length === 0 ? (
          <p className="empty-state">✅ No recent security alerts</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Severity</th>
                <th>Source IP</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert, i) => (
                <tr key={i}>
                  <td>{new Date(alert.timestamp).toLocaleTimeString()}</td>
                  <td>{alert.type}</td>
                  <td>
                    <span className={`badge badge-${alert.severity?.toLowerCase()}`}>
                      {alert.severity}
                    </span>
                  </td>
                  <td>{alert.sourceIp}</td>
                  <td>{alert.resolved ? '✅ Resolved' : '🔴 Active'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
