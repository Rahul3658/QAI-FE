import React, { useContext, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './Sidebar.css';

const Sidebar = () => {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  // Don't show sidebar on auth pages
  const authPages = ['/login', '/register'];
  if (!user || authPages.includes(location.pathname)) return null;

  const isActive = (path) => location.pathname === path;

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleProfileDropdown = () => {
    setIsProfileDropdownOpen(!isProfileDropdownOpen);
  };

  // Role-based menu items
  const getMenuItems = () => {
    const commonItems = [];

    switch (user.role) {
      case 'super_admin':
        const superAdminItems = [
          { path: '/super-admin', icon: '🏠', label: 'Dashboard' },
          { path: '/super-admin/moderators', icon: '👥', label: 'Moderators' },
          { path: '/super-admin/reports', icon: '📊', label: 'Reports' },
        ];
        
        // Only show EduLab PDFs for super_admin with edulab department (case-insensitive)
        if (user.department && user.department.toLowerCase() === 'edulab') {
          superAdminItems.push({ path: '/super-admin/edulab-pdfs', icon: '📚', label: 'EduLab PDFs' });
        }
        
        return [...superAdminItems, ...commonItems];

      case 'moderator':
        return [
          { path: '/moderator', icon: '🏠', label: 'Dashboard' },
          { path: '/moderator-categorization', icon: '🎯', label: 'Categorize Papers' },
          { path: '/moderator/users', icon: '👥', label: 'Users' },
          // { path: '/moderator/approvals', icon: '✅', label: 'Approvals' },
          ...commonItems,
        ];

      case 'coordinator':
        return [
          { path: '/coordinator', icon: '🏠', label: 'Dashboard' },
          { path: '/coordinator/papers', icon: '📄', label: 'Question Papers' },
          { path: '/coordinator/review', icon: '🔍', label: 'Review Papers' },
          { path: '/coordinator/faculty', icon: '👨‍🏫', label: 'Faculty' },
          { path: '/coordinator/reports', icon: '📊', label: 'Reports' },
          ...commonItems,
        ];

      case 'subject_matter_expert':
        return [
          { path: '/subject-matter-expert', icon: '🏠', label: 'Dashboard' },
          { path: '/sme-papers', icon: '📋', label: 'Review Papers' },
          { path: '/my-examiners', icon: '👨‍🏫', label: 'My Examiners' },
          ...commonItems,
        ];

      case 'examiner':
        return [
          { path: '/examiner', icon: '🏠', label: 'Dashboard' },
          { path: '/examiner/create', icon: '🤖', label: 'Generate Questions' },
          { path: '/examiner/papers', icon: '📄', label: 'My Papers' },
          { path: '/paper-templates', icon: '📋', label: 'Paper Templates' },
          ...commonItems,
        ];

      default:
        return commonItems;
    }
  };

  const menuItems = getMenuItems();

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {!isCollapsed && (
          <div className="sidebar-brand">
            <span className="brand-icon">📝</span>
            <span className="brand-text">Question Gen</span>
          </div>
        )}
        <button className="sidebar-toggle" onClick={toggleSidebar}>
          {isCollapsed ? '→' : '←'}
        </button>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`sidebar-link ${isActive(item.path) ? 'active' : ''}`}
            title={isCollapsed ? item.label : ''}
          >
            <span className="sidebar-icon">{item.icon}</span>
            {!isCollapsed && <span className="sidebar-label">{item.label}</span>}
          </Link>
        ))}
        
        {/* Profile Dropdown */}
        <div className="sidebar-dropdown">
          <Link
            to="/profile"
            className={`sidebar-link dropdown-toggle ${
              (isActive('/profile') || isActive('/2fa-security')) ? 'active' : ''
            }`}
            onClick={(e) => {
              // Navigate to profile page
              // Also toggle dropdown on click
              setTimeout(() => toggleProfileDropdown(), 0);
            }}
            title={isCollapsed ? 'Profile' : ''}
          >
            <span className="sidebar-icon">👤</span>
            {!isCollapsed && (
              <>
                <span className="sidebar-label">Profile</span>
                <span 
                  className={`dropdown-arrow ${isProfileDropdownOpen ? 'open' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleProfileDropdown();
                  }}
                >
                  ▼
                </span>
              </>
            )}
          </Link>
          
          {isProfileDropdownOpen && !isCollapsed && (
            <div className="dropdown-menu">
              <Link
                to="/2fa-security"
                className={`dropdown-item ${location.pathname === '/2fa-security' ? 'active' : ''}`}
              >
                <span className="sidebar-icon">🔒</span>
                <span>2FA Security</span>
              </Link>
            </div>
          )}
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="user-avatar">
            {user.name.charAt(0).toUpperCase()}
          </div>
          {!isCollapsed && (
            <div className="user-info">
              <div className="user-name">{user.name}</div>
              <div className="user-role">{user.role.replace('_', ' ')}</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
