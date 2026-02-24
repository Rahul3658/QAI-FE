import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

import API from '../api/axios';
import './Profile.css';

const Profile = () => {
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [activeTab, setActiveTab] = useState('profile');
  

  

  
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    bio: '',
    department: '',
    designation: '',
    experience: '',
    specialization: '',
    address: '',
    city: '',
    state: '',
    country: '',
    pincode: ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });



  const [stats, setStats] = useState({
    totalPapers: 0,
    totalQuestions: 0,
    pendingApprovals: 0,
    completedPapers: 0
  });

  const [accountInfo, setAccountInfo] = useState({
    status: '',
    createdAt: '',
    lastLogin: '',
    college: '',
    department: '',
    university: ''
  });

  useEffect(() => {
    fetchProfileData();
    fetchStats();
  }, []);



  const fetchProfileData = async () => {
    try {
      const { data } = await API.get('/auth/profile');
      if (data.success) {
        console.log('Profile data received:', data.user); // Debug log
        
        setProfileData({
          name: data.user.name || '',
          email: data.user.email || '',
          phone: data.user.phone || '',
          bio: data.user.bio || '',
          department: data.user.department || '',
          designation: data.user.designation || '',
          experience: data.user.experience || '',
          specialization: data.user.specialization || '',
          address: data.user.address || '',
          city: data.user.city || '',
          state: data.user.state || '',
          country: data.user.country || '',
          pincode: data.user.pincode || ''
        });
        
        setAccountInfo({
          status: data.user.status || 'active',
          createdAt: data.user.created_at || '',
          lastLogin: data.user.last_login || '',
          college: data.user.college_name || 'Not assigned',
          department: data.user.department_name || 'Not assigned',
          university: data.user.university_name || 'Not assigned'
        });

        // 2FA data is handled separately in 2FA Security section




      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data } = await API.get('/auth/profile/stats');
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };



  const handleProfileChange = (e) => {
    setProfileData({
      ...profileData,
      [e.target.name]: e.target.value
    });
  };

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value
    });
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const { data } = await API.put('/auth/profile', profileData);
      if (data.success) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to update profile' 
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      setSaving(false);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      setSaving(false);
      return;
    }

    try {
      const { data } = await API.put('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      
      if (data.success) {
        setMessage({ type: 'success', text: 'Password changed successfully!' });
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to change password' 
      });
    } finally {
      setSaving(false);
    }
  };

  const getRoleBadgeClass = (role) => {
    const roleMap = {
      'super_admin': 'badge-danger',
      'moderator': 'badge-warning',
      'examiner': 'badge-success',
      'subject_matter_expert': 'badge-info'
    };
    return roleMap[role] || 'badge-secondary';
  };

  const getRoleDisplayName = (role) => {
    const roleMap = {
      'super_admin': 'Super Admin',
      'moderator': 'Moderator',
      'examiner': 'Examiner',
      'subject_matter_expert': 'Subject Matter Expert'
    };
    return roleMap[role] || role;
  };







  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }



  return (
    <div className="profile-container">
      <div className="profile-header">
        <div className="profile-header-content">
          <div className="profile-avatar">
            <div className="avatar-circle">
              {profileData.name.charAt(0).toUpperCase()}
            </div>
          </div>
          <div className="profile-header-info">
            <h1 className="profile-name">{profileData.name}</h1>
            <p className="profile-email">{profileData.email}</p>
            <span className={`badge ${getRoleBadgeClass(user.role)}`}>
              {getRoleDisplayName(user.role)}
            </span>
          </div>
        </div>
      </div>

    

      {/* Tabs */}
      <div className="profile-tabs">
        <button 
          className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <span className="tab-icon">👤</span>
          Profile Information
        </button>
        <button 
          className={`tab-button ${activeTab === 'account' ? 'active' : ''}`}
          onClick={() => setActiveTab('account')}
        >
          <span className="tab-icon">ℹ️</span>
          Account Info
        </button>
        <button 
          className={`tab-button ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <span className="tab-icon">🔒</span>
          Security
        </button>



      </div>

      {/* Message Display */}
      {message.text && (
        <div className={`message ${message.type === 'success' ? 'message-success' : 'message-error'}`}>
          {message.text}
        </div>
      )}

      {/* Tab Content */}
      <div className="profile-content">
        {activeTab === 'profile' && (
          <form onSubmit={handleProfileSubmit} className="profile-form">
            <div className="form-section">
              <h3 className="section-title">Basic Information</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={profileData.name}
                    className="form-input"
                    disabled
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={profileData.email}
                    className="form-input"
                    disabled
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    value={profileData.phone}
                    className="form-input"
                    disabled
                    placeholder="+1 234 567 8900"
                  />
                </div>
              </div>
            </div>

            {(user.role === 'examiner' || user.role === 'subject_matter_expert') && (
              <div className="form-section">
                <h3 className="section-title">Professional Information</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <input
                      type="text"
                      name="department"
                      value={profileData.department}
                      onChange={handleProfileChange}
                      className="form-input"
                      placeholder="e.g., Computer Science"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Designation</label>
                    <input
                      type="text"
                      name="designation"
                      value={profileData.designation}
                      onChange={handleProfileChange}
                      className="form-input"
                      placeholder="e.g., Assistant Professor"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Experience (Years)</label>
                    <input
                      type="number"
                      name="experience"
                      value={profileData.experience}
                      onChange={handleProfileChange}
                      className="form-input"
                      placeholder="0"
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Specialization</label>
                    <input
                      type="text"
                      name="specialization"
                      value={profileData.specialization}
                      onChange={handleProfileChange}
                      className="form-input"
                      placeholder="e.g., Machine Learning, AI"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Bio</label>
                  <textarea
                    name="bio"
                    value={profileData.bio}
                    onChange={handleProfileChange}
                    className="form-textarea"
                    rows="4"
                    placeholder="Tell us about yourself..."
                  />
                </div>
              </div>
            )}

            <div className="form-section">
              <h3 className="section-title">Address Information</h3>
              <div className="form-group">
                <label className="form-label">Street Address</label>
                <input
                  type="text"
                  name="address"
                  value={profileData.address}
                  onChange={handleProfileChange}
                  className="form-input"
                  placeholder="123 Main Street"
                />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input
                    type="text"
                    name="city"
                    value={profileData.city}
                    onChange={handleProfileChange}
                    className="form-input"
                    placeholder="New York"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">State/Province</label>
                  <input
                    type="text"
                    name="state"
                    value={profileData.state}
                    onChange={handleProfileChange}
                    className="form-input"
                    placeholder="NY"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Country</label>
                  <input
                    type="text"
                    name="country"
                    value={profileData.country}
                    onChange={handleProfileChange}
                    className="form-input"
                    placeholder="United States"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Postal Code</label>
                  <input
                    type="text"
                    name="pincode"
                    value={profileData.pincode}
                    onChange={handleProfileChange}
                    className="form-input"
                    placeholder="10001"
                  />
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'account' && (
          <div className="account-info-section">
            <div className="form-section">
              <h3 className="section-title">Account Details</h3>
              <div className="info-grid">
                <div className="info-item">
                  <div className="info-label">Account Status</div>
                  <div className="info-value">
                    <span className={`badge ${accountInfo.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                      {accountInfo.status === 'active' ? '✓ Active' : '⏳ ' + accountInfo.status}
                    </span>
                  </div>
                </div>
                <div className="info-item">
                  <div className="info-label">Role</div>
                  <div className="info-value">
                    <span className={`badge ${getRoleBadgeClass(user.role)}`}>
                      {getRoleDisplayName(user.role)}
                    </span>
                  </div>
                </div>
                <div className="info-item">
                  <div className="info-label">University</div>
                  <div className="info-value">{accountInfo.university || 'Not assigned'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">College</div>
                  <div className="info-value">{accountInfo.college || 'Not assigned'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Department</div>
                  <div className="info-value">{accountInfo.department || 'Not assigned'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Member Since</div>
                  <div className="info-value">
                    {accountInfo.createdAt ? new Date(accountInfo.createdAt).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    }) : 'N/A'}
                  </div>
                </div>
                <div className="info-item">
                  <div className="info-label">Last Login</div>
                  <div className="info-value">
                    {accountInfo.lastLogin && accountInfo.lastLogin !== 'N/A' ? (
                      new Date(accountInfo.lastLogin).toLocaleString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })
                    ) : 'Never logged in'}
                  </div>
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3 className="section-title">Activity Summary</h3>
              <div className="activity-cards">
                <div className="activity-card">
                  <div className="activity-icon">📊</div>
                  <div className="activity-content">
                    <div className="activity-title">Total Contributions</div>
                    <div className="activity-value">{stats.totalPapers + stats.totalQuestions}</div>
                    <div className="activity-desc">Papers and questions created</div>
                  </div>
                </div>
                <div className="activity-card">
                  <div className="activity-icon">⏳</div>
                  <div className="activity-content">
                    <div className="activity-title">Pending Items</div>
                    <div className="activity-value">{stats.pendingApprovals}</div>
                    <div className="activity-desc">Awaiting your action</div>
                  </div>
                </div>
                <div className="activity-card">
                  <div className="activity-icon">✅</div>
                  <div className="activity-content">
                    <div className="activity-title">Completed</div>
                    <div className="activity-value">{stats.completedPapers}</div>
                    <div className="activity-desc">Successfully finished</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="security-section">
            {/* Password Change Section */}
            <form onSubmit={handlePasswordSubmit} className="profile-form">
              <div className="form-section">
                <h3 className="section-title">
                  <span className="security-icon">🔑</span>
                  Change Password
                </h3>
                <div className="security-info">
                  <p>Ensure your account is using a strong password to stay secure.</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Current Password *</label>
                  <input
                    type="password"
                    name="currentPassword"
                    value={passwordData.currentPassword}
                    onChange={handlePasswordChange}
                    className="form-input"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">New Password *</label>
                  <input
                    type="password"
                    name="newPassword"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    className="form-input"
                    required
                    minLength="6"
                  />
                  <small className="form-hint">Minimum 6 characters</small>
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm New Password *</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    className="form-input"
                    required
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        )}



      </div>
    </div>
  );
};

export default Profile;
