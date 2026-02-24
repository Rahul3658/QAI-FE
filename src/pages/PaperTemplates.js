import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import API from '../api/axios';
import { useToast } from '../context/ToastContext';
import './PaperTemplates.css';

const PaperTemplates = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showForm, setShowForm] = useState(false);

  // Check if user is admin (super_admin from CET or EduLab)
  const isAdmin = user?.role === 'super_admin' &&
    (user?.department?.toLowerCase() === 'cet' ||
      user?.department?.toLowerCase() === 'edulab');

  const [formData, setFormData] = useState({
    template_name: '',
    description: '',
    questions: [],
    class_weightage: {
      class_11: 50,
      class_12: 50
    }
  });

  // Class level options
  const CLASS_LEVELS = [
    { value: '', label: 'Not Specified' },
    { value: 'Class 11', label: 'Class 11' },
    { value: 'Class 12', label: 'Class 12' }
  ];

  const [expandedQuestions, setExpandedQuestions] = useState({});
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [deleteModal, setDeleteModal] = useState({
    show: false,
    templateId: null,
    templateName: '',
    hasDraftPapers: false,
    draftCount: 0,
    draftPapers: []
  });

  useEffect(() => {
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const { data } = await API.get('/templates');
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      showToast('Failed to load templates', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingTemplate(null);
    setFormData({
      template_name: '',
      description: '',
      questions: [
        {
          question_number: 'Q1',
          question_type: 'mcq',
          difficulty: 'medium', // Default difficulty
          class_level: 'Class 11', // NEW: Class level
          has_subquestions: false,
          subquestions: [],
          marks: 5
        }
      ],
      class_weightage: {
        class_11: 50,
        class_12: 50
      }
    });
    setExpandedQuestions({});
    setShowForm(true);
  };

  const handleEdit = async (templateId) => {
    try {
      const { data } = await API.get(`/templates/${templateId}`);
      setEditingTemplate(data.template);
      const isOtherUserTemplate = data.template.created_by !== user?.user_id;
      setIsReadOnly(isOtherUserTemplate);
      setFormData({
        template_name: data.template.template_name,
        description: data.template.description || '',
        questions: data.template.questions || [],
        class_weightage: data.template.class_weightage || {
          class_11: 50,
          class_12: 50
        }
      });
      const expanded = {};
      (data.template.questions || []).forEach((_, index) => {
        expanded[index] = true;
      });
      setExpandedQuestions(expanded);
      setShowForm(true);
    } catch (error) {
      console.error('Error loading template:', error);
      showToast('Failed to load template', 'error');
    }
  };

  const handleDelete = async (templateId, templateName) => {
    try {
      // Check if template has unconfirmed (draft) papers
      const { data } = await API.get(`/templates/${templateId}/usage`);

      const hasDraftPapers = data.draft_count > 0;

      if (hasDraftPapers) {
        // Show warning modal for draft papers with list
        setDeleteModal({
          show: true,
          templateId,
          templateName,
          hasDraftPapers: true,
          draftCount: data.draft_count,
          draftPapers: data.draft_papers || []
        });
      } else {
        // No draft papers, show simple confirmation
        setDeleteModal({
          show: true,
          templateId,
          templateName,
          hasDraftPapers: false,
          draftCount: 0,
          draftPapers: []
        });
      }
    } catch (error) {
      console.error('Error with template deletion:', error);
      showToast(error.response?.data?.message || 'Failed to delete template', 'error');
    }
  };

  const confirmDelete = async () => {
    try {
      await API.delete(`/templates/${deleteModal.templateId}`);
      showToast('Template deleted successfully', 'success');
      setDeleteModal({
        show: false,
        templateId: null,
        templateName: '',
        hasDraftPapers: false,
        draftCount: 0,
        draftPapers: []
      });
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      showToast(error.response?.data?.message || 'Failed to delete template', 'error');
    }
  };

  const cancelDelete = () => {
    setDeleteModal({
      show: false,
      templateId: null,
      templateName: '',
      hasDraftPapers: false,
      draftCount: 0,
      draftPapers: []
    });
  };

  const handleToggleVisibility = async (templateId, currentVisibility, isAdminApproved) => {
    try {
      if (isAdmin) {
        // Admin toggles admin approval
        const newApprovalStatus = !isAdminApproved;
        await API.put(`/templates/${templateId}/toggle-visibility`, {
          is_admin_approved: newApprovalStatus
        });
        showToast(
          `Template is now ${newApprovalStatus ? 'approved and public' : 'unapproved'}`,
          'success'
        );
      } else {
        // Regular examiner toggles public status
        const newVisibility = !currentVisibility;
        await API.put(`/templates/${templateId}/toggle-visibility`, {
          is_public: newVisibility
        });
        showToast(
          `Template is now ${newVisibility ? 'public' : 'private'}`,
          'success'
        );
      }
      fetchTemplates();
    } catch (error) {
      console.error('Error toggling template visibility:', error);
      showToast('Failed to update template visibility', 'error');
    }
  };

  // const handleSetDefault = async (templateId) => {
  //   try {
  //     await API.put(`/templates/${templateId}/set-default`);
  //     showToast('Default template updated', 'success');
  //     fetchTemplates();
  //   } catch (error) {
  //     console.error('Error setting default:', error);
  //     showToast('Failed to set default template', 'error');
  //   }
  // };

  const handleAddQuestion = () => {
    const nextNumber = formData.questions.length + 1;

    // Randomly assign class level based on current weightage
    const weightage = formData.class_weightage || { class_11: 50, class_12: 50 };
    const randomValue = Math.random() * 100;
    const randomClassLevel = randomValue < weightage.class_11 ? 'Class 11' : 'Class 12';

    const newQuestion = {
      question_number: `Q${nextNumber}`,
      question_type: 'mcq',
      difficulty: 'medium', // Default difficulty
      class_level: randomClassLevel, // Randomly assigned based on weightage
      has_subquestions: false,
      subquestions: [],
      marks: 5
    };

    setFormData({
      ...formData,
      questions: [...formData.questions, newQuestion]
    });
  };

  const handleRemoveQuestion = (index) => {
    const newQuestions = formData.questions.filter((_, i) => i !== index);
    // Renumber questions
    const renumbered = newQuestions.map((q, i) => ({
      ...q,
      question_number: `Q${i + 1}`
    }));
    setFormData({ ...formData, questions: renumbered });
  };

  const handleQuestionChange = (index, field, value) => {
    const newQuestions = [...formData.questions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };

    // If toggling has_subquestions, initialize or clear subquestions
    if (field === 'has_subquestions') {
      if (value && newQuestions[index].subquestions.length === 0) {
        newQuestions[index].subquestions = [
          { sub_number: 'a', marks: 2, class_level: newQuestions[index].class_level || 'Class 11' }
        ];
      }
    }

    setFormData({ ...formData, questions: newQuestions });
  };

  const handleAddSubQuestion = (questionIndex) => {
    const newQuestions = [...formData.questions];
    const subCount = newQuestions[questionIndex].subquestions.length;
    const nextLetter = String.fromCharCode(97 + subCount); // a, b, c, d...

    // Randomly assign class level based on current weightage
    const weightage = formData.class_weightage || { class_11: 50, class_12: 50 };
    const randomValue = Math.random() * 100;
    const randomClassLevel = randomValue < weightage.class_11 ? 'Class 11' : 'Class 12';

    // Duplicate the previous sub-question if it exists, otherwise use default
    const previousSubQuestion = subCount > 0
      ? newQuestions[questionIndex].subquestions[subCount - 1]
      : null;

    const newSubQuestion = previousSubQuestion
      ? {
        ...previousSubQuestion,
        sub_number: nextLetter,
        class_level: randomClassLevel // Override with random class level
      }
      : {
        sub_number: nextLetter,
        marks: 2,
        class_level: randomClassLevel // Randomly assigned based on weightage
      };

    newQuestions[questionIndex].subquestions.push(newSubQuestion);

    setFormData({ ...formData, questions: newQuestions });
  };

  const handleRemoveSubQuestion = (questionIndex, subIndex) => {
    const newQuestions = [...formData.questions];
    newQuestions[questionIndex].subquestions = newQuestions[questionIndex].subquestions.filter((_, i) => i !== subIndex);

    // Renumber sub-questions
    newQuestions[questionIndex].subquestions = newQuestions[questionIndex].subquestions.map((sq, i) => ({
      ...sq,
      sub_number: String.fromCharCode(97 + i)
    }));

    setFormData({ ...formData, questions: newQuestions });
  };

  const handleSubQuestionChange = (questionIndex, subIndex, field, value) => {
    const newQuestions = [...formData.questions];
    newQuestions[questionIndex].subquestions[subIndex] = {
      ...newQuestions[questionIndex].subquestions[subIndex],
      [field]: value
    };
    setFormData({ ...formData, questions: newQuestions });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.template_name.trim()) {
      showToast('Please enter a template name', 'error');
      return;
    }

    if (formData.questions.length === 0) {
      showToast('Please add at least one question', 'error');
      return;
    }

    try {
      if (editingTemplate) {
        await API.put(`/templates/${editingTemplate.template_id}`, formData);
        showToast('Template updated successfully', 'success');
      } else {
        await API.post('/templates', formData);
        showToast('Template created successfully', 'success');
      }
      setShowForm(false);
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      showToast('Failed to save template', 'error');
    }
  };

  const getTotalMarks = () => {
    return formData.questions.reduce((sum, q) => {
      if (q.has_subquestions) {
        return sum + q.subquestions.reduce((subSum, sq) => subSum + (parseInt(sq.marks) || 0), 0);
      }
      return sum + (parseInt(q.marks) || 0);
    }, 0);
  };

  const getQuestionMarks = (question) => {
    if (question.has_subquestions) {
      return question.subquestions.reduce((sum, sq) => sum + (parseInt(sq.marks) || 0), 0);
    }
    return parseInt(question.marks) || 0;
  };

  const handleDivideMarks = (questionIndex) => {
    const newQuestions = [...formData.questions];
    const question = newQuestions[questionIndex];

    if (!question.has_subquestions || question.subquestions.length === 0) {
      showToast('Please add sub-questions first', 'warning');
      return;
    }

    // Prompt for total marks to divide
    const totalMarks = prompt(
      `Enter total marks to divide among ${question.subquestions.length} sub-questions:`,
      getQuestionMarks(question) || 10
    );

    if (totalMarks === null) return; // User cancelled

    const marks = parseInt(totalMarks);
    if (isNaN(marks) || marks <= 0) {
      showToast('Please enter a valid positive number', 'error');
      return;
    }

    // Divide marks evenly
    const numSubQuestions = question.subquestions.length;
    const marksPerSub = Math.floor(marks / numSubQuestions);
    const remainder = marks % numSubQuestions;

    // Distribute marks (first sub-question gets remainder)
    newQuestions[questionIndex].subquestions = question.subquestions.map((sq, i) => ({
      ...sq,
      marks: i === 0 ? marksPerSub + remainder : marksPerSub
    }));

    setFormData({ ...formData, questions: newQuestions });
    showToast(`Marks divided: ${marks} marks distributed among ${numSubQuestions} sub-questions`, 'success');
  };

  const toggleQuestionExpanded = (questionIndex) => {
    setExpandedQuestions(prev => ({
      ...prev,
      [questionIndex]: !prev[questionIndex]
    }));
  };

  // Calculate actual class distribution from questions
  const getActualClassDistribution = () => {
    let class11Marks = 0, class12Marks = 0;

    formData.questions.forEach(q => {
      if (q.has_subquestions && q.subquestions) {
        q.subquestions.forEach(sq => {
          const marks = parseInt(sq.marks) || 0;
          if (sq.class_level === 'Class 11') class11Marks += marks;
          else if (sq.class_level === 'Class 12') class12Marks += marks;
        });
      } else {
        const marks = parseInt(q.marks) || 0;
        if (q.class_level === 'Class 11') class11Marks += marks;
        else if (q.class_level === 'Class 12') class12Marks += marks;
      }
    });

    const totalMarks = getTotalMarks();
    if (totalMarks === 0) return { class_11: 0, class_12: 0, class11Marks: 0, class12Marks: 0 };

    return {
      class_11: Math.round((class11Marks / totalMarks) * 100),
      class_12: Math.round((class12Marks / totalMarks) * 100),
      class11Marks,
      class12Marks
    };
  };

  // Auto-adjust question class levels based on target weightage
  const autoAdjustClassLevels = () => {
    const totalMarks = getTotalMarks();
    if (totalMarks === 0 || formData.questions.length === 0) {
      showToast('No questions to adjust', 'warning');
      return;
    }

    const weightage = formData.class_weightage || { class_11: 50, class_12: 50 };
    const targetClass11Marks = Math.round((totalMarks * weightage.class_11) / 100);

    // Collect all question items (questions and subquestions) with their marks
    const items = [];
    formData.questions.forEach((q, qIndex) => {
      if (q.has_subquestions && q.subquestions) {
        q.subquestions.forEach((sq, sqIndex) => {
          items.push({
            type: 'subquestion',
            qIndex,
            sqIndex,
            marks: parseInt(sq.marks) || 0,
            currentClass: sq.class_level || 'Class 11'
          });
        });
      } else {
        items.push({
          type: 'question',
          qIndex,
          marks: parseInt(q.marks) || 0,
          currentClass: q.class_level || 'Class 11'
        });
      }
    });

    // Sort by marks (descending) for better distribution
    items.sort((a, b) => b.marks - a.marks);

    // Assign class levels to match target distribution
    let class11Marks = 0;
    const newQuestions = JSON.parse(JSON.stringify(formData.questions));

    items.forEach(item => {
      let assignedClass = 'Class 11';

      // Assign based on which bucket needs more marks
      if (class11Marks < targetClass11Marks) {
        assignedClass = 'Class 11';
        class11Marks += item.marks;
      } else {
        assignedClass = 'Class 12';
      }

      // Apply the class level
      if (item.type === 'subquestion') {
        newQuestions[item.qIndex].subquestions[item.sqIndex].class_level = assignedClass;
      } else {
        newQuestions[item.qIndex].class_level = assignedClass;
      }
    });

    setFormData({ ...formData, questions: newQuestions });
    showToast('Question class levels adjusted to match target weightage!', 'success');
  };

  // Get class level badge
  const getClassBadge = (classLevel) => {
    if (classLevel === 'Class 11') {
      return { emoji: '📚', color: '#2196f3', bg: '#e3f2fd' };
    } else if (classLevel === 'Class 12') {
      return { emoji: '🎓', color: '#9c27b0', bg: '#f3e5f5' };
    }
    return { emoji: '❓', color: '#757575', bg: '#f5f5f5' };
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
          <h1 className="dashboard-title">📋 Paper Templates</h1>
          <p className="dashboard-subtitle" style={{ color: '#ffffff' }}>
            Create templates with sub-questions
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-success" onClick={() => navigate('/extract-template')}>
            ✙ Upload Pdf Refernce
          </button>
          <button className="btn btn-primary" onClick={handleCreateNew}>
            ✙ Create New Template
          </button>
        </div>
      </div>

      {showForm ? (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              {editingTemplate ? (isReadOnly ? '👁️ View Template' : '✏️ Edit Template') : '➕ Create New Template'}
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {!isReadOnly && (
                <button
                  type="submit"
                  className="btn btn-sm"
                  form="template-form"
                  style={{
                    background: '#ffffff',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}
                >
                  {editingTemplate ? 'Update Template' : 'Create Template'}
                </button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>
                ✕ Cancel
              </button>
            </div>
          </div>

          <form id="template-form" onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Template Name *</label>
              <input
                type="text"
                className="form-input"
                value={formData.template_name}
                onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                placeholder="e.g., Standard Exam Template"
                required
                disabled={isReadOnly}
                style={{ opacity: isReadOnly ? 0.6 : 1, cursor: isReadOnly ? 'not-allowed' : 'text' }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Description</label>
              <textarea
                className="form-input"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this template..."
                rows={2}
                disabled={isReadOnly}
                style={{ opacity: isReadOnly ? 0.6 : 1, cursor: isReadOnly ? 'not-allowed' : 'text' }}
              />
            </div>

            {/* Class Weightage Section */}
            <div style={{ marginBottom: '1.5rem', padding: '1.5rem', background: 'var(--bg-secondary)', borderRadius: '12px', border: '2px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🎓</span>
                <span>Class Level Distribution</span>
              </h4>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Set the percentage distribution between Class 11th and Class 12th questions
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                {/* Class 11 */}
                <div style={{ padding: '1rem', background: '#e3f2fd', borderRadius: '8px', border: '2px solid #2196f3' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: '700', color: '#0d47a1' }}>
                      📚 Class 11th
                    </label>
                    {formData.questions.length > 0 && (() => {
                      const actual = getActualClassDistribution();
                      return (
                        <span style={{ fontSize: '0.75rem', color: '#0d47a1', fontWeight: '600' }}>
                          {actual.class11Marks}/{getTotalMarks()} marks
                        </span>
                      );
                    })()}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.class_weightage?.class_11 ?? 0}
                      onChange={(e) => {
                        const value = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                        setFormData({
                          ...formData,
                          class_weightage: {
                            class_11: value,
                            class_12: 100 - value
                          }
                        });
                      }}
                    />

                    <span style={{ fontWeight: '700', color: '#0d47a1', fontSize: '1.1rem' }}>%</span>
                  </div>
                </div>

                {/* Class 12 */}
                <div style={{ padding: '1rem', background: '#f3e5f5', borderRadius: '8px', border: '2px solid #9c27b0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: '700', color: '#4a148c' }}>
                      🎓 Class 12th
                    </label>
                    {formData.questions.length > 0 && (() => {
                      const actual = getActualClassDistribution();
                      return (
                        <span style={{ fontSize: '0.75rem', color: '#4a148c', fontWeight: '600' }}>
                          {actual.class12Marks}/{getTotalMarks()} marks
                        </span>
                      );
                    })()}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.class_weightage?.class_12 ?? 0}
                      onChange={(e) => {
                        const value = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                        setFormData({
                          ...formData,
                          class_weightage: {
                            class_11: 100 - value,
                            class_12: value
                          }
                        });
                      }}
                    />

                    <span style={{ fontWeight: '700', color: '#4a148c', fontSize: '1.1rem' }}>%</span>
                  </div>
                </div>
              </div>

              {/* Total Indicator */}
              <div style={{
                padding: '0.75rem 1rem',
                background: 'var(--success-light)',
                borderRadius: '8px',
                border: '2px solid var(--success)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontWeight: '600', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  Total Class Distribution:
                </span>
                <span style={{ fontWeight: '700', fontSize: '1.25rem', color: 'var(--success)' }}>
                  {(formData.class_weightage?.class_11) + (formData.class_weightage?.class_12)}% ✓
                </span>
              </div>

              {/* Auto-Adjust Button */}
              {formData.questions.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={autoAdjustClassLevels}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    <span>🎯</span>
                    <span>Auto-Adjust Questions to Match Class Distribution</span>
                  </button>
                  <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                    This will automatically reassign question class levels to match your target percentages
                  </p>
                </div>
              )}
            </div>

            <div className="form-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 className="form-section-title">Questions Structure</h3>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <span className="total-marks-badge">
                    {formData.questions.length} Questions | {getTotalMarks()} Marks
                  </span>
                  {!isReadOnly && (
                    <button type="button" className="btn-add-question" onClick={handleAddQuestion}>
                      ➕ Add Question
                    </button>
                  )}
                </div>
              </div>

              <div className="template-questions-list">
                {formData.questions.map((q, qIndex) => (
                  <div key={qIndex} className="template-question-item">
                    {/* Main Question */}
                    <div
                      className="question-header"
                      style={{
                        cursor: q.has_subquestions ? 'pointer' : 'default',
                        position: 'relative'
                      }}
                    >
                      {q.has_subquestions && (
                        <span
                          onClick={() => toggleQuestionExpanded(qIndex)}
                          style={{
                            position: 'absolute',
                            left: '-20px',
                            fontSize: '1.2rem',
                            transition: 'transform 0.2s',
                            transform: expandedQuestions[qIndex] ? 'rotate(90deg)' : 'rotate(0deg)'
                          }}
                        >
                          ▶
                        </span>
                      )}

                      <span
                        className="question-number-badge"
                        onClick={() => q.has_subquestions && toggleQuestionExpanded(qIndex)}
                      >
                        {q.question_number}
                      </span>

                      <div
                        style={{ flex: 1, display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                        onClick={(e) => {
                          // Only toggle if clicking on empty space, not on input
                          if (e.target === e.currentTarget && q.has_subquestions) {
                            toggleQuestionExpanded(qIndex);
                          }
                        }}
                      >
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Type:</span>
                        <input
                          type="text"
                          className="form-input"
                          value={q.question_type}
                          onChange={(e) => handleQuestionChange(qIndex, 'question_type', e.target.value)}
                          placeholder="e.g., mcq, short_answer, case_study"
                          list={`question-types-${qIndex}`}
                          style={{ flex: 1, padding: '0.5rem' }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <datalist id={`question-types-${qIndex}`}>
                          <option value="mcq">Multiple Choice (MCQ)</option>
                          <option value="short_answer">Short Answer</option>
                          <option value="long_answer">Long Answer</option>
                          <option value="true_false">True/False</option>
                          <option value="fill_in_blanks">Fill in the Blanks</option>
                          <option value="matching">Match the Following</option>
                          <option value="numerical">Numerical/Calculate</option>
                          <option value="diagram">Diagram/Draw</option>
                          <option value="case_study">Case Study</option>
                          <option value="practical">Practical</option>
                          <option value="coding">Coding</option>
                        </datalist>
                      </div>

                      {!q.has_subquestions && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {/* Class Level Badge */}
                          {q.class_level && (() => {
                            const badge = getClassBadge(q.class_level);
                            return (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                padding: '0.25rem 0.5rem',
                                background: badge.bg,
                                color: badge.color,
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                border: `1px solid ${badge.color}`
                              }}>
                                {badge.emoji} {q.class_level}
                              </span>
                            );
                          })()}

                          {/* Class Level Selector */}
                          <select
                            className="form-input"
                            value={q.class_level || ''}
                            onChange={(e) => handleQuestionChange(qIndex, 'class_level', e.target.value)}
                            style={{ padding: '0.5rem', fontSize: '0.875rem', minWidth: '120px' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {CLASS_LEVELS.map(level => (
                              <option key={level.value} value={level.value}>
                                {level.label}
                              </option>
                            ))}
                          </select>

                          {/* Difficulty Selector for Main Question (no sub-questions) */}
                          <select
                            className="form-input"
                            value={q.difficulty || 'medium'}
                            onChange={(e) => handleQuestionChange(qIndex, 'difficulty', e.target.value)}
                            style={{ padding: '0.5rem', fontSize: '0.875rem', minWidth: '110px' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="easy">🟢 Easy</option>
                            <option value="medium">🟡 Medium</option>
                            <option value="hard">🔴 Hard</option>
                          </select>

                          <input
                            type="number"
                            className="marks-input"
                            value={q.marks}
                            onChange={(e) => handleQuestionChange(qIndex, 'marks', parseInt(e.target.value))}
                            min="1"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span style={{ fontWeight: '600', color: 'var(--success)' }}>marks</span>
                        </div>
                      )}

                      {q.has_subquestions && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
                            ({getQuestionMarks(q)} marks)
                          </span>
                        </div>
                      )}

                      <label className="checkbox-label" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={q.has_subquestions}
                          onChange={(e) => {
                            handleQuestionChange(qIndex, 'has_subquestions', e.target.checked);
                            if (e.target.checked) {
                              setExpandedQuestions(prev => ({ ...prev, [qIndex]: true }));
                            }
                          }}
                        />
                        <span>Has Sub-questions</span>
                      </label>

                      <button
                        type="button"
                        className="btn-delete-question"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveQuestion(qIndex);
                        }}
                        title="Delete Question"
                      >
                        🗑️ Delete
                      </button>
                    </div>

                    {/* Sub-questions */}
                    {q.has_subquestions && expandedQuestions[qIndex] !== false && (
                      <div className="subquestions-section">
                        <div className="subquestions-header">
                          <span className="subquestions-title">
                            Sub-questions ({getQuestionMarks(q)} marks total)
                          </span>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              type="button"
                              className="btn-divide-marks"
                              onClick={() => handleDivideMarks(qIndex)}
                              title="Divide marks evenly among sub-questions"
                            >
                              ➗ Divide Marks
                            </button>
                            <button
                              type="button"
                              className="btn-add-subquestion"
                              onClick={() => handleAddSubQuestion(qIndex)}
                            >
                              ➕ Add Sub-question
                            </button>
                          </div>
                        </div>

                        {q.subquestions.map((sq, sqIndex) => (
                          <div key={sqIndex} className="subquestion-item">
                            <span className="subquestion-number">
                              {sq.sub_number}
                            </span>

                            <span className="subquestion-type">
                              {q.question_type}
                            </span>

                            {/* Class Level Badge for Subquestion */}
                            {sq.class_level && (() => {
                              const badge = getClassBadge(sq.class_level);
                              return (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.2rem',
                                  padding: '0.2rem 0.4rem',
                                  background: badge.bg,
                                  color: badge.color,
                                  borderRadius: '10px',
                                  fontSize: '0.65rem',
                                  fontWeight: '600',
                                  border: `1px solid ${badge.color}`
                                }}>
                                  {badge.emoji} {sq.class_level}
                                </span>
                              );
                            })()}

                            {/* Class Level Selector for Subquestion */}
                            <select
                              className="form-input"
                              value={sq.class_level || ''}
                              onChange={(e) => handleSubQuestionChange(qIndex, sqIndex, 'class_level', e.target.value)}
                              style={{ padding: '0.4rem', fontSize: '0.75rem', minWidth: '110px' }}
                            >
                              {CLASS_LEVELS.map(level => (
                                <option key={level.value} value={level.value}>
                                  {level.label}
                                </option>
                              ))}
                            </select>

                            {/* Difficulty Selector for Subquestion */}
                            <select
                              className="form-input"
                              value={sq.difficulty || 'medium'}
                              onChange={(e) => handleSubQuestionChange(qIndex, sqIndex, 'difficulty', e.target.value)}
                              style={{ padding: '0.4rem', fontSize: '0.75rem', minWidth: '100px' }}
                            >
                              <option value="easy">🟢 Easy</option>
                              <option value="medium">🟡 Medium</option>
                              <option value="hard">🔴 Hard</option>
                            </select>

                            <div className="subquestion-marks">
                              <input
                                type="number"
                                className="marks-input"
                                value={sq.marks}
                                onChange={(e) => handleSubQuestionChange(qIndex, sqIndex, 'marks', parseInt(e.target.value))}
                                min="1"
                              />
                              <span style={{ fontWeight: '600', color: 'var(--success)' }}>marks</span>
                            </div>

                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => handleRemoveSubQuestion(qIndex, sqIndex)}
                            >
                              ✕
                            </button>
                          </div>
                        ))}

                        {q.subquestions.length === 0 && (
                          <div className="empty-subquestions">
                            No sub-questions yet. Click "Add Sub-question" to add one.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {formData.questions.length === 0 && (
                  <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                    No questions yet. Click "Add Question" to start building your template.
                  </p>
                )}
              </div>
            </div>


          </form>
        </div>
      ) : (
        <div className="templates-grid">
          {templates.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <p>No templates yet</p>
              <button className="btn btn-primary btn-sm" onClick={handleCreateNew}>
                Create Your First Template
              </button>
            </div>
          ) : (
            templates.map(template => (
              <div key={template.template_id} className="template-card">
                <div className="template-card-header">
                  <h3>{template.template_name}</h3>
                  {/* <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {template.is_default === 1 && (
                      <span className="badge badge-success">Default</span>
                    )}
                    {template.is_public && (
                      <span className="badge badge-info">Public</span>
                    )}
                    {template.is_admin_approved && (
                      <span className="badge" style={{ background: '#10b981', color: 'white' }}>✓ Approved</span>
                    )}
                  </div> */}
                </div>

                {template.description && (
                  <p className="template-description">{template.description}</p>
                )}

                {template.created_by !== user?.user_id && (
                  <div style={{
                    padding: '0.75rem',
                    marginBottom: '0.75rem',
                    background: 'var(--bg-secondary)',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span>👤 Created by:</span>
                    <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                      {template.created_by_name || 'Unknown'}
                    </span>
                  </div>
                )}

                <div className="template-stats">
                  <div className="stat">
                    <span className="stat-label">Questions:</span>
                    <span className="stat-value">{template.question_count || 0}</span>
                  </div>
                </div>

                {/* Admin Approval Checkbox */}
                {isAdmin && (
                  <div style={{
                    padding: '0.75rem',
                    marginBottom: '0.75rem',
                    background: 'var(--bg-secondary)',
                    borderRadius: '0.375rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    border: '2px solid #10b981'
                  }}>
                    <input
                      type="checkbox"
                      id={`admin-approve-${template.template_id}`}
                      checked={template.is_admin_approved || false}
                      onChange={() => handleToggleVisibility(template.template_id, template.is_public, template.is_admin_approved)}
                      style={{ cursor: 'pointer' }}
                    />
                    <label
                      htmlFor={`admin-approve-${template.template_id}`}
                      style={{
                        cursor: 'pointer',
                        margin: 0,
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      Approve for all users (public template)
                    </label>
                  </div>
                )}

                <div className="template-actions">
                  {template.created_by === user?.user_id ? (
                    <>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setIsReadOnly(false);
                          handleEdit(template.template_id);
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(template.template_id, template.template_name)}
                      >
                        🗑️ Delete
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn-info btn-sm"
                      onClick={() => {
                        setIsReadOnly(true);
                        handleEdit(template.template_id);
                      }}
                    >
                      👁️ View
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.show && (
        <div className="modal-overlay" onClick={cancelDelete}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚠️ Confirm Delete</h2>
              <button className="modal-close" onClick={cancelDelete}>✕</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this template?</p>
              <p style={{ fontWeight: 'bold', marginTop: '0.5rem' }}>"{deleteModal.templateName}"</p>

              {deleteModal.hasDraftPapers ? (
                <>
                  <div style={{
                    marginTop: '1rem',
                    padding: '1rem',
                    background: 'var(--warning-light)',
                    border: '2px solid var(--warning)',
                    borderRadius: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                      <strong style={{ color: 'var(--warning)' }}>Warning!</strong>
                    </div>
                    <p style={{ margin: '0.5rem 0', fontSize: '0.875rem' }}>
                      This template is being used by <strong>{deleteModal.draftCount}</strong> unconfirmed (draft) paper(s).
                    </p>
                    <p style={{
                      margin: '0.5rem 0 0 0',
                      fontSize: '0.875rem',
                      color: 'var(--danger)',
                      fontWeight: '600'
                    }}>
                      You must first confirm these papers before deleting this template.
                    </p>
                  </div>

                  {/* List of Draft Papers */}
                  {deleteModal.draftPapers.length > 0 && (
                    <div style={{
                      marginTop: '1rem',
                      padding: '1rem',
                      background: 'var(--bg-secondary)',
                      borderRadius: '0.5rem',
                      maxHeight: '200px',
                      overflowY: 'auto'
                    }}>
                      <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', fontWeight: '600' }}>
                        📄 Draft Papers Using This Template:
                      </h4>
                      <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem' }}>
                        {deleteModal.draftPapers.map((paper) => (
                          <li key={paper.paper_id} style={{ marginBottom: '0.5rem' }}>
                            <strong>{paper.paper_name}</strong>
                            {paper.subject && <span style={{ color: 'var(--text-secondary)' }}> - {paper.subject}</span>}
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              Created: {new Date(paper.created_at).toLocaleDateString()}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <p style={{ color: 'var(--danger)', marginTop: '1rem', fontSize: '0.875rem' }}>
                  This action cannot be undone.
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={cancelDelete}>
                {deleteModal.hasDraftPapers ? 'OK' : 'Cancel'}
              </button>
              {!deleteModal.hasDraftPapers && (
                <button
                  className="btn btn-danger"
                  onClick={confirmDelete}
                >
                  Delete Template
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaperTemplates;