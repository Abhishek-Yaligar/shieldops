import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span>🛡️</span> ShieldOps
      </div>
      <div className="navbar-links">
        <NavLink to="/dashboard">Dashboard</NavLink>
        <NavLink to="/users">Users</NavLink>
        <NavLink to="/data">Data</NavLink>
        <NavLink to="/alerts">Alerts</NavLink>
      </div>
      <div className="navbar-user">
        <span>{user?.username} ({user?.role})</span>
        <button onClick={handleLogout}>Logout</button>
      </div>
    </nav>
  );
}
