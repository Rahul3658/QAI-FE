import { useState, useEffect } from 'react';
import API from '../api/axios';

const SuperAdminDashboard = () => {
  const [subjects, setSubjects] = useState([]);
  const [moderators, setModerators] = useState([]);
  const [pendingModerators, setPendingModerators] = useState([]);
  const [templateVisibilityEnabled, setTemplateVisibilityEnabled] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [stats, setStats] = useState({
    totalSubjects: 0,
    totalModerators: 0,
    totalSMEs: 0,
    totalExaminers: 0,
    pendingApprovals: 0,
    cetSuperAdmins: 0,
    pendingTemplates: 0
  });
  const [currentUserDepartment, setCurrentUserDepartment] = useState(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalContent, setErrorModalContent] = useState({ title: '', message: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Get current user profile to check department
      const profileRes = await API.get('/auth/profile');
      const currentUser = profileRes.data.user;
      setCurrentUserDepartment(currentUser.department);

      console.log('Current user department:', currentUser.department);

      const [subjectsRes, moderatorsRes, pendingModRes, settingsRes] = await Promise.all([
        API.get('/subjects'),
        API.get('/users/moderators'),
        API.get('/users/pending-moderators'),
        API.get('/templates/admin/settings/template-visibility')
      ]);

      let subjects = subjectsRes.data.subjects || [];
      let moderators = moderatorsRes.data.moderators || [];
      let pendingModerators = pendingModRes.data.pending_moderators || [];
      let visibilityEnabled = settingsRes.data.template_visibility_enabled || false;

      console.log('Fetched data:', {
        subjects: subjects.length,
        moderators: moderators.length,
        pendingModerators: pendingModerators.length,
        visibilityEnabled
      });

      setSubjects(subjects);
      setModerators(moderators);
      setPendingModerators(pendingModerators);
      setTemplateVisibilityEnabled(visibilityEnabled);

      // Count CET super admins (only for EDULAB admin)
      let cetSuperAdminCount = 0;
      if (currentUser.department === 'EDULAB') {
        try {
          const cetAdminsRes = await API.get('/users/cet-super-admins');
          cetSuperAdminCount = cetAdminsRes.data.cet_super_admins?.length || 0;
          console.log('CET super admins count:', cetSuperAdminCount);
        } catch (err) {
          console.error('Failed to fetch CET super admins:', err);
          // Don't fail the whole fetch if this fails
        }
      }

      // Calculate stats
      const calculatedStats = {
        totalSubjects: subjects.length,
        totalModerators: moderators.length,
        totalSMEs: subjects.filter(s => s.sme_count > 0).length,
        totalExaminers: 0,
        pendingApprovals: pendingModerators.length,
        cetSuperAdmins: cetSuperAdminCount
      };

      console.log('Calculated stats:', calculatedStats);
      setStats(calculatedStats);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      alert('Failed to load dashboard data. Please check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleModeratorApproval = async (userId, action) => {
    try {
      await API.put(`/users/${userId}/approve-moderator`, { action });
      setErrorModalContent({
        title: 'Success',
        message: action === 'approve' ? 'Moderator approved successfully!' : 'Moderator rejected successfully!'
      });
      setShowErrorModal(true);
      fetchData();
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to process request';
      const existingMod = err.response?.data?.existingModerator;
      setErrorModalContent({
        title: 'Cannot Approve Moderator',
        message: existingMod 
          ? `${errorMsg}\n\nExisting Moderator: ${existingMod}\n\nPlease reject or deactivate the existing moderator first, or reject this application.`
          : errorMsg
      });
      setShowErrorModal(true);
    }
  };

  const updateModeratorStatus = async (userId, status) => {
    try {
      await API.put(`/users/${userId}/status`, { status });
      alert('Moderator status updated successfully!');
      fetchData();
    } catch (err) {
      alert('Failed to update moderator status');
    }
  };

  const updateSubjectStatus = async (subjectId, status) => {
    try {
      await API.put(`/subjects/${subjectId}`, { status });
      alert('Subject status updated successfully!');
      fetchData();
    } catch (err) {
      alert('Failed to update subject status');
    }
  };

  const handleToggleTemplateVisibility = async () => {
    try {
      setLoadingSettings(true);
      const newState = !templateVisibilityEnabled;
      
      await API.put('/templates/admin/settings/template-visibility', {
        enabled: newState
      });

      setTemplateVisibilityEnabled(newState);
      setErrorModalContent({
        title: 'Success',
        message: `Template visibility ${newState ? 'enabled' : 'disabled'}. ${newState ? 'All templates are now visible to all users.' : 'Only own templates are visible.'}`
      });
      setShowErrorModal(true);
      fetchData();
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to update setting';
      setErrorModalContent({
        title: 'Error',
        message: errorMsg
      });
      setShowErrorModal(true);
    } finally {
      setLoadingSettings(false);
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Super Admin Dashboard</h1>
        <p className="dashboard-subtitle" style={{ color: 'white' }}>Manage subjects, moderators, and system operations</p>
      </div>

      {/* Template Visibility Toggle */}
     <div
  style={{
    background: 'var(--bg-surface)',
    padding: '1.5rem',
    borderRadius: '0.5rem',
    marginBottom: '1.5rem',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: 'var(--text-primary)',
  }}
>
  <div>
    <h3
      style={{
        margin: '0 0 0.5rem 0',
        fontSize: '1.125rem',
        fontWeight: '600',
        color: 'var(--text-primary)',
      }}
    >
      Template Visible to All Users
    </h3>
  </div>

  <button
    onClick={handleToggleTemplateVisibility}
    disabled={loadingSettings}
    style={{
      padding: '0.75rem 1.5rem',
      borderRadius: '0.375rem',
      border: 'none',
      background: templateVisibilityEnabled ? '#ef4444' : '#10b981',
      color: 'white',
      fontWeight: '600',
      cursor: loadingSettings ? 'not-allowed' : 'pointer',
      opacity: loadingSettings ? 0.6 : 1,
      transition: 'all 0.2s ease',
    }}
  >
    {loadingSettings
      ? 'Updating...'
      : templateVisibilityEnabled
      ? 'Turn OFF'
      : 'Turn ON'}
  </button>
</div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Subjects</div>
          <div className="stat-value">{stats.totalSubjects}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Active subjects in system
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Moderators</div>
          <div className="stat-value">{stats.totalModerators}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Active moderators
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">SMEs</div>
          <div className="stat-value">{stats.totalSMEs}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Subject matter experts
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending Approvals</div>
          <div className="stat-value">{stats.pendingApprovals}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Awaiting your approval
          </div>
        </div>
        {currentUserDepartment === 'EDULAB' && (
          <div className="stat-card">
            <div className="stat-label">CET Super Admins</div>
            <div className="stat-value">{stats.cetSuperAdmins}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              CET department admins
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              className={`btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setActiveTab('pending')}
            >
              Pending Approvals ({stats.pendingApprovals})
            </button>
           
            <button
              className={`btn ${activeTab === 'subjects' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setActiveTab('subjects')}
            >
              Subjects ({stats.totalSubjects})
            </button>
            <button
              className={`btn ${activeTab === 'moderators' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setActiveTab('moderators')}
            >
              Moderators ({stats.totalModerators})
            </button>
          </div>
        </div>

        {activeTab === 'pending' && (
          <div>
            {stats.pendingApprovals === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">✅</div>
                <p>No pending approvals</p>
              </div>
            ) : (
              <div>
                <h3 style={{ padding: '1rem', margin: 0, borderBottom: '2px solid #e2e8f0' }}>Pending Moderators</h3>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Subject</th>
                      <th>Registered</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingModerators.map(mod => (
                      <tr key={mod.user_id}>
                        <td>{mod.name}</td>
                        <td>{mod.email}</td>
                        <td>{mod.phone || 'N/A'}</td>
                        <td>
                          {mod.subject_name || 'N/A'}
                          {mod.subject_code && <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}> ({mod.subject_code})</span>}
                        </td>
                        <td>{new Date(mod.created_at).toLocaleDateString()}</td>
                        <td>
                          <div className="btn-group">
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleModeratorApproval(mod.user_id, 'approve')}
                            >
                              Approve
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleModeratorApproval(mod.user_id, 'reject')}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'subjects' && (
          <div>
            {subjects.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📚</div>
                <p>No subjects found</p>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Subject Name</th>
                    <th>Subject Code</th>
                    <th>Moderator</th>
                    <th>SMEs</th>
                    <th>Examiners</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map(subject => (
                    <tr key={subject.subject_id}>
                      <td>{subject.subject_name}</td>
                      <td>{subject.subject_code || 'N/A'}</td>
                      <td>
                        {subject.moderator_name || <span style={{ color: 'var(--text-secondary)' }}>Not assigned</span>}
                      </td>
                      <td>{subject.sme_count || 0}</td>
                      <td>{subject.examiner_count || 0}</td>
                      <td>
                        <span className={`badge badge-${subject.status === 'active' ? 'success' : 'danger'}`}>
                          {subject.status || 'active'}
                        </span>
                      </td>
                      <td>
                        <div className="btn-group">
                          {subject.status === 'active' ? (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => updateSubjectStatus(subject.subject_id, 'inactive')}
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => updateSubjectStatus(subject.subject_id, 'active')}
                            >
                              Activate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

       

        {activeTab === 'moderators' && (
          <div>
            {moderators.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">👥</div>
                <p>No moderators found</p>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Subject</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {moderators.map(mod => (
                    <tr key={mod.user_id}>
                      <td>{mod.name}</td>
                      <td>{mod.email}</td>
                      <td>{mod.phone || 'N/A'}</td>
                      <td>
                        {mod.subject_name || 'N/A'}
                        {mod.subject_code && <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}> ({mod.subject_code})</span>}
                      </td>
                      <td>
                        <span className={`badge badge-${mod.status === 'active' ? 'success' : 'danger'}`}>
                          {mod.status}
                        </span>
                      </td>
                      <td>{new Date(mod.created_at).toLocaleDateString()}</td>
                      <td>
                        <div className="btn-group">
                          {mod.status === 'active' ? (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => updateModeratorStatus(mod.user_id, 'inactive')}
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => updateModeratorStatus(mod.user_id, 'active')}
                            >
                              Activate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Error/Success Modal */}
      {showErrorModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            padding: '2rem',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <h3 style={{ 
              margin: '0 0 1rem 0', 
              fontSize: '1.25rem', 
              fontWeight: '600',
              color: errorModalContent.title === 'Success' ? '#10b981' : '#ef4444'
            }}>
              {errorModalContent.title === 'Success' ? '✅ ' : '⚠️ '}{errorModalContent.title}
            </h3>
            <p style={{ 
              margin: '0 0 1.5rem 0', 
              color: '#4b5563',
              whiteSpace: 'pre-line',
              lineHeight: '1.6'
            }}>
              {errorModalContent.message}
            </p>
            <button
              onClick={() => setShowErrorModal(false)}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
