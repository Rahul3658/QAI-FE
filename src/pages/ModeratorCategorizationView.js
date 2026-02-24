import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import API from '../api/axios';
import { useToast } from '../context/ToastContext';

const ModeratorCategorizationView = () => {
  const { paperId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [categorization, setCategorization] = useState(null);
  const [activeTab, setActiveTab] = useState('general');
  const [paperTitle, setPaperTitle] = useState('');
  const [showRemoveAllModal, setShowRemoveAllModal] = useState(false);

  useEffect(() => {
    loadCategorizationData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperId]);

  const loadCategorizationData = async () => {
    try {
      setLoading(true);
      
      // Get categorization from sessionStorage (passed from previous page)
      const storedCategorization = sessionStorage.getItem('categorization');
      
      if (storedCategorization) {
        const parsedCategorization = JSON.parse(storedCategorization);
        setCategorization(parsedCategorization);
        
        // Get paper title
        const { data } = await API.get(`/papers/moderator/paper/${paperId}/details`);
        setPaperTitle(data.paper.paper_title);
      } else {
        showToast('No categorization data found. Please categorize first.', 'warning');
        navigate(`/moderator-categorization/view/${paperId}`);
      }
    } catch (error) {
      console.error('Error loading categorization:', error);
      showToast('Failed to load categorization data', 'error');
      navigate(`/moderator-categorization/view/${paperId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveVariation = (variationId) => {
    setCategorization(prev => {
      if (!prev) return prev;

      const newCategorization = { ...prev };
      
      // Remove from current active tab
      if (newCategorization[activeTab]) {
        newCategorization[activeTab] = newCategorization[activeTab].filter(
          v => v.variation_id !== variationId
        );
      }

      // Update sessionStorage
      sessionStorage.setItem('categorization', JSON.stringify(newCategorization));
      
      return newCategorization;
    });

    showToast('Variation removed from category', 'success');
  };

  const handleRemoveAll = () => {
    setCategorization(prev => {
      if (!prev) return prev;

      const newCategorization = { ...prev };
      
      // Clear current active tab
      newCategorization[activeTab] = [];

      // Update sessionStorage
      sessionStorage.setItem('categorization', JSON.stringify(newCategorization));
      
      return newCategorization;
    });

    setShowRemoveAllModal(false);
    showToast(`All variations removed from ${getCategoryInfo(activeTab).name}`, 'success');
  };

  const renderVariations = (variations, categoryColor) => {
    if (!variations || variations.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          <p style={{ fontSize: '2rem', margin: '0 0 0.5rem 0' }}>📋</p>
          <p style={{ margin: 0 }}>No variations in this category</p>
        </div>
      );
    }

    // Group variations by their full_question_number (e.g., "1", "1a", "1b", "2", "2a")
    const groupedByQuestion = {};
    
    variations.forEach(variation => {
      // Extract the main question number (e.g., "1" from "1a", "2" from "2b")
      const fullNum = variation.full_question_number || '';
      const mainQuestionMatch = fullNum.match(/^(\d+)/);
      const mainQuestion = mainQuestionMatch ? mainQuestionMatch[1] : fullNum;
      
      if (!groupedByQuestion[mainQuestion]) {
        groupedByQuestion[mainQuestion] = [];
      }
      groupedByQuestion[mainQuestion].push(variation);
    });

    // Sort main questions numerically
    const sortedMainQuestions = Object.keys(groupedByQuestion).sort((a, b) => {
      const numA = parseInt(a) || 0;
      const numB = parseInt(b) || 0;
      return numA - numB;
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {sortedMainQuestions.map(mainQuestion => {
          const questionVariations = groupedByQuestion[mainQuestion];
          
          // Sort sub-questions (1, 1a, 1b, etc.)
          const sortedVariations = questionVariations.sort((a, b) => {
            const aNum = a.full_question_number || '';
            const bNum = b.full_question_number || '';
            
            // Extract numeric and letter parts
            const aMatch = aNum.match(/^(\d+)([a-z]*)$/);
            const bMatch = bNum.match(/^(\d+)([a-z]*)$/);
            
            if (!aMatch || !bMatch) return 0;
            
            const aMainNum = parseInt(aMatch[1]);
            const bMainNum = parseInt(bMatch[1]);
            
            if (aMainNum !== bMainNum) return aMainNum - bMainNum;
            
            // If main numbers are same, sort by letter
            const aLetter = aMatch[2] || '';
            const bLetter = bMatch[2] || '';
            return aLetter.localeCompare(bLetter);
          });

          return (
            <div key={mainQuestion} style={{
              padding: '1.5rem',
              background: 'var(--bg-secondary)',
              borderRadius: '0.75rem',
              border: `2px solid ${categoryColor}`
            }}>
              <h3 style={{ 
                margin: '0 0 1.5rem 0', 
                color: categoryColor,
                fontSize: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span>📝</span>
                <span>Question {mainQuestion}</span>
                <span style={{
                  fontSize: '0.875rem',
                  fontWeight: 'normal',
                  color: 'var(--text-secondary)'
                }}>
                  ({sortedVariations.length} sub-question{sortedVariations.length !== 1 ? 's' : ''})
                </span>
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {sortedVariations.map((variation, index) => {
                  // Parse options if they're a string
                  let options = variation.options;
                  if (typeof options === 'string') {
                    try {
                      options = JSON.parse(options);
                    } catch (e) {
                      options = null;
                    }
                  }
                  
                  return (
                    <div key={variation.variation_id || index} style={{
                      padding: '1.25rem',
                      background: 'var(--bg-primary)',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-color)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ 
                            fontSize: '1rem', 
                            fontWeight: '700', 
                            color: categoryColor, 
                            marginBottom: '0.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}>
                            <span>{variation.full_question_number || `Q${mainQuestion}`}</span>
                            <span style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--text-secondary)' }}>
                              (Variation {variation.variation_number})
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <span className="badge badge-info">{variation.question_type}</span>
                            <span className="badge badge-success">{variation.marks} marks</span>
                          </div>
                        </div>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveVariation(variation.variation_id);
                          }}
                          style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem', height: 'fit-content' }}
                          title="Remove this variation from the category"
                        >
                          ✕ Remove
                        </button>
                      </div>

                      <div style={{ marginBottom: '1rem' }}>
                        <p style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-primary)', margin: 0 }}>
                          {variation.question_text}
                        </p>
                      </div>

                      {/* MCQ Options */}
                      {variation.question_type === 'mcq' && options && (
                        <div style={{ marginBottom: '1rem' }}>
                          <strong style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Options:</strong>
                          <ul style={{ margin: '0.5rem 0 0 1.25rem', fontSize: '0.875rem' }}>
                            {options.map((opt, optIndex) => (
                              <li key={optIndex} style={{
                                marginBottom: '0.25rem',
                                color: opt === variation.correct_answer ? 'var(--success)' : 'inherit',
                                fontWeight: opt === variation.correct_answer ? '600' : 'normal'
                              }}>
                                {opt} {opt === variation.correct_answer && '✓'}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Answer */}
                      {variation.correct_answer && (
                        <div style={{ 
                          padding: '0.75rem', 
                          background: 'var(--success-light)', 
                          borderRadius: '0.375rem',
                          border: '1px solid var(--success)'
                        }}>
                          <strong style={{ fontSize: '0.8rem', color: 'var(--success)' }}>Correct Answer:</strong>
                          <div style={{ fontSize: '0.875rem', marginTop: '0.25rem', color: 'var(--text-primary)' }}>
                            {variation.correct_answer}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const getCategoryInfo = (category) => {
    const info = {
      general: {
        name: 'General Exam',
        icon: '📘',
        color: 'var(--primary)',
        bgColor: 'var(--primary-light)'
      },
      reexam: {
        name: 'Re-Exam',
        icon: '📙',
        color: 'var(--warning)',
        bgColor: 'var(--warning-light)'
      },
      special: {
        name: 'Special Case',
        icon: '📗',
        color: 'var(--info)',
        bgColor: 'var(--info-light)'
      }
    };
    return info[category] || info.general;
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <div className="spinner"></div>
          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading categorization...</p>
        </div>
      </div>
    );
  }

  const currentCategory = getCategoryInfo(activeTab);

  return (
    <>
      <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: '0 0 0.5rem 0' }}>🎯 Categorized Questions</h2>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {paperTitle}
            </p>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigate(`/moderator-categorization/view/${paperId}`)}
          >
            ← Back to Paper
          </button>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {/* Category Tabs */}
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '2rem',
            borderBottom: '2px solid var(--border-color)',
            flexWrap: 'wrap'
          }}>
            {['general', 'reexam', 'special'].map(category => {
              const info = getCategoryInfo(category);
              const count = categorization?.[category]?.length || 0;
              
              return (
                <button
                  key={category}
                  onClick={() => setActiveTab(category)}
                  style={{
                    padding: '1rem 1.5rem',
                    background: activeTab === category ? info.bgColor : 'transparent',
                    color: activeTab === category ? info.color : 'var(--text-primary)',
                    border: 'none',
                    borderBottom: activeTab === category ? `3px solid ${info.color}` : '3px solid transparent',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '1rem',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <span style={{ fontSize: '1.25rem' }}>{info.icon}</span>
                  <span>{info.name}</span>
                  <span style={{
                    padding: '0.125rem 0.5rem',
                    borderRadius: '1rem',
                    fontSize: '0.75rem',
                    background: activeTab === category ? info.color : 'var(--bg-secondary)',
                    color: activeTab === category ? '#fff' : 'var(--text-secondary)'
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Category Header */}
          <div style={{
            padding: '1rem',
            background: currentCategory.bgColor,
            borderRadius: '0.5rem',
            border: `2px solid ${currentCategory.color}`,
            marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '2rem' }}>{currentCategory.icon}</span>
                <div>
                  <h3 style={{ margin: 0, color: currentCategory.color }}>{currentCategory.name}</h3>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {categorization?.[activeTab]?.length || 0} variations in this category
                  </p>
                </div>
              </div>
              {categorization?.[activeTab]?.length > 0 && (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => setShowRemoveAllModal(true)}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  🗑️ Remove All
                </button>
              )}
            </div>
          </div>

          {/* Variations Grid */}
          {renderVariations(categorization?.[activeTab], currentCategory.color)}
        </div>
      </div>
      </div>

      {/* Remove All Confirmation Modal */}
      {showRemoveAllModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ width: '500px', maxWidth: '90%' }}>
            <div className="card-header" style={{ background: 'var(--error-light)', borderBottom: '2px solid var(--error)' }}>
              <h3 className="card-title" style={{ color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🗑️</span>
                Remove All Variations
              </h3>
            </div>
            <div style={{ padding: '2rem' }}>
              <p style={{ fontSize: '1rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                Are you sure you want to remove all <strong>{categorization?.[activeTab]?.length || 0} variations</strong> from <strong>{getCategoryInfo(activeTab).name}</strong>?
              </p>

              <div style={{
                background: 'var(--warning-light)',
                border: '1px solid var(--warning)',
                borderRadius: '0.5rem',
                padding: '1rem',
                marginBottom: '1.5rem'
              }}>
                <div style={{ fontWeight: '600', marginBottom: '0.5rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>⚠️</span>
                  Warning
                </div>
                <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                  This will remove all variations from this category. You can add them back from the main categorization page.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowRemoveAllModal(false)}
                  className="btn btn-secondary"
                  style={{ minWidth: '100px' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRemoveAll}
                  className="btn btn-danger"
                  style={{ minWidth: '150px' }}
                >
                  🗑️ Yes, Remove All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ModeratorCategorizationView;
