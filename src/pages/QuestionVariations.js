import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../api/axios';
import { useToast } from '../context/ToastContext';

const QuestionVariations = () => {
  const { paper_id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [paper, setPaper] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [variations, setVariations] = useState([]);
  const [selectedVariations, setSelectedVariations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Form for generating new variations
  const [generateForm, setGenerateForm] = useState({
    question_number: '',
    question_type: 'short_answer',
    marks: 5,
    num_variations: 5,
    section_name: ''
  });

  // SME selection
  const [smes, setSmes] = useState([]);
  const [selectedSme, setSelectedSme] = useState('');
  const [showSendModal, setShowSendModal] = useState(false);

  useEffect(() => {
    if (paper_id) {
      fetchPaper();
      fetchQuestions();
      fetchSMEs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paper_id]);

  const fetchPaper = async () => {
    try {
      const { data } = await API.get(`/papers/${paper_id}`);
      setPaper(data.paper);
    } catch (error) {
      console.error('Error fetching paper:', error);
      showToast('Failed to load paper', 'error');
    }
  };

  const fetchQuestions = async () => {
    try {
      const { data } = await API.get(`/papers/${paper_id}/questions`);
      setQuestions(data.questions || []);
    } catch (error) {
      console.error('Error fetching questions:', error);
    }
  };

  const fetchSMEs = async () => {
    try {
      const { data } = await API.get('/users/smes');
      setSmes(data.smes || []);
    } catch (error) {
      console.error('Error fetching SMEs:', error);
    }
  };

  const fetchVariations = async (questionId) => {
    try {
      setLoading(true);
      const { data } = await API.get(`/question-variations/questions/${questionId}/variations`);
      setVariations(data.variations || []);
      setSelectedVariations([]);
    } catch (error) {
      console.error('Error fetching variations:', error);
      showToast('Failed to load variations', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateVariations = async (e) => {
    e.preventDefault();

    if (!generateForm.question_number) {
      showToast('Please enter question number', 'error');
      return;
    }

    try {
      setGenerating(true);
      showToast(`Generating ${generateForm.num_variations} variations...`, 'info');

      const { data } = await API.post('/question-variations/generate-with-variations', {
        paper_id: parseInt(paper_id),
        subject: paper?.subject || 'General',
        topic: paper?.topic || 'General',
        ...generateForm
      });

      showToast(`Generated ${data.variations.length} variations for ${data.question_number}!`, 'success');

      // Refresh questions and select the new one
      await fetchQuestions();
      setSelectedQuestion(data.parent_question_id);
      await fetchVariations(data.parent_question_id);

      // Reset form
      setGenerateForm({
        ...generateForm,
        question_number: '',
        num_variations: 5
      });

    } catch (error) {
      console.error('Error generating variations:', error);
      showToast(error.response?.data?.message || 'Failed to generate variations', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectVariation = (variationId) => {
    setSelectedVariations(prev => {
      if (prev.includes(variationId)) {
        return prev.filter(id => id !== variationId);
      } else {
        return [...prev, variationId];
      }
    });
  };

  const handleSendToSME = async () => {
    if (selectedVariations.length === 0) {
      showToast('Please select at least one variation', 'error');
      return;
    }

    if (!selectedSme) {
      showToast('Please select an SME', 'error');
      return;
    }

    try {
      await API.post('/question-variations/variations/send-to-sme', {
        variation_ids: selectedVariations,
        sme_id: parseInt(selectedSme)
      });

      showToast(`Sent ${selectedVariations.length} variations to SME!`, 'success');
      setShowSendModal(false);
      setSelectedVariations([]);

      // Refresh variations
      if (selectedQuestion) {
        await fetchVariations(selectedQuestion);
      }

    } catch (error) {
      console.error('Error sending to SME:', error);
      showToast(error.response?.data?.message || 'Failed to send to SME', 'error');
    }
  };

  const handleFinalizeVariation = async (variationId) => {
    if (!window.confirm('Are you sure you want to finalize this variation? This will mark it as the official question.')) {
      return;
    }

    try {
      await API.post(`/question-variations/variations/${variationId}/finalize`);
      showToast('Variation finalized successfully!', 'success');

      // Refresh variations
      if (selectedQuestion) {
        await fetchVariations(selectedQuestion);
      }

    } catch (error) {
      console.error('Error finalizing variation:', error);
      showToast(error.response?.data?.message || 'Failed to finalize variation', 'error');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      draft: { color: 'var(--text-secondary)', bg: 'var(--bg-secondary)', text: '📝 Draft' },
      sent_to_sme: { color: 'var(--info)', bg: 'var(--info-light)', text: '📤 Sent to SME' },
      approved: { color: 'var(--success)', bg: 'var(--success-light)', text: '✅ Approved' },
      rejected: { color: 'var(--error)', bg: 'var(--error-light)', text: '❌ Rejected' },
      finalized: { color: 'var(--primary)', bg: 'var(--primary-light)', text: '⭐ Finalized' }
    };

    const badge = badges[status] || badges.draft;

    return (
      <span style={{
        padding: '0.25rem 0.75rem',
        borderRadius: '1rem',
        fontSize: '0.75rem',
        fontWeight: '500',
        color: badge.color,
        background: badge.bg,
        border: `1px solid ${badge.color}`
      }}>
        {badge.text}
      </span>
    );
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={() => navigate('/examiner/papers')}
          className="btn btn-secondary"
          style={{ marginBottom: '1rem' }}
        >
          ← Back to Papers
        </button>
        <h1 style={{ margin: '0 0 0.5rem 0' }}>Question Variations</h1>
        {paper && (
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            {paper.paper_title || 'Untitled Paper'}
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        {/* Left Panel - Generate & Questions List */}
        <div>
          {/* Generate Form */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header">
              <h3 className="card-title">🎯 Generate Variations</h3>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <form onSubmit={handleGenerateVariations}>
                <div className="form-group">
                  <label className="form-label">Question Number *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={generateForm.question_number}
                    onChange={(e) => setGenerateForm({ ...generateForm, question_number: e.target.value })}
                    placeholder="e.g., Q1, Q2, Q3"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Question Type</label>
                  <select
                    className="form-select"
                    value={generateForm.question_type}
                    onChange={(e) => setGenerateForm({ ...generateForm, question_type: e.target.value })}
                  >
                    <option value="mcq">Multiple Choice</option>
                    <option value="short_answer">Short Answer</option>
                    <option value="long_answer">Long Answer</option>
                    <option value="true_false">True/False</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Marks</label>
                  <input
                    type="number"
                    className="form-input"
                    value={generateForm.marks}
                    onChange={(e) => setGenerateForm({ ...generateForm, marks: parseInt(e.target.value) })}
                    min="1"
                    max="20"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Number of Variations</label>
                  <input
                    type="number"
                    className="form-input"
                    value={generateForm.num_variations}
                    onChange={(e) => setGenerateForm({ ...generateForm, num_variations: parseInt(e.target.value) })}
                    min="1"
                    max="50"
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={generating}
                  style={{ width: '100%' }}
                >
                  {generating ? '🤖 Generating...' : '🚀 Generate Variations'}
                </button>
              </form>
            </div>
          </div>

          {/* Questions List */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">📋 Questions</h3>
            </div>
            <div style={{ padding: '1rem' }}>
              {questions.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                  No questions yet. Generate some variations!
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {questions.filter(q => q.has_variations).map((question) => (
                    <button
                      key={question.question_id}
                      onClick={() => {
                        setSelectedQuestion(question.question_id);
                        fetchVariations(question.question_id);
                      }}
                      className="btn"
                      style={{
                        textAlign: 'left',
                        background: selectedQuestion === question.question_id ? 'var(--primary-light)' : 'var(--bg-secondary)',
                        border: selectedQuestion === question.question_id ? '2px solid var(--primary)' : '1px solid var(--border-color)'
                      }}
                    >
                      {question.question_text}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Variations */}
        <div>
          {selectedQuestion ? (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="card-title">📝 Variations</h3>
                {selectedVariations.length > 0 && (
                  <button
                    onClick={() => setShowSendModal(true)}
                    className="btn btn-primary btn-sm"
                  >
                    📤 Send {selectedVariations.length} to SME
                  </button>
                )}
              </div>
              <div style={{ padding: '1.5rem' }}>
                {loading ? (
                  <p style={{ textAlign: 'center', padding: '2rem' }}>Loading variations...</p>
                ) : variations.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                    No variations found
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {variations.map((variation) => (
                      <div
                        key={variation.variation_id}
                        style={{
                          padding: '1rem',
                          border: '1px solid var(--border-color)',
                          borderRadius: '0.5rem',
                          background: variation.is_selected ? 'var(--success-light)' : 'var(--bg-secondary)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <input
                              type="checkbox"
                              checked={selectedVariations.includes(variation.variation_id)}
                              onChange={() => handleSelectVariation(variation.variation_id)}
                              disabled={variation.status !== 'draft'}
                              style={{ width: '18px', height: '18px' }}
                            />
                            <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>
                              Variation {variation.variation_number}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {getStatusBadge(variation.status)}
                            {variation.is_selected && (
                              <span style={{ fontSize: '1.5rem' }}>⭐</span>
                            )}
                          </div>
                        </div>

                        <div style={{ marginBottom: '0.75rem' }}>
                          <p style={{ margin: '0 0 0.5rem 0', fontWeight: '500' }}>
                            {variation.question_text}
                          </p>
                          {variation.options && (
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginLeft: '1rem' }}>
                              {JSON.parse(variation.options).map((opt, idx) => (
                                <div key={idx}>{opt}</div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                          <strong>Answer:</strong> {variation.correct_answer}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {variation.marks} marks • {variation.question_type}
                          </span>
                          {variation.status === 'approved' && !variation.is_selected && (
                            <button
                              onClick={() => handleFinalizeVariation(variation.variation_id)}
                              className="btn btn-success btn-sm"
                            >
                              ⭐ Finalize
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card">
              <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <p style={{ fontSize: '3rem', margin: '0 0 1rem 0' }}>📝</p>
                <p style={{ margin: 0 }}>Select a question to view its variations</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Send to SME Modal */}
      {showSendModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ width: '500px', maxWidth: '90%' }}>
            <div className="card-header">
              <h3 className="card-title">📤 Send to SME</h3>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <p style={{ marginBottom: '1rem' }}>
                Send {selectedVariations.length} selected variation(s) to SME for review
              </p>

              <div className="form-group">
                <label className="form-label">Select SME *</label>
                <select
                  className="form-select"
                  value={selectedSme}
                  onChange={(e) => setSelectedSme(e.target.value)}
                >
                  <option value="">Choose SME...</option>
                  {smes.map(sme => (
                    <option key={sme.user_id} value={sme.user_id}>
                      {sme.name} - {sme.department_name || 'No Department'}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowSendModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendToSME}
                  className="btn btn-primary"
                >
                  Send to SME
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionVariations;
