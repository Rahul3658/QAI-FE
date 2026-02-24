import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import API from '../api/axios';
import { useToast } from '../context/ToastContext';
import useVoiceAssistant from '../hooks/useVoiceAssistant';
import VoiceAssistantUI from '../components/VoiceAssistantUI';
import QuestionMetadataInfo from '../components/QuestionMetadataInfo';

const ModeratorCategorization = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [expandedSubQuestions, setExpandedSubQuestions] = useState({});
  const [categorization, setCategorization] = useState({ general: [], reexam: [], special: [] });
  const [categorizingAI, setCategorizingAI] = useState(false);
  const [savingCategorization, setSavingCategorization] = useState(false);
  const [approvingFinal, setApprovingFinal] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState({});
  const [categorizedPapers, setCategorizedPapers] = useState([]);
  const [showAIProcessingModal] = useState(false);
  const [aiProcessingStage] = useState('');
  // const [activeCategoryTab, setActiveCategoryTab] = useState('general');

  // Confirmation modals state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [paperToApprove, setPaperToApprove] = useState(null);

  // Replace variation modal state
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [replaceModalData, setReplaceModalData] = useState(null);

  // Approvals tab state
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'approvals'

  // PDF Preview and Edit state
  const [previewingPaper, setPreviewingPaper] = useState(null);
  const [editingPaperContent, setEditingPaperContent] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [finalizedPapers, setFinalizedPapers] = useState([]);
  const [viewingFinalizedPaper, setViewingFinalizedPaper] = useState(null);
  const [generating40Sets, setGenerating40Sets] = useState(false);
  const [generated40Sets, setGenerated40Sets] = useState([]);
  const [selectedSetsForCategories, setSelectedSetsForCategories] = useState({ general: [], reexam: [], special: [] });
  const [viewingSet, setViewingSet] = useState(null);
  const [loadingSetDetails, setLoadingSetDetails] = useState(false);
  const [showCategorySelectModal, setShowCategorySelectModal] = useState(false);
  const [setToAssign, setSetToAssign] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState(null);

  // Insufficient variations modal
  const [showInsufficientVariationsModal, setShowInsufficientVariationsModal] = useState(false);
  const [insufficientVariationsData, setInsufficientVariationsData] = useState(null);

  // Pagination state for variations
  const [variationsPagination, setVariationsPagination] = useState({}); // { subQuestionId: { page, total, loading } }
  const [paginatedVariations, setPaginatedVariations] = useState({}); // { subQuestionId: [variations] }
 
  // Mock Test checkbox state
  const [isMockTest, setIsMockTest] = useState(false);

  // PDF Encryption modal state
  const [showEncryptionModal, setShowEncryptionModal] = useState(false);
  const [encryptionPassword, setEncryptionPassword] = useState('');
  const [pendingDownloadData, setPendingDownloadData] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showDownloadProgressModal, setShowDownloadProgressModal] = useState(false);
 
  // Refs for scrolling to variations section
  const variationsRefs = useRef({});

  // Voice assistant state
  const [voiceAssistantState, setVoiceAssistantState] = useState({
    activeTab: 'pending',
    paperId: null,
    paperTitle: null,
    expandedSubQuestionId: null,
    expandedSubQuestionNumber: null,
    availableVariations: [],
    paperQuestions: [],
    generated40Sets: [],
    viewingSet: null,
    canGenerateSets: false,
    canSaveCategorization: false,
    canAICategorize: false,
    showConfirmModal: false,
    confirmModalTitle: null,
    showCategorySelectModal: false,
    setToAssign: null,
    isViewingSet: false,
    isPreviewingPaper: false
  });

  const isViewPage = location.pathname.startsWith('/moderator-categorization/view/');
  const activeView = isViewPage ? 'view' : 'list';

  // Voice assistant state update handler
  const handleVoiceAssistantStateUpdate = useCallback(async (updatedState) => {
    console.log('🎤 Voice assistant state update:', updatedState);

    // Handle tab switching
    if (updatedState.shouldSwitchTab) {
      setActiveTab(updatedState.targetTab);
      if (updatedState.targetTab === 'pending' || updatedState.targetTab === 'approvals') {
        navigate('/moderator-categorization');
      }
    }

    // Handle view paper details
    if (updatedState.shouldViewPaper && updatedState.paperId) {
      navigate(`/moderator-categorization/view/${updatedState.paperId}`);
    }

    // Handle sub-question expansion
    if (updatedState.shouldExpandSubQuestion === true) {
      console.log('🔍 Expanding sub-question:', updatedState.questionIndex, updatedState.subQuestionIndex);
      await toggleSubQuestion(updatedState.questionIndex, updatedState.subQuestionIndex);
    }

    // Handle generate 40 sets
    if (updatedState.shouldGenerate40Sets && updatedState.paperId) {
      await handleGenerate40Sets(updatedState.paperId);
    }

    // Handle view set
    if (updatedState.shouldViewSet && updatedState.setData) {
      await handleViewSet(updatedState.setData);
    }

    // Handle AI categorization
    if (updatedState.shouldAICategorize) {
      await handleAICategorize40Sets();
    }

    // Handle save categorization
    if (updatedState.shouldSaveCategorization) {
      await handleSaveCategorization();
    }

    // Handle view finalized paper
    if (updatedState.shouldViewFinalizedPaper && updatedState.paperId) {
      await handleViewFinalizedPaper(updatedState.paperId);
    }

    // Handle confirm modal action
    if (updatedState.shouldConfirmModal && confirmModalData) {
      confirmModalData.onConfirm();
      setShowConfirmModal(false);
      setConfirmModalData(null);
    }

    // Handle cancel modal action
    if (updatedState.shouldCancelModal) {
      setShowConfirmModal(false);
      setConfirmModalData(null);
    }

    // Handle category selection
    if (updatedState.shouldSelectCategory && updatedState.category && setToAssign) {
      handleToggleSetInCategory(setToAssign.set, updatedState.category);
      setShowCategorySelectModal(false);
      setSetToAssign(null);
    }

    // Handle cancel category modal
    if (updatedState.shouldCancelCategoryModal) {
      setShowCategorySelectModal(false);
      setSetToAssign(null);
    }

    // Handle click on set (open category modal)
    if (updatedState.shouldClickSet && updatedState.setData) {
      const assignedCategory = getSetCategory(updatedState.setData.set_number);
      setSetToAssign({ set: updatedState.setData, currentCategory: assignedCategory });
      setShowCategorySelectModal(true);
    }

    // Handle view set questions
    if (updatedState.shouldViewSetQuestions && updatedState.setData) {
      await handleViewSet(updatedState.setData);
    }

    // Handle close viewing set
    if (updatedState.shouldCloseViewingSet) {
      setViewingSet(null);
    }

    // Handle preview paper
    if (updatedState.shouldPreviewPaper && updatedState.paperId && updatedState.paperTitle) {
      await handlePreviewPaper(updatedState.paperId, updatedState.paperTitle);
    }

    // Handle close preview
    if (updatedState.shouldClosePreview) {
      setPreviewingPaper(null);
      setEditingPaperContent(null);
    }

    // Handle download PDF
    if (updatedState.shouldDownloadPDF && updatedState.paperId && updatedState.paperTitle) {
      await handleDownloadPDF(updatedState.paperId, updatedState.paperTitle, editingPaperContent);
    }

    // Handle go back to approvals
    if (updatedState.shouldGoBackToApprovals) {
      setViewingFinalizedPaper(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceAssistantState, expandedSubQuestions, activeTab, confirmModalData, setToAssign, editingPaperContent]);

  // Initialize voice assistant
  const voiceAssistant = useVoiceAssistant({
    context: 'moderator-categorization',
    formState: voiceAssistantState,
    onStateChange: handleVoiceAssistantStateUpdate,
    enabled: true
  });

  useEffect(() => {
    if (activeView === 'list') {
      // Fetch both pending and finalized papers together
      fetchBothPapers();
    } else if (activeView === 'view') {
      const paperId = location.pathname.split('/').pop();
      if (paperId) {
        loadPaperDetails(paperId);

        // Restore categorization from sessionStorage
        const storedCategorization = sessionStorage.getItem('categorization');
        if (storedCategorization) {
          try {
            const parsed = JSON.parse(storedCategorization);
            // Only set if there's actual data
            if (parsed && (parsed.general?.length > 0 || parsed.reexam?.length > 0 || parsed.special?.length > 0)) {
              setCategorization(parsed);
            }
          } catch (e) {
            console.error('Failed to parse categorization:', e);
            sessionStorage.removeItem('categorization');
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, location.pathname]);

  // Update voice assistant state when activeTab changes
  useEffect(() => {
    setVoiceAssistantState(prev => ({
      ...prev,
      activeTab: activeTab
    }));
  }, [activeTab]);

  // Update voice assistant state when modal shows
  useEffect(() => {
    setVoiceAssistantState(prev => ({
      ...prev,
      showConfirmModal: showConfirmModal,
      confirmModalTitle: confirmModalData?.title || null
    }));
  }, [showConfirmModal, confirmModalData]);

  // Update voice assistant state when category modal shows
  useEffect(() => {
    setVoiceAssistantState(prev => ({
      ...prev,
      showCategorySelectModal: showCategorySelectModal,
      setToAssign: setToAssign
    }));
  }, [showCategorySelectModal, setToAssign]);

  // Update voice assistant state when viewing set
  useEffect(() => {
    setVoiceAssistantState(prev => ({
      ...prev,
      isViewingSet: viewingSet !== null,
      viewingSet: viewingSet
    }));
  }, [viewingSet]);

  // Update voice assistant state when previewing paper
  useEffect(() => {
    setVoiceAssistantState(prev => ({
      ...prev,
      isPreviewingPaper: previewingPaper !== null,
      // Update paperId and paperTitle when previewing
      ...(previewingPaper && {
        paperId: previewingPaper.paper_id,
        paperTitle: previewingPaper.paper_title
      })
    }));
  }, [previewingPaper]);

  // Update voice assistant state when viewing finalized paper
  useEffect(() => {
    setVoiceAssistantState(prev => ({
      ...prev,
      viewingFinalizedPaper: viewingFinalizedPaper,
      categorizedPapers: viewingFinalizedPaper?.categorized_papers || []
    }));
  }, [viewingFinalizedPaper]);

  const fetchBothPapers = async () => {
    try {
      setLoading(true);
      console.log('Fetching both pending and finalized papers...');

      // Call both APIs in parallel
      const [pendingResponse, finalizedResponse] = await Promise.all([
        API.get('/papers/moderator/pending-papers'),
        API.get('/papers/moderator/finalized-papers')
      ]);

      console.log('Pending papers received:', pendingResponse.data);
      console.log('Finalized papers received:', finalizedResponse.data);

      setPapers(pendingResponse.data.papers || []);
      setFinalizedPapers(finalizedResponse.data.papers || []);

      // Update voice assistant state
      setVoiceAssistantState(prev => ({
        ...prev,
        activeTab: activeTab,
        pendingPapers: pendingResponse.data.papers || [],
        finalizedPapers: finalizedResponse.data.papers || []
      }));
    } catch (error) {
      console.error('Error fetching papers:', error);
      console.error('Error details:', error.response?.data);
      showToast(error.response?.data?.message || 'Failed to load papers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleViewFinalizedPaper = async (paperId) => {
    try {
      setLoading(true);
     
      // Get all approved papers with categories
      const { data } = await API.get(`/moderator-categorization/paper/${paperId}/categorized-sets`);
     
      // Group papers by category
      const groupedByCategory = {
        general: data.categorized_papers.filter(p => p.paper_category === 'general'),
        reexam: data.categorized_papers.filter(p => p.paper_category === 'reexam'),
        special: data.categorized_papers.filter(p => p.paper_category === 'special')
      };
     
      setViewingFinalizedPaper({
        original_paper: data.original_paper,
        categorized_papers: data.categorized_papers || [],
        grouped_by_category: groupedByCategory
      });
    } catch (error) {
      console.error('Error loading categorized papers:', error);
      showToast('Failed to load categorized papers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewPaper = async (paperId, paperTitle) => {
    try {
      setLoadingPreview(true);

      // Fetch paper details including questions
      const { data } = await API.get(`/papers/moderator/paper/${paperId}/preview`);

      const collegeName = data.paper.college_name || 'College Name';
      const examinerName = data.paper.examiner_name || 'Examiner Name';
      const questions = data.paper.questions || [];

      console.log('📄 Preview data received:', {
        total_questions: questions.length,
        first_question: questions[0] ? {
          text: questions[0].question_text ? questions[0].question_text.substring(0, 50) : 'N/A',
          type: questions[0].question_type,
          marks: questions[0].marks
        } : 'No questions'
      });

      setPreviewingPaper({
        paper_id: paperId,
        paper_title: paperTitle,
        questions: questions,
        college_name: collegeName,
        examiner_name: examinerName
      });
      setEditingPaperContent({
        header: `${collegeName}\n\n${paperTitle}\n`,
        instructions: 'Instructions:\n1. Answer all questions.\n2. All questions carry equal marks.\n3. Write clearly and legibly.',
        footer: 'End of Paper'
      });
    } catch (error) {
      console.error('Error loading paper preview:', error);
      showToast('Failed to load paper preview', 'error');
      setPreviewingPaper(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const loadPaperDetails = async (paperId) => {
    try {
      setLoading(true);
      const { data } = await API.get(`/papers/moderator/paper/${paperId}/details`);
      setSelectedPaper(data.paper);

      // Update voice assistant state
      setVoiceAssistantState(prev => ({
        ...prev,
        paperId: data.paper.paper_id,
        paperTitle: data.paper.paper_title,
        paperStatus: data.paper.status,
        paperQuestions: data.paper.questions || [],
        canGenerateSets: data.paper.status === 'pending_moderator' || data.paper.status === 'pending'
      }));

      // If paper is finalized or approved, load categorized papers
      if (data.paper.status === 'finalized' || data.paper.status === 'approved') {
        loadCategorizedPapers(paperId);
      }
    } catch (error) {
      console.error('Error loading paper:', error);
      showToast('Failed to load paper details', 'error');
      navigate('/moderator-categorization');
    } finally {
      setLoading(false);
    }
  };

  const loadCategorizedPapers = async (paperId) => {
    try {
      const { data } = await API.get(`/papers/moderator/paper/${paperId}/categorized-papers`);
      setCategorizedPapers(data.categorized_papers || []);
    } catch (error) {
      console.error('Error loading categorized papers:', error);
    }
  };

  const loadVariationsPage = async (subQuestionId, page = 1) => {
    try {
      setVariationsPagination(prev => ({
        ...prev,
        [subQuestionId]: { ...prev[subQuestionId], loading: true }
      }));

      console.log('📥 Loading variations for sub-question:', subQuestionId, 'page:', page);

      // Use moderator-specific endpoint that only returns variations sent to moderator
      const { data } = await API.get(`/sub-questions/moderator/sub-questions/${subQuestionId}/variations`, {
        params: { page, limit: 50 }
      });

      console.log('✅ Received variations:', data.variations.length, 'Total:', data.pagination.total);

      setPaginatedVariations(prev => ({
        ...prev,
        [subQuestionId]: data.variations
      }));

      setVariationsPagination(prev => ({
        ...prev,
        [subQuestionId]: {
          page: data.pagination.page,
          total: data.pagination.total, // This now contains only moderator-visible count
          totalPages: data.pagination.totalPages,
          hasMore: data.pagination.hasMore,
          loading: false
        }
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
     
      // Only load if not already loaded
      if (!paginatedVariations[subQuestionId]) {
        await loadVariationsPage(subQuestionId, 1);
      }
    }
  };

  // const handleAICategorize = async () => {
  //   if (!selectedPaper) return;

  //   try {
  //     setCategorizingAI(true);
  //     setShowAIProcessingModal(true);

  //     const stages = [
  //       '🔍 Analyzing question variations...',
  //       '📊 Evaluating distribution patterns...',
  //       '🎯 Categorizing into 3 sets...',
  //       '📘 Preparing General Exam set...',
  //       '📙 Preparing Re-Exam set...',
  //       '📗 Preparing Special Case set...',
  //       '✨ Finalizing categorization...'
  //     ];

  //     // Animate through stages (1 second each = 7 seconds total)
  //     for (let i = 0; i < stages.length; i++) {
  //       setAiProcessingStage(stages[i]);
  //       await new Promise(resolve => setTimeout(resolve, 6000));
  //     }

  //     console.log('Starting AI categorization...');
  //     const { data } = await API.post(`/papers/moderator/paper/${selectedPaper.paper_id}/ai-categorize`);
  //     console.log('AI categorization result:', data);
  //     console.log('General:', data.categorization?.general?.length || 0);
  //     console.log('Re-exam:', data.categorization?.reexam?.length || 0);
  //     console.log('Special:', data.categorization?.special?.length || 0);

  //     setShowAIProcessingModal(false);
  //     setAiProcessingStage('');

  //     // Check if we have valid categorization data
  //     if (!data.categorization ||
  //       (!data.categorization.general?.length &&
  //         !data.categorization.reexam?.length &&
  //         !data.categorization.special?.length)) {
  //       showToast('No variations found to categorize. Make sure variations have been sent to moderator.', 'error');
  //       return;
  //     }

  //     // Check for conflicts before merging
  //     const conflicts = [];
  //     ['general', 'reexam', 'special'].forEach(category => {
  //       const aiVariations = data.categorization[category] || [];
  //       aiVariations.forEach(aiVar => {
  //         const existingVar = categorization[category]?.find(v =>
  //           v.sub_question_id === aiVar.sub_question_id
  //         );
  //         if (existingVar) {
  //           conflicts.push({
  //             category,
  //             aiVariation: aiVar,
  //             existingVariation: existingVar
  //           });
  //         }
  //       });
  //     });

  //     if (conflicts.length > 0) {
  //       // Show modal for conflicts
  //       setReplaceModalData({
  //         isAI: true,
  //         conflicts,
  //         aiCategorization: data.categorization
  //       });
  //       setShowReplaceModal(true);
  //     } else {
  //       // No conflicts, set categorization directly (don't merge with empty state)
  //       setCategorization({
  //         general: data.categorization.general || [],
  //         reexam: data.categorization.reexam || [],
  //         special: data.categorization.special || []
  //       });
  //       showToast(`AI categorization completed! General: ${data.categorization.general?.length || 0}, Re-exam: ${data.categorization.reexam?.length || 0}, Special: ${data.categorization.special?.length || 0}`, 'success');
  //     }
  //   } catch (error) {
  //     console.error('AI categorization error:', error);
  //     setShowAIProcessingModal(false);
  //     setAiProcessingStage('');
  //     showToast(error.response?.data?.message || 'Failed to categorize variations', 'error');
  //   } finally {
  //     setCategorizingAI(false);
  //   }
  // };

  // const handleSaveVariationCategorization = () => {
  //   if (!selectedPaper || !categorization) return;

  //   // Validate that each category has at least one variation from each sub-question
  //   const allSubQuestions = [];
  //   if (selectedPaper.questions) {
  //     selectedPaper.questions.forEach(q => {
  //       if (q.sub_questions) {
  //         q.sub_questions.forEach(sq => {
  //           allSubQuestions.push({
  //             sub_question_id: sq.sub_question_id,
  //             full_question_number: sq.full_question_number
  //           });
  //         });
  //       }
  //     });
  //   }

  //   const errors = [];
  //   const categories = ['general', 'reexam', 'special'];
  //   const categoryNames = {
  //     general: 'General Exam',
  //     reexam: 'Re-Exam',
  //     special: 'Special Case'
  //   };

  //   categories.forEach(category => {
  //     const categoryVariations = categorization[category] || [];
  //     const subQuestionsInCategory = new Set(
  //       categoryVariations.map(v => v.sub_question_id)
  //     );

  //     // Check if all sub-questions are represented
  //     allSubQuestions.forEach(sq => {
  //       if (!subQuestionsInCategory.has(sq.sub_question_id)) {
  //         errors.push({
  //           category: categoryNames[category],
  //           subQuestion: sq.full_question_number
  //         });
  //       }
  //     });
  //   });

  //   if (errors.length > 0) {
  //     showToast('Incomplete categorization - please check missing variations', 'error');
  //     return;
  //   }

  //   setShowSaveModal(true);
  // };

  const confirmSaveCategorization = async () => {
    try {
      setSavingCategorization(true);
      const { data } = await API.post(`/papers/moderator/paper/${selectedPaper.paper_id}/save-categorization`, {
        categorization
      });
      showToast(data.message, 'success');
      setShowSaveModal(false);

      // Reload paper details to show new status and categorized papers
      await loadPaperDetails(selectedPaper.paper_id);

      // // Reset categorization to empty state AFTER reloading
      setCategorization({ general: [], reexam: [], special: [] });

      // // Clear sessionStorage
      sessionStorage.removeItem('categorization');
    } catch (error) {
      console.error('Save categorization error:', error);
      showToast(error.response?.data?.message || 'Failed to save categorization', 'error');
    } finally {
      setSavingCategorization(false);
    }
  };

  const confirmFinalApprove = async () => {
    if (!paperToApprove) return;

    try {
      setApprovingFinal(true);
      const { data } = await API.post(`/papers/moderator/paper/${paperToApprove}/final-approve`);
      showToast(data.message, 'success');
      setShowApprovalModal(false);
      setPaperToApprove(null);

      // Reload paper details
      await loadPaperDetails(paperToApprove);
    } catch (error) {
      console.error('Final approval error:', error);
      showToast(error.response?.data?.message || 'Failed to approve paper', 'error');
    } finally {
      setApprovingFinal(false);
    }
  };

  // const handleToggleVariationInCategory = (variationId, category) => {
  //   const newCategorization = { ...categorization };

  //   // Remove from current category
  //   newCategorization.general = newCategorization.general?.filter(v => v.variation_id !== variationId) || [];
  //   newCategorization.reexam = newCategorization.reexam?.filter(v => v.variation_id !== variationId) || [];
  //   newCategorization.special = newCategorization.special?.filter(v => v.variation_id !== variationId) || [];

  //   // Find the variation from all approved variations
  //   let variation = null;
  //   if (selectedPaper && selectedPaper.questions) {
  //     for (const q of selectedPaper.questions) {
  //       if (q.sub_questions) {
  //         for (const sq of q.sub_questions) {
  //           if (sq.variations) {
  //             variation = sq.variations.find(v => v.variation_id === variationId);
  //             if (variation) break;
  //           }
  //         }
  //         if (variation) break;
  //       }
  //     }
  //   }

  //   // Add to new category if specified (if null, just remove it)
  //   if (category && variation) {
  //     newCategorization[category] = [...(newCategorization[category] || []), variation];
  //   }

  //   setCategorization(newCategorization);
  //   sessionStorage.setItem('categorization', JSON.stringify(newCategorization));
  // };

  // const handleAddVariationToCategory = (variation, category, subQuestionId, fullQuestionNumber) => {
  //   // Check if this exact variation is already in this category
  //   const alreadyInCategory = categorization[category]?.some(v => v.variation_id === variation.variation_id);
  //   if (alreadyInCategory) {
  //     showToast('This variation is already in this category', 'warning');
  //     return;
  //   }

  //   // Get the sub_question_id for this variation
  //   const variationSubQuestionId = variation.sub_question_id || subQuestionId;

  //   // Check if another variation from the SAME sub-question already exists in this category
  //   const existingVariation = categorization[category]?.find(v =>
  //     v.sub_question_id === variationSubQuestionId
  //   );

  //   if (existingVariation) {
  //     // Show modal to confirm replacement
  //     setReplaceModalData({
  //       variation,
  //       category,
  //       subQuestionId: variationSubQuestionId,
  //       fullQuestionNumber,
  //       existingVariation
  //     });
  //     setShowReplaceModal(true);
  //     return;
  //   }

  //   // Ensure variation has sub_question_id and full_question_number
  //   const enrichedVariation = {
  //     ...variation,
  //     sub_question_id: variationSubQuestionId,
  //     full_question_number: variation.full_question_number || fullQuestionNumber
  //   };

  //   const newCategorization = {
  //     ...categorization,
  //     [category]: [...(categorization[category] || []), enrichedVariation]
  //   };

  //   setCategorization(newCategorization);
  //   sessionStorage.setItem('categorization', JSON.stringify(newCategorization));

  //   showToast(`Added to ${category === 'general' ? 'General Exam' : category === 'reexam' ? 'Re-Exam' : 'Special Case'}`, 'success');
  // };

  const confirmReplaceVariation = () => {
    if (!replaceModalData) return;

    if (replaceModalData.isAI) {
      // Handle AI categorization with conflicts
      const { aiCategorization, conflicts } = replaceModalData;

      const newCategorization = { ...categorization };

      // Replace conflicting variations
      conflicts.forEach(conflict => {
        const { category, aiVariation } = conflict;
        newCategorization[category] = [
          ...(newCategorization[category] || []).filter(v => v.sub_question_id !== aiVariation.sub_question_id),
          aiVariation
        ];
      });

      // Add non-conflicting variations
      ['general', 'reexam', 'special'].forEach(category => {
        const aiVariations = aiCategorization[category] || [];
        aiVariations.forEach(aiVar => {
          const isConflict = conflicts.some(c =>
            c.category === category && c.aiVariation.variation_id === aiVar.variation_id
          );
          if (!isConflict) {
            const alreadyExists = newCategorization[category]?.some(v =>
              v.variation_id === aiVar.variation_id
            );
            if (!alreadyExists) {
              newCategorization[category] = [...(newCategorization[category] || []), aiVar];
            }
          }
        });
      });

      setCategorization(newCategorization);
      sessionStorage.setItem('categorization', JSON.stringify(newCategorization));
      showToast('AI categorization completed with replacements!', 'success');
    } else {
      // Handle manual addition
      const { variation, category, subQuestionId, fullQuestionNumber } = replaceModalData;

      const newCategorization = {
        ...categorization,
        [category]: [
          ...(categorization[category] || []).filter(v => v.sub_question_id !== subQuestionId),
          {
            ...variation,
            sub_question_id: subQuestionId,
            full_question_number: variation.full_question_number || fullQuestionNumber
          }
        ]
      };

      setCategorization(newCategorization);
      sessionStorage.setItem('categorization', JSON.stringify(newCategorization));

      const categoryName = category === 'general' ? 'General Exam' : category === 'reexam' ? 'Re-Exam' : 'Special Case';
      showToast(`Replaced with Variation ${variation.variation_number} in ${categoryName}`, 'success');
    }

    setShowReplaceModal(false);
    setReplaceModalData(null);
  };

  const cancelReplaceVariation = () => {
    if (replaceModalData?.isAI) {
      // For AI, add only non-conflicting variations
      const { aiCategorization, conflicts } = replaceModalData;
      const newCategorization = { ...categorization };

      ['general', 'reexam', 'special'].forEach(category => {
        const aiVariations = aiCategorization[category] || [];
        aiVariations.forEach(aiVar => {
          const isConflict = conflicts.some(c =>
            c.category === category && c.aiVariation.variation_id === aiVar.variation_id
          );
          if (!isConflict) {
            const alreadyExists = newCategorization[category]?.some(v =>
              v.variation_id === aiVar.variation_id
            );
            if (!alreadyExists) {
              newCategorization[category] = [...(newCategorization[category] || []), aiVar];
            }
          }
        });
      });

      setCategorization(newCategorization);
      sessionStorage.setItem('categorization', JSON.stringify(newCategorization));
      showToast('AI categorization completed, kept existing variations', 'success');
    }

    setShowReplaceModal(false);
    setReplaceModalData(null);
  };

  // const isVariationCategorized = (variationId) => {
  //   return [
  //     ...(categorization?.general || []),
  //     ...(categorization?.reexam || []),
  //     ...(categorization?.special || [])
  //   ].some(v => v.variation_id === variationId);
  // };

  // Check if variation is in a SPECIFIC category
  // const isVariationInCategory = (variationId, category) => {
  //   return categorization?.[category]?.some(v => v.variation_id === variationId) || false;
  // };

  // Get ALL categories a variation is in (can be multiple)
  const getVariationCategories = (variationId) => {
    const categories = [];
    if (categorization?.general?.some(v => v.variation_id === variationId)) categories.push('general');
    if (categorization?.reexam?.some(v => v.variation_id === variationId)) categories.push('reexam');
    if (categorization?.special?.some(v => v.variation_id === variationId)) categories.push('special');
    return categories;
  };

  // Legacy function - returns first category found (for backward compatibility)
  // const getVariationCategory = (variationId) => {
  //   if (categorization?.general?.some(v => v.variation_id === variationId)) return 'general';
  //   if (categorization?.reexam?.some(v => v.variation_id === variationId)) return 'reexam';
  //   if (categorization?.special?.some(v => v.variation_id === variationId)) return 'special';
  //   return null;
  // };

  const handleDownloadPDF = async (paperId, paperTitle, customContent = null, password = null) => {
    try {
      setDownloadingPDF({ ...downloadingPDF, [paperId]: true });

      // Always use AI-enhanced PDF generation with custom content
      let response;
      if (customContent) {
        console.log('🤖 Generating AI-enhanced PDF with custom content:', {
          header: customContent.header ? 'Yes' : 'No',
          instructions: customContent.instructions ? 'Yes' : 'No',
          footer: customContent.footer ? 'Yes' : 'No',
          questions: customContent.questions?.length || 0,
          encrypted: password ? 'Yes' : 'No'
        });

        showToast('🤖 AI is formatting your paper... This may take a few seconds.', 'info');

        response = await API.post(`/papers/moderator/paper/${paperId}/download-pdf-ai`, {
          header: customContent.header,
          instructions: customContent.instructions,
          footer: customContent.footer,
          questions: customContent.questions,
          password: password || undefined // Include password if provided
        }, {
          responseType: 'blob',
          timeout: 60000 // 60 second timeout for AI processing
        });
      } else {
        // Fallback to regular PDF if no custom content
        response = await API.get(`/papers/moderator/paper/${paperId}/download-pdf`, {
          responseType: 'blob',
          params: password ? { password } : {}
        });
      }

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const filename = password 
        ? `${paperTitle.replace(/[^a-z0-9]/gi, '_')}_AI_Encrypted.pdf`
        : `${paperTitle.replace(/[^a-z0-9]/gi, '_')}_AI.pdf`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      if (password) {
        showToast('✅ Encrypted AI-formatted PDF downloaded successfully!', 'success');
      } else {
        showToast('✅ AI-formatted PDF downloaded successfully!', 'success');
      }

      // Close preview modal if open
      if (customContent) {
        setPreviewingPaper(null);
        setEditingPaperContent(null);
      }
    } catch (error) {
      console.error('Download PDF error:', error);
      showToast(error.response?.data?.message || 'Failed to download PDF', 'error');
    } finally {
      setDownloadingPDF({ ...downloadingPDF, [paperId]: false });
    }
  };

  const handleDownloadClick = (paperId, paperTitle, customContent) => {
    // Store the download data and show encryption modal
    setPendingDownloadData({ paperId, paperTitle, customContent });
    setShowEncryptionModal(true);
    setEncryptionPassword('');
  };

  const confirmDownloadWithEncryption = async () => {
    if (pendingDownloadData) {
      // Validate password if provided
      if (encryptionPassword && encryptionPassword.trim().length > 0 && encryptionPassword.trim().length < 6) {
        showToast('Password must be at least 6 characters long', 'error');
        return;
      }

      const { paperId, paperTitle, customContent } = pendingDownloadData;
      
      // Close encryption modal and show download progress modal
      setShowEncryptionModal(false);
      setShowDownloadProgressModal(true);
      
      // Start download
      await handleDownloadPDF(paperId, paperTitle, customContent, encryptionPassword || null);
      
      // Close download progress modal after completion
      setShowDownloadProgressModal(false);
      
      // Reset state
      setPendingDownloadData(null);
      setEncryptionPassword('');
      setShowPassword(false);
    }
  };

  const cancelEncryptionModal = () => {
    setShowEncryptionModal(false);
    setPendingDownloadData(null);
    setEncryptionPassword('');
    setShowPassword(false);
  };

  const handleAICategorize40Sets = async () => {
    if (generated40Sets.length === 0) {
      showToast('No sets available to categorize', 'error');
      return;
    }

    try {
      setCategorizingAI(true);
     
      // Simple AI logic: Pick top sets based on quality score
      // Distribute evenly: top 13 to general, next 13 to reexam, next 14 to special
      const sortedSets = [...generated40Sets].sort((a, b) => b.avg_quality_score - a.avg_quality_score);
     
      setSelectedSetsForCategories({
        general: sortedSets.slice(0, 13),
        reexam: sortedSets.slice(13, 26),
        special: sortedSets.slice(26, 40)
      });

      // Update voice assistant state
      setVoiceAssistantState(prev => ({
        ...prev,
        canSaveCategorization: true
      }));
     
      showToast('AI categorization completed! Sets distributed based on quality scores.', 'success');
    } catch (error) {
      console.error('AI categorization error:', error);
      showToast('Failed to categorize sets', 'error');
    } finally {
      setCategorizingAI(false);
    }
  };

  const handleToggleSetInCategory = (setData, category) => {
    setSelectedSetsForCategories(prev => {
      const currentSets = prev[category] || [];
      const isAlreadySelected = currentSets.some(s => s.set_number === setData.set_number);
     
      if (isAlreadySelected) {
        // Remove from category
        return {
          ...prev,
          [category]: currentSets.filter(s => s.set_number !== setData.set_number)
        };
      } else {
        // Add to category
        return {
          ...prev,
          [category]: [...currentSets, setData]
        };
      }
    });
  };

  const getSetCategory = (setNumber) => {
    if (selectedSetsForCategories.general.some(s => s.set_number === setNumber)) return 'general';
    if (selectedSetsForCategories.reexam.some(s => s.set_number === setNumber)) return 'reexam';
    if (selectedSetsForCategories.special.some(s => s.set_number === setNumber)) return 'special';
    return null;
  };

  const handleViewSet = async (setData) => {
    try {
      setLoadingSetDetails(true);
     
      // NEW: Fetch set details from new endpoint
      const { data } = await API.get(`/moderator-categorization/set/${setData.set_id}/details`);
     
      const viewingSetData = {
        ...setData,
        questions: data.questions || []
      };

      setViewingSet(viewingSetData);

      // Update voice assistant state
      setVoiceAssistantState(prev => ({
        ...prev,
        viewingSet: viewingSetData
      }));
    } catch (error) {
      console.error('Error loading set details:', error);
      showToast('Failed to load set details', 'error');
    } finally {
      setLoadingSetDetails(false);
    }
  };

  const handleSaveCategorization = async () => {
    // Count total selected sets
    const totalSelected = selectedSetsForCategories.general.length +
                         selectedSetsForCategories.reexam.length +
                         selectedSetsForCategories.special.length;

    if (totalSelected === 0) {
      showToast('Please select at least one set to categorize', 'error');
      return;
    }

    // Show confirmation modal
    setConfirmModalData({
      title: 'Save Categorization',
      message: `This will categorize ${totalSelected} sets (General: ${selectedSetsForCategories.general.length}, Re-Exam: ${selectedSetsForCategories.reexam.length}, Special: ${selectedSetsForCategories.special.length}). Continue?`,
      onConfirm: () => performSaveCategorization()
    });
    setShowConfirmModal(true);
  };

  const performSaveCategorization = async () => {
    setShowConfirmModal(false);

    try {
      setSavingCategorization(true);
     
      // NEW: Prepare categorizations array with set_ids (not paper_ids)
      const categorizations = [];
     
      selectedSetsForCategories.general.forEach(set => {
        categorizations.push({ set_id: set.set_id, category: 'general' });
      });
     
      selectedSetsForCategories.reexam.forEach(set => {
        categorizations.push({ set_id: set.set_id, category: 'reexam' });
      });
     
      selectedSetsForCategories.special.forEach(set => {
        categorizations.push({ set_id: set.set_id, category: 'special' });
      });

      const { data } = await API.post(`/moderator-categorization/save-categorized-sets`, {
        categorizations,
        base_paper_id: selectedPaper.paper_id
      });

      showToast(data.message || `Successfully categorized ${categorizations.length} sets!`, 'success');
     
      // Reset state
      setGenerated40Sets([]);
      setSelectedSetsForCategories({ general: [], reexam: [], special: [] });
     
      // Navigate to approvals tab
      setActiveTab('approvals');
      navigate('/moderator-categorization');
     
    } catch (error) {
      console.error('Save categorization error:', error);
      showToast(error.response?.data?.message || 'Failed to save categorization', 'error');
    } finally {
      setSavingCategorization(false);
    }
  };

  const handleGenerate40Sets = async (paperId) => {
    if (!paperId) {
      paperId = selectedPaper?.paper_id;
    }
   
    if (!paperId) {
      showToast('No paper selected', 'error');
      return;
    }

    // Show confirmation modal
    setConfirmModalData({
      title: 'Generate 40 Sets',
      message: 'This will generate 40 unique question paper sets. Each set will have unique questions with AI quality scores. Continue?',
      onConfirm: () => performGenerate40Sets(paperId)
    });
    setShowConfirmModal(true);
  };

  const performGenerate40Sets = async (paperId) => {
    setShowConfirmModal(false);

    try {
      setGenerating40Sets(true);
      showToast('Generating 40 unique sets... This may take a few moments.', 'info');

      const { data } = await API.post(`/moderator-categorization/paper/${paperId}/generate-40-sets`);

      showToast(`Successfully generated ${data.total_sets} unique sets!`, 'success');
     
      // Load the generated 40 sets
      setGenerated40Sets(data.sets || []);

      // Update voice assistant state
      setVoiceAssistantState(prev => ({
        ...prev,
        generated40Sets: data.sets || [],
        canAICategorize: (data.sets || []).length > 0,
        canSaveCategorization: false
      }));
     
      // Reload paper details to show the new sets
      if (selectedPaper) {
        await loadPaperDetails(paperId);
      } else {
        await fetchBothPapers();
      }
     
    } catch (error) {
      console.error('Generate 40 sets error:', error);
     
      // Show detailed error if available
      if (error.response?.data?.details) {
        setInsufficientVariationsData(error.response.data.details);
        setShowInsufficientVariationsModal(true);
      } else {
        showToast(error.response?.data?.message || 'Failed to generate 40 sets', 'error');
      }
    } finally {
      setGenerating40Sets(false);
    }
  };

  return (
    <div style={{ padding: '2rem', width: '100%', minHeight: '100vh', background: '#f5f7fa' }}>
      {activeView === 'list' ? (
        <>
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ margin: '0 0 0.5rem 0' }}>🎯 Paper Categorization</h1>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              Review and categorize papers sent by SME
            </p>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '1.5rem',
            borderBottom: '2px solid var(--border-color)'
          }}>
            <button
              onClick={() => setActiveTab('pending')}
              style={{
                padding: '0.75rem 1.5rem',
                background: activeTab === 'pending' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'pending' ? '#fff' : 'var(--text-primary)',
                border: 'none',
                borderBottom: activeTab === 'pending' ? '3px solid var(--primary)' : '3px solid transparent',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '1rem',
                transition: 'all 0.2s ease'
              }}
            >
              📋 Pending Papers ({papers.length})
            </button>
            <button
              onClick={() => setActiveTab('approvals')}
              style={{
                padding: '0.75rem 1.5rem',
                background: activeTab === 'approvals' ? 'var(--success)' : 'transparent',
                color: activeTab === 'approvals' ? '#fff' : 'var(--text-primary)',
                border: 'none',
                borderBottom: activeTab === 'approvals' ? '3px solid var(--success)' : '3px solid transparent',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '1rem',
                transition: 'all 0.2s ease'
              }}
            >
              ✅ Approvals ({finalizedPapers.length})
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem' }}>
              <div className="spinner"></div>
            </div>
          ) : activeTab === 'pending' ? (
            papers.length === 0 ? (
              <div className="card">
                <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <p style={{ fontSize: '3rem', margin: '0 0 1rem 0' }}>📋</p>
                  <p style={{ margin: 0 }}>No papers pending review</p>
                </div>
              </div>
            ) : (
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Pending Papers ({papers.length})</h3>
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
                            <span style={{
                              padding: '0.25rem 0.75rem',
                              borderRadius: '1rem',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              color: 'var(--warning)',
                              background: 'var(--warning-light)',
                              border: '1px solid var(--warning)'
                            }}>
                              📤 Pending Review
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            <span>From: {paper.examiner_name}</span>
                            {/* <span>•</span>
                            <span>{paper.question_count} questions</span> */}
                            {/* <span>•</span>
                          <span>{paper.total_marks} marks</span> */}
                            <span>•</span>
                            <span>Sent: {new Date(paper.updated_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => navigate(`/moderator-categorization/view/${paper.paper_id}`)}
                        >
                          👁️ View Details
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          ) : activeTab === 'approvals' ? (
            viewingFinalizedPaper ? (
              <div className="card">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="card-title">📄 {viewingFinalizedPaper.original_paper?.paper_title}</h3>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setViewingFinalizedPaper(null)}
                    >
                      ← Back to Approvals
                    </button>
                  </div>
                </div>
                <div style={{ padding: '1.5rem' }}>
                  <h4 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                    🎯 Categorized Sets by Category
                  </h4>
                 
                  {/* Display each category with its sets */}
                  {[
                    { key: 'general', name: 'General Exam', icon: '📘', color: 'primary' },
                    { key: 'reexam', name: 'Re-Exam', icon: '📙', color: 'warning' },
                    { key: 'special', name: 'Special Case', icon: '📗', color: 'info' }
                  ].map(category => {
                    const sets = viewingFinalizedPaper.grouped_by_category?.[category.key] || [];
                   
                    if (sets.length === 0) return null;
                   
                    return (
                      <div key={category.key} style={{ marginBottom: '2rem' }}>
                        {/* Category Header */}
                        <div style={{
                          background: `var(--${category.color})`,
                          color: 'white',
                          padding: '1rem 1.5rem',
                          borderRadius: '0.5rem 0.5rem 0 0',
                          fontSize: '1.25rem',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem'
                        }}>
                          <span style={{ fontSize: '1.5rem' }}>{category.icon}</span>
                          {category.name}
                          <span style={{
                            marginLeft: 'auto',
                            background: 'rgba(255,255,255,0.2)',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '1rem',
                            fontSize: '0.875rem'
                          }}>
                            {sets.length} set{sets.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                       
                        {/* Sets Grid */}
                        <div style={{
                          border: `2px solid var(--${category.color})`,
                          borderTop: 'none',
                          borderRadius: '0 0 0.5rem 0.5rem',
                          padding: '1.5rem',
                          background: 'var(--bg-secondary)'
                        }}>
                          <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                            {sets.map((paper, index) => {
                              // Extract set number from paper title (e.g., "Paper Title - Set 5")
                              const setNumberMatch = paper.paper_title.match(/Set (\d+)$/);
                              const setNumber = setNumberMatch ? setNumberMatch[1] : (index + 1);
                             
                              return (
                                <div
                                  key={paper.paper_id}
                                  style={{
                                    padding: '1rem',
                                    background: 'white',
                                    borderRadius: '10px',
                                    border: `2px solid var(--${category.color})`,
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                                    textAlign: 'center'
                                  }}
                                >
                                  {/* Gradient Book Icon */}
                                  <div style={{
                                    width: '70px',
                                    height: '70px',
                                    margin: '0 auto 1rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'white',
                                    borderRadius: '50%',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                                  }}>
                                    <svg width="45" height="45" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      {/* Open book */}
                                      <path d="M20 25 L20 75 L48 70 L50 72 L52 70 L80 75 L80 25 L52 30 L50 28 L48 30 L20 25 Z"
                                            stroke="url(#bookGrad)"
                                            strokeWidth="3"
                                            fill="none"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"/>
                                      {/* Center spine */}
                                      <line x1="50" y1="28" x2="50" y2="72" stroke="url(#bookGrad)" strokeWidth="3"/>
                                      {/* Left page lines */}
                                      <line x1="28" y1="38" x2="44" y2="38" stroke="url(#bookGrad)" strokeWidth="2" strokeLinecap="round"/>
                                      <line x1="28" y1="48" x2="44" y2="48" stroke="url(#bookGrad)" strokeWidth="2" strokeLinecap="round"/>
                                      <line x1="28" y1="58" x2="44" y2="58" stroke="url(#bookGrad)" strokeWidth="2" strokeLinecap="round"/>
                                      {/* Right page lines */}
                                      <line x1="56" y1="38" x2="72" y2="38" stroke="url(#bookGrad)" strokeWidth="2" strokeLinecap="round"/>
                                      <line x1="56" y1="48" x2="72" y2="48" stroke="url(#bookGrad)" strokeWidth="2" strokeLinecap="round"/>
                                      <line x1="56" y1="58" x2="72" y2="58" stroke="url(#bookGrad)" strokeWidth="2" strokeLinecap="round"/>
                                      <defs>
                                        <linearGradient id="bookGrad" x1="20" y1="25" x2="80" y2="75" gradientUnits="userSpaceOnUse">
                                          <stop offset="0%" stopColor="#667eea"/>
                                          <stop offset="50%" stopColor="#a855f7"/>
                                          <stop offset="100%" stopColor="#ec4899"/>
                                        </linearGradient>
                                      </defs>
                                    </svg>
                                  </div>

                                  <div style={{ marginBottom: '1rem' }}>
                                    <div style={{ fontWeight: '700', fontSize: '1.25rem', marginBottom: '0.5rem', color: `var(--${category.color})` }}>
                                      Set {setNumber}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                      {paper.question_count} questions
                                    </div>
                                  </div>
                                  <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => handlePreviewPaper(paper.paper_id, paper.paper_title)}
                                    style={{ width: '100%' }}
                                  >
                                    👁️ Preview & Edit
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : finalizedPapers.length === 0 ? (
              <div className="card">
                <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <p style={{ fontSize: '3rem', margin: '0 0 1rem 0' }}>✅</p>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem', fontWeight: '600' }}>No finalized papers yet</p>
                  <p style={{ margin: 0, fontSize: '0.875rem' }}>
                    Papers will appear here after you categorize and save them
                  </p>
                </div>
              </div>
            ) : (
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Finalized Papers ({finalizedPapers.length})</h3>
                </div>
                <div style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    {finalizedPapers.map(paper => (
                      <div
                        key={paper.paper_id}
                        style={{
                          padding: '1.5rem',
                          background: 'var(--bg-secondary)',
                          borderRadius: '0.5rem',
                          border: '1px solid var(--success)',
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
                            <span style={{
                              padding: '0.25rem 0.75rem',
                              borderRadius: '1rem',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              color: 'var(--success)',
                              background: 'var(--success-light)',
                              border: '1px solid var(--success)'
                            }}>
                              ✅ Completed
                            </span>
                          </div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span>By: {paper.examiner_name || 'Unknown'}</span>
                            {/* <span>•</span>
                            <span>{paper.categorized_count} categorized papers</span> */}
                            <span>•</span>
                            <span>Completed: {new Date(paper.updated_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleViewFinalizedPaper(paper.paper_id)}
                        >
                          👁️ View Categorized Sets
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          ) : null}
        </>
      ) : (
        <>
          {selectedPaper && (
            <div className="card">
              <div style={{ padding: '1.5rem' }}>
                <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => navigate('/moderator-categorization')}
                  >
                    ← Back to Papers
                  </button>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {/* Only show Generate button when sets are not generated */}
                    {generated40Sets.length === 0 && (selectedPaper.status === 'pending_moderator' || selectedPaper.status === 'pending') && (
                      <button
                        className="btn btn-success"
                        onClick={() => handleGenerate40Sets()}
                        disabled={generating40Sets}
                        style={{ fontWeight: '600', fontSize: '1rem', padding: '0.75rem 1.5rem' }}
                      >
                        {generating40Sets ? '⏳ Generating...' : '🎯 Generate 40 Unique Sets'}
                      </button>
                    )}

                    {selectedPaper.status === 'finalized' && (
                      <button
                        className="btn btn-success"
                        onClick={() => {
                          // Navigate to approvals tab instead of showing modal
                          setActiveTab('approvals');
                          navigate('/moderator-categorization');
                        }}
                      >
                        ✅ View in Approvals
                      </button>
                    )}
                  </div>
                </div>

                {/* Only show paper title and 40 sets when sets are generated */}
                {generated40Sets.length === 0 && (
                  <>
                    <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                      {selectedPaper.paper_title}
                    </h3>

                    {/* Status Banner */}
                    {selectedPaper.status === 'finalized' && (
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
                        Paper Categorization Approved
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        3 papers have been created. Click "View in Approvals" to mark them as ready for use.
                      </div>
                    </div>
                  </div>
                )}

                {selectedPaper.status === 'approved' && (
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
                        Approved & Ready
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        This paper has been approved and is ready for use. You can download the PDFs below.
                      </div>
                    </div>
                  </div>
                )}

                {/* Show Categorized Papers */}
                {(selectedPaper.status === 'finalized' || selectedPaper.status === 'approved') && categorizedPapers.length > 0 && (
                  <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1rem' }}>📚 Categorized Papers</h3>
                    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
                      {categorizedPapers.map((paper, index) => {
                        const categoryColors = {
                          'General Exam': { bg: 'var(--primary-light)', border: 'var(--primary)', icon: '📘' },
                          'Re-Exam': { bg: 'var(--warning-light)', border: 'var(--warning)', icon: '📙' },
                          'Special Case': { bg: 'var(--info-light)', border: 'var(--info)', icon: '📗' }
                        };

                        const categoryName = paper.paper_title.includes('General Exam') ? 'General Exam'
                          : paper.paper_title.includes('Re-Exam') ? 'Re-Exam'
                            : 'Special Case';

                        const colors = categoryColors[categoryName];

                        return (
                          <div key={paper.paper_id} style={{
                            padding: '1.5rem',
                            background: colors.bg,
                            borderRadius: '0.5rem',
                            border: `2px solid ${colors.border}`
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                              <span style={{ fontSize: '1.5rem' }}>{colors.icon}</span>
                              <h4 style={{ margin: 0, fontSize: '1rem' }}>{categoryName}</h4>
                            </div>

                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                              <p style={{ margin: '0.25rem 0' }}>
                                <strong>{paper.question_count}</strong> questions
                              </p>
                              <p style={{ margin: '0.25rem 0' }}>
                                <strong>{paper.total_marks}</strong> marks
                              </p>
                              {/* <p style={{ margin: '0.25rem 0' }}>
                                Status: <strong style={{ color: paper.status === 'approved' ? 'var(--success)' : 'var(--warning)' }}>
                                  {paper.status === 'approved' ? 'Approved' : 'Draft'}
                                </strong>
                              </p> */}
                            </div>

                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handlePreviewPaper(paper.paper_id, paper.paper_title)}
                              style={{ width: '100%' }}
                            >
                              👁️ Preview & Edit
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                    <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem' }}>
                      <div className="stat-card" style={{ flex: 1 }}>
                        <div className="stat-label">Examiner</div>
                        <div className="stat-value" style={{ fontSize: '1rem' }}>
                          {selectedPaper.examiner_name}
                        </div>
                      </div>
                      <div className="stat-card" style={{ flex: 1 }}>
                        <div className="stat-label">Total Questions</div>
                        <div className="stat-value" style={{ fontSize: '1rem' }}>
                          {selectedPaper.questions?.length || 0}
                        </div>
                      </div>
                      {/* <div className="stat-card" style={{ flex: 1 }}>
                    <div className="stat-label">Total Marks</div>
                    <div className="stat-value" style={{ fontSize: '1rem' }}>
                      {selectedPaper.total_marks}
                    </div>
                  </div> */}
                    </div>
                  </>
                )}

                {/* Show 40 sets and categorization after generation */}
                {generated40Sets.length > 0 && (
                  <div style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ margin: 0 }}>📦 Generated 40 Sets</h3>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-primary"
                          onClick={handleAICategorize40Sets}
                          disabled={categorizingAI}
                        >
                          {categorizingAI ? '⏳ Categorizing...' : '🤖 AI Auto-Categorize'}
                        </button>
                        {(selectedSetsForCategories.general.length > 0 ||
                          selectedSetsForCategories.reexam.length > 0 ||
                          selectedSetsForCategories.special.length > 0) && (
                          <button
                            className="btn btn-success"
                            onClick={handleSaveCategorization}
                            disabled={savingCategorization}
                            style={{ fontWeight: '600' }}
                          >
                            {savingCategorization ? '⏳ Saving...' : '✅ Save & Move to Approvals'}
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{
                      marginBottom: '1.5rem',
                      padding: '1rem',
                      background: 'var(--info-light)',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--info)'
                    }}>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--info)' }}>
                        💡 {generated40Sets.length} sets generated. Use AI to auto-select top 3 or manually click on sets below to categorize them.
                      </p>
                    </div>

                    {/* Categorization Boxes */}
                    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '2rem' }}>
                      {[
                        { key: 'general', name: 'General Exam', icon: '📘', color: 'var(--primary)', bg: 'var(--primary-light)' },
                        { key: 'reexam', name: 'Re-Exam', icon: '📙', color: 'var(--warning)', bg: 'var(--warning-light)' },
                        { key: 'special', name: 'Special Case', icon: '📗', color: 'var(--info)', bg: 'var(--info-light)' }
                      ].map(cat => (
                        <div key={cat.key} style={{
                          padding: '1.5rem',
                          background: cat.bg,
                          borderRadius: '0.75rem',
                          border: `3px solid ${cat.color}`,
                          minHeight: '150px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                            <span style={{ fontSize: '2rem' }}>{cat.icon}</span>
                            <h4 style={{ margin: 0, color: cat.color, fontSize: '1.125rem', fontWeight: '700' }}>
                              {cat.name}
                            </h4>
                          </div>
                          {selectedSetsForCategories[cat.key].length > 0 ? (
                            <div style={{
                              padding: '1rem',
                              background: 'white',
                              borderRadius: '0.5rem',
                              border: `2px solid ${cat.color}`,
                              maxHeight: '200px',
                              overflowY: 'auto'
                            }}>
                              <div style={{ fontWeight: '600', marginBottom: '0.75rem', color: cat.color }}>
                                {selectedSetsForCategories[cat.key].length} set(s) selected
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {selectedSetsForCategories[cat.key].map(set => (
                                  <div key={set.set_number} style={{
                                    padding: '0.5rem',
                                    background: cat.bg,
                                    borderRadius: '0.25rem',
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                  }}>
                                    Set {set.set_number}
                                    <button
                                      onClick={() => handleToggleSetInCategory(set, cat.key)}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: '0',
                                        marginLeft: '0.25rem',
                                        color: 'var(--danger)',
                                        fontWeight: 'bold'
                                      }}
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div style={{
                              padding: '1rem',
                              background: 'white',
                              borderRadius: '0.5rem',
                              border: '2px dashed #ccc',
                              textAlign: 'center',
                              color: 'var(--text-secondary)',
                              fontSize: '0.875rem'
                            }}>
                              Click sets below to assign
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* 40 Sets Grid */}
                    <h4 style={{ marginBottom: '1rem' }}>All 40 Sets (Click to categorize)</h4>
                    <div style={{
                      display: 'grid',
                      gap: '1rem',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                      maxHeight: '600px',
                      overflowY: 'auto',
                      padding: '1rem',
                      background: 'var(--bg-secondary)',
                      borderRadius: '0.5rem'
                    }}>
                      {generated40Sets.map((set) => {
                        const assignedCategory = getSetCategory(set.set_number);
                        const isAssigned = assignedCategory !== null;
                       
                        return (
                          <div
                            key={set.set_number}
                            style={{
                              padding: '1rem',
                              background: isAssigned ? 'var(--success-light)' : 'white',
                              borderRadius: '0.5rem',
                              border: isAssigned ? '2px solid var(--success)' : '2px solid var(--border-color)',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            onClick={() => {
                              setSetToAssign({ set, currentCategory: assignedCategory });
                              setShowCategorySelectModal(true);
                            }}
                            onMouseEnter={(e) => {
                              if (!isAssigned) {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                          >
                            <div style={{ fontWeight: '600', marginBottom: '0.5rem', fontSize: '1.125rem' }}>
                              Set {set.set_number}
                            </div>
                            {isAssigned && (
                              <div style={{
                                fontSize: '0.75rem',
                                color: 'var(--success)',
                                fontWeight: '600',
                                marginBottom: '0.5rem'
                              }}>
                                ✓ {assignedCategory}
                              </div>
                            )}
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewSet(set);
                              }}
                              style={{ width: '100%', fontSize: '0.75rem' }}
                            >
                              👁️ View Questions
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Only show questions section when 40 sets are NOT generated */}
                {generated40Sets.length === 0 && selectedPaper.questions && selectedPaper.questions.length > 0 && (
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
                          {q.sub_question_count > 0 && (
                            <span className="badge badge-secondary">
                              {q.sub_question_count} sub-questions
                            </span>
                          )}
                        </div>

                        {q.sub_questions && q.sub_questions.length > 0 && (
                          <div style={{ marginTop: '1rem' }}>
                            <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>
                              📋 Sub-Questions ({q.sub_questions.length})
                            </h4>
                            {q.sub_questions.map((subQ, subIndex) => {
                              const isExpanded = expandedSubQuestions[`${index}-${subIndex}`];

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
                                        {subQ.full_question_number}
                                      </strong>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                      <span className="badge badge-info">{subQ.question_type}</span>
                                      <span className="badge badge-success">{subQ.marks} marks</span>
                                      {subQ.variations && subQ.variations.length > 0 && (
                                        <span className="badge badge-primary">{subQ.variations.length} variations</span>
                                      )}
                                    </div>
                                  </div>

                                  {isExpanded && (
                                    <div
                                      ref={el => variationsRefs.current[subQ.sub_question_id] = el}
                                      style={{ padding: '1rem', background: 'var(--bg-primary)' }}
                                    >
                                      {/* Show loading state */}
                                      {variationsPagination[subQ.sub_question_id]?.loading && (
                                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                                          <div className="spinner"></div>
                                          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading variations...</p>
                                        </div>
                                      )}

                                      {/* Show variations */}
                                      {!variationsPagination[subQ.sub_question_id]?.loading && (paginatedVariations[subQ.sub_question_id] || subQ.variations || []).length > 0 && (
                                        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))' }}>
                                          {(paginatedVariations[subQ.sub_question_id] || subQ.variations || []).map((variation, varIndex) => (
                                          <div key={varIndex} style={{
                                            padding: '1rem',
                                            background: 'var(--bg-secondary)',
                                            borderRadius: '0.5rem',
                                            border: '2px solid var(--success)'
                                          }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>
                                                  Variation {variation.variation_number}
                                                </span>
                                                <QuestionMetadataInfo question={variation} />
                                              </div>
                                              <span style={{
                                                padding: '0.25rem 0.75rem',
                                                borderRadius: '1rem',
                                                fontSize: '0.75rem',
                                                fontWeight: '500',
                                                color: 'var(--success)',
                                                background: 'var(--success-light)',
                                                border: '1px solid var(--success)'
                                              }}>
                                                ✓ Selected by SME
                                              </span>
                                            </div>

                                            <p style={{ fontSize: '0.875rem', marginBottom: '0.75rem', lineHeight: '1.4' }}>
                                              {variation.question_text}
                                            </p>

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

                                            {variation.correct_answer && (
                                              <div style={{ padding: '0.5rem', background: 'var(--success-light)', borderRadius: '0.25rem', marginBottom: '0.75rem' }}>
                                                <strong style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Answer:</strong>
                                                <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                                                  {variation.correct_answer}
                                                </div>
                                              </div>
                                            )}

                                            {variation.sme_comments && (
                                              <div style={{ padding: '0.5rem', background: 'var(--info-light)', borderRadius: '0.25rem', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                                                <strong style={{ color: 'var(--info)' }}>SME Comments:</strong>
                                                <div style={{ marginTop: '0.25rem' }}>{variation.sme_comments}</div>
                                              </div>
                                            )}

                                            {/* Show which categories this variation is in */}
                                            {getVariationCategories(variation.variation_id).length > 0 && (
                                              <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                                  In categories:
                                                </span>
                                                {getVariationCategories(variation.variation_id).map(cat => (
                                                  <span key={cat} style={{
                                                    padding: '0.25rem 0.5rem',
                                                    borderRadius: '0.25rem',
                                                    fontSize: '0.7rem',
                                                    fontWeight: '600',
                                                    background: cat === 'general' ? 'var(--primary-light)' : cat === 'reexam' ? 'var(--warning-light)' : 'var(--info-light)',
                                                    color: cat === 'general' ? 'var(--primary)' : cat === 'reexam' ? 'var(--warning)' : 'var(--info)',
                                                    border: `1px solid ${cat === 'general' ? 'var(--primary)' : cat === 'reexam' ? 'var(--warning)' : 'var(--info)'}`
                                                  }}>
                                                    {cat === 'general' && '📘 General'}
                                                    {cat === 'reexam' && '📙 Re-Exam'}
                                                    {cat === 'special' && '📗 Special'}
                                                  </span>
                                                ))}
                                              </div>
                                            )}

                                            {/* Category Assignment Buttons
                                            <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                                              <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                                                Add to:
                                              </div>
                                              <button
                                                className={`btn btn-sm ${isVariationInCategory(variation.variation_id, 'general') ? 'btn-primary' : 'btn-secondary'}`}
                                                onClick={() => handleAddVariationToCategory(variation, 'general', subQ.sub_question_id, subQ.full_question_number)}
                                                disabled={isVariationInCategory(variation.variation_id, 'general')}
                                                style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}
                                                title="Add to General Exam"
                                              >
                                                📘 {isVariationInCategory(variation.variation_id, 'general') ? '✓ General' : 'General'}
                                              </button>
                                              <button
                                                className={`btn btn-sm ${isVariationInCategory(variation.variation_id, 'reexam') ? 'btn-warning' : 'btn-secondary'}`}
                                                onClick={() => handleAddVariationToCategory(variation, 'reexam', subQ.sub_question_id, subQ.full_question_number)}
                                                disabled={isVariationInCategory(variation.variation_id, 'reexam')}
                                                style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}
                                                title="Add to Re-Exam"
                                              >
                                                📙 {isVariationInCategory(variation.variation_id, 'reexam') ? '✓ Re-Exam' : 'Re-Exam'}
                                              </button>
                                              <button
                                                className={`btn btn-sm ${isVariationInCategory(variation.variation_id, 'special') ? 'btn-info' : 'btn-secondary'}`}
                                                onClick={() => handleAddVariationToCategory(variation, 'special', subQ.sub_question_id, subQ.full_question_number)}
                                                disabled={isVariationInCategory(variation.variation_id, 'special')}
                                                style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}
                                                title="Add to Special Case"
                                              >
                                                📗 {isVariationInCategory(variation.variation_id, 'special') ? '✓ Special' : 'Special'}
                                              </button>
                                            </div> */}
                                          </div>
                                        ))}
                                        </div>
                                      )}

                                      {/* Show message if no variations */}
                                      {!variationsPagination[subQ.sub_question_id]?.loading && (paginatedVariations[subQ.sub_question_id] || subQ.variations || []).length === 0 && (
                                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                          <p>No variations available for this sub-question.</p>
                                        </div>
                                      )}

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
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {(!selectedPaper.questions || selectedPaper.questions.length === 0) && (
                  <div style={{
                    textAlign: 'center',
                    padding: '4rem 2rem',
                    background: 'var(--bg-secondary)',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-color)'
                  }}>
                    <p style={{ fontSize: '3rem', margin: '0 0 1rem 0' }}>📋</p>
                    <p style={{ color: 'var(--text-secondary)', margin: '0 0 0.5rem 0', fontSize: '1.125rem' }}>
                      No questions with variations found
                    </p>
                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.875rem' }}>
                      This paper doesn't have any sub-questions with approved variations from SME.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Category Selection Modal */}
      {showCategorySelectModal && setToAssign && (
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
          zIndex: 9999
        }}>
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: '1rem',
            padding: '2rem',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            border: '1px solid var(--border-color)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Select Category for Set {setToAssign.set.set_number}</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Current: {setToAssign.currentCategory ? setToAssign.currentCategory.toUpperCase() : 'None'}
            </p>
           
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              {[
                { key: 'general', name: 'General Exam', icon: '📘', color: 'var(--primary)' },
                { key: 'reexam', name: 'Re-Exam', icon: '📙', color: 'var(--warning)' },
                { key: 'special', name: 'Special Case', icon: '📗', color: 'var(--info)' }
              ].map(cat => (
                <button
                  key={cat.key}
                  onClick={() => {
                    // Remove from current category if assigned
                    if (setToAssign.currentCategory) {
                      handleToggleSetInCategory(setToAssign.set, setToAssign.currentCategory);
                    }
                    // Add to new category if different
                    if (cat.key !== setToAssign.currentCategory) {
                      handleToggleSetInCategory(setToAssign.set, cat.key);
                    }
                    setShowCategorySelectModal(false);
                    setSetToAssign(null);
                  }}
                  style={{
                    padding: '1rem',
                    background: setToAssign.currentCategory === cat.key ? cat.color : 'var(--bg-secondary)',
                    color: setToAssign.currentCategory === cat.key ? 'white' : 'var(--text-primary)',
                    border: `2px solid ${cat.color}`,
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (setToAssign.currentCategory !== cat.key) {
                      e.currentTarget.style.background = cat.color;
                      e.currentTarget.style.color = 'white';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (setToAssign.currentCategory !== cat.key) {
                      e.currentTarget.style.background = 'var(--bg-secondary)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }
                  }}
                >
                  <span style={{ fontSize: '1.5rem' }}>{cat.icon}</span>
                  {cat.name}
                  {setToAssign.currentCategory === cat.key && <span style={{ marginLeft: 'auto' }}>✓</span>}
                </button>
              ))}
            </div>

            {setToAssign.currentCategory && (
              <button
                onClick={() => {
                  handleToggleSetInCategory(setToAssign.set, setToAssign.currentCategory);
                  setShowCategorySelectModal(false);
                  setSetToAssign(null);
                }}
                className="btn btn-danger"
                style={{ width: '100%', marginBottom: '1rem' }}
              >
                Remove from {setToAssign.currentCategory.toUpperCase()}
              </button>
            )}

            <button
              onClick={() => {
                setShowCategorySelectModal(false);
                setSetToAssign(null);
              }}
              className="btn btn-secondary"
              style={{ width: '100%' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && confirmModalData && (
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
          zIndex: 9999
        }}>
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: '1rem',
            padding: '2rem',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            border: '1px solid var(--border-color)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>{confirmModalData.title}</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
              {confirmModalData.message}
            </p>
           
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmModalData(null);
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmModalData.onConfirm();
                  setConfirmModalData(null);
                }}
                className="btn btn-success"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Insufficient Variations Modal */}
      {showInsufficientVariationsModal && insufficientVariationsData && (
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
          zIndex: 9999
        }}>
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: '1rem',
            padding: '2rem',
            maxWidth: '600px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            border: '1px solid var(--border-color)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--error)' }}>
              ⚠️ Cannot Generate 40 Sets Yet
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
              Please generate more variations for the following sub-questions:
            </p>
           
            <div style={{
              background: 'var(--bg-secondary)',
              padding: '1rem',
              borderRadius: '0.5rem',
              marginBottom: '1.5rem',
              maxHeight: '300px',
              overflowY: 'auto'
            }}>
              {insufficientVariationsData.map((detail, index) => (
                <div key={index} style={{
                  padding: '0.75rem',
                  marginBottom: index < insufficientVariationsData.length - 1 ? '0.5rem' : 0,
                  background: 'var(--bg-primary)',
                  borderRadius: '0.375rem',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ fontWeight: '600', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                    {detail.sub_question}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    Current: <span style={{ color: 'var(--error)', fontWeight: '600' }}>{detail.current}</span> /
                    Needed: <span style={{ color: 'var(--success)', fontWeight: '600' }}>{detail.needed}</span> variations
                  </div>
                </div>
              ))}
            </div>

            <p style={{
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
              marginBottom: '1.5rem',
              padding: '0.75rem',
              background: 'var(--warning-light)',
              borderRadius: '0.375rem',
              border: '1px solid var(--warning)'
            }}>
              💡 Go to each sub-question and generate at least 40 variations before creating the 40 sets.
            </p>
           
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowInsufficientVariationsModal(false);
                  setInsufficientVariationsData(null);
                }}
                className="btn btn-primary"
              >
                OK, Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Set Modal */}
      {viewingSet && (
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
          zIndex: 9999,
          padding: '2rem'
        }}>
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: '1rem',
            padding: '2rem',
            maxWidth: '900px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>📄 Set {viewingSet.set_number} - Questions</h2>
              <button
                className="btn btn-secondary"
                onClick={() => setViewingSet(null)}
              >
                ✕ Close
              </button>
            </div>

            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '2rem' }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Total Questions:</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>
                    {viewingSet.questions?.length || 0}
                  </div>
                </div>
              </div>
            </div>

            {loadingSetDetails ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <div className="spinner"></div>
                <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading questions...</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {viewingSet.questions && viewingSet.questions.length > 0 ? (
                  viewingSet.questions.map((q, index) => {
                    // Check if this is a grouped question
                    if (q.sub_questions && q.sub_questions.length > 0) {
                      // Render grouped question
                      return (
                        <div key={index} style={{ marginBottom: '2rem' }}>
                          <div style={{
                            padding: '0.75rem 1rem',
                            background: 'var(--primary)',
                            color: 'white',
                            borderRadius: '0.5rem 0.5rem 0 0',
                            fontSize: '1.25rem',
                            fontWeight: 'bold'
                          }}>
                            {q.main_question_number}
                          </div>
                          {q.sub_questions.map((subQ, subIndex) => (
                            <div key={subIndex} style={{
                              padding: '1.5rem',
                              background: 'var(--bg-secondary)',
                              borderRadius: subIndex === q.sub_questions.length - 1 ? '0 0 0.5rem 0.5rem' : '0',
                              border: '1px solid var(--border-color)',
                              borderTop: subIndex === 0 ? 'none' : '1px solid var(--border-color)'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                <strong style={{ fontSize: '1.125rem', color: 'var(--primary)' }}>
                                  {subQ.sub_question_number || `${q.main_question_number}.${subIndex + 1}`}
                                </strong>
                                {subQ.question_type && (
                                  <span className={`badge badge-${subQ.question_type === 'mcq' ? 'primary' : 'info'}`}>
                                    {subQ.question_type === 'mcq' ? 'MCQ' : subQ.question_type}
                                  </span>
                                )}
                                {subQ.marks && (
                                  <span className="badge badge-success">{subQ.marks} marks</span>
                                )}
                              </div>

                              <p style={{ margin: '0 0 1rem 0', lineHeight: '1.6' }}>
                                {subQ.question_text || 'No question text'}
                              </p>

                              {subQ.question_type === 'mcq' && subQ.options && (
                                <div style={{ marginTop: '1rem' }}>
                                  {(typeof subQ.options === 'string' ? JSON.parse(subQ.options) : subQ.options).map((opt, optIndex) => (
                                    <div key={optIndex} style={{
                                      padding: '0.75rem',
                                      marginBottom: '0.5rem',
                                      background: 'var(--bg-primary)',
                                      borderRadius: '0.375rem',
                                      border: '1px solid var(--border-color)'
                                    }}>
                                      {opt}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {subQ.correct_answer && (
                                <div style={{
                                  marginTop: '1rem',
                                  padding: '0.75rem',
                                  background: 'var(--success-light)',
                                  borderRadius: '0.375rem',
                                  border: '1px solid var(--success)'
                                }}>
                                  <strong style={{ color: 'var(--success)' }}>Answer:</strong> {subQ.correct_answer}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    } else {
                      // Render flat question
                      return (
                        <div key={index} style={{
                          padding: '1.5rem',
                          background: 'var(--bg-secondary)',
                          borderRadius: '0.5rem',
                          border: '1px solid var(--border-color)',
                          marginBottom: '1rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                            <strong style={{ fontSize: '1.125rem', color: 'var(--primary)' }}>
                              {q.question_text?.match(/^Q\.\d+\.\d+\)/)?.[0] || `Q${index + 1}`}
                            </strong>
                            {q.question_type && (
                              <span className={`badge badge-${q.question_type === 'mcq' ? 'primary' : 'info'}`}>
                                {q.question_type === 'mcq' ? 'MCQ' : q.question_type}
                              </span>
                            )}
                            {q.marks && (
                              <span className="badge badge-success">{q.marks} marks</span>
                            )}
                          </div>

                          <p style={{ margin: '0 0 1rem 0', lineHeight: '1.6' }}>
                            {q.question_text?.replace(/^Q\.\d+\.\d+\)\s*/, '') || 'No question text'}
                          </p>

                          {q.question_type === 'mcq' && q.options && (
                            <div style={{ marginTop: '1rem' }}>
                              {(typeof q.options === 'string' ? JSON.parse(q.options) : q.options).map((opt, optIndex) => (
                                <div key={optIndex} style={{
                                  padding: '0.75rem',
                                  marginBottom: '0.5rem',
                                  background: 'var(--bg-primary)',
                                  borderRadius: '0.375rem',
                                  border: '1px solid var(--border-color)'
                                }}>
                                  {opt}
                                </div>
                              ))}
                            </div>
                          )}

                          {q.correct_answer && (
                            <div style={{
                              marginTop: '1rem',
                              padding: '0.75rem',
                              background: 'var(--success-light)',
                              borderRadius: '0.375rem',
                              border: '1px solid var(--success)'
                            }}>
                              <strong style={{ color: 'var(--success)' }}>Answer:</strong> {q.correct_answer}
                            </div>
                          )}
                        </div>
                      );
                    }
                  })
                ) : (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    <p>No questions found in this set</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
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
              border: '4px solid var(--primary-light)',
              borderTop: '4px solid var(--primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>

            <h3 style={{
              margin: '0 0 1rem 0',
              color: 'var(--primary)',
              fontSize: '1.5rem'
            }}>
              AI Categorization
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
              Please wait while AI categorizes variations into 3 sets...
            </p>
          </div>
        </div>
      )}

      {/* Save Categorization Confirmation Modal */}
      {showSaveModal && (
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
            <div className="card-header" style={{ background: 'var(--success-light)', borderBottom: '2px solid var(--success)' }}>
              <h3 className="card-title" style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.5rem' }}>💾</span>
                Save Categorization
              </h3>
            </div>
            <div style={{ padding: '2rem' }}>
              <p style={{ fontSize: '1rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                Save categorization and create 3 final papers?
              </p>

              <div style={{
                background: 'var(--info-light)',
                border: '1px solid var(--info)',
                borderRadius: '0.5rem',
                padding: '1rem',
                marginBottom: '1.5rem'
              }}>
                <div style={{ fontWeight: '600', marginBottom: '0.75rem', color: 'var(--info)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>📄</span>
                  This will create:
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.5rem', color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                  <li style={{ marginBottom: '0.5rem' }}>General Exam paper</li>
                  <li style={{ marginBottom: '0.5rem' }}>Re-Exam paper</li>
                  <li>Special Case paper</li>
                </ul>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="btn btn-secondary"
                  disabled={savingCategorization}
                  style={{ minWidth: '100px' }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSaveCategorization}
                  className="btn btn-success"
                  disabled={savingCategorization}
                  style={{ minWidth: '150px' }}
                >
                  {savingCategorization ? (
                    <>
                      <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px', marginRight: '0.5rem' }}></span>
                      Saving...
                    </>
                  ) : (
                    <>💾 Yes, Save & Create</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Final Approval Confirmation Modal */}
      {showApprovalModal && (
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
            <div className="card-header" style={{ background: 'var(--success-light)', borderBottom: '2px solid var(--success)' }}>
              <h3 className="card-title" style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.5rem' }}>✅</span>
                Final Approval
              </h3>
            </div>
            <div style={{ padding: '2rem' }}>
              <p style={{ fontSize: '1rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                Give final approval to this paper?
              </p>

              <div style={{
                background: 'var(--success-light)',
                border: '1px solid var(--success)',
                borderRadius: '0.5rem',
                padding: '1rem',
                marginBottom: '1.5rem'
              }}>
                <div style={{ fontWeight: '600', marginBottom: '0.5rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>✓</span>
                  This will:
                </div>
                <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                  Mark the paper as approved and ready for use
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowApprovalModal(false);
                    setPaperToApprove(null);
                  }}
                  className="btn btn-secondary"
                  disabled={approvingFinal}
                  style={{ minWidth: '100px' }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmFinalApprove}
                  className="btn btn-success"
                  disabled={approvingFinal}
                  style={{ minWidth: '150px' }}
                >
                  {approvingFinal ? (
                    <>
                      <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px', marginRight: '0.5rem' }}></span>
                      Approving...
                    </>
                  ) : (
                    <>✅ Yes, Approve</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Replace Variation Confirmation Modal */}
      {showReplaceModal && replaceModalData && (
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
          <div className="card" style={{ width: '600px', maxWidth: '90%' }}>
            <div className="card-header" style={{ background: 'var(--warning-light)', borderBottom: '2px solid var(--warning)' }}>
              <h3 className="card-title" style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                Replace Existing Variation{replaceModalData.isAI && replaceModalData.conflicts?.length > 1 ? 's' : ''}?
              </h3>
            </div>
            <div style={{ padding: '2rem' }}>
              {replaceModalData.isAI ? (
                <>
                  <p style={{ fontSize: '1rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                    AI categorization found <strong>{replaceModalData.conflicts.length} conflict{replaceModalData.conflicts.length > 1 ? 's' : ''}</strong> with existing variations:
                  </p>

                  <div style={{
                    maxHeight: '300px',
                    overflowY: 'auto',
                    marginBottom: '1.5rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '0.5rem'
                  }}>
                    {replaceModalData.conflicts.map((conflict, index) => {
                      const categoryName = conflict.category === 'general' ? 'General Exam' : conflict.category === 'reexam' ? 'Re-Exam' : 'Special Case';
                      const categoryIcon = conflict.category === 'general' ? '📘' : conflict.category === 'reexam' ? '📙' : '📗';

                      return (
                        <div key={index} style={{
                          padding: '1rem',
                          borderBottom: index < replaceModalData.conflicts.length - 1 ? '1px solid var(--border-color)' : 'none',
                          background: index % 2 === 0 ? 'var(--bg-secondary)' : 'var(--bg-primary)'
                        }}>
                          <div style={{ marginBottom: '0.5rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                            {categoryIcon} {categoryName} - {conflict.aiVariation.full_question_number || 'Question'}
                          </div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            <div style={{ marginBottom: '0.25rem' }}>
                              Current: <span style={{ color: 'var(--error)' }}>Variation {conflict.existingVariation.variation_number}</span>
                            </div>
                            <div>
                              AI wants: <span style={{ color: 'var(--success)' }}>Variation {conflict.aiVariation.variation_number}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{
                    background: 'var(--info-light)',
                    border: '1px solid var(--info)',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{ fontWeight: '600', marginBottom: '0.5rem', color: 'var(--info)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.25rem' }}>💡</span>
                      Choose an option:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.5rem', color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                      <li style={{ marginBottom: '0.5rem' }}><strong>Replace All:</strong> Use AI's new variations</li>
                      <li><strong>Keep Existing:</strong> Keep your current variations, add only non-conflicting ones</li>
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ fontSize: '1rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                    Sub-question <strong>{replaceModalData.fullQuestionNumber}</strong> already has a variation in{' '}
                    <strong>{replaceModalData.category === 'general' ? 'General Exam' : replaceModalData.category === 'reexam' ? 'Re-Exam' : 'Special Case'}</strong>
                  </p>

                  <div style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--error)', marginBottom: '0.5rem' }}>
                        Current: Variation {replaceModalData.existingVariation.variation_number}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        {replaceModalData.existingVariation.question_text?.substring(0, 100)}...
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--success)', marginBottom: '0.5rem' }}>
                        New: Variation {replaceModalData.variation.variation_number}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        {replaceModalData.variation.question_text?.substring(0, 100)}...
                      </div>
                    </div>
                  </div>

                  <div style={{
                    background: 'var(--warning-light)',
                    border: '1px solid var(--warning)',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{ fontWeight: '600', marginBottom: '0.5rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.25rem' }}>⚠️</span>
                      Note
                    </div>
                    <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                      Only one variation per sub-question is allowed in each category. Do you want to replace the existing one?
                    </p>
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={cancelReplaceVariation}
                  className="btn btn-secondary"
                  style={{ minWidth: '120px' }}
                >
                  {replaceModalData.isAI ? '🔒 Keep Existing' : 'Cancel'}
                </button>
                <button
                  onClick={confirmReplaceVariation}
                  className="btn btn-warning"
                  style={{ minWidth: '150px' }}
                >
                  {replaceModalData.isAI ? '🔄 Replace All' : '🔄 Yes, Replace'}
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
        
        @keyframes pulse {
          0%, 100% { 
            opacity: 1;
            transform: scale(1);
          }
          50% { 
            opacity: 0.8;
            transform: scale(1.05);
          }
        }
      `}</style>

      {/* PDF Preview and Edit Modal */}
      {previewingPaper && (
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
          zIndex: 10000,
          padding: '2rem'
        }}>
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: '1rem',
            maxWidth: '900px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            border: '1px solid var(--border-color)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>
                📄 Preview & Edit: {previewingPaper.paper_title}
              </h3>
              <button
                onClick={() => {
                  setPreviewingPaper(null);
                  setEditingPaperContent(null);
                  setIsMockTest(false);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)'
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{
              padding: '1.5rem',
              overflowY: 'auto',
              flex: 1
            }}>
              {loadingPreview ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <div className="spinner"></div>
                  <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading preview...</p>
                </div>
              ) : (
                <>
                  {/* Editable Header */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      Paper Header:
                    </label>
                    <textarea
                      value={editingPaperContent?.header || ''}
                      onChange={(e) => setEditingPaperContent({ ...editingPaperContent, header: e.target.value })}
                      placeholder="Enter paper header in any language (English, Hindi, Marathi, Urdu, etc.)"
                      dir="auto"
                      lang="mul"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '1rem',
                        fontFamily: 'system-ui, -apple-system, "Segoe UI", "Noto Sans", "Noto Sans Devanagari", "Noto Sans Arabic", sans-serif',
                        resize: 'vertical',
                        minHeight: '100px',
                        lineHeight: '1.6',
                        unicodeBidi: 'plaintext'
                      }}
                    />
                   
                    {/* Mock Test Checkbox */}
                    <div style={{
                      marginTop: '1rem',
                      padding: '1rem 1.25rem',
                      background: isMockTest ? '#fff3cd' : 'var(--bg-secondary)',
                      borderRadius: '0.75rem',
                      border: isMockTest ? '2px solid #ff9800' : '2px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      transition: 'all 0.3s ease',
                      boxShadow: isMockTest ? '0 4px 12px rgba(255, 152, 0, 0.2)' : 'none',
                      cursor: 'pointer'
                    }}
                    onClick={() => setIsMockTest(!isMockTest)}
                    >
                      <input
                        type="checkbox"
                        id="mockTestCheckbox"
                        checked={isMockTest}
                        onChange={(e) => setIsMockTest(e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: '22px',
                          height: '22px',
                          cursor: 'pointer',
                          accentColor: '#ff9800'
                        }}
                      />
                      <label
                        htmlFor="mockTestCheckbox"
                        style={{
                          fontWeight: '700',
                          color: isMockTest ? '#ff6b00' : 'var(--text-primary)',
                          cursor: 'pointer',
                          userSelect: 'none',
                          flex: 1,
                          fontSize: '1.05rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span style={{ fontSize: '1.5rem' }}>📝</span>
                        <span>Print "Mock Test" on PDF</span>
                      </label>
                      {isMockTest && (
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          background: '#ff9800',
                          color: 'white',
                          borderRadius: '1rem',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          animation: 'pulse 2s infinite'
                        }}>
                          ACTIVE
                        </span>
                      )}
                    </div>
                   
                    {/* Preview of how header will look */}
                    {isMockTest && (
                      <div style={{
                        marginTop: '1rem',
                        padding: '1.25rem',
                        background: 'linear-gradient(135deg, #fff3cd 0%, #ffe8a1 100%)',
                        border: '2px solid #ff9800',
                        borderRadius: '0.75rem',
                        color: '#856404',
                        boxShadow: '0 4px 12px rgba(255, 152, 0, 0.15)'
                      }}>
                        <div style={{ 
                          fontWeight: '700', 
                          marginBottom: '0.75rem', 
                          fontSize: '1rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          color: '#ff6b00'
                        }}>
                          <span style={{ fontSize: '1.25rem' }}>📄</span>
                          <span>Preview: Header will appear as:</span>
                        </div>
                        <div style={{
                          whiteSpace: 'pre-wrap',
                          fontFamily: 'system-ui, -apple-system, "Segoe UI", "Noto Sans", "Noto Sans Devanagari", "Noto Sans Arabic", sans-serif',
                          fontSize: '0.95rem',
                          lineHeight: '1.6',
                          padding: '1rem',
                          background: 'white',
                          borderRadius: '0.5rem',
                          border: '2px solid #ff9800',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
                        }}>
                          {editingPaperContent?.header}
                          {editingPaperContent?.header && '\n\n'}
                          <strong style={{ 
                            color: '#ff6b00', 
                            fontSize: '1.1rem',
                            textDecoration: 'underline',
                            textDecorationColor: '#ff9800'
                          }}>Mock Test</strong>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Editable Instructions */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      Paper Instructions:
                    </label>
                    <textarea
                      value={editingPaperContent?.instructions || ''}
                      onChange={(e) => setEditingPaperContent({ ...editingPaperContent, instructions: e.target.value })}
                      placeholder="Enter paper instructions in any language (e.g., Instructions:\n1. Answer all questions.\n2. All questions carry equal marks.)"
                      dir="auto"
                      lang="mul"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '1rem',
                        fontFamily: 'system-ui, -apple-system, "Segoe UI", "Noto Sans", "Noto Sans Devanagari", "Noto Sans Arabic", sans-serif',
                        resize: 'vertical',
                        minHeight: '120px',
                        lineHeight: '1.6',
                        unicodeBidi: 'plaintext'
                      }}
                    />
                  </div>

                  {/* Editable Questions */}
                  <div style={{
                    padding: '1.5rem',
                    background: 'var(--bg-secondary)',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-color)',
                    marginBottom: '1.5rem'
                  }}>
                    <h4 style={{ marginTop: 0, color: 'var(--text-primary)' }}>
                      Questions ({previewingPaper.questions?.length || 0})
                      {previewingPaper.questions?.length > 0 && previewingPaper.questions[0]?.sub_questions &&
                        ` - ${previewingPaper.questions.reduce((sum, q) => sum + (q.sub_questions?.length || 1), 0)} total sub-questions`
                      }
                    </h4>
                    {previewingPaper.questions && previewingPaper.questions.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {previewingPaper.questions.map((q, index) => {
                          // Check if this is a grouped question
                          if (q.sub_questions && q.sub_questions.length > 0) {
                            // Render grouped question
                            return (
                              <div key={index} style={{
                                padding: '1rem',
                                background: 'var(--bg-primary)',
                                borderRadius: '0.375rem',
                                border: '2px solid var(--primary)'
                              }}>
                                <div style={{ marginBottom: '1rem', padding: '0.5rem', background: 'var(--primary-light)', borderRadius: '0.25rem' }}>
                                  <strong style={{ fontSize: '1rem', color: 'var(--primary)' }}>{q.main_question_number}</strong>
                                </div>
                                {/* Editable instruction for this main question */}
                                <div style={{ marginBottom: '1rem' }}>
                                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                    Instruction (e.g., "Select the correct alternative:" or "Answer the following:"):
                                  </label>
                                  <input
                                    type="text"
                                    value={q.instruction || (q.sub_questions?.[0]?.question_type === 'mcq' ? 'Select the correct alternative:' : 'Answer the following:')}
                                    onChange={(e) => {
                                      const updatedQuestions = [...previewingPaper.questions];
                                      updatedQuestions[index].instruction = e.target.value;
                                      setPreviewingPaper({ ...previewingPaper, questions: updatedQuestions });
                                    }}
                                    placeholder="Enter instruction for this question group"
                                    dir="auto"
                                    style={{
                                      width: '100%',
                                      padding: '0.5rem',
                                      borderRadius: '0.375rem',
                                      border: '1px solid var(--border-color)',
                                      background: 'white',
                                      color: 'var(--text-primary)',
                                      fontSize: '0.875rem',
                                      fontFamily: 'system-ui, -apple-system, "Segoe UI", "Noto Sans", "Noto Sans Devanagari", "Noto Sans Arabic", sans-serif'
                                    }}
                                  />
                                </div>
                                {q.sub_questions.map((subQ, subIndex) => (
                                  <div key={subIndex} style={{
                                    marginBottom: '1rem',
                                    padding: '0.75rem',
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '0.375rem',
                                    border: '1px solid var(--border-color)'
                                  }}>
                                    <div style={{ marginBottom: '0.75rem' }}>
                                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                        {subQ.sub_question_number}:
                                      </label>
                                      <textarea
                                        value={subQ.question_text}
                                        onChange={(e) => {
                                          const updatedQuestions = [...previewingPaper.questions];
                                          updatedQuestions[index].sub_questions[subIndex].question_text = e.target.value;
                                          setPreviewingPaper({ ...previewingPaper, questions: updatedQuestions });
                                        }}
                                        dir="auto"
                                        lang="mul"
                                        style={{
                                          width: '100%',
                                          padding: '0.5rem',
                                          borderRadius: '0.375rem',
                                          border: '1px solid var(--border-color)',
                                          background: 'white',
                                          color: 'var(--text-primary)',
                                          fontSize: '0.875rem',
                                          fontFamily: 'system-ui, -apple-system, "Segoe UI", "Noto Sans", "Noto Sans Devanagari", "Noto Sans Arabic", sans-serif',
                                          resize: 'vertical',
                                          minHeight: '60px',
                                          lineHeight: '1.5'
                                        }}
                                      />
                                    </div>
                                    {subQ.options && (
                                      <div style={{ marginBottom: '0.5rem' }}>
                                        <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                          Options:
                                        </label>
                                        {subQ.options.map((opt, optIndex) => (
                                          <div key={optIndex} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                                            <input
                                              type="text"
                                              value={opt}
                                              onChange={(e) => {
                                                const updatedQuestions = [...previewingPaper.questions];
                                                const updatedOptions = [...updatedQuestions[index].sub_questions[subIndex].options];
                                                updatedOptions[optIndex] = e.target.value;
                                                updatedQuestions[index].sub_questions[subIndex].options = updatedOptions;
                                                setPreviewingPaper({ ...previewingPaper, questions: updatedQuestions });
                                              }}
                                              dir="auto"
                                              style={{
                                                flex: 1,
                                                padding: '0.375rem 0.5rem',
                                                borderRadius: '0.25rem',
                                                border: '1px solid var(--border-color)',
                                                background: 'white',
                                                color: 'var(--text-primary)',
                                                fontSize: '0.875rem',
                                                fontFamily: 'system-ui, -apple-system, "Segoe UI", "Noto Sans", "Noto Sans Devanagari", "Noto Sans Arabic", sans-serif'
                                              }}
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                      <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                        Marks:
                                      </label>
                                      <input
                                        type="number"
                                        value={subQ.marks}
                                        onChange={(e) => {
                                          const updatedQuestions = [...previewingPaper.questions];
                                          updatedQuestions[index].sub_questions[subIndex].marks = parseInt(e.target.value) || 0;
                                          setPreviewingPaper({ ...previewingPaper, questions: updatedQuestions });
                                        }}
                                        min="1"
                                        style={{
                                          width: '80px',
                                          padding: '0.375rem 0.5rem',
                                          borderRadius: '0.25rem',
                                          border: '1px solid var(--border-color)',
                                          background: 'white',
                                          color: 'var(--text-primary)',
                                          fontSize: '0.875rem'
                                        }}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          } else {
                            // Render flat question
                            return (
                              <div key={index} style={{
                                padding: '1rem',
                                background: 'var(--bg-primary)',
                                borderRadius: '0.375rem',
                                border: '1px solid var(--border-color)'
                              }}>
                                <div style={{ marginBottom: '0.75rem' }}>
                                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                    Question {index + 1}:
                                  </label>
                                  <textarea
                                    value={q.question_text}
                                    onChange={(e) => {
                                      const updatedQuestions = [...previewingPaper.questions];
                                      updatedQuestions[index] = { ...updatedQuestions[index], question_text: e.target.value };
                                      setPreviewingPaper({ ...previewingPaper, questions: updatedQuestions });
                                    }}
                                    dir="auto"
                                    lang="mul"
                                    style={{
                                      width: '100%',
                                      padding: '0.5rem',
                                      borderRadius: '0.375rem',
                                      border: '1px solid var(--border-color)',
                                      background: 'var(--bg-secondary)',
                                      color: 'var(--text-primary)',
                                      fontSize: '0.875rem',
                                      fontFamily: 'system-ui, -apple-system, "Segoe UI", "Noto Sans", "Noto Sans Devanagari", "Noto Sans Arabic", sans-serif',
                                      resize: 'vertical',
                                      minHeight: '60px',
                                      lineHeight: '1.5'
                                    }}
                                  />
                                </div>
                                {q.options && (
                                  <div style={{ marginBottom: '0.5rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                      Options:
                                    </label>
                                    {q.options.map((opt, optIndex) => (
                                      <div key={optIndex} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                                        <input
                                          type="text"
                                          value={opt}
                                          onChange={(e) => {
                                            const updatedQuestions = [...previewingPaper.questions];
                                            const updatedOptions = [...updatedQuestions[index].options];
                                            updatedOptions[optIndex] = e.target.value;
                                            updatedQuestions[index] = { ...updatedQuestions[index], options: updatedOptions };
                                            setPreviewingPaper({ ...previewingPaper, questions: updatedQuestions });
                                          }}
                                          dir="auto"
                                          style={{
                                            flex: 1,
                                            padding: '0.375rem 0.5rem',
                                            borderRadius: '0.25rem',
                                            border: '1px solid var(--border-color)',
                                            background: 'var(--bg-secondary)',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.875rem',
                                            fontFamily: 'system-ui, -apple-system, "Segoe UI", "Noto Sans", "Noto Sans Devanagari", "Noto Sans Arabic", sans-serif'
                                          }}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                  <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                    Marks:
                                  </label>
                                  <input
                                    type="number"
                                    value={q.marks}
                                    onChange={(e) => {
                                      const updatedQuestions = [...previewingPaper.questions];
                                      updatedQuestions[index] = { ...updatedQuestions[index], marks: parseInt(e.target.value) || 0 };
                                      setPreviewingPaper({ ...previewingPaper, questions: updatedQuestions });
                                    }}
                                    min="1"
                                    style={{
                                      width: '80px',
                                      padding: '0.375rem 0.5rem',
                                  borderRadius: '0.25rem',
                                  border: '1px solid var(--border-color)',
                                  background: 'var(--bg-secondary)',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.875rem'
                                }}
                              />
                            </div>
                          </div>
                            );
                          }
                        })}
                      </div>
                    ) : (
                      <p style={{ color: 'var(--text-secondary)' }}>No questions available</p>
                    )}
                  </div>

                  {/* Editable Footer */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      Paper Footer:
                    </label>
                    <textarea
                      value={editingPaperContent?.footer || ''}
                      onChange={(e) => setEditingPaperContent({ ...editingPaperContent, footer: e.target.value })}
                      placeholder="Enter paper footer in any language (English, Hindi, Marathi, Urdu, etc.)"
                      dir="auto"
                      lang="mul"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '1rem',
                        fontFamily: 'system-ui, -apple-system, "Segoe UI", "Noto Sans", "Noto Sans Devanagari", "Noto Sans Arabic", sans-serif',
                        resize: 'vertical',
                        minHeight: '80px',
                        lineHeight: '1.6',
                        unicodeBidi: 'plaintext'
                      }}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '1.5rem',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'space-between'
            }}>
              <button
                onClick={() => {
                  setPreviewingPaper(null);
                  setEditingPaperContent(null);
                  setIsMockTest(false);
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Preserve grouping structure for PDF generation
                  const questionsForPDF = [];
                  previewingPaper.questions.forEach(q => {
                    if (q.sub_questions && q.sub_questions.length > 0) {
                      // This is a grouped question - preserve the group structure
                      questionsForPDF.push({
                        is_grouped: true,
                        main_question_number: q.main_question_number,
                        instruction: q.instruction || null,
                        sub_questions: q.sub_questions.map(subQ => ({
                          question_text: subQ.question_text,
                          options: subQ.options || null,
                          marks: subQ.marks,
                          question_type: subQ.question_type,
                          sub_question_number: subQ.sub_question_number
                        }))
                      });
                    } else {
                      // This is a flat question
                      questionsForPDF.push({
                        is_grouped: false,
                        question_text: q.question_text,
                        options: q.options || null,
                        marks: q.marks,
                        question_type: q.question_type
                      });
                    }
                  });

                  // Download PDF with "Mock Test" in filename and header if checkbox is checked
                  const mockTestTitle = isMockTest ? `${previewingPaper.paper_title} - Mock Test` : previewingPaper.paper_title;
                  const headerWithMockTest = isMockTest ? `${editingPaperContent.header}\n\nMock Test` : editingPaperContent.header;

                  // Show encryption modal instead of directly downloading
                  handleDownloadClick(
                    previewingPaper.paper_id,
                    mockTestTitle,
                    {
                      header: headerWithMockTest,
                      instructions: editingPaperContent.instructions,
                      footer: editingPaperContent.footer,
                      questions: questionsForPDF
                    }
                  );
                }}
                className="btn btn-success"
                disabled={downloadingPDF[previewingPaper.paper_id]}
                style={{ 
                  fontWeight: '600', 
                  fontSize: '1rem', 
                  padding: '0.75rem 1.5rem',
                  background: isMockTest ? '#ff9800' : '#28a745',
                  border: 'none',
                  color: 'white',
                  boxShadow: isMockTest ? '0 4px 12px rgba(255, 152, 0, 0.3)' : '0 2px 8px rgba(40, 167, 69, 0.3)',
                  transition: 'all 0.3s ease'
                }}
              >
                {downloadingPDF[previewingPaper.paper_id] 
                  ? '⏳ AI Formatting...' 
                  : isMockTest 
                    ? '📝 Download Mock Test PDF (AI Enhanced)' 
                    : '🤖 Download PDF (AI Enhanced)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Encryption Modal */}
      {showEncryptionModal && (
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
          zIndex: 10001,
          padding: '2rem'
        }}>
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: '1rem',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            border: '1px solid var(--border-color)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <span style={{ fontSize: '1.5rem' }}>🔒</span>
              <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>
                PDF Encryption Options
              </h3>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem' }}>
              <p style={{ 
                marginBottom: '1.5rem', 
                color: 'var(--text-secondary)',
                lineHeight: '1.6'
              }}>
                Would you like to encrypt this PDF with a password?
              </p>

              <div style={{
                background: 'var(--bg-secondary)',
                padding: '1rem',
                borderRadius: '0.5rem',
                marginBottom: '1.5rem',
                border: '1px solid var(--border-color)'
              }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem'
                }}>
                  Password (Optional):
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={encryptionPassword}
                    onChange={(e) => setEncryptionPassword(e.target.value)}
                    placeholder="Leave empty for no encryption"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      paddingRight: '3rem',
                      borderRadius: '0.375rem',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '1rem',
                      fontFamily: 'monospace'
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        confirmDownloadWithEncryption();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.5rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-secondary)',
                      transition: 'color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    )}
                  </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                  <p style={{
                    margin: 0,
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    fontStyle: 'italic'
                  }}>
                    💡 Tip: Use a strong password (min. 6 characters)
                  </p>
                  {encryptionPassword && encryptionPassword.length > 0 && (
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      color: encryptionPassword.length >= 6 ? 'var(--success)' : 'var(--error)'
                    }}>
                      {encryptionPassword.length >= 6 ? '✓ Valid' : `${encryptionPassword.length}/6 chars`}
                    </span>
                  )}
                </div>
              </div>

              <div style={{
                background: 'var(--info-light)',
                padding: '1rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--info)',
                marginBottom: '1.5rem'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem'
                }}>
                  <span style={{ fontSize: '1.25rem' }}>ℹ️</span>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                    <strong>Note:</strong> If you set a password, users will need to enter it to open the PDF.
                    Leave empty to download without encryption.
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '1.5rem',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={cancelEncryptionModal}
                className="btn btn-secondary"
                style={{ minWidth: '120px' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDownloadWithEncryption}
                className="btn btn-success"
                disabled={encryptionPassword && encryptionPassword.trim().length > 0 && encryptionPassword.trim().length < 6}
                style={{ 
                  minWidth: '180px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  opacity: (encryptionPassword && encryptionPassword.trim().length > 0 && encryptionPassword.trim().length < 6) ? 0.5 : 1,
                  cursor: (encryptionPassword && encryptionPassword.trim().length > 0 && encryptionPassword.trim().length < 6) ? 'not-allowed' : 'pointer'
                }}
              >
                {encryptionPassword ? (
                  <>
                    <span>🔒</span>
                    <span>Download Encrypted</span>
                  </>
                ) : (
                  <>
                    <span>📄</span>
                    <span>Download Without Encryption</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download Progress Modal */}
      {showDownloadProgressModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10002,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'var(--bg-primary)',
            borderRadius: '1rem',
            padding: '3rem 2.5rem',
            maxWidth: '450px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 25px 70px rgba(0, 0, 0, 0.6)',
            border: '1px solid var(--border-color)'
          }}>
            {/* Animated Spinner */}
            <div style={{
              width: '70px',
              height: '70px',
              margin: '0 auto 2rem',
              border: '5px solid var(--primary-light)',
              borderTop: '5px solid var(--primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>

            {/* Title */}
            <h3 style={{
              margin: '0 0 1rem 0',
              color: 'var(--primary)',
              fontSize: '1.5rem',
              fontWeight: '700'
            }}>
              {encryptionPassword ? '🔒 Generating Encrypted PDF' : '📄 Generating AI-Enhanced PDF'}
            </h3>

            {/* Message */}
            <p style={{
              margin: '0 0 1.5rem 0',
              fontSize: '1rem',
              color: 'var(--text-primary)',
              fontWeight: '500',
              lineHeight: '1.6'
            }}>
              AI is formatting your paper with professional layout and styling...
            </p>

            {/* Additional Info */}
            <div style={{
              background: 'var(--info-light)',
              padding: '1rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--info)'
            }}>
              <p style={{
                margin: 0,
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                lineHeight: '1.5'
              }}>
                {encryptionPassword 
                  ? '🔐 Your PDF will be password-protected and ready to download in a moment...'
                  : '⚡ Your PDF will be ready to download in a moment...'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Voice Assistant UI */}
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
    </div>
  );
};

export default ModeratorCategorization;