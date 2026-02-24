import { useState, useEffect } from 'react';
import API from '../api/axios';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';

const Moderators = () => {
  const [moderators, setModerators] = useState([]);
  const [pendingModerators, setPendingModerators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [modalConfig, setModalConfig] = useState({ isOpen: false });
  const { showToast } = useToast();

  useEffect(() => {
    fetchModerators();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchModerators = async () => {
    try {
      setLoading(true);
      const [moderatorsRes, pendingRes] = await Promise.all([
        API.get('/admins'),
        API.get('/admins/pending')
      ]);

      setModerators(moderatorsRes.data.admins || []);
      setPendingModerators(pendingRes.data.pending_admins || []);
    } catch (err) {
      console.error('Failed to fetch moderators:', err);
      showToast('Failed to load moderators', 'error');
    } finally {
      setLoading(false);
    }
  };

 const handleApproval = (userId, action, moderatorName) => {
  setModalConfig({
    isOpen: true,
    type: action === 'approve' ? 'success' : 'error',
    title: action === 'approve' ? 'Approve Moderator' : 'Reject Moderator',
    message: `Are you sure you want to ${action} ${moderatorName}?`,
    confirmText: action === 'approve' ? 'Approve' : 'Reject',
    onConfirm: () => confirmApproval(userId, action)
  });
};

const confirmApproval = async (userId, action, force = false) => {
  try {
    const res = await API.put(`/admins/${userId}/approve`, { action, force });
    console.log("Approval response:", res.data);

    if (res.data.warning) {
      // 🟡 Show new modal for "Moderator Already Exists"
      setModalConfig({
        isOpen: true,
        type: 'warning',
        title: 'Moderator Already Exists',
        message: res.data.message,
        confirmText: 'Approve Anyway',
        cancelText: 'Cancel',
        onConfirm: () => confirmApproval(userId, action, true) // 🟢 call again with force=true
      });
      return; // stop here so the first modal closes
    }

    if (res.data.success) {
      showToast(res.data.message, 'success');
      fetchModerators();
      setModalConfig({ isOpen: false }); // ✅ Close modal
      return;
    }

    showToast(res.data.message || 'Unexpected server response', 'error');
  } catch (err) {
    console.error("Approval error:", err);
    showToast(err.response?.data?.message || 'Failed to process request', 'error');
  }
};

  const handleStatusChange = (userId, newStatus, moderatorName) => {
    setModalConfig({
      isOpen: true,
      type: newStatus === 'active' ? 'success' : 'warning',
      title: newStatus === 'active' ? 'Activate Moderator' : 'Deactivate Moderator',
      message: `Are you sure you want to ${newStatus === 'active' ? 'activate' : 'deactivate'} ${moderatorName}?`,
      confirmText: newStatus === 'active' ? 'Activate' : 'Deactivate',
      onConfirm: () => confirmStatusChange(userId, newStatus)
    });
  };

  const confirmStatusChange = async (userId, newStatus) => {
    try {
      await API.put(`/admins/${userId}/status`, { status: newStatus });
      showToast(`Moderator ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`, 'success');
      fetchModerators();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update status', 'error');
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">👥 Moderators Management</h1>
          <p className="dashboard-subtitle" style={{ color: 'white' }}>Manage all moderators in the system</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Moderators</div>
          <div className="stat-value">{moderators.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active</div>
          <div className="stat-value">
            {moderators.filter(m => m.status === 'active').length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Inactive</div>
          <div className="stat-value">
            {moderators.filter(m => m.status === 'inactive').length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending Approval</div>
          <div className="stat-value">{pendingModerators.length}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              className={`btn ${activeTab === 'all' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setActiveTab('all')}
            >
              All Moderators ({moderators.length})
            </button>
            <button
              className={`btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setActiveTab('pending')}
            >
              Pending Approval ({pendingModerators.length})
            </button>
          </div>
        </div>

        {activeTab === 'all' && (
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
                    <th>College</th>
                    <th>University</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {moderators.map(moderator => (
                    <tr key={moderator.user_id}>
                      <td><strong>{moderator.name}</strong></td>
                      <td>{moderator.email}</td>
                      <td>{moderator.college_name}</td>
                      <td>{moderator.university_name}</td>
                      <td>
                        <span className={`badge badge-${moderator.status === 'active' ? 'success' : 'danger'}`}>
                          {moderator.status}
                        </span>
                      </td>
                      <td>{new Date(moderator.created_at).toLocaleDateString()}</td>
                      <td>
                        <div className="btn-group">
                          {moderator.status === 'active' ? (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleStatusChange(moderator.user_id, 'inactive', moderator.name)}
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleStatusChange(moderator.user_id, 'active', moderator.name)}
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

        {activeTab === 'pending' && (
          <div>
            {pendingModerators.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">✅</div>
                <p>No pending moderator approvals</p>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>College</th>
                    <th>University</th>
                    <th>Registered</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingModerators.map(moderator => (
                    <tr key={moderator.user_id}>
                      <td><strong>{moderator.name}</strong></td>
                      <td>{moderator.email}</td>
                      <td>{moderator.college_name}</td>
                      <td>{moderator.university_name}</td>
                      <td>{new Date(moderator.created_at).toLocaleDateString()}</td>
                      <td>
                        <div className="btn-group">
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handleApproval(moderator.user_id, 'approve', moderator.name)}
                          >
                            ✓ Approve
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleApproval(moderator.user_id, 'reject', moderator.name)}
                          >
                            ✗ Reject
                          </button>
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

      {/* Modal */}
      <Modal
  key={modalConfig.title + modalConfig.message} // 🟢 Forces remount when text changes
  isOpen={modalConfig.isOpen}
  onClose={() => setModalConfig({ isOpen: false })}
  onConfirm={modalConfig.onConfirm}
  title={modalConfig.title}
  message={modalConfig.message}
  type={modalConfig.type}
  confirmText={modalConfig.confirmText}
  cancelText={modalConfig.cancelText || 'Cancel'}
/>


    </div>
  );
};

export default Moderators;
