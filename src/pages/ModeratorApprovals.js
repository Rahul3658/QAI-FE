import { useState, useEffect } from 'react';
import API from '../api/axios';
import { useToast } from '../context/ToastContext';

const ModeratorApprovals = () => {
  const { showToast } = useToast();
  
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingPapers, setLoadingPapers] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [downloading, setDownloading] = useState({});

  useEffect(() => {
    fetchApprovedRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchApprovedRequests = async () => {
    try {
      setLoading(true);
      const { data } = await API.get('/moderator-categorization/approved-requests');
      setRequests(data.requests || []);
    } catch (err) {
      showToast('Failed to fetch approved requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleViewPapers = async (request) => {
    try {
      setLoadingPapers(true);
      setSelectedRequest(request);
      const { data } = await API.get(`/moderator-categorization/request/${request.request_id}/approved-papers`);
      setPapers(data.papers || []);
    } catch (err) {
      showToast('Failed to load papers', 'error');
    } finally {
      setLoadingPapers(false);
    }
  };

  const handleBack = () => {
    setSelectedRequest(null);
    setPapers([]);
  };

  const handleDownloadPDF = async (paperId, category) => {
    try {
      setDownloading({ ...downloading, [paperId]: true });
      
      const response = await API.get(`/moderator-categorization/paper/${paperId}/download`, {
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `paper_${paperId}_${category}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showToast('PDF downloaded successfully!', 'success');
    } catch (err) {
      showToast('Failed to download PDF', 'error');
    } finally {
      setDownloading({ ...downloading, [paperId]: false });
    }
  };

  const getCategoryBadge = (category) => {
    const badges = {
      'general': 'badge-primary',
      'reexam': 'badge-warning',
      'special': 'badge-info'
    };
    return badges[category] || 'badge-secondary';
  };

  const getCategoryLabel = (category) => {
    const labels = {
      'general': 'General Exam',
      'reexam': 'Re-Exam',
      'special': 'Special Case'
    };
    return labels[category] || category;
  };

  // Filter requests
  const filteredRequests = requests.filter(r => {
    const matchesSearch = searchTerm === '' || 
      r.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.faculty_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // If viewing papers for a specific request
  if (selectedRequest) {
    return (
      <div className="dashboard">
        <div className="dashboard-header">
          <button className="btn btn-secondary" onClick={handleBack}>
            ← Back to Requests
          </button>
          <h1 className="dashboard-title">Approved Papers</h1>
          <p className="dashboard-subtitle">
            {selectedRequest.subject} - {selectedRequest.topic}
          </p>
        </div>

        {loadingPapers ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="spinner"></div>
          </div>
        ) : (
          <>
            {/* Papers Grid */}
            <div style={{ display: 'grid', gap: '1.5rem' }}>
              {papers.map(paper => (
                <div 
                  key={paper.paper_id}
                  className="card"
                  style={{ 
                    border: `2px solid var(--${paper.category === 'general' ? 'primary' : paper.category === 'reexam' ? 'warning' : 'info'})`,
                    background: `var(--${paper.category === 'general' ? 'primary' : paper.category === 'reexam' ? 'warning' : 'info'}-light)`
                  }}
                >
                  <div className="card-header" style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem'
                  }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.125rem' }}>
                        Set {paper.set_number} - {getCategoryLabel(paper.category)}
                      </h3>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        {paper.question_count} questions | {paper.total_marks} marks
                      </p>
                      {paper.selection_reason && (
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                          SME: "{paper.selection_reason}"
                        </p>
                      )}
                    </div>
                    <span className={`badge ${getCategoryBadge(paper.category)}`} style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>
                      {getCategoryLabel(paper.category)}
                    </span>
                  </div>

                  <div style={{ padding: '1.5rem' }}>
                    {paper.moderator_notes && (
                      <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '0.5rem' }}>
                        <strong>Moderator Notes:</strong>
                        <p style={{ margin: '0.5rem 0 0 0' }}>{paper.moderator_notes}</p>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        className="btn btn-primary"
                        onClick={() => handleDownloadPDF(paper.paper_id, paper.category)}
                        disabled={downloading[paper.paper_id]}
                      >
                        {downloading[paper.paper_id] ? '⏳ Downloading...' : '📥 Download PDF'}
                      </button>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        Approved on {new Date(paper.categorized_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // Main view - show requests list
  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">✅ Approved Requests</h1>
        <p className="dashboard-subtitle">View all completed and categorized paper sets</p>
      </div>

      {/* Search */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ padding: '1.5rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Search</label>
            <input
              type="text"
              className="form-input"
              placeholder="Search by subject, topic, or faculty..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>
            {requests.length}
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Completed Requests</div>
        </div>
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>
            {requests.reduce((sum, r) => sum + r.categorized_count, 0)}
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Total Papers</div>
        </div>
      </div>

      {/* Requests List */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            Completed Requests ({filteredRequests.length})
          </h2>
        </div>
        <div style={{ padding: '1.5rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div className="spinner"></div>
            </div>
          ) : filteredRequests.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
              No completed requests found.
            </p>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Request ID</th>
                    <th>Subject / Topic</th>
                    <th>Faculty</th>
                    <th>SME</th>
                    <th>Papers</th>
                    <th>Completed On</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map(request => (
                    <tr key={request.request_id}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                          #{request.request_id}
                        </span>
                      </td>
                      <td>
                        <div>
                          <div style={{ fontWeight: '500' }}>{request.subject}</div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            {request.topic}
                          </div>
                        </div>
                      </td>
                      <td>{request.faculty_name}</td>
                      <td>{request.sme_name || 'N/A'}</td>
                      <td>
                        <span className="badge badge-success">
                          {request.categorized_count} categorized
                        </span>
                      </td>
                      <td>{new Date(request.completed_at).toLocaleDateString()}</td>
                      <td>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleViewPapers(request)}
                        >
                          View Papers
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModeratorApprovals;
