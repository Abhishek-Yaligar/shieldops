import React, { useEffect, useState } from 'react';
import { alertService } from '../services/authService';

export default function SecurityAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    alertService.getAlerts()
      .then(data => setAlerts(data.alerts || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleResolve = async (id) => {
    try {
      await alertService.resolveAlert(id);
      setAlerts(alerts.map(a => a._id === id ? { ...a, resolved: true } : a));
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  };

  if (loading) return <div className="loading">Loading alerts...</div>;

  const active = alerts.filter(a => !a.resolved);
  const resolved = alerts.filter(a => a.resolved);

  return (
    <div className="page">
      <div className="page-header">
        <h2>Security Alerts</h2>
        <span className="badge badge-danger">{active.length} Active</span>
      </div>

      <div className="section">
        <h3>Active Alerts</h3>
        {active.length === 0 ? (
          <p className="empty-state">✅ No active threats detected</p>
        ) : (
          active.map(alert => (
            <div key={alert._id} className={`alert-card severity-${alert.severity?.toLowerCase()}`}>
              <div className="alert-header">
                <span className="alert-type">{alert.type}</span>
                <span className={`badge badge-${alert.severity?.toLowerCase()}`}>{alert.severity}</span>
              </div>
              <p>{alert.description}</p>
              <div className="alert-meta">
                <span>🌐 {alert.sourceIp}</span>
                <span>🕒 {new Date(alert.timestamp).toLocaleString()}</span>
                <span>🔧 {alert.service}</span>
              </div>
              <button className="btn-success btn-sm" onClick={() => handleResolve(alert._id)}>
                Mark Resolved
              </button>
            </div>
          ))
        )}
      </div>

      <div className="section">
        <h3>Resolved Alerts ({resolved.length})</h3>
        {resolved.map(alert => (
          <div key={alert._id} className="alert-card resolved">
            <div className="alert-header">
              <span>{alert.type}</span>
              <span className="badge badge-success">Resolved</span>
            </div>
            <p>{alert.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
