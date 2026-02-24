import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../api/axios';
import { useToast } from '../context/ToastContext';

const SubQuestionVariations = () => {
  const { paper_id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [paper, setPaper] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateQuestions, setTemplateQuestions] = useState([]);
  
  // Selected question and sub-question from template
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [selectedSubQuestion, setSelectedSubQuestion] = useState(null);
  
  const [variations, setVariations] = useState([]);
  const [selectedVariations, setSelectedVariations] = useState([]);
  const [generating, setGenerating] = useState(false);

  // Form for generating variations
  const [variationForm, setVariationForm] = useState({
    num_variations: 10
  });

  // SME selection
  const [smes, setSmes] = useState([]);
  const [selectedSme, setSelectedSme] = useState('');
  const [showSendModal, setShowSendModal] = useState(false);

  useEffect(() => {
    if (paper_id) {
      fetchPaper();
      fetchTemplates();
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

  const fetchTemplates = async () => {
    try {
      const { data } = await API.get('/templates');
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
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

  const handleTemplateSelect = async (templateId) => {
    try {
      const { data } = await API.get(`/templates/${templateId}`);
      setSelectedTemplate(data.template);
      
      // Parse questions if they're stored as JSON string
      let questions = data.template.questions;
      if (typeof questions === 'string') {
        questions = JSON.parse(questions);
      }
      
      setTemplateQuestions(questions || []);
      setSelectedQuestion(null);
      setSelectedSubQuestion(null);
      setVariations([]);
    } catch (error) {
      console.error('Error fetching template:', error);
      showToast('Failed to load template', 'error');
    }
  };

  const handleQuestionSelect = (question) => {
    setSelectedQuestion(question);
    setSelectedSubQuestion(null);
    setVariations([]);
  };

  const handleSubQuestionSelect = async (subQuestion) => {
    setSelectedSubQuestion(subQuestion);
    // Fetch existing variations if any
    await fetchVariationsForSubQuestion(subQuestion);
  };

  const fetchVariationsForSubQuestion = async (subQuestion) => {
    // This would fetch variations if they already exist
    // For now, we'll just clear the variations
    setVariations([]);
    setSelectedVariations([]);
  };

  const handleGenerateVariations = async () => {
    if (!selectedQuestion || !selectedSubQuestion) {
      showToast('Please select a question and sub-question first', 'error');
      return;
    }

    try {
      setGenerating(true);
      showToast(`Generating ${variationForm.num_variations} variations...`, 'info');

      // First, create the main question if it doesn't exist
      const mainQuestionNumber = selectedQuestion.question_number;
      
      // Check if main question exists
      let mainQuestionId = null;
      const { data: existingQuestions } = await API.get(`/papers/${paper_id}/questions`);
      const existingMain = existingQuestions.questions?.find(q => 
        q.question_text?.includes(mainQuestionNumber)
      );

      if (existingMain) {
        mainQuestionId = existingMain.question_id;
      } else {
        // Create main question
        const { data: mainData } = await API.post('/sub-questions/create-main-question', {
          paper_id: parseInt(paper_id),
          question_number: mainQuestionNumber,
          subject: paper?.subject || 'General',
          topic: paper?.topic || 'General'
        });
        mainQuestionId = mainData.parent_question_id;
      }

      // Check if sub-question exists
      const { data: existingSubQuestions } = await API.get(`/sub-questions/questions/${mainQuestionId}/sub-questions`);
      let subQuestionId = null;
      
      const existingSub = existingSubQuestions.sub_questions?.find(sq => 
        sq.sub_question_number === selectedSubQuestion.sub_number
      );

      if (existingSub) {
        subQuestionId = existingSub.sub_question_id;
      } else {
        // Create sub-question with difficulty
        const { data: subData } = await API.post('/sub-questions/create-sub-question', {
          parent_question_id: mainQuestionId,
          paper_id: parseInt(paper_id),
          sub_question_number: selectedSubQuestion.sub_number,
          question_type: selectedQuestion.question_type,
          marks: selectedSubQuestion.marks,
          difficulty: selectedSubQuestion.difficulty || 'medium',
          section_name: ''
        });
        subQuestionId = subData.sub_question_id;
      }

      // Generate variations with class level from template
      const { data } = await API.post('/sub-questions/generate-variations', {
        sub_question_id: subQuestionId,
        num_variations: variationForm.num_variations,
        subject: paper?.subject || 'General',
        topic: paper?.topic || 'General',
        class_level: selectedSubQuestion.class_level || null // NEW: Pass class level from template
      });

      showToast(`Generated ${data.variations.length} variations!`, 'success');
      setVariations(data.variations || []);

    } catch (error) {
      console.error('Error generating variations:', error);
      
      // Check if it's a topic not in PDF error
      const errorData = error.response?.data;
      if (error.response?.status === 400 && (errorData?.error === 'topic_not_in_pdf' || errorData?.error === 'parsing_failed_pdf_mismatch')) {
        // Topic/chapters not found in PDF - show detailed error with options
        const topicName = errorData.topicRequested || paper?.topic || 'the specified topic';
        const pdfName = errorData.pdfUsed || 'the selected PDF';
        
        showToast(
          `❌ Topic/Chapter Not Found in PDF\n\n` +
          `The topic "${topicName}" is not present in ${pdfName} for this class level.\n\n` +
          `Please:\n` +
          `1. Upload a different PDF that covers this topic\n` +
          `2. Select a different topic/chapter from the PDF\n` +
          `3. Generate questions without PDF context`,
          'error'
        );
      } else {
        showToast(error.response?.data?.message || 'Failed to generate variations', 'error');
      }
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
      await API.post('/sub-questions/variations/send-to-sme', {
        variation_ids: selectedVariations,
        sme_id: parseInt(selectedSme)
      });

      showToast(`Sent ${selectedVariations.length} variations to SME!`, 'success');
      setShowSendModal(false);
      setSelectedVariations([]);
      
      // Refresh variations
      if (selectedSubQuestion) {
        await fetchVariationsForSubQuestion(selectedSubQuestion);
      }

    } catch (error) {
      console.error('Error sending to SME:', error);
      showToast(error.response?.data?.message || 'Failed to send to SME', 'error');
    }
  };

  const handleFinalizeVariation = async (variationId) => {
    if (!window.confirm('Are you sure you want to finalize this variation?')) {
      return;
    }

    try {
      await API.post(`/sub-questions/variations/${variationId}/finalize`);
      showToast('Variation finalized successfully!', 'success');
      
      if (selectedSubQuestion) {
        await fetchVariationsForSubQuestion(selectedSubQuestion);
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
    <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={() => navigate('/examiner/papers')}
          className="btn btn-secondary"
          style={{ marginBottom: '1rem' }}
        >
          ← Back to Papers
        </button>
        <h1 style={{ margin: '0 0 0.5rem 0' }}>Generate Questions from Template</h1>
        {paper && (
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            {paper.paper_title || 'Untitled Paper'}
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem' }}>
        {/* Left Sidebar - Template Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Step 1: Select Template */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">📋 Step 1: Select Template</h3>
            </div>
            <div style={{ padding: '1rem' }}>
              <select
                className="form-select"
                value={selectedTemplate?.template_id || ''}
                onChange={(e) => handleTemplateSelect(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">Choose a template...</option>
                {templates.map(t => (
                  <option key={t.template_id} value={t.template_id}>
                    {t.template_name} ({t.question_count} questions)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Step 2: Select Question */}
          {selectedTemplate && templateQuestions.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">📝 Step 2: Select Question</h3>
              </div>
              <div style={{ padding: '1rem' }}>
                {templateQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuestionSelect(q)}
                    className="btn"
                    style={{
                      width: '100%',
                      marginBottom: '0.5rem',
                      textAlign: 'left',
                      background: selectedQuestion === q ? 'var(--primary-light)' : 'var(--bg-secondary)',
                      border: selectedQuestion === q ? '2px solid var(--primary)' : '1px solid var(--border-color)'
                    }}
                  >
                    <div style={{ fontWeight: '600' }}>{q.question_number}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {q.question_type} • {q.has_subquestions && q.subquestions?.length > 0 ? `${q.subquestions.length} sub-questions` : `${q.marks} marks`}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Select Sub-Question */}
          {selectedQuestion && selectedQuestion.has_subquestions && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">🔢 Step 3: Select Sub-Question</h3>
              </div>
              <div style={{ padding: '1rem' }}>
                {selectedQuestion.subquestions?.map((sq, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSubQuestionSelect(sq)}
                    className="btn"
                    style={{
                      width: '100%',
                      marginBottom: '0.5rem',
                      textAlign: 'left',
                      background: selectedSubQuestion === sq ? 'var(--primary-light)' : 'var(--bg-secondary)',
                      border: selectedSubQuestion === sq ? '2px solid var(--primary)' : '1px solid var(--border-color)'
                    }}
                  >
                    <div style={{ fontWeight: '600' }}>
                      {selectedQuestion.question_number}.{sq.sub_number}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {sq.marks} marks
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Generate Variations */}
          {selectedSubQuestion && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">🎯 Step 4: Generate</h3>
              </div>
              <div style={{ padding: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Number of Variations</label>
                  <input
                    type="number"
                    className="form-input"
                    value={variationForm.num_variations}
                    onChange={(e) => setVariationForm({ num_variations: parseInt(e.target.value) })}
                    min="1"
                    max="50"
                  />
                </div>
                <button
                  onClick={handleGenerateVariations}
                  className="btn btn-primary"
                  disabled={generating}
                  style={{ width: '100%' }}
                >
                  {generating ? '🤖 Generating...' : '🚀 Generate Variations'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Main Content - Variations */}
        <div>
          {!selectedTemplate ? (
            <div className="card">
              <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <p style={{ fontSize: '3rem', margin: '0 0 1rem 0' }}>📋</p>
                <p style={{ margin: 0 }}>Select a template to get started</p>
              </div>
            </div>
          ) : !selectedQuestion ? (
            <div className="card">
              <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <p style={{ fontSize: '3rem', margin: '0 0 1rem 0' }}>📝</p>
                <p style={{ margin: 0 }}>Select a question from the template</p>
              </div>
            </div>
          ) : !selectedSubQuestion ? (
            <div className="card">
              <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <p style={{ fontSize: '3rem', margin: '0 0 1rem 0' }}>🔢</p>
                <p style={{ margin: 0 }}>Select a sub-question to generate variations</p>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="card-title">
                  📝 Variations for {selectedQuestion.question_number}.{selectedSubQuestion.sub_number}
                </h3>
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
                {variations.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                    No variations yet. Click "Generate Variations" to create some!
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
                              {variation.full_number || `${selectedQuestion.question_number}.${selectedSubQuestion.sub_number}.${variation.variation_number}`}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {getStatusBadge(variation.status)}
                            {variation.is_selected && <span style={{ fontSize: '1.5rem' }}>⭐</span>}
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

export default SubQuestionVariations;
