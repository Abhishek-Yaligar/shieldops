import React, { useEffect, useState } from 'react';
import { userService } from '../services/authService';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    userService.getAll()
      .then(data => setUsers(data.users || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    try {
      await userService.delete(id);
      setUsers(users.filter(u => u._id !== id));
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  if (loading) return <div className="loading">Loading users...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h2>User Management</h2>
        <span className="badge">RBAC Enforced</span>
      </div>
      {error && <div className="error-banner">{error}</div>}
      <table className="table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Email</th>
            <th>Role</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user._id}>
              <td>{user.username}</td>
              <td>{user.email}</td>
              <td><span className={`badge badge-${user.role}`}>{user.role}</span></td>
              <td>{new Date(user.createdAt).toLocaleDateString()}</td>
              <td>
                <button className="btn-danger btn-sm" onClick={() => handleDelete(user._id)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
