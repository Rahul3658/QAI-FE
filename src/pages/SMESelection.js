import { useState, useEffect } from 'react';
import API from '../api/axios';
import { useToast } from '../context/ToastContext';

const SMESelection = () => {
  const { showToast } = useToast();
  
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [sets, setSets] = useState([]);
  const [selectedSets, setSelectedSets] = useState([]);
  const [selectionReasons, setSelectionReasons] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [aiRecommending, setAiRecommending] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState(null);
  const [expandedSet, setExpandedSet] = useState(null);
  const [editingSet, setEditingSet] = useState(null);
  const [editedQuestions, setEditedQuestions] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const fetchPendingRequests = async () => {
    try {
      setLoading(true);
      const { data } = await API.get('/sme-selection/pending-requests');
      setRequests(data.requests || []);
    } catch (err) {
      console.error('Failed to fetch requests');
    } finally {
      setLoading(false);
    }
  };

  const handleViewSets = async (request) => {
    try {
      setSelectedRequest(request);
      const { data } = await API.get(`/sme-selection/request/${request.request_id}/sets`);
      setSets(data.sets || []);
      
      // If already selected, load the selected paper IDs
      if (request.status !== 'pending_sme_selection' && request.selected_count > 0) {
        const selectedPaperIds = (data.sets || [])
          .filter(set => set.selected_by_sme)
          .map(set => set.paper_id);
        setSelectedSets(selectedPaperIds);
      } else {
        setSelectedSets([]);
      }
      
      setSelectionReasons({});
      setAiRecommendation(null);
    } catch (err) {
      showToast('Failed to load sets', 'error');
    }
  };

  const handleGetAIRecommendation = async () => {
    try {
      setAiRecommending(true);
      const { data } = await API.post(`/sme-selection/request/${selectedRequest.request_id}/ai-recommend`);
      setAiRecommendation(data.recommendation);
      showToast('AI recommendation generated!', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to get AI recommendation', 'error');
    } finally {
      setAiRecommending(false);
    }
  };

  const handleApplyAIRecommendation = () => {
    if (!aiRecommendation) return;
    
    const recommendedPaperIds = aiRecommendation.recommended_sets.map(s => s.paper_id);
    setSelectedSets(recommendedPaperIds);
    
    // Set reasons from AI
    const reasons = {};
    aiRecommendation.recommended_sets.forEach(s => {
      reasons[s.paper_id] = s.reason;
    });
    setSelectionReasons(reasons);
    
    showToast('AI recommendations applied!', 'success');
  };

  const handleToggleSet = (paperId) => {
    if (selectedSets.includes(paperId)) {
      setSelectedSets(selectedSets.filter(id => id !== paperId));
    } else {
      if (selectedSets.length >= 3) {
        showToast('You can only select 3 sets', 'warning');
        return;
      }
      setSelectedSets([...selectedSets, paperId]);
    }
  };

  const handleSubmitSelection = async () => {
    if (selectedSets.length !== 3) {
      showToast('Please select exactly 3 sets', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      
      const selection_reasons = selectedSets.map(paperId => 
        selectionReasons[paperId] || 'Selected by SME'
      );

      await API.post(`/sme-selection/request/${selectedRequest.request_id}/select`, {
        selected_paper_ids: selectedSets,
        selection_reasons,
        ai_assisted: !!aiRecommendation
      });

      showToast('Successfully selected 3 sets! Sent to Moderator.', 'success');
      setSelectedRequest(null);
      setSets([]);
      fetchPendingRequests();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to submit selection', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    setSelectedRequest(null);
    setSets([]);
    setSelectedSets([]);
    setSelectionReasons({});
    setAiRecommendation(null);
  };

  const handleEditSet = (set) => {
    setEditingSet(set.paper_id);
    setEditedQuestions({ ...editedQuestions, [set.paper_id]: [...set.questions] });
  };

  const handleCancelEdit = (paperId) => {
    setEditingSet(null);
    const updatedQuestions = { ...editedQuestions };
    delete updatedQuestions[paperId];
    setEditedQuestions(updatedQuestions);
  };

  const handleQuestionChange = (paperId, questionIndex, field, value) => {
    const updated = { ...editedQuestions };
    updated[paperId][questionIndex][field] = value;
    setEditedQuestions(updated);
  };

  const handleSaveEdits = async (paperId) => {
    try {
      setSaving(true);
      const questions = editedQuestions[paperId];
      
      await API.put(`/sme-selection/paper/${paperId}/questions`, { questions });
      
      // Update the sets with edited questions
      const updatedSets = sets.map(s => 
        s.paper_id === paperId ? { ...s, questions: [...questions] } : s
      );
      setSets(updatedSets);
      
      setEditingSet(null);
      showToast('Questions updated successfully!', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save changes', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRejectRequest = async (reason) => {
    if (!selectedRequest) return;

    try {
      setSubmitting(true);
      await API.post(`/sme-selection/request/${selectedRequest.request_id}/reject`, {
        rejection_reason: reason
      });

      showToast('Request rejected successfully. Faculty will be notified.', 'success');
      setSelectedRequest(null);
      setSets([]);
      fetchPendingRequests();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to reject request', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (selectedRequest) {
    const isReadOnly = selectedRequest.status !== 'pending_sme_selection';
    const statusConfig = {
      'pending_moderator': { label: 'Sent to Moderator', color: 'info' },
      'pending_hod': { label: 'With HOD', color: 'info' },
      'approved': { label: 'Approved', color: 'success' },
      'rejected': { label: 'Rejected', color: 'danger' }
    };
    const currentStatus = statusConfig[selectedRequest.status];
    
    return (
      <div className="dashboard">
        <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <button className="btn btn-secondary" onClick={handleBack}>
              ← Back to Requests
            </button>
            <h1 className="dashboard-title">
              {isReadOnly ? 'View Selected Sets' : 'Select 3 Sets from 10'}
            </h1>
            <p className="dashboard-subtitle">
              {selectedRequest.subject} - {selectedRequest.topic}
            </p>
            {isReadOnly && currentStatus && (
              <div style={{ marginTop: '0.5rem' }}>
                <span className={`badge badge-${currentStatus.color}`} style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>
                  Status: {currentStatus.label}
                </span>
              </div>
            )}
          </div>
          {!isReadOnly && (
            <button
              className="btn btn-danger"
              onClick={() => {
                const reason = window.prompt('Please provide a reason for rejecting all 10 sets:');
                if (reason && reason.trim()) {
                  handleRejectRequest(reason);
                }
              }}
            >
              ❌ Reject All Sets
            </button>
          )}
        </div>

        {/* AI Recommendation Section - Only show if not read-only */}
        {!isReadOnly && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header">
              <h2 className="card-title">🤖 AI Assistance</h2>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleGetAIRecommendation}
                  disabled={aiRecommending}
                >
                  {aiRecommending ? '⏳ Analyzing...' : '🤖 Get AI Recommendation'}
                </button>
                
                {aiRecommendation && (
                  <>
                    <button
                      className="btn btn-success"
                      onClick={handleApplyAIRecommendation}
                    >
                      ✅ Apply AI Recommendations
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setAiRecommendation(null);
                        showToast('AI recommendations cleared', 'info');
                      }}
                    >
                      🔄 Clear & Start Over
                    </button>
                  </>
                )}
                
                {selectedSets.length > 0 && (
                  <button
                    className="btn btn-warning"
                    onClick={() => {
                      setSelectedSets([]);
                      setSelectionReasons({});
                      showToast('Selection cleared. You can select again.', 'info');
                    }}
                  >
                    ❌ Clear Selection
                  </button>
                )}
              </div>

              {aiRecommendation && (
                <div style={{ 
                  marginTop: '1rem', 
                  padding: '1rem', 
                  background: 'var(--success-light)', 
                  borderRadius: '0.5rem',
                  border: '1px solid var(--success)'
                }}>
                  <h4 style={{ marginTop: 0 }}>AI Analysis:</h4>
                  <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
                    {aiRecommendation.overall_analysis}
                  </p>
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {aiRecommendation.recommended_sets.map((rec, idx) => (
                      <div key={idx} style={{ 
                        padding: '0.75rem', 
                        background: 'white', 
                        borderRadius: '0.375rem',
                        border: '1px solid var(--border-color)'
                      }}>
                        <strong>#{rec.rank} - Set {rec.set_number}</strong>
                        <p style={{ fontSize: '0.875rem', margin: '0.25rem 0 0 0', color: 'var(--text-secondary)' }}>
                          {rec.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Selection Progress */}
        <div style={{ 
          padding: '1rem', 
          background: isReadOnly ? 'var(--info-light)' : (selectedSets.length === 3 ? 'var(--success-light)' : 'var(--info-light)'), 
          borderRadius: '0.5rem',
          marginBottom: '1.5rem',
          border: `1px solid ${isReadOnly ? 'var(--info)' : (selectedSets.length === 3 ? 'var(--success)' : 'var(--info)')}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '1rem', fontWeight: '500' }}>
              {isReadOnly ? `✅ Selected Sets: ${selectedSets.length}/3` : `Selected: ${selectedSets.length}/3 sets`}
            </span>
            {!isReadOnly && selectedSets.length === 3 && (
              <button
                className="btn btn-success"
                onClick={handleSubmitSelection}
                disabled={submitting}
              >
                {submitting ? '⏳ Submitting...' : '✅ Submit Selection'}
              </button>
            )}
          </div>
        </div>

        {/* Sets Grid */}
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {sets.map(set => {
            const isSelected = selectedSets.includes(set.paper_id);
            const isExpanded = expandedSet === set.paper_id;
            
            return (
              <div 
                key={set.paper_id}
                className="card"
                style={{ 
                  border: isSelected ? '2px solid var(--success)' : '1px solid var(--border-color)',
                  background: isSelected ? 'var(--success-light)' : 'white'
                }}
              >
                <div className="card-header" style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  background: isSelected ? 'var(--success)' : 'var(--bg-secondary)',
                  color: isSelected ? 'white' : 'inherit'
                }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.125rem' }}>
                      {isSelected && '✅ '} Set {set.set_number}
                    </h3>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', opacity: 0.9 }}>
                      Quality Score: {set.ai_quality_score} | {set.question_count} questions
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {!isReadOnly && (
                      <button
                        className={`btn btn-sm ${isSelected ? 'btn-danger' : 'btn-success'}`}
                        onClick={() => handleToggleSet(set.paper_id)}
                        disabled={!isSelected && selectedSets.length >= 3}
                      >
                        {isSelected ? 'Deselect' : 'Select'}
                      </button>
                    )}
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => setExpandedSet(isExpanded ? null : set.paper_id)}
                    >
                      {isExpanded ? 'Hide' : 'View'} Questions
                    </button>
                    {!isReadOnly && isExpanded && editingSet !== set.paper_id && (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleEditSet(set)}
                      >
                        ✏️ Edit Questions
                      </button>
                    )}
                    {editingSet === set.paper_id && (
                      <>
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => handleSaveEdits(set.paper_id)}
                          disabled={saving}
                        >
                          {saving ? '⏳' : '💾'} Save
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => handleCancelEdit(set.paper_id)}
                          disabled={saving}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      {(editingSet === set.paper_id ? editedQuestions[set.paper_id] : set.questions).map((q, idx) => (
                        <div key={idx} style={{ 
                          padding: '1rem', 
                          background: editingSet === set.paper_id ? 'var(--warning-light)' : 'var(--bg-secondary)', 
                          borderRadius: '0.5rem',
                          border: `1px solid ${editingSet === set.paper_id ? 'var(--warning)' : 'var(--border-color)'}`
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {editingSet === set.paper_id ? (
                              <>
                                <select
                                  className="form-input"
                                  value={q.question_type}
                                  onChange={(e) => handleQuestionChange(set.paper_id, idx, 'question_type', e.target.value)}
                                  style={{ width: 'auto', padding: '0.25rem 0.5rem' }}
                                >
                                  <option value="mcq">MCQ</option>
                                  <option value="short_answer">Short Answer</option>
                                  <option value="long_answer">Long Answer</option>
                                </select>
                                <input
                                  type="number"
                                  className="form-input"
                                  value={q.marks}
                                  onChange={(e) => handleQuestionChange(set.paper_id, idx, 'marks', parseInt(e.target.value))}
                                  style={{ width: '80px', padding: '0.25rem 0.5rem' }}
                                  min="1"
                                />
                              </>
                            ) : (
                              <>
                                <span className="badge badge-primary">{q.question_type}</span>
                                <span className="badge badge-success">{q.marks} marks</span>
                              </>
                            )}
                          </div>
                          {editingSet === set.paper_id ? (
                            <textarea
                              className="form-input"
                              value={q.question_text}
                              onChange={(e) => handleQuestionChange(set.paper_id, idx, 'question_text', e.target.value)}
                              rows="3"
                              style={{ marginBottom: '0.5rem' }}
                            />
                          ) : (
                            <p style={{ margin: '0.5rem 0', fontWeight: '500' }}>
                              Q{idx + 1}. {q.question_text}
                            </p>
                          )}
                          
                          {/* MCQ Options - Editable */}
                          {q.question_type === 'mcq' && q.options && (
                            <div style={{ marginTop: '0.5rem' }}>
                              <label style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', display: 'block' }}>
                                Options:
                              </label>
                              {editingSet === set.paper_id ? (
                                <div style={{ display: 'grid', gap: '0.5rem' }}>
                                  {q.options.map((opt, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                      <span style={{ fontWeight: 'bold', minWidth: '20px' }}>{String.fromCharCode(65 + i)}.</span>
                                      <input
                                        type="text"
                                        className="form-input"
                                        value={opt}
                                        onChange={(e) => {
                                          const newOptions = [...q.options];
                                          newOptions[i] = e.target.value;
                                          handleQuestionChange(set.paper_id, idx, 'options', newOptions);
                                        }}
                                        style={{ flex: 1 }}
                                      />
                                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                                        <input
                                          type="radio"
                                          name={`correct-${set.paper_id}-${idx}`}
                                          checked={opt === q.correct_answer}
                                          onChange={() => handleQuestionChange(set.paper_id, idx, 'correct_answer', opt)}
                                        />
                                        <span style={{ fontSize: '0.875rem' }}>Correct</span>
                                      </label>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div style={{ fontSize: '0.875rem' }}>
                                  {q.options.map((opt, i) => (
                                    <div key={i} style={{ 
                                      padding: '0.25rem 0.5rem',
                                      background: opt === q.correct_answer ? 'var(--success-light)' : 'transparent',
                                      borderRadius: '0.25rem',
                                      marginBottom: '0.25rem'
                                    }}>
                                      {String.fromCharCode(65 + i)}. {opt}
                                      {opt === q.correct_answer && ' ✓'}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Answer for Short/Long Answer - Editable */}
                          {(q.question_type === 'short_answer' || q.question_type === 'long_answer') && (
                            <div style={{ marginTop: '0.5rem' }}>
                              <label style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', display: 'block' }}>
                                Answer:
                              </label>
                              {editingSet === set.paper_id ? (
                                <textarea
                                  className="form-input"
                                  value={q.correct_answer || ''}
                                  onChange={(e) => handleQuestionChange(set.paper_id, idx, 'correct_answer', e.target.value)}
                                  rows={q.question_type === 'long_answer' ? 5 : 3}
                                  placeholder="Enter the answer..."
                                  style={{ fontSize: '0.875rem' }}
                                />
                              ) : (
                                <div style={{ 
                                  padding: '0.75rem', 
                                  background: 'var(--success-light)', 
                                  borderRadius: '0.375rem',
                                  fontSize: '0.875rem',
                                  whiteSpace: 'pre-wrap'
                                }}>
                                  {q.correct_answer || 'No answer provided'}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isSelected && !isReadOnly && (
                  <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
                    <label className="form-label">Selection Reason (Optional)</label>
                    <textarea
                      className="form-input"
                      value={selectionReasons[set.paper_id] || ''}
                      onChange={(e) => setSelectionReasons({ ...selectionReasons, [set.paper_id]: e.target.value })}
                      placeholder="Why did you select this set?"
                      rows="2"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">📋 SME Selection Dashboard</h1>
        <p className="dashboard-subtitle">Select 3 best sets from 10 generated sets</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">All Requests</h2>
        </div>
        <div style={{ padding: '1.5rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div className="spinner"></div>
            </div>
          ) : requests.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
              No requests found. Check back later!
            </p>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Topic</th>
                    <th>Faculty</th>
                    <th>Sets</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map(req => {
                    const statusConfig = {
                      'pending_sme_selection': { label: 'Pending Selection', color: 'warning', canReview: true },
                      'pending_moderator': { label: 'With Moderator', color: 'info', canReview: true },
                      'pending_hod': { label: 'With HOD', color: 'info', canReview: true },
                      'approved': { label: 'Approved', color: 'success', canReview: true },
                      'rejected': { label: 'Rejected', color: 'danger', canReview: true }
                    };
                    const status = statusConfig[req.status] || { label: req.status, color: 'secondary', canReview: false };
                    
                    return (
                      <tr key={req.request_id}>
                        <td>{req.subject}</td>
                        <td>{req.topic}</td>
                        <td>{req.faculty_name}</td>
                        <td>
                          {req.selected_count > 0 ? (
                            <span>{req.selected_count} selected / {req.total_sets} total</span>
                          ) : (
                            <span>{req.total_sets}/10</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge badge-${status.color}`}>
                            {status.label}
                          </span>
                        </td>
                        <td>{new Date(req.created_at).toLocaleDateString()}</td>
                        <td>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleViewSets(req)}
                          >
                            {req.status === 'pending_sme_selection' ? 'Review & Select' : 'View Sets'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SMESelection;
