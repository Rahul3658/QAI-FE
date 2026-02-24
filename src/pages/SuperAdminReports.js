import { useState, useEffect } from 'react';
import API from '../api/axios';

const SuperAdminReports = () => {
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedRole, setSelectedRole] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [systemSummary, setSystemSummary] = useState({
    total_subjects: 0,
    total_moderators: 0,
    total_smes: 0,
    total_examiners: 0,
    total_papers: 0
  });
  const [subjectData, setSubjectData] = useState(null);

  // Load data on mount
  useEffect(() => {
    loadSubjects();
  }, []);

  // Load subject details when subject changes
  useEffect(() => {
    if (selectedSubject !== 'all') {
      loadSubjectData(selectedSubject);
    } else {
      setSubjectData(null);
    }
  }, [selectedSubject]);

  const loadSubjects = async () => {
    try {
      setLoading(true);
      const response = await API.get('/subjects');
      setSubjects(response.data.subjects || []);
      
      // Calculate system summary
      const subjects = response.data.subjects || [];
      setSystemSummary({
        total_subjects: subjects.length,
        total_moderators: subjects.filter(s => s.moderator_user_id).length,
        total_smes: subjects.reduce((sum, s) => sum + (s.sme_count || 0), 0),
        total_examiners: subjects.reduce((sum, s) => sum + (s.examiner_count || 0), 0),
        total_papers: 0 // Can be fetched separately if needed
      });
    } catch (err) {
      console.error('Failed to load subjects:', err);
      alert('Failed to load subjects: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSubjectData = async (subjectId) => {
    try {
      setLoading(true);
      
      // Fetch subject details, moderator, SMEs, and examiners
      const [subjectRes, moderatorRes, smesRes, examinersRes] = await Promise.all([
        API.get(`/subjects/${subjectId}`),
        API.get(`/subjects/${subjectId}/moderator`),
        API.get(`/subjects/${subjectId}/smes`),
        API.get(`/subjects/${subjectId}/examiners`)
      ]);

      console.log('Subject data loaded:', {
        subject: subjectRes.data.subject,
        moderator: moderatorRes.data.moderator,
        smes: smesRes.data.smes,
        examiners: examinersRes.data.examiners
      });

      setSubjectData({
        subject: subjectRes.data.subject,
        moderator: moderatorRes.data.moderator || null,
        smes: smesRes.data.smes || [],
        examiners: examinersRes.data.examiners || []
      });
    } catch (err) {
      console.error('Failed to load subject data:', err);
      alert('Failed to load subject data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter users by role and search
  const getFilteredUsers = () => {
    if (!subjectData) return { moderator: null, smes: [], examiners: [], showModeratorSection: false };

    const matchesSearch = (user) => {
      if (!user || !searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return user.name.toLowerCase().includes(search) || 
             user.email.toLowerCase().includes(search);
    };

    const showModeratorSection = selectedRole === 'all' || selectedRole === 'moderator';
    const moderatorMatchesSearch = subjectData.moderator ? matchesSearch(subjectData.moderator) : true;

    return {
      showModeratorSection,
      moderator: showModeratorSection && subjectData.moderator && moderatorMatchesSearch
        ? subjectData.moderator 
        : null,
      smes: (selectedRole === 'all' || selectedRole === 'subject_matter_expert') 
        ? subjectData.smes.filter(matchesSearch) 
        : [],
      examiners: (selectedRole === 'all' || selectedRole === 'examiner') 
        ? subjectData.examiners.filter(matchesSearch) 
        : []
    };
  };

  const filteredData = getFilteredUsers();

  if (loading && !subjectData) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading reports...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">📊 Subject-Based Reports</h1>
        <p className="dashboard-subtitle" style={{ color: 'white' }}>Subject-wise Faculty & Assignment Details</p>
      </div>

      {/* System-wide Summary Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">TOTAL SUBJECTS</div>
          <div className="stat-value">{systemSummary.total_subjects}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">TOTAL MODERATORS</div>
          <div className="stat-value">{systemSummary.total_moderators}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">TOTAL SMES</div>
          <div className="stat-value">{systemSummary.total_smes}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">TOTAL EXAMINERS</div>
          <div className="stat-value">{systemSummary.total_examiners}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <div className="card-header" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>🔍 Filter Reports</h3>
        </div>
        <div style={{ padding: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>
                📚 Subject *
              </label>
              <select
                className="form-control"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                style={{ padding: '0.625rem', fontSize: '0.9375rem', borderRadius: '0.5rem', border: '2px solid #e5e7eb' }}
              >
                <option value="all">Select Subject...</option>
                {subjects.map(subject => (
                  <option key={subject.subject_id} value={subject.subject_id}>
                    {subject.subject_name} {subject.subject_code && `(${subject.subject_code})`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>
                👤 Role
              </label>
              <select
                className="form-control"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                style={{ padding: '0.625rem', fontSize: '0.9375rem', borderRadius: '0.5rem', border: '2px solid #e5e7eb' }}
              >
                <option value="all">All Roles</option>
                <option value="moderator">⚖️ Moderator</option>
                <option value="subject_matter_expert">🎯 SMEs</option>
                <option value="examiner">👨‍🏫 Examiners</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>
                🔎 Search Users
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ padding: '0.625rem', fontSize: '0.9375rem', borderRadius: '0.5rem', border: '2px solid #e5e7eb' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Subject Reports */}
      {selectedSubject === 'all' ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📊</div>
          <h3 style={{ color: '#6b7280', marginBottom: '0.5rem', fontWeight: '600' }}>
            Select a Subject to View Reports
          </h3>
          <p style={{ color: '#9ca3af', fontSize: '0.9375rem' }}>
            Please select a subject from the filter above to view detailed faculty reports
          </p>
        </div>
      ) : loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading subject data...</p>
        </div>
      ) : !subjectData ? (
        <div className="empty-state">
          <div className="empty-state-icon">❌</div>
          <p>Failed to load subject data</p>
        </div>
      ) : (
        <div style={{ marginBottom: '2.5rem' }}>
          {/* Subject Header */}
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '1.25rem 1.5rem',
            borderRadius: '0.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'white', fontWeight: '600' }}>
              📚 {subjectData.subject?.subject_name || 'Subject Report'}
            </h2>
            {subjectData.subject?.subject_code && (
              <p style={{ margin: '0.5rem 0 0 0', color: 'rgba(255,255,255,0.9)', fontSize: '0.9375rem' }}>
                Code: {subjectData.subject.subject_code}
              </p>
            )}
          </div>

          <div style={{
            background: 'white',
            borderRadius: '0.5rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }}>
            {/* Moderator */}
            {filteredData.showModeratorSection && (
              <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
                <h4 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#1f2937', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>⚖️</span>
                  Moderator
                </h4>
                {subjectData?.moderator ? (
                  filteredData.moderator ? (
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.5rem', padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '600', fontSize: '1rem', color: '#111827', marginBottom: '0.25rem' }}>
                            {filteredData.moderator.name}
                          </div>
                          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                            {filteredData.moderator.email}
                          </div>
                          {filteredData.moderator.phone && (
                            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                              📞 {filteredData.moderator.phone}
                            </div>
                          )}
                        </div>
                        <span className={`badge badge-${filteredData.moderator.status === 'active' ? 'success' : 'danger'}`}>
                          {filteredData.moderator.status}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1rem', textAlign: 'center', color: '#9ca3af' }}>
                      Moderator doesn't match search criteria
                    </div>
                  )
                ) : (
                  <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1rem', textAlign: 'center', color: '#9ca3af' }}>
                    No moderator assigned to this subject yet
                  </div>
                )}
              </div>
            )}

            {/* SMEs */}
            {filteredData.smes.length > 0 && (
              <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
                <h4 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#1f2937', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>🎯</span>
                  Subject Matter Experts ({filteredData.smes.length})
                </h4>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {filteredData.smes.map(sme => (
                    <div key={sme.user_id} style={{ background: '#f0fdf4', border: '1px solid #d1fae5', borderRadius: '0.5rem', padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '600', fontSize: '1rem', color: '#111827', marginBottom: '0.25rem' }}>
                            {sme.name}
                          </div>
                          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                            {sme.email}
                          </div>
                          {sme.phone && (
                            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                              📞 {sme.phone}
                            </div>
                          )}
                          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem' }}>
                            Assigned: {new Date(sme.assigned_at).toLocaleDateString()}
                            {sme.assigned_by_name && ` by ${sme.assigned_by_name}`}
                          </div>
                        </div>
                        <span className={`badge badge-${sme.status === 'active' ? 'success' : 'danger'}`}>
                          {sme.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Examiners */}
            {filteredData.examiners.length > 0 && (
              <div style={{ padding: '1.5rem' }}>
                <h4 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#1f2937', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>👨‍🏫</span>
                  Examiners ({filteredData.examiners.length})
                </h4>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {filteredData.examiners.map(examiner => (
                    <div key={examiner.user_id} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '600', fontSize: '1rem', color: '#111827', marginBottom: '0.25rem' }}>
                            {examiner.name}
                          </div>
                          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                            {examiner.email}
                          </div>
                          {examiner.phone && (
                            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                              📞 {examiner.phone}
                            </div>
                          )}
                          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem' }}>
                            Assigned: {new Date(examiner.assigned_at).toLocaleDateString()}
                            {examiner.assigned_by_name && ` by ${examiner.assigned_by_name}`}
                          </div>
                        </div>
                        <span className={`badge badge-${examiner.status === 'active' ? 'success' : 'danger'}`}>
                          {examiner.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No Results */}
            {!filteredData.showModeratorSection && filteredData.smes.length === 0 && filteredData.examiners.length === 0 && (
              <div style={{ padding: '3rem', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
                <p style={{ color: '#9ca3af' }}>No users match your filters</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminReports;
