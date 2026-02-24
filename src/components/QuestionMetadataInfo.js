import { useState, useRef, useEffect } from 'react';

const QuestionMetadataInfo = ({ question }) => {
  const [showInfo, setShowInfo] = useState(false);
  const popupRef = useRef(null);
  const buttonRef = useRef(null);

  // Check if question has any metadata
  const hasMetadata = question?.reference_source || question?.difficulty_level || question?.difficulty_reason;

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popupRef.current && !popupRef.current.contains(event.target) && 
          buttonRef.current && !buttonRef.current.contains(event.target)) {
        setShowInfo(false);
      }
    };

    if (showInfo) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showInfo]);

  if (!hasMetadata) {
    return null;
  }

  // Check if this is an EduLab PDF (uploaded by Super Admin for AI context)
  const isEduLabPdf = question.pdf_filename?.toLowerCase().includes('maharashtra board') || 
                      question.reference_source?.toLowerCase().includes('maharashtra board');

  const getDifficultyColor = (level) => {
    switch (level) {
      case 'Easy': return { bg: '#f0fdf4', border: '#10b981', text: '#065f46', badge: '#10b981' };
      case 'Hard': return { bg: '#fef2f2', border: '#ef4444', text: '#991b1b', badge: '#ef4444' };
      default: return { bg: '#fffbeb', border: '#f59e0b', text: '#92400e', badge: '#f59e0b' };
    }
  };

  const difficultyColors = question.difficulty_level ? getDifficultyColor(question.difficulty_level) : null;

  return (
    <div style={{ display: 'inline-block', position: 'relative', marginLeft: '0.5rem' }}>
      <button
        ref={buttonRef}
        onClick={() => setShowInfo(!showInfo)}
        style={{
          background: 'white',
          color: showInfo ? '#3b82f6' : '#6b7280',
          border: `2px solid ${showInfo ? '#3b82f6' : '#d1d5db'}`,
          borderRadius: '50%',
          width: '24px',
          height: '24px',
          cursor: 'pointer',
          fontSize: '0.75rem',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          boxShadow: showInfo ? '0 2px 8px rgba(59,130,246,0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
          transform: showInfo ? 'scale(1.1)' : 'scale(1)'
        }}
        title="View question metadata"
        onMouseEnter={(e) => {
          if (!showInfo) {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.borderColor = '#3b82f6';
            e.currentTarget.style.color = '#3b82f6';
          }
        }}
        onMouseLeave={(e) => {
          if (!showInfo) {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.borderColor = '#d1d5db';
            e.currentTarget.style.color = '#6b7280';
          }
        }}
      >
        ℹ️
      </button>

      {showInfo && (
        <div 
          ref={popupRef}
          style={{
            position: 'fixed',
            zIndex: 10000,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            padding: '1.25rem',
            background: 'white',
            borderRadius: '0.75rem',
            border: '2px solid #3b82f6',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
            minWidth: '320px',
            maxWidth: '500px',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}
        >
          {/* PDF Context Banner - Only show for USER-uploaded PDFs, not EduLab PDFs */}
          {!isEduLabPdf && (question.pdf_filename || question.reference_source?.toLowerCase().includes('pdf')) && (
            <div style={{
              background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
              color: 'white',
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              boxShadow: '0 4px 6px rgba(220, 38, 38, 0.3)'
            }}>
              <span style={{ fontSize: '1.5rem' }}>📄</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '700', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                  Generated from Uploaded PDF
                </div>
                {question.pdf_filename && (
                  <div style={{ fontSize: '0.8rem', opacity: 0.95 }}>
                    {question.pdf_filename}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Header */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '1rem',
            paddingBottom: '0.75rem',
            borderBottom: '2px solid #e5e7eb'
          }}>
            <h4 style={{ 
              margin: 0, 
              color: '#1f2937', 
              fontSize: '1.1rem', 
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span style={{ fontSize: '1.3rem' }}>📋</span>
              Question Details
            </h4>
            <button
              onClick={() => setShowInfo(false)}
              style={{
                background: '#f3f4f6',
                border: 'none',
                borderRadius: '0.375rem',
                width: '28px',
                height: '28px',
                cursor: 'pointer',
                color: '#6b7280',
                fontSize: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#e5e7eb';
                e.currentTarget.style.color = '#374151';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f3f4f6';
                e.currentTarget.style.color = '#6b7280';
              }}
            >
              ×
            </button>
          </div>

          {/* Reference Source */}
          {question.reference_source && (
            <div style={{ 
              marginBottom: '1rem',
              padding: '1rem',
              background: question.reference_source?.toLowerCase().includes('maharashtra board') 
                ? '#fff7ed' 
                : question.reference_source?.toLowerCase().includes('pdf') ? '#fef2f2' : '#f0f9ff',
              borderRadius: '0.5rem',
              borderLeft: `4px solid ${
                question.reference_source?.toLowerCase().includes('maharashtra board') 
                  ? '#f97316' 
                  : question.reference_source?.toLowerCase().includes('pdf') ? '#dc2626' : '#3b82f6'
              }`
            }}>
              <div style={{ 
                fontWeight: '700', 
                color: question.reference_source?.toLowerCase().includes('maharashtra board') 
                  ? '#9a3412' 
                  : question.reference_source?.toLowerCase().includes('pdf') ? '#991b1b' : '#1e40af', 
                marginBottom: '0.5rem', 
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span style={{ fontSize: '1.1rem' }}>
                  {question.reference_source?.toLowerCase().includes('maharashtra board') 
                    ? '🎓' 
                    : question.reference_source?.toLowerCase().includes('pdf') ? '📄' : '📚'}
                </span>
                Reference Source
                {question.reference_source?.toLowerCase().includes('maharashtra board') && (
                  <span style={{
                    background: '#f97316',
                    color: 'white',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '0.25rem',
                    fontSize: '0.7rem',
                    fontWeight: '600',
                    marginLeft: '0.5rem'
                  }}>
                    Maharashtra Board
                  </span>
                )}
              </div>
              <div style={{ 
                color: '#1f2937', 
                fontSize: '0.85rem', 
                lineHeight: '1.7',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {question.reference_source?.toLowerCase().includes('pdf') ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ 
                        background: '#dc2626',
                        color: 'white',
                        padding: '0.25rem 0.6rem',
                        borderRadius: '0.375rem',
                        fontWeight: '700',
                        fontSize: '0.75rem',
                        letterSpacing: '0.5px',
                        boxShadow: '0 2px 4px rgba(220, 38, 38, 0.3)'
                      }}>📄 PDF</span>
                      <span>{question.reference_source.replace(/^PDF:\s*/i, '')}</span>
                    </div>
                    {/* Hide File info for EduLab PDFs (Super Admin uploaded for AI context) */}
                    {!isEduLabPdf && question.pdf_filename && (
                      <div style={{ 
                        fontSize: '0.8rem', 
                        color: '#6b7280',
                        paddingLeft: '0.5rem',
                        borderLeft: '2px solid #e5e7eb',
                        marginTop: '0.25rem'
                      }}>
                        <strong>File:</strong> {question.pdf_filename}
                      </div>
                    )}
                    {question.relevance_score !== undefined && question.relevance_score !== null && (
                      <div style={{ 
                        fontSize: '0.8rem', 
                        color: '#6b7280',
                        paddingLeft: '0.5rem',
                        borderLeft: '2px solid #e5e7eb',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <strong>Relevance:</strong>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.25rem',
                          background: question.relevance_score >= 70 ? '#dcfce7' : question.relevance_score >= 40 ? '#fef3c7' : '#fee2e2',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '0.25rem',
                          fontWeight: '600',
                          color: question.relevance_score >= 70 ? '#166534' : question.relevance_score >= 40 ? '#92400e' : '#991b1b'
                        }}>
                          {question.relevance_score}%
                          <span style={{ fontSize: '0.7rem' }}>
                            {question.relevance_score >= 70 ? '✓' : question.relevance_score >= 40 ? '~' : '!'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ 
                      background: '#059669',
                      color: 'white',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '0.375rem',
                      fontWeight: '700',
                      fontSize: '0.75rem',
                      letterSpacing: '0.5px',
                      boxShadow: '0 2px 4px rgba(5, 150, 105, 0.3)'
                    }}>📚 BOOK</span>
                    <span>{question.reference_source}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Difficulty Level */}
          {question.difficulty_level && difficultyColors && (
            <div style={{ 
              marginBottom: '1rem',
              padding: '1rem',
              background: difficultyColors.bg,
              borderRadius: '0.5rem',
              borderLeft: `4px solid ${difficultyColors.border}`
            }}>
              <div style={{ 
                fontWeight: '700', 
                marginBottom: '0.5rem', 
                fontSize: '0.9rem',
                color: difficultyColors.text,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span style={{ fontSize: '1.1rem' }}>🎯</span>
                Difficulty Level
              </div>
              <div style={{ 
                display: 'inline-block',
                padding: '0.4rem 1rem',
                borderRadius: '0.375rem',
                fontSize: '0.9rem',
                fontWeight: '700',
                background: difficultyColors.badge,
                color: 'white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                {question.difficulty_level}
              </div>
            </div>
          )}

          {/* Difficulty Reason */}
          {question.difficulty_reason && (
            <div style={{ 
              padding: '1rem',
              background: '#fffbeb',
              borderRadius: '0.5rem',
              borderLeft: '4px solid #f59e0b'
            }}>
              <div style={{ 
                fontWeight: '700', 
                color: '#92400e', 
                marginBottom: '0.5rem', 
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span style={{ fontSize: '1.1rem' }}>💡</span>
                Why This Difficulty?
              </div>
              <div style={{ 
                color: '#1f2937', 
                fontSize: '0.9rem', 
                lineHeight: '1.6',
                textAlign: 'justify'
              }}>
                {question.difficulty_reason}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Backdrop overlay */}
      {showInfo && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.3)',
            zIndex: 9999
          }}
          onClick={() => setShowInfo(false)}
        />
      )}
    </div>
  );
};

export default QuestionMetadataInfo;
