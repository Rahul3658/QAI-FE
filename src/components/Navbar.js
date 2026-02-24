import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const { theme, toggleTheme } = useContext(ThemeContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className={`navbar ${user ? 'with-sidebar' : ''}`}>
      <div className="navbar-brand">
        {user ? (
          <span>Welcome, {user.name}</span>
        ) : (
          <Link to="/" style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>📝 Question Generator</Link>
        )}
      </div>

      <div className="navbar-menu">
        {user ? (
          <>
            <button onClick={toggleTheme} className="theme-toggle" title="Toggle theme">
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <button onClick={handleLogout} className="btn btn-secondary btn-sm">
              🚪 Logout
            </button>
          </>
        ) : (
          <>
            <button onClick={toggleTheme} className="theme-toggle" title="Toggle theme">
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <Link to="/login" className="navbar-link">Login</Link>
            <Link to="/register" className="btn btn-primary btn-sm">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
