import React, { useState, useEffect } from 'react';
import API from '../api/axios';

const CollegeAdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [college, setCollege] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalContent, setErrorModalContent] = useState({ title: '', message: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, pendingRes, collegeRes] = await Promise.all([
        API.get('/users'),
        API.get('/users/pending'),
        API.get('/colleges/my-college')
      ]);
      
      setUsers(usersRes.data.users);
      setPendingUsers(pendingRes.data.pending_users);
      setCollege(collegeRes.data.college);
    } catch (err) {
      console.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (userId, action) => {
    try {
      await API.put(`/users/${userId}/approve`, { action });
      setErrorModalContent({
        title: 'Success',
        message: action === 'approve' ? 'User approved successfully!' : 'User rejected successfully!'
      });
      setShowErrorModal(true);
      fetchData();
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to process request';
      const existingSME = err.response?.data?.existingSME;
      setErrorModalContent({
        title: 'Cannot Approve User',
        message: existingSME 
          ? `${errorMsg}\n\nExisting SME: ${existingSME}\n\nOnly one SME is allowed per subject. Please deactivate the existing SME first, or reject this application.`
          : errorMsg
      });
      setShowErrorModal(true);
    }
  };

  const updateUserStatus = async (userId, status) => {
    try {
      await API.put(`/users/${userId}/status`, { status });
      fetchData();
    } catch (err) {
      alert('Failed to update user status');
    }
  };



  const handlePaperApproval = async (paperId, action) => {
    if (!window.confirm(`Are you sure you want to ${action} this paper?`)) return;
    
    try {
      await API.put(`/colleges/papers/${paperId}/approve`, { action });
      alert(`Paper ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
      setSelectedPaper(null);
      setActiveTab('papers');
      fetchData();
    } catch (err) {
      alert('Failed to process request');
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Moderator's Dashboard</h1>
        <p className="dashboard-subtitle">{college?.college_name}</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Faculty</div>
          <div className="stat-value">{users.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending Users</div>
          <div className="stat-value">{pendingUsers.length}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Active Faculty</div>
          <div className="stat-value">
            {users.filter(u => u.status === 'active').length}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
            <button 
              className={`btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setActiveTab('pending')}
            >
              Pending Users ({pendingUsers.length})
            </button>

            {activeTab === 'view' && (
              <button 
                className="btn btn-primary btn-sm"
              >
                👁️ Viewing Paper
              </button>
            )}
            <button 
              className={`btn ${activeTab === 'all' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setActiveTab('all')}
            >
              All Faculty ({users.length})
            </button>
          </div>
        </div>

        {activeTab === 'pending' && (
          <>
            {pendingUsers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">✅</div>
                <p>No pending approvals</p>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Registered</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingUsers.map(user => (
                    <tr key={user.user_id}>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td><span className="badge badge-info">{user.role}</span></td>
                      <td>{new Date(user.created_at).toLocaleDateString()}</td>
                      <td>
                        <div className="btn-group">
                          <button 
                            className="btn btn-success btn-sm"
                            onClick={() => handleApproval(user.user_id, 'approve')}
                          >
                            Approve
                          </button>
                          <button 
                            className="btn btn-danger btn-sm"
                            onClick={() => handleApproval(user.user_id, 'reject')}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}



        {activeTab === 'all' && (
          <>
            {users.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">👥</div>
                <p>No faculty members yet</p>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.user_id}>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td><span className="badge badge-info">{user.role}</span></td>
                      <td>
                        <span className={`badge badge-${user.status === 'active' ? 'success' : 'danger'}`}>
                          {user.status}
                        </span>
                      </td>
                      <td>{new Date(user.created_at).toLocaleDateString()}</td>
                      <td>
                        <div className="btn-group">
                          {user.status === 'active' ? (
                            <button 
                              className="btn btn-danger btn-sm"
                              onClick={() => updateUserStatus(user.user_id, 'inactive')}
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button 
                              className="btn btn-success btn-sm"
                              onClick={() => updateUserStatus(user.user_id, 'active')}
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
          </>
        )}

        {activeTab === 'view' && selectedPaper && (
          <div style={{padding: '1.5rem'}}>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => setActiveTab('papers')}
              style={{marginBottom: '1rem'}}
            >
              ← Back to Pending Papers
            </button>

            <h3 style={{marginTop: 0, marginBottom: '1rem'}}>{selectedPaper.paper_title}</h3>
            
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem'}}>
              <div className="stat-card">
                <div className="stat-label">Created By</div>
                <div className="stat-value" style={{fontSize: '1rem'}}>{selectedPaper.generated_by_name}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total Marks</div>
                <div className="stat-value">{selectedPaper.total_marks}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Status</div>
                <div className="stat-value">
                  <span className="badge badge-warning">{selectedPaper.status}</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Created</div>
                <div className="stat-value" style={{fontSize: '1rem'}}>
                  {new Date(selectedPaper.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>

            <h4>Questions ({selectedPaper.questions?.length || 0})</h4>
            {selectedPaper.questions && selectedPaper.questions.length > 0 ? (
              <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem'}}>
                {selectedPaper.questions.map((q, index) => (
                  <div key={q.question_id} className="card" style={{padding: '1rem'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem'}}>
                      <strong>Question {index + 1}</strong>
                      <div style={{display: 'flex', gap: '0.5rem'}}>
                        <span className={`badge badge-${q.difficulty === 'easy' ? 'success' : q.difficulty === 'medium' ? 'warning' : 'danger'}`}>
                          {q.difficulty}
                        </span>
                        <span className="badge badge-secondary">{q.question_type}</span>
                        <span className="badge badge-primary">{q.marks} marks</span>
                      </div>
                    </div>
                    <p style={{marginBottom: '0.5rem'}}>{q.question_text}</p>
                    
                    {q.options && q.options.length > 0 && (
                      <div style={{marginTop: '0.5rem'}}>
                        <strong>Options:</strong>
                        <ul style={{marginTop: '0.25rem', marginBottom: '0.5rem'}}>
                          {q.options.map((opt, i) => (
                            <li key={i}>{opt}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {q.correct_answer && (
                      <div style={{marginTop: '0.5rem', padding: '0.5rem', background: '#f0fdf4', borderRadius: '0.25rem'}}>
                        <strong>Correct Answer:</strong> {q.correct_answer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p>No questions available for this paper.</p>
            )}

            <div style={{display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem'}}>
              <button 
                className="btn btn-success"
                onClick={() => handlePaperApproval(selectedPaper.paper_id, 'approve')}
              >
                ✅ Approve Paper
              </button>
              <button 
                className="btn btn-danger"
                onClick={() => handlePaperApproval(selectedPaper.paper_id, 'reject')}
              >
                ❌ Reject Paper
              </button>
            </div>
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

export default CollegeAdminDashboard;
