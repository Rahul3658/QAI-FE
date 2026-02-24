/**
 * VoiceAssistantUI - Visual interface for voice assistant
 * 
 * Features:
 * - Microphone button with visual states
 * - Real-time transcript display
 * - Assistant response display
 * - Error messages
 * - Browser compatibility warnings
 * - Theme-aware styling
 */

import React, { useState, useEffect } from 'react';
import themeAwareStyles from '../utils/ThemeAwareStyles';

const VoiceAssistantUI = ({
  isListening,
  isProcessing,
  isSpeaking,
  isActive,
  message,
  onStart,
  onStop,
  error,
  isSupported,
  continuousMode = false,
  onToggleContinuousMode,
  currentSuggestions = [],
  workflowState = null
}) => {
  // Detect and track theme
  const [theme, setTheme] = useState(themeAwareStyles.detectTheme());

  // Update theme when it changes
  useEffect(() => {
    const updateTheme = () => {
      setTheme(themeAwareStyles.detectTheme());
    };

    // Listen for theme changes
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkModeQuery.addEventListener('change', updateTheme);

    // Also listen for class changes on body
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => {
      darkModeQuery.removeEventListener('change', updateTheme);
      observer.disconnect();
    };
  }, []);

  // Determine button state
  const getButtonState = () => {
    if (isListening) return 'listening';
    if (isProcessing) return 'processing';
    if (isSpeaking) return 'speaking';
    if (isActive) return 'active'; // Active but waiting
    return 'idle';
  };

  const buttonState = getButtonState();

  // Button styles based on state
  const getButtonStyles = () => {
    const baseStyles = {
      width: '60px',
      height: '60px',
      borderRadius: '50%',
      border: 'none',
      cursor: isSupported ? 'pointer' : 'not-allowed',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1.75rem',
      transition: 'all 0.3s ease',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      position: 'relative',
      opacity: isSupported ? 1 : 0.5
    };

    const stateStyles = {
      idle: {
        background: 'linear-gradient(135deg, #667eea, #764ba2)',
        color: '#fff'
      },
      active: {
        background: 'linear-gradient(135deg, #667eea, #764ba2)',
        color: '#fff',
        opacity: 0.8
      },
      listening: {
        background: 'linear-gradient(135deg, #f093fb, #f5576c)',
        color: '#fff',
        animation: 'pulse 1.5s ease-in-out infinite'
      },
      processing: {
        background: 'linear-gradient(135deg, #4facfe, #00f2fe)',
        color: '#fff'
      },
      speaking: {
        background: 'linear-gradient(135deg, #43e97b, #38f9d7)',
        color: '#fff',
        animation: 'pulse 1s ease-in-out infinite'
      }
    };

    return { ...baseStyles, ...stateStyles[buttonState] };
  };

  // Button icon based on state
  const getButtonIcon = () => {
    switch (buttonState) {
      case 'listening':
        return '🎤';
      case 'processing':
        return '⏳';
      case 'speaking':
        return '🔊';
      default:
        return '🎙️';
    }
  };

  // Button label
  const getButtonLabel = () => {
    switch (buttonState) {
      case 'listening':
        return 'Listening...';
      case 'processing':
        return 'Processing...';
      case 'speaking':
        return 'Speaking...';
      case 'active':
        return 'Click to Stop';
      default:
        return 'Start Voice Assistant';
    }
  };

  const handleClick = () => {
    if (!isSupported) return;
    
    if (isActive || isListening || isProcessing || isSpeaking) {
      // Stop the assistant if it's active in any way
      onStop();
    } else {
      // Start the assistant
      onStart();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '2rem',
      right: '2rem',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: '1rem'
    }}>
      {/* Message bubble */}
      {(message || error) && (
        <div style={{
          maxWidth: '320px',
          padding: '1rem 1.25rem',
          borderRadius: '16px',
          background: error 
            ? themeAwareStyles.getBackgroundColor(theme, 'error')
            : themeAwareStyles.getBackgroundColor(theme, 'assistant'),
          border: error 
            ? `2px solid ${themeAwareStyles.getTextColor(theme, 'error')}`
            : theme === 'dark' ? '2px solid #3a3a3a' : '2px solid #e0e0e0',
          boxShadow: theme === 'dark' 
            ? '0 8px 24px rgba(0, 0, 0, 0.4)'
            : '0 8px 24px rgba(0, 0, 0, 0.12)',
          fontSize: '0.9375rem',
          color: error 
            ? themeAwareStyles.getTextColor(theme, 'error')
            : themeAwareStyles.getTextColor(theme, 'assistant'),
          lineHeight: '1.5',
          animation: 'slideIn 0.3s ease-out'
        }}>
          {error ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.25rem' }}>⚠️</span>
              <div>
                <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Error</div>
                <div>{error.message}</div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.25rem' }}>
                {isListening ? '🎤' : isSpeaking ? '🔊' : '💬'}
              </span>
              <div>{message}</div>
            </div>
          )}
        </div>
      )}

      {/* Browser compatibility warning */}
      {!isSupported && (
        <div style={{
          maxWidth: '320px',
          padding: '1rem 1.25rem',
          borderRadius: '16px',
          background: 'rgba(255, 193, 7, 0.1)',
          border: '2px solid #ffc107',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
          fontSize: '0.875rem',
          color: '#856404',
          lineHeight: '1.5'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem' }}>⚠️</span>
            <div>
              <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                Voice Assistant Not Supported
              </div>
              <div>
                Your browser doesn't support voice recognition. Please use Chrome, Edge, or Safari.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Continuous Mode Toggle - Only show if onToggleContinuousMode is provided */}
      {isSupported && onToggleContinuousMode && (
        <div style={{
          background: theme === 'dark' ? 'rgba(42, 42, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          border: theme === 'dark' ? '2px solid #3a3a3a' : '2px solid #e0e0e0',
          borderRadius: '12px',
          padding: '0.75rem 1rem',
          boxShadow: theme === 'dark' 
            ? '0 4px 12px rgba(0, 0, 0, 0.4)'
            : '0 4px 12px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          userSelect: 'none'
        }}
        onClick={() => onToggleContinuousMode(!continuousMode)}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = theme === 'dark'
            ? '0 6px 16px rgba(0, 0, 0, 0.6)'
            : '0 6px 16px rgba(0, 0, 0, 0.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = theme === 'dark'
            ? '0 4px 12px rgba(0, 0, 0, 0.4)'
            : '0 4px 12px rgba(0, 0, 0, 0.1)';
        }}
        >
          <div style={{
            width: '40px',
            height: '22px',
            borderRadius: '11px',
            background: continuousMode ? 'linear-gradient(135deg, #667eea, #764ba2)' : (theme === 'dark' ? '#555' : '#ccc'),
            position: 'relative',
            transition: 'background 0.3s ease'
          }}>
            <div style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: '#fff',
              position: 'absolute',
              top: '2px',
              left: continuousMode ? '20px' : '2px',
              transition: 'left 0.3s ease',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
            }} />
          </div>
          <div style={{
            fontSize: '0.875rem',
            fontWeight: '600',
            color: continuousMode 
              ? '#667eea' 
              : (theme === 'dark' ? '#b0b0b0' : '#666')
          }}>
            Continuous Mode
          </div>
        </div>
      )}

      {/* Current Suggestions Display */}
      {continuousMode && currentSuggestions.length > 0 && (
        <div style={{
          maxWidth: '320px',
          padding: '1rem',
          borderRadius: '12px',
          background: theme === 'dark' ? 'rgba(102, 126, 234, 0.1)' : 'rgba(102, 126, 234, 0.05)',
          border: theme === 'dark' ? '2px solid rgba(102, 126, 234, 0.3)' : '2px solid rgba(102, 126, 234, 0.2)',
          boxShadow: theme === 'dark' 
            ? '0 4px 12px rgba(0, 0, 0, 0.4)'
            : '0 4px 12px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            fontSize: '0.75rem',
            fontWeight: '700',
            color: '#667eea',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '0.75rem'
          }}>
            💡 Suggestions
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            {currentSuggestions.slice(0, 4).map((suggestion, index) => (
              <div key={index} style={{
                fontSize: '0.875rem',
                color: theme === 'dark' ? '#e0e0e0' : '#333',
                padding: '0.5rem',
                background: theme === 'dark' ? 'rgba(42, 42, 42, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                borderRadius: '8px',
                borderLeft: `3px solid ${suggestion.priority === 1 ? '#f5576c' : suggestion.priority === 2 ? '#4facfe' : '#43e97b'}`
              }}>
                <span style={{ fontWeight: '600' }}>•</span> {suggestion.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Workflow State Display */}
      {continuousMode && workflowState && (
        <div style={{
          maxWidth: '320px',
          padding: '0.75rem 1rem',
          borderRadius: '12px',
          background: theme === 'dark' ? 'rgba(42, 42, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          border: theme === 'dark' ? '2px solid #3a3a3a' : '2px solid #e0e0e0',
          boxShadow: theme === 'dark' 
            ? '0 4px 12px rgba(0, 0, 0, 0.4)'
            : '0 4px 12px rgba(0, 0, 0, 0.1)',
          fontSize: '0.8125rem'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.5rem'
          }}>
            <span style={{ fontWeight: '600', color: theme === 'dark' ? '#b0b0b0' : '#666' }}>Progress</span>
            <span style={{ fontWeight: '700', color: '#667eea' }}>
              {workflowState.completionPercent}%
            </span>
          </div>
          <div style={{
            width: '100%',
            height: '6px',
            background: theme === 'dark' ? '#3a3a3a' : '#e0e0e0',
            borderRadius: '3px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${workflowState.completionPercent}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #667eea, #764ba2)',
              transition: 'width 0.5s ease'
            }} />
          </div>
          {workflowState.nextMilestone && (
            <div style={{
              marginTop: '0.5rem',
              color: theme === 'dark' ? '#b0b0b0' : '#666',
              fontSize: '0.75rem'
            }}>
              Next: {workflowState.nextMilestone}
            </div>
          )}
        </div>
      )}

      {/* Microphone button */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
        <button
          onClick={handleClick}
          disabled={!isSupported}
          style={getButtonStyles()}
          title={getButtonLabel()}
          onMouseEnter={(e) => {
            if (isSupported) {
              e.currentTarget.style.transform = 'scale(1.1)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          {getButtonIcon()}
          
          {/* Pulse animation ring for listening/speaking */}
          {(isListening || isSpeaking) && (
            <div style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              border: '3px solid currentColor',
              opacity: 0.5,
              animation: 'pulseRing 1.5s ease-out infinite'
            }} />
          )}
        </button>

        {/* Status label */}
        <div style={{
          fontSize: '0.75rem',
          fontWeight: '600',
          color: theme === 'dark' ? '#b0b0b0' : '#666',
          textAlign: 'center',
          minWidth: '120px'
        }}>
          {getButtonLabel()}
        </div>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.9;
          }
        }

        @keyframes pulseRing {
          0% {
            transform: scale(1);
            opacity: 0.5;
          }
          100% {
            transform: scale(1.4);
            opacity: 0;
          }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default VoiceAssistantUI;
