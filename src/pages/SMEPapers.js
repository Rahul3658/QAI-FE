import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import API from '../api/axios';
import { useToast } from '../context/ToastContext';
import useVoiceAssistant from '../hooks/useVoiceAssistant';
import VoiceAssistantUI from '../components/VoiceAssistantUI';
import QuestionMetadataInfo from '../components/QuestionMetadataInfo';

const SMEPapers = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [expandedSubQuestions, setExpandedSubQuestions] = useState({});
  const [reviewForm, setReviewForm] = useState({});
  const [aiRecommendations, setAiRecommendations] = useState({});
  const [showingRecommendations, setShowingRecommendations] = useState({});
  const [aiInputNumbers, setAiInputNumbers] = useState({});
  const [showAIProcessingModal, setShowAIProcessingModal] = useState(false);
  const [aiProcessingStage, setAiProcessingStage] = useState('');

  // Send to Moderator modal state
  const [showModeratorModal, setShowModeratorModal] = useState(false);
  const [paperToSendToModerator, setPaperToSendToModerator] = useState(null);

  // Pagination state for variations
  const [variationsPagination, setVariationsPagination] = useState({}); // { subQuestionId: { page, total, loading } }
  const [paginatedVariations, setPaginatedVariations] = useState({}); // { subQuestionId: [variations] }
  
  // Refs for scrolling to variations section
  const variationsRefs = useRef({});

  // Voice assistant state
  const [voiceAssistantState, setVoiceAssistantState] = useState({
    paperId: null,
    paperTitle: null,
    paperStatus: null,
    expandedSubQuestionId: null,
    expandedSubQuestionNumber: null,
    availableVariations: [],
    paperQuestions: [],
    aiSuggestionCount: 1,
    hasAIRecommendations: false,
    aiRecommendedVariations: [],
    canSendToModerator: false,
    sendToModeratorVisible: false,
    currentVariationIndex: 0
  });

  const isViewPage = location.pathname.startsWith('/sme-papers/view/');
  const activeView = isViewPage ? 'view' : 'list';

  // Voice assistant state update handler
  const handleVoiceAssistantStateUpdate = useCallback(async (updatedState) => {
    console.log('🎤 Voice assistant state update:', updatedState);
    
    // Handle variation selection
    if (updatedState.shouldSelectVariation) {
      await handleReviewVariation(updatedState.variationId, 'approved', '');
    }
    
    // Handle variation unselection
    if (updatedState.shouldUnselectVariation) {
      await handleReviewVariation(updatedState.variationId, 'sent_to_sme', 'Unselected By SME (via voice)');
    }
    
    // Handle batch variation selection
    if (updatedState.shouldSelectVariationsBatch && updatedState.variationsToSelect) {
      for (const { variationId } of updatedState.variationsToSelect) {
        await handleReviewVariation(variationId, 'approved', '');
      }
    }
    
    // Handle AI suggestion count update
    if (updatedState.aiSuggestionCount !== undefined) {
      setVoiceAssistantState(prev => ({
        ...prev,
        aiSuggestionCount: updatedState.aiSuggestionCount
      }));
      
      // Update the input field if sub-question is expanded
      if (voiceAssistantState.expandedSubQuestionId) {
        setAiInputNumbers(prev => ({
          ...prev,
          [voiceAssistantState.expandedSubQuestionId]: updatedState.aiSuggestionCount
        }));
      }
    }
    
    // Handle AI trigger
    if (updatedState.shouldTriggerAI && voiceAssistantState.expandedSubQuestionId) {
      const variations = voiceAssistantState.availableVariations;
      const count = updatedState.aiSuggestionCount || voiceAssistantState.aiSuggestionCount || 1;
      await handleAIRecommend(voiceAssistantState.expandedSubQuestionId, variations, count);
    }
    
    // Handle AI recommendations apply
    if (updatedState.shouldApplyAIRecommendations && voiceAssistantState.expandedSubQuestionId) {
      await handleApplyAIRecommendations(voiceAssistantState.expandedSubQuestionId);
    }
    
    // Handle AI recommendations cancel
    if (updatedState.shouldCancelAIRecommendations && voiceAssistantState.expandedSubQuestionId) {
      handleCancelAIRecommendations(voiceAssistantState.expandedSubQuestionId);
    }
    
    // Handle show variation (scroll and highlight)
    if (updatedState.shouldShowVariation && updatedState.variationNumber) {
      // Find the variation element and scroll to it
      const variationElements = document.querySelectorAll('[data-variation-number]');
      for (const el of variationElements) {
        if (parseInt(el.getAttribute('data-variation-number')) === updatedState.variationNumber) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.style.border = '3px solid var(--primary)';
          setTimeout(() => {
            el.style.border = '';
          }, 2000);
          break;
        }
      }
      
      // Update current variation index
      setVoiceAssistantState(prev => ({
        ...prev,
        currentVariationIndex: updatedState.currentVariationIndex || prev.currentVariationIndex
      }));
    }
    
    // Handle sub-question expansion
    if (updatedState.shouldExpandSubQuestion !== undefined) {
      await toggleSubQuestion(updatedState.questionIndex, updatedState.subQuestionIndex);
    }
    
    // Handle sub-question collapse
    if (updatedState.shouldCollapseSubQuestion) {
      // Find the currently expanded sub-question and collapse it
      const expandedKey = Object.keys(expandedSubQuestions).find(key => expandedSubQuestions[key]);
      if (expandedKey) {
        const [qIndex, sqIndex] = expandedKey.split('-').map(Number);
        await toggleSubQuestion(qIndex, sqIndex);
      }
    }
    
    // Handle send to moderator
    if (updatedState.shouldSendToModerator && updatedState.paperId) {
      handleSendToModerator(updatedState.paperId, updatedState.paperTitle);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceAssistantState, expandedSubQuestions]);

  // Initialize voice assistant
  const voiceAssistant = useVoiceAssistant({
    context: 'sme-variation-review',
    formState: voiceAssistantState,
    onStateChange: handleVoiceAssistantStateUpdate,
    enabled: activeView === 'view' && selectedPaper !== null
  });

  useEffect(() => {
    if (activeView === 'list') {
      fetchPapers();
    } else if (activeView === 'view') {
      const paperId = location.pathname.split('/').pop();
      if (paperId) {
        loadPaperDetails(paperId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, location.pathname]);

  const fetchPapers = async () => {
    try {
      setLoading(true);
      const { data } = await API.get('/sub-questions/sme/papers-with-reviews');
      setPapers(data.papers || []);
    } catch (error) {
      console.error('Error fetching papers:', error);
      showToast('Failed to load papers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadPaperDetails = async (paperId) => {
    try {
      setLoading(true);
      // Use SME-specific endpoint that only returns variations sent to this SME
      const { data } = await API.get(`/sub-questions/sme/paper/${paperId}/details`);
      setSelectedPaper(data.paper);
      
      // Initialize voice assistant state
      setVoiceAssistantState(prev => ({
        ...prev,
        paperId: data.paper.paper_id,
        paperTitle: data.paper.paper_title,
        paperStatus: data.paper.status,
        paperQuestions: data.paper.questions || [],
        sendToModeratorVisible: data.paper.status === 'confirmed_by_examiner'
      }));
    } catch (error) {
      console.error('Error loading paper:', error);
      showToast('Failed to load paper details', 'error');
      navigate('/sme-papers');
    } finally {
      setLoading(false);
    }
  };

  const loadVariationsPage = async (subQuestionId, page = 1) => {
    try {
      setVariationsPagination(prev => ({
        ...prev,
        [subQuestionId]: { ...prev[subQuestionId], loading: true }
      }));

      // Use SME-specific endpoint that only returns variations visible to SME
      const { data } = await API.get(`/sub-questions/sme/sub-questions/${subQuestionId}/variations`, {
        params: { page, limit: 50 }
      });

      setPaginatedVariations(prev => ({
        ...prev,
        [subQuestionId]: data.variations
      }));

      setVariationsPagination(prev => ({
        ...prev,
        [subQuestionId]: {
          page: data.pagination.page,
          total: data.pagination.total, // This now contains only SME-visible count
          totalPages: data.pagination.totalPages,
          hasMore: data.pagination.hasMore,
          loading: false
        }
      }));
      
      // Update voice assistant context with loaded variations
      setVoiceAssistantState(prev => ({
        ...prev,
        availableVariations: data.variations
      }));

      // Scroll to variations section after loading
      setTimeout(() => {
        if (variationsRefs.current[subQuestionId]) {
          variationsRefs.current[subQuestionId].scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }
      }, 100);
    } catch (error) {
      console.error('Error loading variations:', error);
      showToast('Failed to load variations', 'error');
      setVariationsPagination(prev => ({
        ...prev,
        [subQuestionId]: { ...prev[subQuestionId], loading: false }
      }));
    }
  };

  const toggleSubQuestion = async (questionIndex, subQuestionIndex) => {
    const key = `${questionIndex}-${subQuestionIndex}`;
    const isCurrentlyExpanded = expandedSubQuestions[key];
    
    setExpandedSubQuestions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));

    // If expanding and variations not loaded yet, load first page
    if (!isCurrentlyExpanded && selectedPaper?.questions?.[questionIndex]?.sub_questions?.[subQuestionIndex]) {
      const subQuestion = selectedPaper.questions[questionIndex].sub_questions[subQuestionIndex];
      const subQuestionId = subQuestion.sub_question_id;
      
      // Update voice assistant context
      setVoiceAssistantState(prev => ({
        ...prev,
        expandedSubQuestionId: subQuestionId,
        expandedSubQuestionNumber: subQuestion.full_question_number,
        availableVariations: paginatedVariations[subQuestionId] || subQuestion.variations || [],
        currentVariationIndex: 0
      }));
      
      // Only load if not already loaded
      if (!paginatedVariations[subQuestionId]) {
        await loadVariationsPage(subQuestionId, 1);
      }
    } else if (isCurrentlyExpanded) {
      // Collapsing - clear voice assistant context
      setVoiceAssistantState(prev => ({
        ...prev,
        expandedSubQuestionId: null,
        expandedSubQuestionNumber: null,
        availableVariations: [],
        currentVariationIndex: 0
      }));
    }
  };

  const handleReviewVariation = async (variationId, status, comments = '') => {
    try {
      const response = await API.post(`/sub-questions/variations/${variationId}/review`, {
        status,
        comments
      });

      // Update local state immediately for instant UI feedback
      if (response.data.variation) {
        const updatedStatus = response.data.variation.status;
        
        // Update the variation status in selectedPaper state
        setSelectedPaper(prev => {
          if (!prev) return prev;
          
          const updatedPaper = { ...prev };
          updatedPaper.questions = prev.questions.map(q => ({
            ...q,
            sub_questions: q.sub_questions.map(sq => ({
              ...sq,
              variations: sq.variations.map(v => 
                v.variation_id === variationId 
                  ? { ...v, status: updatedStatus }
                  : v
              )
            }))
          }));
          
          return updatedPaper;
        });

        // Also update paginated variations if they exist
        setPaginatedVariations(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(subQuestionId => {
            updated[subQuestionId] = updated[subQuestionId].map(v =>
              v.variation_id === variationId
                ? { ...v, status: updatedStatus }
                : v
            );
          });
          return updated;
        });
      }

      showToast(`Variation ${status === 'approved' ? 'selected' : status === 'sent_to_sme' ? 'unselected' : 'rejected'} successfully!`, 'success');

      // Clear review form for this variation
      setReviewForm(prev => {
        const newForm = { ...prev };
        delete newForm[variationId];
        return newForm;
      });

    } catch (error) {
      console.error('Error reviewing variation:', error);
      showToast(error.response?.data?.message || 'Failed to submit review', 'error');
    }
  };

  const handleAIRecommend = async (subQuestionId, variations, numToSelect = 1) => {
    if (!variations || variations.length === 0) {
      showToast('No variations available', 'warning');
      return;
    }

    // Filter variations that SME can review (sent_to_sme only, not already selected/unselected)
    const pendingVariations = variations.filter(v =>
      v.status === 'sent_to_sme'
    );

    if (pendingVariations.length === 0) {
      showToast('No pending variations to select', 'warning');
      return;
    }

    if (pendingVariations.length < numToSelect) {
      numToSelect = pendingVariations.length;
    }

    // Show processing modal with stages
    setShowAIProcessingModal(true);

    const stages = [
      '🔍 Analyzing question variations...',
      '📊 Evaluating content quality...',
      '🧠 Processing AI algorithms...',
      '⚡ Calculating scores...',
      '✨ Finalizing recommendations...'
    ];

    // Animate through stages
    for (let i = 0; i < stages.length; i++) {
      setAiProcessingStage(stages[i]);
      await new Promise(resolve => setTimeout(resolve, 6000)); // 1 second per stage
    }

    // Simple AI logic: Select variations with better quality indicators
    const scoredVariations = pendingVariations.map(v => {
      let score = 0;

      // Score based on question text length (more detailed = better)
      score += Math.min(v.question_text.length / 100, 10);

      // Score based on answer quality (if available)
      if (v.correct_answer) {
        score += Math.min(v.correct_answer.length / 50, 5);
      }

      // Score based on options quality for MCQ
      if (v.question_type === 'mcq' && v.options && v.options.length === 4) {
        score += 5;
      }

      // Add some randomness to avoid always picking the same pattern
      score += Math.random() * 3;

      return { ...v, ai_score: score };
    });

    // Sort by score and select top N
    const recommended = scoredVariations
      .sort((a, b) => b.ai_score - a.ai_score)
      .slice(0, numToSelect);

    // Hide processing modal
    setShowAIProcessingModal(false);
    setAiProcessingStage('');

    // Store recommendations and show preview
    setAiRecommendations(prev => ({
      ...prev,
      [subQuestionId]: recommended
    }));

    setShowingRecommendations(prev => ({
      ...prev,
      [subQuestionId]: true
    }));
    
    // Update voice assistant state
    setVoiceAssistantState(prev => ({
      ...prev,
      hasAIRecommendations: true,
      aiRecommendedVariations: recommended.map(r => r.variation_number)
    }));
  };

  const handleApplyAIRecommendations = async (subQuestionId) => {
    const recommended = aiRecommendations[subQuestionId];

    if (!recommended || recommended.length === 0) {
      return;
    }

    try {
      setLoading(true);
      
      // Apply each recommendation and update local state
      for (const variation of recommended) {
        const response = await API.post(`/sub-questions/variations/${variation.variation_id}/review`, {
          status: 'approved',
          comments: 'AI Recommended - Auto-selected'
        });

        // Update local state immediately for instant UI feedback
        if (response.data.variation) {
          const updatedStatus = response.data.variation.status;
          
          // Update the variation status in selectedPaper state
          setSelectedPaper(prev => {
            if (!prev) return prev;
            
            const updatedPaper = { ...prev };
            updatedPaper.questions = prev.questions.map(q => ({
              ...q,
              sub_questions: q.sub_questions.map(sq => ({
                ...sq,
                variations: sq.variations.map(v => 
                  v.variation_id === variation.variation_id 
                    ? { ...v, status: updatedStatus }
                    : v
                )
              }))
            }));
            
            return updatedPaper;
          });

          // Also update paginated variations if they exist
          setPaginatedVariations(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(subQuestionId => {
              updated[subQuestionId] = updated[subQuestionId].map(v =>
                v.variation_id === variation.variation_id
                  ? { ...v, status: updatedStatus }
                  : v
              );
            });
            return updated;
          });
        }
      }

      showToast(`AI selected ${recommended.length} best variation(s)!`, 'success');

      // Clear recommendations
      setAiRecommendations(prev => {
        const newRecs = { ...prev };
        delete newRecs[subQuestionId];
        return newRecs;
      });

      setShowingRecommendations(prev => {
        const newShowing = { ...prev };
        delete newShowing[subQuestionId];
        return newShowing;
      });

      // Reload paper to ensure everything is in sync
      if (selectedPaper) {
        await loadPaperDetails(selectedPaper.paper_id);
      }
    } catch (error) {
      console.error('AI recommend error:', error);
      showToast('Failed to apply AI recommendations', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAIRecommendations = (subQuestionId) => {
    setAiRecommendations(prev => {
      const newRecs = { ...prev };
      delete newRecs[subQuestionId];
      return newRecs;
    });

    setShowingRecommendations(prev => {
      const newShowing = { ...prev };
      delete newShowing[subQuestionId];
      return newShowing;
    });
  };

  const handleSendToModerator = (paperId, paperTitle) => {
    // First, validate that each sub-question has at least 4 selected variations
    if (selectedPaper && selectedPaper.questions) {
      let hasInsufficientSelections = false;
      let insufficientSubQuestions = [];

      for (const question of selectedPaper.questions) {
        if (question.sub_questions) {
          for (const subQuestion of question.sub_questions) {
            const selectedCount = subQuestion.variations?.filter(v =>
              v.status === 'selected_by_sme' || v.status === 'approved'
            ).length || 0;
            if (selectedCount <= 39) {
              hasInsufficientSelections = true;
              insufficientSubQuestions.push(`${subQuestion.full_question_number} (${selectedCount} selected)`);
            }
          }
        }
      }

      if (hasInsufficientSelections) {
        showToast(
          `Cannot send to moderator. Each sub-question must have more than 39 selected variations (minimum 40). Sub-questions with insufficient selections: ${insufficientSubQuestions.join(', ')}`,
          'error'
        );
        return;
      }
    }

    // Show modal instead of alert
    setPaperToSendToModerator({ paperId, paperTitle });
    setShowModeratorModal(true);
  };

  const confirmSendToModerator = async () => {
    if (!paperToSendToModerator) return;

    try {
      setLoading(true);
      await API.post(`/papers/${paperToSendToModerator.paperId}/send-to-moderator`);
      showToast('Paper sent to moderator successfully!', 'success');
      setShowModeratorModal(false);
      setPaperToSendToModerator(null);

      // Reload paper details to show updated status
      if (selectedPaper) {
        await loadPaperDetails(selectedPaper.paper_id);
      }
    } catch (error) {
      console.error('Error sending to moderator:', error);
      showToast(error.response?.data?.message || 'Failed to send to moderator', 'error');
    } finally {
      setLoading(false);
    }
  };
  const getStatusBadge = (status) => {
    const badges = {
      draft: { color: 'var(--text-secondary)', bg: 'var(--bg-secondary)', text: '📝 Draft' },
      sent_to_sme: { color: 'var(--info)', bg: 'var(--info-light)', text: '📤 Pending Review' },
      selected_by_sme: { color: 'var(--success)', bg: 'var(--success-light)', text: '✓ Selected' },
      unselected_by_sme: { color: 'var(--error)', bg: 'var(--error-light)', text: '✗ Unselected' },
      sent_to_moderator: { color: 'var(--primary)', bg: 'var(--primary-light)', text: '📤 With Moderator' },
      approved: { color: 'var(--success)', bg: 'var(--success-light)', text: '✓ Selected' },
      rejected: { color: 'var(--error)', bg: 'var(--error-light)', text: '✗ Rejected' },
      // Old statuses for backward compatibility
      examiner_approved: { color: 'var(--primary)', bg: 'var(--primary-light)', text: '✅ Ready for Review' },
      sme_approved: { color: 'var(--success)', bg: 'var(--success-light)', text: '✓ SME Approved' },
      moderator_approved: { color: 'var(--success)', bg: 'var(--success-light)', text: '⭐ Moderator Approved' },
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
      {/* Voice Assistant - Only show in view mode */}
      {activeView === 'view' && selectedPaper && (
        <VoiceAssistantUI
          isListening={voiceAssistant.isListening}
          isProcessing={voiceAssistant.isProcessing}
          isSpeaking={voiceAssistant.isSpeaking}
          isActive={voiceAssistant.isActive}
          message={voiceAssistant.assistantMessage}
          onStart={voiceAssistant.startListening}
          onStop={voiceAssistant.stopListening}
          error={voiceAssistant.error}
          isSupported={voiceAssistant.isSupported}
          continuousMode={false}
          onToggleContinuousMode={null}
          currentSuggestions={voiceAssistant.currentSuggestions}
          workflowState={voiceAssistant.workflowState}
        />
      )}
      
      {activeView === 'list' ? (
        <>
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ margin: '0 0 0.5rem 0' }}>📋 Review Papers</h1>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              Review question variations sent by examiners in your department
            </p>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem' }}>
              <div className="spinner"></div>
            </div>
          ) : papers.length === 0 ? (
            <div className="card">
              <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <p style={{ fontSize: '3rem', margin: '0 0 1rem 0' }}>📋</p>
                <p style={{ margin: 0 }}>No papers with pending reviews</p>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Papers ({papers.length})</h3>
              </div>
              <div style={{ padding: '1.5rem' }}>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {papers.map(paper => (
                    <div
                      key={paper.paper_id}
                      style={{
                        padding: '1.5rem',
                        background: 'var(--bg-secondary)',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                          <h4 style={{ margin: 0, fontSize: '1.125rem', color: 'var(--text-primary)' }}>
                            📄 {paper.paper_title}
                          </h4>
                          {paper.status === 'pending_moderator' ? (
                            <span style={{
                              padding: '0.25rem 0.75rem',
                              borderRadius: '1rem',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              color: 'var(--info)',
                              background: 'var(--info-light)',
                              border: '1px solid var(--info)'
                            }}>
                              📤 Sent to Moderator
                            </span>
                          ) : paper.status === 'confirmed_by_examiner' ? (
                            <span style={{
                              padding: '0.25rem 0.75rem',
                              borderRadius: '1rem',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              color: 'var(--success)',
                              background: 'var(--success-light)',
                              border: '1px solid var(--success)'
                            }}>
                              ✅ Examiner Confirmed - Ready to Send
                            </span>
                          ) : paper.status === 'finalized' ? (
                            <span style={{
                              padding: '0.25rem 0.75rem',
                              borderRadius: '1rem',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              color: 'var(--success)',
                              background: 'var(--success-light)',
                              border: '1px solid var(--success)'
                            }}>
                              ✅ Completed from Moderator
                            </span>
                          )

                            : paper.status === 'sent_to_sme' ? (
                              <span style={{
                                padding: '0.25rem 0.75rem',
                                borderRadius: '1rem',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                color: 'var(--warning)',
                                background: 'var(--warning-light)',
                                border: '1px solid var(--warning)'
                              }}>
                                ⚠️ In Progress
                              </span>
                            ) : (
                              <span style={{
                                padding: '0.25rem 0.75rem',
                                borderRadius: '1rem',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                color: 'var(--warning)',
                                background: 'var(--warning-light)',
                                border: '1px solid var(--warning)'
                              }}>
                                ⚠️ In Progress
                              </span>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                          <span>From: {paper.examiner_name}</span>
                          {/* <span>•</span>
                          <span>{paper.pending_reviews} pending reviews</span> */}
                          <span>•</span>
                          <span>Created: {new Date(paper.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate(`/sme-papers/view/${paper.paper_id}`)}
                      >
                        👁️ View & Review
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* View Paper with Variations */}
          {selectedPaper && (
            <div className="card">
              <div style={{ padding: '1.5rem' }}>
                <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => navigate('/sme-papers')}
                  >
                    ← Back to Papers
                  </button>

                  {/* Send to Moderator button - only show if paper is confirmed by examiner, not yet sent, and has selected variations */}
                  {selectedPaper.status === 'confirmed_by_examiner' && (() => {
                    // Check if there are questions and sub-questions with selected variations
                    let hasSelectedVariations = false;
                    if (selectedPaper.questions) {
                      for (const question of selectedPaper.questions) {
                        if (question.sub_questions) {
                          for (const subQuestion of question.sub_questions) {
                            const selectedCount = subQuestion.variations?.filter(v =>
                              v.status === 'selected_by_sme' || v.status === 'approved'
                            ).length || 0;
                            if (selectedCount > 0) {
                              hasSelectedVariations = true;
                              break;
                            }
                          }
                          if (hasSelectedVariations) break;
                        }
                      }
                    }

                    return hasSelectedVariations ? (
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handleSendToModerator(selectedPaper.paper_id, selectedPaper.paper_title)}
                        disabled={loading}
                      >
                        {loading ? '⏳ Sending...' : '📤 Send to Moderator'}
                      </button>
                    ) : (
                      <span style={{
                        padding: '0.5rem 1rem',
                        background: 'var(--warning-light)',
                        color: 'var(--warning)',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        border: '1px solid var(--warning)'
                      }}>
                        ⚠️ Select variations first
                      </span>
                    );
                  })()}

                  {/* Show status if already sent */}
                  {selectedPaper.status === 'pending_moderator' && (
                    <span style={{
                      padding: '0.5rem 1rem',
                      background: 'var(--info-light)',
                      color: 'var(--info)',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      border: '1px solid var(--info)'
                    }}>
                      ✓ Sent to Moderator
                    </span>
                  )}
                </div>

                <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                  {selectedPaper.paper_title}
                </h3>

                {/* Paper Status Banner */}
                {selectedPaper.status === 'pending_moderator' ? (
                  <div style={{
                    padding: '1rem',
                    background: 'var(--info-light)',
                    border: '2px solid var(--info)',
                    borderRadius: '0.5rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}>
                    <span style={{ fontSize: '2rem' }}>📤</span>
                    <div>
                      <div style={{ fontWeight: '600', color: 'var(--info)', marginBottom: '0.25rem' }}>
                        Sent to Moderator
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        This paper has been forwarded to the moderator for final review and categorization.
                      </div>
                    </div>
                  </div>
                ) : selectedPaper.status === 'confirmed_by_examiner' ? (
                  <div style={{
                    padding: '1rem',
                    background: 'var(--success-light)',
                    border: '2px solid var(--success)',
                    borderRadius: '0.5rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}>
                    <span style={{ fontSize: '2rem' }}>✅</span>
                    <div>
                      <div style={{ fontWeight: '600', color: 'var(--success)', marginBottom: '0.25rem' }}>
                        Examiner Confirmed - Ready to Send
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        The examiner has confirmed this paper. Review and select variations, then send to moderator when ready.
                      </div>
                    </div>
                  </div>
                ) : selectedPaper.status === 'sent_to_sme' ? (
                  <div style={{
                    padding: '1rem',
                    background: 'var(--warning-light)',
                    border: '2px solid var(--warning)',
                    borderRadius: '0.5rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}>
                    <span style={{ fontSize: '2rem' }}>⚠️</span>
                    <div>
                      <div style={{ fontWeight: '600', color: 'var(--warning)', marginBottom: '0.25rem' }}>
                        Paper In Progress
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        The examiner is still working on this paper. More variations may be added. You can start reviewing, but wait for examiner confirmation before sending to moderator.
                      </div>
                    </div>
                  </div>
                ): selectedPaper.status === 'finalized' ? (
                  <div style={{
                    padding: '1rem',
                    background: 'var(--success-light)',
                    border: '2px solid var(--success)',
                    borderRadius: '0.5rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}>
                    <span style={{ fontSize: '2rem' }}>✅</span>
                    <div>
                      <div style={{ fontWeight: '600', color: 'var(--success)', marginBottom: '0.25rem' }}>
                        Paper finalized.
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        The paper is already finalized and cannot be modified further.
                      </div>
                    </div>
                  </div>
                ): (
                  <div style={{
                    padding: '1rem',
                    background: 'var(--warning-light)',
                    border: '2px solid var(--warning)',
                    borderRadius: '0.5rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}>
                    <span style={{ fontSize: '2rem' }}>⚠️</span>
                    <div>
                      <div style={{ fontWeight: '600', color: 'var(--warning)', marginBottom: '0.25rem' }}>
                        Paper In Progress
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        The examiner is still working on this paper. More questions or variations may be added.
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: '2rem' }}>
                  <div className="stat-card" style={{ maxWidth: '300px' }}>
                    <div className="stat-label">Examiner</div>
                    <div className="stat-value" style={{ fontSize: '1rem' }}>
                      {selectedPaper.generated_by_name}
                    </div>
                  </div>
                </div>

                {/* Questions */}
                {selectedPaper.questions && selectedPaper.questions.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {selectedPaper.questions.map((q, index) => (
                      <div key={index} className="question-card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                          <strong style={{ fontSize: '1.125rem', color: 'var(--text-primary)' }}>
                            Q{index + 1}
                          </strong>
                          {q.question_type && (
                            <span className={`badge badge-${q.question_type === 'mcq' ? 'primary' : 'info'}`}>
                              {q.question_type === 'mcq' ? 'MCQ' : q.question_type}
                            </span>
                          )}
                          {q.sub_question_count > 0 && (() => {
                            // Check if there are real sub-questions (not just 'main')
                            const hasRealSubQuestions = q.sub_questions?.some(sq => 
                              sq.sub_question_number !== 'main' && !sq.sub_question_number?.toString().toLowerCase().includes('main')
                            );
                            return hasRealSubQuestions ? (
                              <span className="badge badge-secondary">
                                {q.sub_question_count} sub-questions
                              </span>
                            ) : null;
                          })()}
                        </div>

                        {/* Sub-Questions */}
                        {q.sub_questions && q.sub_questions.length > 0 && (() => {
                          // Check if this question actually has sub-questions or just a 'main' placeholder
                          const hasRealSubQuestions = q.sub_questions.some(sq => 
                            sq.sub_question_number !== 'main' && !sq.sub_question_number?.toString().toLowerCase().includes('main')
                          );
                          
                          return (
                            <div style={{ marginTop: '1rem' }}>
                              {/* Only show "Sub-Questions" header if there are real sub-questions */}
                              {hasRealSubQuestions && (
                                <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>
                                  📋 Sub-Questions ({q.sub_questions.length})
                                </h4>
                              )}
                              {q.sub_questions.map((subQ, subIndex) => {
                                const isExpanded = expandedSubQuestions[`${index}-${subIndex}`];
                                const pendingVariations = subQ.variations?.filter(v =>
                                  v.status === 'sent_to_sme'
                                ) || [];
                                const selectedVariations = subQ.variations?.filter(v =>
                                  v.status === 'selected_by_sme' || v.status === 'approved'
                                ) || [];
                                
                                // Check if this is a 'main' sub-question (question without real sub-questions)
                                const isMainSubQuestion = subQ.sub_question_number === 'main' || 
                                                         subQ.sub_question_number?.toString().toLowerCase().includes('main');

                                return (
                                  <div key={subIndex} style={{
                                    marginBottom: '1rem',
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '0.5rem',
                                    border: '1px solid var(--border-color)',
                                    overflow: 'hidden'
                                  }}>
                                    <div
                                      onClick={() => toggleSubQuestion(index, subIndex)}
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '1rem',
                                        cursor: 'pointer',
                                        background: isExpanded ? 'var(--primary-light)' : 'transparent'
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <span style={{ fontSize: '1.25rem', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                                          ▶
                                        </span>
                                        <strong style={{ color: 'var(--primary)' }}>
                                          {/* Show Q1.main format for main sub-questions, otherwise show normal numbering */}
                                          {isMainSubQuestion 
                                            ? `Q${index + 1}.main`
                                            : subQ.full_question_number
                                          }
                                        </strong>
                                      </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                      <span className="badge badge-info">{subQ.question_type}</span>
                                      <span className="badge badge-success">{subQ.marks} marks</span>
                                      {pendingVariations.length > 0 && (
                                        <span className="badge badge-warning">{pendingVariations.length} pending</span>
                                      )}
                                      {selectedVariations.length > 0 && (
                                        <span className="badge badge-success">{selectedVariations.length} selected</span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Variations */}
                                  {isExpanded && subQ.variations && subQ.variations.length > 0 && (
                                    <div 
                                      ref={el => variationsRefs.current[subQ.sub_question_id] = el}
                                      style={{ padding: '1rem', background: 'var(--bg-primary)' }}
                                    >
                                      {/* AI Recommendation Section */}
                                      {subQ.variations.filter(v => v.status === 'sent_to_sme').length > 0 && selectedPaper.status !== 'pending_moderator' && !showingRecommendations[subQ.sub_question_id] && (
                                        <div style={{
                                          marginBottom: '1rem',
                                          padding: '1rem',
                                          background: 'var(--info-light)',
                                          borderRadius: '0.5rem',
                                          border: '1px solid var(--info)'
                                        }}>
                                          <div style={{ marginBottom: '0.75rem' }}>
                                            <strong style={{ color: 'var(--info)', fontSize: '0.875rem' }}>🤖 AI Recommendation</strong>
                                            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                              Enter how many variations you want AI to recommend
                                            </p>
                                          </div>
                                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <input
                                              type="number"
                                              min="1"
                                              max={subQ.variations.filter(v => v.status === 'sent_to_sme').length}
                                              value={aiInputNumbers[subQ.sub_question_id] ?? ''}
                                              onChange={(e) => {
                                                const value = e.target.value;
                                                if (value === '') {
                                                  // Allow empty value for clearing
                                                  setAiInputNumbers(prev => ({
                                                    ...prev,
                                                    [subQ.sub_question_id]: ''
                                                  }));
                                                } else {
                                                  const numValue = parseInt(value);
                                                  if (!isNaN(numValue)) {
                                                    const maxValue = subQ.variations.filter(v => v.status === 'sent_to_sme').length;
                                                    setAiInputNumbers(prev => ({
                                                      ...prev,
                                                      [subQ.sub_question_id]: Math.max(1, Math.min(numValue, maxValue))
                                                    }));
                                                  }
                                                }
                                              }}
                                              onBlur={(e) => {
                                                // Set to 1 if empty when user leaves the field
                                                if (e.target.value === '') {
                                                  setAiInputNumbers(prev => ({
                                                    ...prev,
                                                    [subQ.sub_question_id]: 1
                                                  }));
                                                }
                                              }}
                                              className="form-input"
                                              style={{ width: '80px', padding: '0.5rem', fontSize: '0.875rem' }}
                                            />
                                            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                              / {subQ.variations.filter(v => v.status === 'sent_to_sme').length} available
                                            </span>
                                            <button
                                              className="btn btn-info btn-sm"
                                              onClick={() => handleAIRecommend(subQ.sub_question_id, subQ.variations, aiInputNumbers[subQ.sub_question_id] || 1)}
                                              disabled={loading}
                                              style={{ marginLeft: 'auto' }}
                                            >
                                              {loading ? '⏳ Getting...' : '🤖 Get AI Suggestions'}
                                            </button>
                                          </div>
                                        </div>
                                      )}

                                      {/* AI Recommendations Preview */}
                                      {showingRecommendations[subQ.sub_question_id] && aiRecommendations[subQ.sub_question_id] && (
                                        <div style={{
                                          marginBottom: '1rem',
                                          padding: '1.5rem',
                                          background: 'var(--success-light)',
                                          borderRadius: '0.5rem',
                                          border: '2px solid var(--success)'
                                        }}>
                                          <div style={{ marginBottom: '1rem' }}>
                                            <strong style={{ color: 'var(--success)', fontSize: '1rem' }}>
                                              ✨ AI Recommended {aiRecommendations[subQ.sub_question_id].length} Variation(s)
                                            </strong>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                              <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => handleCancelAIRecommendations(subQ.sub_question_id)}
                                                disabled={loading}
                                              >
                                                ✗ Cancel
                                              </button>
                                              <button
                                                className="btn btn-success btn-sm"
                                                onClick={() => handleApplyAIRecommendations(subQ.sub_question_id)}
                                                disabled={loading}
                                              >
                                                {loading ? '⏳ Applying...' : '✓ Apply AI Suggestions'}
                                              </button>
                                            </div>
                                            {/* <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                              Review the AI's top picks below and apply if you agree
                                            </p> */}
                                          </div>

                                          <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
                                            {aiRecommendations[subQ.sub_question_id].map((rec, idx) => (
                                              <div key={idx} style={{
                                                padding: '0.75rem',
                                                background: 'var(--bg-primary)',
                                                borderRadius: '0.375rem',
                                                border: '2px solid var(--success)'
                                              }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                  <strong style={{ fontSize: '0.875rem', color: 'var(--success)' }}>
                                                    #{idx + 1} - Variation {rec.variation_number}
                                                  </strong>
                                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                    AI Score: {rec.ai_score.toFixed(1)}
                                                  </span>
                                                </div>
                                                <p style={{ fontSize: '0.8rem', margin: '0.5rem 0', color: 'var(--text-primary)' }}>
                                                  {rec.question_text.substring(0, 150)}{rec.question_text.length > 150 ? '...' : ''}
                                                </p>
                                              </div>
                                            ))}
                                          </div>


                                        </div>
                                      )}

                                      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))' }}>
                                        {(paginatedVariations[subQ.sub_question_id] || subQ.variations)
                                          .filter(v => v.status === 'sent_to_sme' || v.status === 'selected_by_sme' || v.status === 'unselected_by_sme' || v.status === 'sent_to_moderator' || v.status === 'approved' || v.status === 'rejected')
                                          .map((variation, varIndex) => (
                                            <div 
                                              key={varIndex} 
                                              data-variation-number={variation.variation_number}
                                              style={{
                                                padding: '1rem',
                                                background: 'var(--bg-secondary)',
                                                borderRadius: '0.5rem',
                                                border: `2px solid ${variation.status === 'sent_to_sme' ? 'var(--warning)' : 'var(--border-color)'}`,
                                                transition: 'border 0.3s ease'
                                              }}>
                                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                  <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>
                                                    Variation {variation.variation_number}
                                                  </span>
                                                  <QuestionMetadataInfo question={variation} />
                                                </div>
                                                {getStatusBadge(variation.status)}
                                              </div>

                                              <p style={{ fontSize: '0.875rem', marginBottom: '0.75rem', lineHeight: '1.4' }}>
                                                {variation.question_text}
                                              </p>

                                              {/* MCQ Options */}
                                              {variation.question_type === 'mcq' && variation.options && (
                                                <div style={{ marginBottom: '0.75rem' }}>
                                                  <strong style={{ fontSize: '0.75rem' }}>Options:</strong>
                                                  <ul style={{ margin: '0.25rem 0 0 1.25rem', fontSize: '0.8rem' }}>
                                                    {variation.options.map((opt, optIndex) => (
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
                                                <div style={{ padding: '0.5rem', background: 'var(--success-light)', borderRadius: '0.25rem', marginBottom: '0.75rem' }}>
                                                  <strong style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Answer:</strong>
                                                  <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                                                    {variation.correct_answer}
                                                  </div>
                                                </div>
                                              )}

                                              {/* Review Actions - Only show if paper not sent to moderator */}
                                              {(variation.status === 'sent_to_sme') && selectedPaper.status !== 'pending_moderator' && (
                                                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                                                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                                    <button
                                                      className="btn btn-success btn-sm"
                                                      onClick={() => handleReviewVariation(variation.variation_id, 'approved', reviewForm[variation.variation_id] || '')}
                                                      style={{ flex: 1 }}
                                                    >
                                                      ✓ Select
                                                    </button>
                                                    {/* <button
                                                      className="btn btn-danger btn-sm"
                                                      onClick={() => handleReviewVariation(variation.variation_id, 'rejected', reviewForm[variation.variation_id] || '')}
                                                      style={{ flex: 1 }}
                                                    >
                                                      ✗ Reject
                                                    </button> */}
                                                  </div>
                                                  {/* <textarea
                                                    className="form-input"
                                                    value={reviewForm[variation.variation_id] || ''}
                                                    onChange={(e) => setReviewForm(prev => ({ ...prev, [variation.variation_id]: e.target.value }))}
                                                    placeholder="Add comments (optional)..."
                                                    rows="2"
                                                    style={{ fontSize: '0.875rem' }}
                                                  /> */}
                                                </div>
                                              )}

                                              {/* Unselect option for selected variations */}
                                              {(variation.status === 'selected_by_sme' || variation.status === 'approved') && selectedPaper.status !== 'pending_moderator' && (
                                                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                                                  <button
                                                    className="btn btn-warning btn-sm"
                                                    onClick={() => handleReviewVariation(variation.variation_id, 'sent_to_sme', 'Unselected by SME')}
                                                    style={{ width: '100%' }}
                                                  >
                                                    ↩️ Unselect
                                                  </button>
                                                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.5rem 0 0 0', textAlign: 'center' }}>
                                                    Change your mind? Click to unselect this variation
                                                  </p>
                                                </div>
                                              )}

                                            </div>
                                          ))}
                                      </div>

                                      {/* Pagination Controls */}
                                      {variationsPagination[subQ.sub_question_id] && variationsPagination[subQ.sub_question_id].totalPages > 1 && (
                                        <div style={{
                                          marginTop: '1.5rem',
                                          padding: '1rem',
                                          background: 'var(--bg-secondary)',
                                          borderRadius: '0.5rem',
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                          flexWrap: 'wrap',
                                          gap: '1rem'
                                        }}>
                                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                            Showing {((variationsPagination[subQ.sub_question_id].page - 1) * 50) + 1} - {Math.min(variationsPagination[subQ.sub_question_id].page * 50, variationsPagination[subQ.sub_question_id].total)} of {variationsPagination[subQ.sub_question_id].total} variations
                                          </div>
                                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <button
                                              className="btn btn-secondary btn-sm"
                                              onClick={() => loadVariationsPage(subQ.sub_question_id, variationsPagination[subQ.sub_question_id].page - 1)}
                                              disabled={variationsPagination[subQ.sub_question_id].page === 1 || variationsPagination[subQ.sub_question_id].loading}
                                              style={{ padding: '0.5rem 1rem' }}
                                            >
                                              ← Previous
                                            </button>
                                            <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: '600' }}>
                                              Page {variationsPagination[subQ.sub_question_id].page} of {variationsPagination[subQ.sub_question_id].totalPages}
                                            </span>
                                            <button
                                              className="btn btn-secondary btn-sm"
                                              onClick={() => loadVariationsPage(subQ.sub_question_id, variationsPagination[subQ.sub_question_id].page + 1)}
                                              disabled={!variationsPagination[subQ.sub_question_id].hasMore || variationsPagination[subQ.sub_question_id].loading}
                                              style={{ padding: '0.5rem 1rem' }}
                                            >
                                              Next →
                                            </button>
                                          </div>
                                          {variationsPagination[subQ.sub_question_id].loading && (
                                            <div style={{ width: '100%', textAlign: 'center', color: 'var(--primary)' }}>
                                              ⏳ Loading variations...
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                    No questions available
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* AI Processing Modal */}
      {showAIProcessingModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: '1rem',
            padding: '3rem',
            maxWidth: '500px',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 2rem',
              border: '4px solid var(--info-light)',
              borderTop: '4px solid var(--info)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>

            <h3 style={{
              margin: '0 0 1rem 0',
              color: 'var(--info)',
              fontSize: '1.5rem'
            }}>
              AI Processing
            </h3>

            <p style={{
              margin: 0,
              fontSize: '1.125rem',
              color: 'var(--text-primary)',
              fontWeight: '500'
            }}>
              {aiProcessingStage}
            </p>

            <p style={{
              margin: '1rem 0 0 0',
              fontSize: '0.875rem',
              color: 'var(--text-secondary)'
            }}>
              Please wait while AI analyzes the variations...
            </p>
          </div>
        </div>
      )}

      {/* Send to Moderator Confirmation Modal */}
      {showModeratorModal && paperToSendToModerator && (
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
          <div className="card" style={{ width: '550px', maxWidth: '90%' }}>
            <div className="card-header" style={{ background: 'var(--primary-light)', borderBottom: '2px solid var(--primary)' }}>
              <h3 className="card-title" style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.5rem' }}>📤</span>
                Send to Moderator
              </h3>
            </div>
            <div style={{ padding: '2rem' }}>
              <p style={{ fontSize: '1rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                Are you sure you want to send <strong>"{paperToSendToModerator.paperTitle}"</strong> to the Moderator?
              </p>

              <div style={{
                background: 'var(--info-light)',
                border: '1px solid var(--info)',
                borderRadius: '0.5rem',
                padding: '1rem',
                marginBottom: '1.5rem'
              }}>
                <div style={{ fontWeight: '600', marginBottom: '0.75rem', color: 'var(--info)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>ℹ️</span>
                  What happens next:
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.5rem', color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                  <li style={{ marginBottom: '0.5rem' }}>All approved variations will be forwarded to the moderator</li>
                  <li style={{ marginBottom: '0.5rem' }}>The moderator will review and categorize the questions</li>
                  <li>You will be notified once the review is complete</li>
                </ul>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowModeratorModal(false);
                    setPaperToSendToModerator(null);
                  }}
                  className="btn btn-secondary"
                  disabled={loading}
                  style={{ minWidth: '100px' }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSendToModerator}
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ minWidth: '150px' }}
                >
                  {loading ? (
                    <>
                      <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px', marginRight: '0.5rem' }}></span>
                      Sending...
                    </>
                  ) : (
                    <>📤 Yes, Send to Moderator</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SMEPapers;
