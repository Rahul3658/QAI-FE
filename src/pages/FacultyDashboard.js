import { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import API from '../api/axios';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';
import QuestionMetadataInfo from '../components/QuestionMetadataInfo';
import useVoiceAssistant from '../hooks/useVoiceAssistant';
import VoiceAssistantUI from '../components/VoiceAssistantUI';

const FacultyDashboard = () => {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();

  // Determine which view to show based on URL path
  const isDashboardPage = location.pathname === '/examiner';
  const isGeneratePage = location.pathname === '/examiner/create';
  const isPapersPage = location.pathname === '/examiner/papers';
  const isViewPage = location.pathname.startsWith('/examiner/view/');
  const activeView = isViewPage ? 'view' : isPapersPage ? 'papers' : isGeneratePage ? 'generate' : isDashboardPage ? 'dashboard' : 'view';
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editedQuestions, setEditedQuestions] = useState([]);
  const [showAnswers, setShowAnswers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalConfig, setModalConfig] = useState({ isOpen: false });
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const [viewingRequest, setViewingRequest] = useState(null);
  const [requestSets, setRequestSets] = useState([]);
  const [selectedSetFromRequest, setSelectedSetFromRequest] = useState(null);
  const { showToast } = useToast();

  // Template-based generation state
  const [templateQuestions, setTemplateQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('english'); // Default to English
  const [languageConfirmed, setLanguageConfirmed] = useState(false);
  const [selectedSubQuestion, setSelectedSubQuestion] = useState(null);
  const [variationForm, setVariationForm] = useState({ num_variations: 40 });
  const [generationMethod, setGenerationMethod] = useState(null); // 'template' or 'pdf'
  const [existingPaperNames, setExistingPaperNames] = useState([]);
  const [selectedExistingPaper, setSelectedExistingPaper] = useState(null);
  const [expandedSubQuestions, setExpandedSubQuestions] = useState({}); // Track which sub-questions are expanded
  const [selectedVariationsForSME, setSelectedVariationsForSME] = useState({}); // Track selected variations per sub-question
  const [completedQuestions, setCompletedQuestions] = useState(new Set());
  const [completedSubQuestions, setCompletedSubQuestions] = useState(new Set());
  const [nextAvailable, setNextAvailable] = useState({ nextQuestion: null, nextSubQuestion: null });
  
  // Pagination state for variations
  const [variationsPagination, setVariationsPagination] = useState({}); // { subQuestionId: { page, total, loading } }
  const [paginatedVariations, setPaginatedVariations] = useState({}); // { subQuestionId: [variations] }
  
  // Refs for scrolling to variations section
  const variationsRefs = useRef({});
  const templateFieldRef = useRef(null);
  const paperNameFieldRef = useRef(null);
  const languageFieldRef = useRef(null);
  const questionFieldRef = useRef(null);
  const subQuestionFieldRef = useRef(null);
  const subjectFieldRef = useRef(null);
  const chaptersFieldRef = useRef(null);
  const numVariationsFieldRef = useRef(null);

  const handleFieldSuggested = useCallback((fieldKey) => {
    if (!isGeneratePage || !fieldKey) return;
    
    const normalizedKey = String(fieldKey).toLowerCase();
    
    const scrollFieldMap = {
      template: templateFieldRef,
      paperName: paperNameFieldRef,
      papername: paperNameFieldRef,
      language: languageFieldRef,
      question: questionFieldRef,
      subQuestion: subQuestionFieldRef,
      subquestion: subQuestionFieldRef,
      subject: subjectFieldRef,
      chapters: chaptersFieldRef,
      numVariations: numVariationsFieldRef,
      numvariations: numVariationsFieldRef
    };

    const targetRef = scrollFieldMap[fieldKey] || scrollFieldMap[normalizedKey];
    if (targetRef?.current?.scrollIntoView) {
      targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetRef.current.focus?.({ preventScroll: true });
    }
  }, [isGeneratePage]);

  // Progress tracking state
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ 
    current: 0, 
    total: 0, 
    stage: '',
    expectedDuration: 0,
    elapsedTime: 0,
    showExtendedWaitWarning: false
  });
  
  // Cooldown state to prevent model overload after validation
  const [validationCooldown, setValidationCooldown] = useState(0);
  const [showCooldownModal, setShowCooldownModal] = useState(false);

  // Completion modal state
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [paperToComplete, setPaperToComplete] = useState(null);
  
  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [paperToDelete, setPaperToDelete] = useState(null);
  
  // Paper info modal state
  const [showPaperInfoModal, setShowPaperInfoModal] = useState(false);
  const [paperInfoData, setPaperInfoData] = useState(null);
  const [paperInfoLoading, setPaperInfoLoading] = useState(false);
  const [paperInfoError, setPaperInfoError] = useState(null);
  // AI Suggestion state (for examiner)
  const [aiRecommendations, setAiRecommendations] = useState({});
  const [showingRecommendations, setShowingRecommendations] = useState({});
  const [aiInputNumbers, setAiInputNumbers] = useState({});
  const [showAIProcessingModal, setShowAIProcessingModal] = useState(false);
  const [aiProcessingStage, setAiProcessingStage] = useState('');

  // Form state for paper generation 
  const [paperForm, setPaperForm] = useState({
    subject: '',
    topic: '',
    chapters: '', // New field for Topic/Chapters
    difficulty: 'medium',
    num_questions: 10,
    total_marks: 50,
    question_types: {
      mcq: true,
      short_answer: true,
      long_answer: false
    },
    marks_distribution: {
      mcq: 1,
      short_answer: 2,
      long_answer: 5
    }
  });

  // PDF upload and validation state (session-only, no localStorage)
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfValidation, setPdfValidation] = useState(null);
  const [showRelevanceWarning, setShowRelevanceWarning] = useState(false);
  const [validatingPdf, setValidatingPdf] = useState(false);

  // Voice Assistant integration
  // Log templates for debugging
  useEffect(() => {
    console.log('📋 Templates updated:', {
      count: templates.length,
      names: templates.map(t => t.template_name)
    });
  }, [templates]);

  const voiceAssistant = useVoiceAssistant({
    context: 'generate-questions',
    formState: {
      selectedTemplate,
      selectedExistingPaper,
      paperName: paperForm.topic, // Question paper name
      chapters: paperForm.chapters, // Topics/Chapters field
      selectedLanguage,
      languageConfirmed,
      selectedQuestion,
      selectedSubQuestion,
      subject: paperForm.subject,
      num_variations: variationForm.num_variations,
      availableTemplates: templates,
      existingPapers: existingPaperNames,
      templateQuestions,
      completedQuestions: Array.from(completedQuestions), // Pass completed questions for validation
      completedSubQuestions: Array.from(completedSubQuestions), // Pass completed sub-questions for validation
      nextAvailable: nextAvailable, // Pass next available question/sub-question info
      allCompleted: nextAvailable.allCompleted // Pass if all questions are completed
    },
    onStateChange: (updatedState) => {
      // Apply state changes from voice commands
      console.log('🎯 onStateChange called with:', updatedState);
      
      if (updatedState.selectedTemplate !== undefined) {
        // Only call handleTemplateSelect if template is actually changing
        const isTemplateChanging = updatedState.selectedTemplate !== selectedTemplate;
        setSelectedTemplate(updatedState.selectedTemplate);
        if (updatedState.selectedTemplate && isTemplateChanging) {
          console.log('📋 Template changed, loading questions...');
          handleTemplateSelect(updatedState.selectedTemplate);
        } else if (updatedState.selectedTemplate && !isTemplateChanging) {
          console.log('📋 Template unchanged, skipping reload');
        }
      }
      if (updatedState.selectedExistingPaper !== undefined) {
        setSelectedExistingPaper(updatedState.selectedExistingPaper);
      }
      if (updatedState.paperName !== undefined) {
        setPaperForm(prev => {
          if (prev.topic !== updatedState.paperName) {
            setLanguageConfirmed(false);
          }
          return { ...prev, topic: updatedState.paperName };
        });
      }
      if (updatedState.chapters !== undefined) {
        setPaperForm(prev => ({ ...prev, chapters: updatedState.chapters }));
      }
      if (updatedState.selectedLanguage !== undefined) {
        setSelectedLanguage(updatedState.selectedLanguage);
      }
      if (updatedState.languageConfirmed !== undefined) {
        setLanguageConfirmed(updatedState.languageConfirmed);
      }
      // Handle question selection by question_number (backend sends only the number)
      if (updatedState.selectedQuestionNumber !== undefined) {
        if (updatedState.selectedQuestionNumber) {
          // Find the question in templateQuestions array by question_number
          // Use the EXACT same logic as the dropdown onChange handler
          const searchValue = updatedState.selectedQuestionNumber;
          
          console.log('🔍 Voice assistant question search - BEFORE:', {
            searchValue,
            searchValueType: typeof searchValue,
            searchValueString: String(searchValue),
            templateQuestionsCount: templateQuestions.length,
            allQuestionNumbers: templateQuestions.map(q => ({
              question_number: q.question_number,
              type: typeof q.question_number,
              stringValue: String(q.question_number),
              exactMatch: q.question_number === searchValue,
              looseMatch: String(q.question_number) === String(searchValue)
            }))
          });
          
          const question = templateQuestions.find(q => q.question_number === searchValue);
          
          console.log('🔍 Voice assistant question search - AFTER:', {
            found: !!question,
            foundQuestion: question ? {
              question_number: question.question_number,
              question_type: question.question_type,
              marks: question.marks
            } : null
          });
          
          if (question) {
            console.log('✅ Voice assistant selected question:', question.question_number);
            setSelectedQuestion(question);
            setSelectedSubQuestion(null);
          } else {
            console.log('⚠️ Question not found in templateQuestions - trying loose match');
            // Try loose string comparison as fallback
            const looseQuestion = templateQuestions.find(q => String(q.question_number) === String(searchValue));
            if (looseQuestion) {
              console.log('✅ Found with loose match:', looseQuestion.question_number);
              setSelectedQuestion(looseQuestion);
              setSelectedSubQuestion(null);
            } else {
              console.log('❌ No match found even with loose comparison');
            }
          }
        } else {
          setSelectedQuestion(null);
          setSelectedSubQuestion(null);
        }
      }
      if (updatedState.selectedSubQuestion !== undefined) {
        if (updatedState.selectedSubQuestion) {
          // Backend already found and returned the correct sub-question
          // Just use it directly - it's already the right object from the template
          console.log('✅ Voice assistant selected sub-question:', updatedState.selectedSubQuestion.sub_number);
          setSelectedSubQuestion(updatedState.selectedSubQuestion);
        } else {
          setSelectedSubQuestion(null);
        }
      }
      if (updatedState.subject !== undefined) {
        setPaperForm(prev => ({ ...prev, subject: updatedState.subject }));
      }
      if (updatedState.num_variations !== undefined) {
        setVariationForm(prev => ({ ...prev, num_variations: updatedState.num_variations }));
      }
      // Handle trigger generation
      if (updatedState.shouldGenerate) {
        handleGenerateVariations();
      }
    },
    onFieldSuggested: handleFieldSuggested,
    enabled: isGeneratePage // Only enable on generate page
  });

  const stopVoiceAssistantActivity = useCallback(() => {
    try {
      voiceAssistant.stopListening?.();
      voiceAssistant.stopSpeaking?.();
      voiceAssistant.setContinuousMode?.(false);
    } catch (error) {
      console.warn('Voice assistant stop error:', error);
    }
  }, [voiceAssistant]);

  useEffect(() => {
    if(isDashboardPage){
      fetchPapers();
    }
    if (activeView === 'papers') {
      fetchPapers();
    }
    if (activeView === 'generate') {
      const loadGeneratePageData = async () => {
        await fetchTemplates();
        await fetchExistingPaperNames();
        // Refresh completed questions when returning to generate page
        // Wait a bit for templates to load if needed
        setTimeout(() => {
          if (selectedExistingPaper && templateQuestions.length > 0) {
            console.log('🔄 Auto-refreshing completed questions on page load');
            refreshCompletedQuestions();
          }
        }, 100);
      };
      loadGeneratePageData();
    }
    if (activeView === 'view' && location.pathname.startsWith('/examiner/view/')) {
      // Extract paper ID from URL and load it
      const paperId = location.pathname.split('/').pop();
      if (paperId) {
        // Always reload to get fresh data (including new variations)
        loadPaperDetails(paperId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, location.pathname]);

  const loadPaperDetails = async (paperId) => {
    try {
      setLoading(true);
      const { data } = await API.get(`/papers/${paperId}/details`);
      console.log('📄 Paper Details:', data.paper);
      console.log('📝 Questions Count:', data.paper.questions?.length);

      if (data.paper.questions && data.paper.questions.length > 0) {
        data.paper.questions.forEach((q, idx) => {
          console.log(`Question ${idx + 1}:`, {
            question_id: q.question_id,
            question_text: q.question_text?.substring(0, 50),
            sub_question_count: q.sub_question_count,
            has_sub_questions: !!q.sub_questions,
            sub_questions_length: q.sub_questions?.length
          });

          if (q.sub_questions && q.sub_questions.length > 0) {
            console.log(`  ✅ Has ${q.sub_questions.length} sub-questions`);
            q.sub_questions.forEach((sq, sqIdx) => {
              console.log(`    Sub-Q ${sqIdx + 1}:`, {
                sub_question_id: sq.sub_question_id,
                sub_question_number: sq.sub_question_number,
                variation_count: sq.variation_count
              });
            });
          } else {
            console.log(`  ❌ No sub-questions found`);
          }
        });
      }

      setSelectedPaper(data.paper);
      setEditedQuestions(data.paper.questions || []);
      setEditMode(false);
      
      // Clear paginated variations cache to force reload with fresh data
      setPaginatedVariations({});
      setVariationsPagination({});
    } catch (err) {
      console.error('Load paper error:', err);
      showToast('Failed to load paper details', 'error');
      navigate('/examiner/papers');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      console.log('📥 Fetching templates...');
      const { data } = await API.get('/templates');
      console.log('✅ Templates fetched:', data.templates?.length || 0);
      setTemplates(data.templates || []);
      // Set default template if available
      const defaultTemplate = data.templates?.find(t => t.is_default);
      if (defaultTemplate) {
        setSelectedTemplate(defaultTemplate.template_id);
      }
    } catch (error) {
      console.error('❌ Error fetching templates:', error);
      showToast('Failed to load templates', 'error');
    }
  };

  const fetchExistingPaperNames = async () => {
    try {
      const { data } = await API.get('/papers');
      // Filter only draft papers that use variations (can be edited)
      const paperNames = data.papers
        .filter(p => p.status === 'draft')
        .map(p => ({
          paper_id: p.paper_id,
          paper_title: p.paper_title,
          status: p.status
        }));
      setExistingPaperNames(paperNames);
    } catch (error) {
      console.error('Error fetching existing paper names:', error);
    }
  };

  // Helper function to check if a question/sub-question has variations
  const getCompletedQuestions = async (paperId) => {
    if (!paperId) return { completedQuestions: new Set(), completedSubQuestions: new Set() };
    
    try {
      // Get all sub-questions for this paper with their variations
      const { data } = await API.get(`/papers/${paperId}/details`);
      const completedQuestions = new Set();
      const completedSubQuestions = new Set();
      
      console.log('🔍 Checking completed questions for paper:', paperId);
      
      if (data.paper && data.paper.questions) {
        for (const question of data.paper.questions) {
          // Extract question number from question_text (e.g., "Q.1)" -> "Q.1")
          let questionNumber = null;
          
          if (question.question_text) {
            // Try to match patterns like "Q.1)", "1)", "Q1)", etc.
            const match = question.question_text.match(/^(Q\.?\d+|[A-Z]\.?\d+|\d+)/i);
            if (match) {
              questionNumber = match[1].replace(/\)$/, ''); // Remove trailing )
            }
          }
          
          // Fallback to question_number field if available
          if (!questionNumber && question.question_number) {
            questionNumber = question.question_number;
          }
          
          console.log(`📝 Checking Question ${questionNumber}:`, {
            question_text: question.question_text?.substring(0, 50),
            has_sub_questions: question.sub_questions?.length > 0,
            sub_questions_count: question.sub_questions?.length
          });
          
          if (question.sub_questions && question.sub_questions.length > 0) {
            // Question has sub-questions - check each one
            for (const subQuestion of question.sub_questions) {
              const variationCount = subQuestion.variations?.length || 0;
              const hasVariations = variationCount > 0;
              
              // Clean sub-question number (remove trailing parenthesis)
              let subQuestionNumber = subQuestion.sub_question_number;
              if (typeof subQuestionNumber === 'string') {
                subQuestionNumber = subQuestionNumber.replace(/\)$/, '');
              }
              
              console.log(`  📌 Sub-Question ${subQuestionNumber}:`, {
                original: subQuestion.sub_question_number,
                cleaned: subQuestionNumber,
                variations: variationCount,
                completed: hasVariations
              });
              
              // Skip 'main' sub-questions - they're for questions without real sub-questions
              if (subQuestionNumber === 'main') {
                console.log(`    ⚠️ Skipping 'main' sub-question (not a real sub-question)`);
                if (hasVariations && questionNumber) {
                  // Mark the question itself as completed (not as a sub-question)
                  completedQuestions.add(questionNumber);
                  console.log(`    ✅ Marked question as completed: ${questionNumber}`);
                }
                continue;
              }
              
              if (hasVariations && questionNumber) {
                const key = `${questionNumber}-${subQuestionNumber}`;
                completedSubQuestions.add(key);
                console.log(`    ✅ Marked as completed: ${key}`);
              }
            }
          } else {
            // Question has NO sub-questions - check if it has a 'main' sub-question or variations directly
            // This handles cases where the sub_questions array might not be populated yet
            // or the question structure is different
            
            // First, try to find a 'main' sub-question by checking the API response structure
            // The API might return sub_questions even if empty, so we need to check explicitly
            if (!question.sub_questions || question.sub_questions.length === 0) {
              // Check if there's a 'main' sub-question that might be stored differently
              // or check variations directly on the question (fallback)
              console.log(`  📌 Question ${questionNumber} has no sub-questions array`);
              
              // Try to get sub-questions via API if main question ID is available
              if (question.question_id && questionNumber) {
                try {
                  const { data: subQuestionsData } = await API.get(`/sub-questions/questions/${question.question_id}/sub-questions`);
                  if (subQuestionsData.sub_questions && subQuestionsData.sub_questions.length > 0) {
                    // Check for 'main' sub-question
                    const mainSubQuestion = subQuestionsData.sub_questions.find(sq => {
                      let sqNum = sq.sub_question_number;
                      if (typeof sqNum === 'string') {
                        sqNum = sqNum.replace(/\)$/, '');
                      }
                      return sqNum === 'main';
                    });
                    
                    if (mainSubQuestion) {
                      const variationCount = mainSubQuestion.variations?.length || 0;
                      if (variationCount > 0) {
                        completedQuestions.add(questionNumber);
                        console.log(`    ✅ Marked question ${questionNumber} as completed (via 'main' sub-question with ${variationCount} variations)`);
                      }
                    }
                  }
                } catch (subQError) {
                  console.warn(`  ⚠️ Could not fetch sub-questions for question ${questionNumber}:`, subQError);
                }
              }
            }
          }
        }
      }
      
      console.log('📊 Completed questions:', Array.from(completedQuestions));
      console.log('📊 Completed sub-questions:', Array.from(completedSubQuestions));
      
      return { completedQuestions, completedSubQuestions };
    } catch (error) {
      console.error('Error checking completed questions:', error);
      return { completedQuestions: new Set(), completedSubQuestions: new Set() };
    }
  };

  // Helper function to determine next available question/sub-question
  const getNextAvailableSelection = (templateQuestions, completedQuestions, completedSubQuestions) => {
    if (!templateQuestions || templateQuestions.length === 0) {
      return { nextQuestion: null, nextSubQuestion: null };
    }

    console.log('🎯 Finding next available question/sub-question...');
    console.log('  Completed questions:', Array.from(completedQuestions));
    console.log('  Completed sub-questions:', Array.from(completedSubQuestions));

    // Helper function to normalize question number (matches getCompletedQuestions logic)
    const normalizeQuestionNumber = (question) => {
      let questionNumber = null;
      
      if (question.question_text) {
        // Extract from question_text (e.g., "Q.1)" -> "1")
        const match = question.question_text.match(/^(Q\.?\d+|[A-Z]\.?\d+|\d+)/i);
        if (match) {
          questionNumber = match[1].replace(/\)$/, ''); // Remove trailing )
        }
      }
      
      // Fallback to question_number field if available
      if (!questionNumber && question.question_number) {
        questionNumber = question.question_number;
      }
      
      // Normalize: remove trailing period and parenthesis
      if (typeof questionNumber === 'string') {
        questionNumber = questionNumber.replace(/[.)]$/, '');
      }
      
      return questionNumber;
    };

    // Sort questions by question_number
    const sortedQuestions = [...templateQuestions].sort((a, b) => {
      const aNum = parseFloat(a.question_number);
      const bNum = parseFloat(b.question_number);
      return aNum - bNum;
    });

    for (const question of sortedQuestions) {
      // Normalize question number for comparison (must match how it's stored in completedQuestions)
      const normalizedQNum = normalizeQuestionNumber(question);
      console.log(`  🔍 Checking Question ${normalizedQNum} (raw: ${question.question_number}):`, {
        has_sub_questions: (question.sub_questions || question.subquestions || []).length > 0,
        is_completed: completedQuestions.has(normalizedQNum)
      });

      const subQuestions = question.sub_questions || question.subquestions || [];
      
      // Check if this question has real sub-questions (excluding 'main')
      const hasRealSubQuestions = subQuestions.length > 0 && subQuestions.some(sq => {
        let sqNum = sq.sub_number || sq.sub_question_number;
        if (typeof sqNum === 'string') {
          sqNum = sqNum.replace(/\)$/, '');
        }
        return sqNum !== 'main';
      });
      
      if (hasRealSubQuestions) {
        // Question has sub-questions - check each one
        const sortedSubQuestions = [...subQuestions].sort((a, b) => {
          const aNum = parseFloat(a.sub_number || a.sub_question_number);
          const bNum = parseFloat(b.sub_number || b.sub_question_number);
          return aNum - bNum;
        });

        for (const subQuestion of sortedSubQuestions) {
          // Clean sub-question number (remove trailing parenthesis)
          let cleanSubNumber = subQuestion.sub_number || subQuestion.sub_question_number;
          if (typeof cleanSubNumber === 'string') {
            cleanSubNumber = cleanSubNumber.replace(/\)$/, '');
          }
          
          // Skip 'main' sub-questions
          if (cleanSubNumber === 'main') {
            continue;
          }
          
          const key = `${normalizedQNum}-${cleanSubNumber}`;
          const isCompleted = completedSubQuestions.has(key);
          
          console.log(`    Checking ${key}: ${isCompleted ? '✅ Completed' : '⏭️ Next!'}`);
          
          if (!isCompleted) {
            console.log(`👉 Next available: Question ${normalizedQNum}, Sub-${cleanSubNumber}`);
            return { nextQuestion: question, nextSubQuestion: subQuestion };
          }
        }
      } else {
        // Question without sub-questions (or only has 'main' sub-question)
        // Check if it's completed using normalized question number
        if (!completedQuestions.has(normalizedQNum)) {
          console.log(`👉 Next available: Question ${normalizedQNum} (no sub-questions)`);
          return { nextQuestion: question, nextSubQuestion: null };
        } else {
          console.log(`    ✅ Question ${normalizedQNum} is completed, moving to next...`);
        }
      }
    }

    // All questions completed - allow any selection
    console.log('🎉 All questions completed!');
    return { nextQuestion: null, nextSubQuestion: null, allCompleted: true };
  };

  const fetchPapers = async () => {
    try {
      setLoading(true);
      // Fetch papers (new single paper system)
      const { data } = await API.get('/papers');
      setPapers(data.papers || []);
    } catch (err) {
      console.error('Failed to fetch papers');
    } finally {
      setLoading(false);
    }
  };

  // Function to refresh completed questions (can be called after generating variations)
  const refreshCompletedQuestions = async () => {
    console.log('🔄 Refreshing completed questions...');
    if (selectedExistingPaper && templateQuestions.length > 0) {
      const { completedQuestions: cq, completedSubQuestions: csq } = await getCompletedQuestions(selectedExistingPaper);
      console.log('📊 Setting completed questions:', {
        completedQuestions: Array.from(cq),
        completedSubQuestions: Array.from(csq)
      });
      
      setCompletedQuestions(cq);
      setCompletedSubQuestions(csq);
      
      const next = getNextAvailableSelection(templateQuestions, cq, csq);
      setNextAvailable(next);
      
      console.log('👉 Next available:', {
        question: next.nextQuestion?.question_number,
        subQuestion: next.nextSubQuestion?.sub_number,
        allCompleted: next.allCompleted
      });
      
      // Auto-select next available
      if (next.nextQuestion) {
        console.log('✅ Auto-selecting next question');
        setSelectedQuestion(next.nextQuestion);
        setSelectedSubQuestion(next.nextSubQuestion);
      }
    } else {
      console.log('⚠️ Cannot refresh - missing paper or template');
    }
  };

  // Load completed questions when paper or template changes
  useEffect(() => {
    const loadCompletedQuestions = async () => {
      if (selectedExistingPaper && templateQuestions.length > 0) {
        console.log('🔄 Loading completed questions (paper or template changed)');
        const { completedQuestions: cq, completedSubQuestions: csq } = await getCompletedQuestions(selectedExistingPaper);
        setCompletedQuestions(cq);
        setCompletedSubQuestions(csq);
        
        const next = getNextAvailableSelection(templateQuestions, cq, csq);
        setNextAvailable(next);
        
        console.log('👉 Next available after load:', {
          question: next.nextQuestion?.question_number,
          subQuestion: next.nextSubQuestion?.sub_number,
          currentlySelected: selectedQuestion?.question_number
        });
        
        // Auto-select next available if nothing is selected OR if we're on generate page
        if ((!selectedQuestion || activeView === 'generate') && next.nextQuestion) {
          console.log('✅ Auto-selecting next question:', next.nextQuestion.question_number);
          setSelectedQuestion(next.nextQuestion);
          setSelectedSubQuestion(next.nextSubQuestion);
        }
      } else {
        // New paper - start from first question
        setCompletedQuestions(new Set());
        setCompletedSubQuestions(new Set());
        if (templateQuestions.length > 0) {
          const next = getNextAvailableSelection(templateQuestions, new Set(), new Set());
          setNextAvailable(next);
        }
      }
    };
    
    loadCompletedQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExistingPaper, templateQuestions]);

  // Old 10-set system - keeping for backward compatibility
  // eslint-disable-next-line no-unused-vars
  const handleViewRequest = async (request) => {
    try {
      setLoading(true);
      setViewingRequest(request);
      // Fetch all 10 sets for this request
      const { data } = await API.get(`/paper-generation/request/${request.request_id}/sets`);
      setRequestSets(data.sets || []);
      setSelectedSetFromRequest(null);
    } catch (err) {
      showToast('Failed to load sets', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleViewSetFromRequest = async (set) => {
    try {
      setLoading(true);
      const { data } = await API.get(`/papers/${set.paper_id}`);
      setSelectedSetFromRequest(data.paper);
      setEditedQuestions(data.paper.questions || []);
      setEditMode(false);
    } catch (err) {
      showToast('Failed to load set details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToSets = () => {
    setSelectedSetFromRequest(null);
    setEditMode(false);
  };

  const handleBackToRequests = () => {
    setViewingRequest(null);
    setRequestSets([]);
    setSelectedSetFromRequest(null);
    setEditMode(false);
  };

  // Old handleSendToSME removed - using new one for variations

  const handleViewPaper = async (paperId) => {
    // Just navigate - the useEffect will load the paper
    navigate(`/examiner/view/${paperId}`);
  };

  const handleEditQuestion = (index, field, value) => {
    const updated = [...editedQuestions];
    updated[index] = { ...updated[index], [field]: value };
    setEditedQuestions(updated);
  };

  const handleEditOption = (qIndex, optIndex, value) => {
    const updated = [...editedQuestions];
    const options = [...(updated[qIndex].options || [])];
    options[optIndex] = value;
    updated[qIndex] = { ...updated[qIndex], options };
    setEditedQuestions(updated);
  };

  const handleAddQuestion = () => {
    setEditedQuestions([...editedQuestions, {
      question_text: '',
      question_type: 'mcq',
      difficulty: 'medium',
      marks: 1,
      options: ['', '', '', ''],
      correct_answer: ''
    }]);
  };

  const handleDeleteQuestion = (index) => {
    if (window.confirm('Are you sure you want to delete this question?')) {
      setEditedQuestions(editedQuestions.filter((_, i) => i !== index));
    }
  };

  const handleSavePaper = async () => {
    try {
      setSaving(true);
      const paperToSave = selectedSetFromRequest || selectedPaper;

      // Save variations if they exist (only save draft variations)
      let variationsSaved = 0;
      let variationErrors = 0;
      let variationsSkipped = 0;

      for (const question of editedQuestions) {
        if (question.sub_questions && question.sub_questions.length > 0) {
          for (const subQuestion of question.sub_questions) {
            if (subQuestion.variations && subQuestion.variations.length > 0) {
              for (const variation of subQuestion.variations) {
                // Only save draft variations (sent variations should not be modified)
                if (variation.status !== 'draft') {
                  variationsSkipped++;
                  continue;
                }
                
                try {
                  await API.put(`/sub-questions/variations/${variation.variation_id}`, {
                    question_text: variation.question_text,
                    options: variation.options,
                    correct_answer: variation.correct_answer
                  });
                  variationsSaved++;
                } catch (varErr) {
                  console.error('Error saving variation:', varErr);
                  variationErrors++;
                }
              }
            }
          }
        }
      }
      
      console.log(`Save summary: ${variationsSaved} saved, ${variationErrors} errors, ${variationsSkipped} skipped (non-draft)`);

      // Also save the main paper structure (for old flat questions)
      await API.put(`/papers/${paperToSave.paper_id}`, {
        questions: editedQuestions.filter(q => !q.sub_questions || q.sub_questions.length === 0)
      });

      if (variationErrors > 0) {
        showToast(`Paper saved with ${variationErrors} variation errors. ${variationsSaved} variations saved successfully.`, 'warning');
      } else if (variationsSaved > 0) {
        showToast(`Paper saved successfully! variations updated.`, 'success');
      } else {
        showToast('Paper saved successfully!', 'success');
      }

      setEditMode(false);

      // Reload the set
      if (selectedSetFromRequest) {
        handleViewSetFromRequest(selectedSetFromRequest);
      } else {
        handleViewPaper(paperToSave.paper_id);
      }
    } catch (err) {
      showToast('Failed to save paper: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setSaving(false);
    }
  };
const handleDeletePaper = (paperId, paperTitle) => {
    setPaperToDelete({ paperId, paperTitle });
    setShowDeleteModal(true);
  };

  const confirmDeletePaper = async () => {
    if (!paperToDelete) return;

    try {
      setSaving(true);
      // Use new dedicated API endpoint for examiner paper deletion
      const { data } = await API.post('/papers/examiner/delete-paper', { 
        paperId: paperToDelete.paperId 
      });
      showToast(data.message || 'Paper deleted successfully!', 'success');
      setShowDeleteModal(false);
      setPaperToDelete(null);
      await fetchPapers(); // Refresh the list
    } catch (error) {
      console.error('Error deleting paper:', error);
      const errorMessage = error.response?.data?.message || 'Failed to delete paper';
      const errorReason = error.response?.data?.reason;
      showToast(
        errorReason ? `${errorMessage} (${errorReason})` : errorMessage, 
        'error'
      );
    } finally {
      setSaving(false);
    }
  };
  const handleMarkAsComplete = async (paperId, paperTitle) => {
    // Validate that all sub-questions have at least 40 variations sent to SME
    try {
      const { data } = await API.get(`/papers/${paperId}`);
      const paper = data.paper;
      
      if (!paper || !paper.questions) {
        showToast('Unable to load paper details', 'error');
        return;
      }
      
      const insufficientSubQuestions = [];
      
      for (const question of paper.questions) {
        if (question.sub_questions && question.sub_questions.length > 0) {
          for (const subQuestion of question.sub_questions) {
            const sentToSMECount = subQuestion.variations?.filter(v => 
              v.status === 'sent_to_sme' || 
              v.status === 'selected_by_sme' || 
              v.status === 'approved' ||
              v.status === 'unselected_by_sme'
            ).length || 0;
            
            if (sentToSMECount < 40) {
              insufficientSubQuestions.push({
                number: subQuestion.full_question_number,
                count: sentToSMECount
              });
            }
          }
        }
      }
      
      if (insufficientSubQuestions.length > 0) {
        const details = insufficientSubQuestions
          .map(sq => `${sq.number} (${sq.count}/40)`)
          .join(', ');
        showToast(
          `Cannot confirm paper. Each sub-question must have at least 40 variations sent to SME. Insufficient: ${details}`,
          'error'
        );
        return;
      }
      
      // All validations passed, proceed with confirmation
      setPaperToComplete({ paperId, paperTitle });
      setShowCompletionModal(true);
    } catch (error) {
      console.error('Error validating paper:', error);
      showToast('Failed to validate paper', 'error');
    }
  };

  const confirmMarkAsComplete = async () => {
    if (!paperToComplete) return;

    // // Add additional confirmation prompt
    // const isConfirmed = window.confirm(
    //   `⚠️ FINAL CONFIRMATION\n\n` +
    //   `Are you absolutely sure you want to confirm all variations for "${paperToComplete.paperTitle}"?\n\n` +
    //   `This action will:\n` +
    //   `• Mark all variations as "Examiner Approved"\n` +
    //   `• Allow SME to review and send to moderator\n` +
    //   `• Cannot be easily undone\n\n` +
    //   `Click OK to proceed or Cancel to go back.`
    // );

    // if (!isConfirmed) {
    //   return; // User cancelled, don't proceed
    // }

    try {
      setSaving(true);
      const { data } = await API.put(`/papers/${paperToComplete.paperId}/mark-complete`);
      showToast(data.message || 'Paper marked as completed successfully!', 'success');
      setShowCompletionModal(false);
      setPaperToComplete(null);
      await fetchPapers(); // Refresh the list
    } catch (error) {
      console.error('Error marking paper as complete:', error);
      showToast(error.response?.data?.message || 'Failed to mark paper as complete', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Paper info modal handlers
  const handleOpenPaperInfo = async (paperId, paperTitle) => {
    setShowPaperInfoModal(true);
    setPaperInfoLoading(true);
    setPaperInfoError(null);
    setPaperInfoData({ paper_title: paperTitle });

    try {
      const { data } = await API.get(`/papers/${paperId}/info`);
      setPaperInfoData(data.paper);
    } catch (error) {
      console.error('Error fetching paper info:', error);
      setPaperInfoError(error.response?.data?.message || 'Failed to load paper information');
      showToast('Failed to load paper information', 'error');
    } finally {
      setPaperInfoLoading(false);
    }
  };

  const handleClosePaperInfo = () => {
    setShowPaperInfoModal(false);
    setPaperInfoData(null);
    setPaperInfoError(null);
  };







  // Old getStatusBadge removed - using new one for variations

  const getStatusLabel = (status) => {
    const labels = {
      draft: 'Draft - Ready to Send',
      pending: 'Under Review',
      approved: 'Approved',
      rejected: 'Rejected',
      finalized: 'Finalized',
      archived: 'Archived',
      generating: 'Generating...',
      pending_sme_selection: 'Pending SME Selection',
      pending_moderator: 'Pending Moderator',
      completed: 'Completed'
    };
    return labels[status] || status;
  };

  

  // Template-based generation handlers
  const handleTemplateSelect = async (templateId) => {
    if (!templateId) {
      setTemplateQuestions([]);
      setSelectedQuestion(null);
      setSelectedSubQuestion(null);
      return;
    }

    try {
      const { data } = await API.get(`/templates/${templateId}`);
      let questions = data.template?.questions || data.questions;

      if (typeof questions === 'string') {
        questions = JSON.parse(questions);
      }

      setTemplateQuestions(questions || []);
      setSelectedQuestion(null);
      setSelectedSubQuestion(null);
    } catch (error) {
      console.error('Error fetching template:', error);
      showToast('Failed to load template', 'error');
    }
  };

  // PDF handling functions - uncomment when pdf upload option needed to validate topic
  const handlePdfSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (file.type !== 'application/pdf') {
      showToast('Only PDF files are allowed', 'error');
      return;
    }

    // Validate file size (10MB)
    if (file.size > 50 * 1024 * 1024) {
      showToast('File size exceeds 50MB limit', 'error');
      return;
    }

    setPdfFile(file);
    setPdfValidation(null); // Clear previous validation
    setShowRelevanceWarning(false);
    console.log('📄 PDF selected:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)} MB)`);
  };

  const handlePdfRemove = () => {
    setPdfFile(null);
    setPdfValidation(null);
    setShowRelevanceWarning(false);
    console.log('🗑️ PDF removed');
  };

  const handleValidatePdf = async () => {
    if (!pdfFile || !paperForm.topic || !paperForm.subject) {
      showToast('Please upload a PDF and fill in topic/subject first', 'error');
      return;
    }

    try {
      setValidatingPdf(true);
      console.log('📤 Uploading PDF to File Search Store...');

      // Step 1: Upload PDF
      const formData = new FormData();
      formData.append('pdf', pdfFile);
      formData.append('topic', paperForm.topic);
      formData.append('subject', paperForm.subject);

      const { data: uploadData } = await API.post('/sub-questions/upload-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 90000
      });

      console.log('✅ PDF uploaded:', uploadData.fileMetadata.fileId);

      if (!uploadData.isNewUpload) {
        showToast('Using existing PDF file', 'info');
      }

      // Step 2: Validate relevance
      console.log('🔍 Validating PDF relevance...');
      const { data: validationData } = await API.post('/sub-questions/validate-pdf-topic-v2', {
        fileId: uploadData.fileMetadata.fileId,
        topic: paperForm.topic,
        subject: paperForm.subject,
        chapters: paperForm.chapters || ''
      }, {
        timeout: 90000
      });

      const validation = validationData.validation;
      console.log('✅ Validation complete:', validation);

      // Store validation results in component state (NOT localStorage)
      setPdfValidation({
        isRelevant: validation.isRelevant,
        relevanceScore: validation.relevanceScore,
        fileId: uploadData.fileMetadata.fileId,
        fileName: uploadData.fileMetadata.originalFilename,
        fileSize: uploadData.fileMetadata.fileSizeBytes,
        keyTermsFound: validation.keyTermsFound,
        reasoning: validation.reasoning
      });

      // Show appropriate message based on relevance score
      if (validation.relevanceScore >= 70) {
        showToast(`✅ PDF validated! Relevance: ${validation.relevanceScore}/100 (High)`, 'success');
      } else if (validation.relevanceScore >= 30) {
        showToast(`⚠️ PDF validated. Relevance: ${validation.relevanceScore}/100 (Medium)`, 'warning');
        setShowRelevanceWarning(true);
      } else {
        showToast(`❌ PDF validated. Relevance: ${validation.relevanceScore}/100 (Low)`, 'error');
        setShowRelevanceWarning(true);
      }

    } catch (error) {
      console.error('PDF validation error:', error);
      
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        showToast('Validation timeout. Please try again.', 'error');
      } else if (error.response?.status === 429) {
        showToast('Rate limit exceeded. Please wait and try again.', 'error');
      } else {
        showToast(error.response?.data?.message || 'PDF validation failed', 'error');
      }
      
      setPdfValidation(null);
    } finally {
      setValidatingPdf(false);
    }
  };

  // Cooldown function to prevent model overload after validation
  const startValidationCooldown = (callback) => {
    setShowCooldownModal(true);
    setValidationCooldown(10);
    
    const cooldownInterval = setInterval(() => {
      setValidationCooldown(prev => {
        if (prev <= 1) {
          clearInterval(cooldownInterval);
          setShowCooldownModal(false);
          // Execute the callback after cooldown
          setTimeout(callback, 100);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleProceedWithoutPdf = () => {
    setShowRelevanceWarning(false);
    // Clear PDF but keep validation data (so we don't re-upload)
    setPdfFile(null);
    setPdfValidation(null);
    // Start cooldown before generation
    startValidationCooldown(() => handleGenerateVariations());
  };

  const handleProceedWithPdf = () => {
    setShowRelevanceWarning(false);
    // Mark that user wants to proceed despite low relevance
    if (pdfValidation) {
      setPdfValidation({
        ...pdfValidation,
        userProceeded: true
      });
    }
    // Start cooldown before generation
    startValidationCooldown(() => handleGenerateVariations());
  };

  const handleCancelGeneration = () => {
    setShowRelevanceWarning(false);
    // User can modify inputs
  };

  // Calculate generation timeout based on batch processing metrics
  const calculateGenerationTimeout = (numVariations, batchSize = 20, usePdfContext = false) => {
    const WARMUP_TIME = 10000; // 10 seconds
    // PDF context takes longer: 1.5 minutes (90 seconds) per batch
    // Without PDF: 55 seconds per batch
    const BATCH_PROCESSING_TIME = 100000;
    const BUFFER_TIME = 300000; // 5 minute buffer (very generous to prevent premature timeout)
    
    const numBatches = Math.ceil(numVariations / batchSize);
    const expectedDuration = WARMUP_TIME + (numBatches * BATCH_PROCESSING_TIME);
    const timeoutDuration = expectedDuration + BUFFER_TIME;
    
    // NO MAX TIMEOUT CAP - let it run as long as needed
    return {
      expectedDuration,
      timeoutDuration, // No cap applied
      numBatches,
      batchProcessingTime: BATCH_PROCESSING_TIME
    };
  };

  const handleGenerateVariations = async () => {
    stopVoiceAssistantActivity();
    // Check if question is selected
    if (!selectedQuestion) {
      showToast('Please select a question first', 'error');
      return;
    }

    // Check if sub-question is required and selected
    const hasSubQuestions = (selectedQuestion.sub_questions || selectedQuestion.subquestions)?.length > 0;
    if (hasSubQuestions && !selectedSubQuestion) {
      showToast('Please select a sub-question', 'error');
      return;
    }

    if (!paperForm.topic || !paperForm.topic.trim()) {
      showToast('Please enter a question paper name', 'error');
      return;
    }

    if (!paperForm.subject || !paperForm.subject.trim()) {
      showToast('Please enter a subject', 'error');
      return;
    }

    // Check existing variations count for this sub-question
    let existingVariationsCount = 0;
    if (selectedExistingPaper && selectedQuestion && selectedSubQuestion) {
      try {
        const { data: paperData } = await API.get(`/papers/${selectedExistingPaper}/details`);
        if (paperData.paper && paperData.paper.questions) {
          for (const question of paperData.paper.questions) {
            if (question.sub_questions) {
              for (const subQuestion of question.sub_questions) {
                // Clean sub-question numbers for comparison
                let cleanSubNumber = subQuestion.sub_question_number;
                if (typeof cleanSubNumber === 'string') {
                  cleanSubNumber = cleanSubNumber.replace(/\)$/, '');
                }
                let selectedCleanSubNumber = selectedSubQuestion.sub_number;
                if (typeof selectedCleanSubNumber === 'string') {
                  selectedCleanSubNumber = selectedCleanSubNumber.replace(/\)$/, '');
                }
                
                if (cleanSubNumber === selectedCleanSubNumber) {
                  existingVariationsCount = subQuestion.variations?.length || 0;
                  break;
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error checking existing variations:', error);
      }
    }

    console.log(`📊 Existing variations: ${existingVariationsCount}`);

    // Only enforce 40 minimum if starting from scratch (less than 40 existing)
    if (existingVariationsCount < 40) {
    if (!variationForm.num_variations || variationForm.num_variations <= 39) {
        showToast('Please generate more than 39 variations (minimum 40 required for first generation)', 'error');
      return;
      }
    } else {
      // Already have 40+, allow any number of additional variations
      if (!variationForm.num_variations || variationForm.num_variations < 1) {
        showToast('Please enter number of additional variations to generate', 'error');
        return;
      }
      console.log(`✅ Sub-question already has ${existingVariationsCount} variations, allowing additional generation`);
    }
     // Warn user about large requests
    if (variationForm.num_variations > 200) {
      const estimatedMinutes = Math.ceil(variationForm.num_variations / 50) * 2;
      const confirmed = window.confirm(
        `⏱️ Large Request Warning\n\n` +
        `Generating ${variationForm.num_variations} variations will take approximately ${estimatedMinutes} minutes.\n\n` +
        `The process will run in the background. Do you want to continue?`
      );
      if (!confirmed) return;
    }

    // Check if PDF validation is required but not done
    if (pdfFile && !pdfValidation) {
      showToast('Please validate the PDF before generating variations', 'error');
      return;
    }
    
    // Declare progressInterval outside try-catch so it's accessible in catch block
    let progressInterval = null;

    try {
      setGenerating(true);
      setShowProgressModal(true);
      setGenerationProgress({ current: 0, total: variationForm.num_variations, stage: 'Initializing...' });

      // Use selected existing paper or create new one
      let paperId = selectedExistingPaper ? parseInt(selectedExistingPaper) : null;

      if (!paperId) {
        setGenerationProgress({ current: 0, total: variationForm.num_variations, stage: 'Creating question paper...' });
        const { data: paperData } = await API.post('/papers/create', {
          subject: paperForm.subject,
          topic: paperForm.topic || 'From Template',
          total_marks: 100,
         uses_variations: true,
          template_id: selectedTemplate ? parseInt(selectedTemplate, 10) : null,
          language: selectedLanguage || 'english'
        });
        paperId = paperData.paper.paper_id;

        // CRITICAL FIX: Set selectedExistingPaper to the new paper ID
        setSelectedExistingPaper(paperId.toString());

        // Show message if using existing paper
        if (paperData.paper.is_existing) {
          showToast(`Using existing paper: "${paperData.paper.paper_title}"`, 'info');
        }

        await fetchPapers();
        await fetchExistingPaperNames(); // Refresh the list
      }

      const mainQuestionNumber = selectedQuestion.question_number;

      // Check if main question exists
      const { data: existingQuestions } = await API.get(`/papers/${paperId}/questions`);
      let mainQuestionId = existingQuestions.questions?.find(q =>
        q.question_text?.includes(mainQuestionNumber)
      )?.question_id;

      if (!mainQuestionId) {
        const { data: mainData } = await API.post('/sub-questions/create-main-question', {
          paper_id: paperId,
          question_number: mainQuestionNumber,
          subject: paperForm.subject,
          topic: paperForm.topic || 'General',
          question_type: selectedQuestion.question_type || 'short_answer'
        });
        mainQuestionId = mainData.parent_question_id;
      }

      // Check if sub-question exists or create one
      let subQuestionId;
      
      if (selectedSubQuestion) {
        // Question has sub-questions - use the selected one
        const { data: existingSubQuestions } = await API.get(`/sub-questions/questions/${mainQuestionId}/sub-questions`);
        subQuestionId = existingSubQuestions.sub_questions?.find(sq =>
          sq.sub_question_number === selectedSubQuestion.sub_number
        )?.sub_question_id;

        if (!subQuestionId) {
          const { data: subData } = await API.post('/sub-questions/create-sub-question', {
            parent_question_id: mainQuestionId,
            paper_id: paperId,
            sub_question_number: selectedSubQuestion.sub_number,
            question_type: selectedQuestion.question_type,
            marks: selectedSubQuestion.marks,
            difficulty: selectedSubQuestion.difficulty || 'medium'
          });
          subQuestionId = subData.sub_question_id;
        }
      } else {
        // Question has NO sub-questions - create a default sub-question
        const { data: existingSubQuestions } = await API.get(`/sub-questions/questions/${mainQuestionId}/sub-questions`);
        
        // Check if a default sub-question already exists
        subQuestionId = existingSubQuestions.sub_questions?.find(sq =>
          sq.sub_question_number === 'main'
        )?.sub_question_id;

        if (!subQuestionId) {
          const { data: subData } = await API.post('/sub-questions/create-sub-question', {
            parent_question_id: mainQuestionId,
            paper_id: paperId,
            sub_question_number: 'main', // Use 'main' for questions without sub-questions
            question_type: selectedQuestion.question_type,
            marks: selectedQuestion.marks || selectedQuestion.total_marks || 5,
            difficulty: selectedQuestion.difficulty || 'medium'
          });
          subQuestionId = subData.sub_question_id;
        }
      }

      // Get class_level from selected question (not template level)
      const classLevel = selectedQuestion?.class_level || null;
      
      console.log('📚 Question class_level:', classLevel);
      console.log('📄 selectedPaper data:', {
        subject: selectedPaper?.subject,
        topic: selectedPaper?.topic,
        chapters: selectedPaper?.chapters
      });
      console.log('📝 paperForm data:', {
        subject: paperForm.subject,
        topic: paperForm.topic,
        chapters: paperForm.chapters
      });

      // Prepare request with optional PDF context
      // Use selectedPaper data (not paperForm) for subject/topic to get correct IDs
      const generateRequest = {
        sub_question_id: subQuestionId,
        num_variations: variationForm.num_variations,
        // starting_variation: 1,
        subject: selectedPaper?.subject || paperForm.subject || 'General',
        topic: selectedPaper?.topic || paperForm.topic || 'General',
        chapters: selectedPaper?.chapters || paperForm.chapters || '',
        language: selectedLanguage || 'english',
        class_level: classLevel // Add class_level for EduLab PDF context matching
      };
      
      console.log('📤 Final generateRequest:', generateRequest);

      // Add PDF fileId if available and user wants to use it (backend will use File Search directly)
      console.log('🔍 Checking PDF validation state:', {
        hasPdfValidation: !!pdfValidation,
        fileId: pdfValidation?.fileId,
        isRelevant: pdfValidation?.isRelevant,
        userProceeded: pdfValidation?.userProceeded,
        hasPdfFile: !!pdfFile
      });
      
      let usePdfContext = false;
      
      // Use validated PDF context if available (no localStorage check)
      if (pdfValidation?.fileId && (pdfValidation.isRelevant || pdfValidation.userProceeded)) {
        generateRequest.fileId = pdfValidation.fileId;
        generateRequest.usePdfContext = true;
        generateRequest.relevanceScore = pdfValidation.relevanceScore;
        usePdfContext = true;
        console.log('✅ Using validated PDF with File ID:', pdfValidation.fileId);
        console.log('� PcDF relevance score:', pdfValidation.relevanceScore);
        
        if (pdfValidation.userProceeded) {
          console.log('⚠️ User proceeded with low relevance PDF (score:', pdfValidation.relevanceScore, ')');
        }
      } else {
        console.log('ℹ️ Generating without PDF context');
      }

      // Calculate timeouts based on batch processing metrics (AFTER determining PDF context)
      const { expectedDuration, timeoutDuration, numBatches, batchProcessingTime } = 
        calculateGenerationTimeout(variationForm.num_variations, 20, usePdfContext);
      
      console.log(`⏱️ Expected duration: ${expectedDuration}ms (${numBatches} batches)`);
      console.log(`⏱️ Batch processing time: ${batchProcessingTime}ms per batch`);
      console.log(`⏱️ Using PDF context: ${usePdfContext}`);
      console.log(`⏱️ Timeout set to: ${timeoutDuration}ms`);

      // Initialize progress with expected duration
      setGenerationProgress({ 
        current: 0, 
        total: variationForm.num_variations, 
        stage: 'Warming up model (10 seconds)...',
        expectedDuration,
        elapsedTime: 0,
        showExtendedWaitWarning: false
      });
      
      // Track elapsed time and update progress based on time
      const startTime = Date.now();
      progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progressPercent = Math.min(99, (elapsed / expectedDuration) * 100);
        
        setGenerationProgress(prev => {
          const newProgress = {
            ...prev,
            elapsedTime: elapsed,
            current: Math.floor((progressPercent / 100) * prev.total)
          };
          
          // Keep spinning at 99% without warning - wait for backend to complete
          if (elapsed < 10000) {
            newProgress.stage = `Warming up model (${Math.ceil((10000 - elapsed) / 1000)}s)...`;
          } else if (progressPercent >= 99) {
            newProgress.stage = `Finalizing variations...`;
          } else {
            newProgress.stage = `Processing Generation ...`;
          }
          
          return newProgress;
        });
      }, 1000); // Update every second

       // Start generation - backend handles ALL batches automatically
      console.log(`⏱️ Setting API timeout to ${timeoutDuration}ms for ${variationForm.num_variations} variations`);
      
      const response = await API.post('/sub-questions/generate-variations', generateRequest, {
        timeout: timeoutDuration
      });
      const { data } = response;
      // Clear the progress interval
      clearInterval(progressInterval);

      
      // Track partial success warnings
      let hasPartialSuccess = false;

      // Check for partial success
      if (response.status === 206 && data.partial) {
        hasPartialSuccess = true;
        console.warn('Partial generation:', data.error_details);
      }

      // All variations are in the response (backend handled all batches)
      const allVariations = data.variations || [];

      // Set to complete
      setGenerationProgress({ 
        ...generationProgress,
        current: allVariations.length, 
        total: variationForm.num_variations, 
        stage: 'Complete!',
        showExtendedWaitWarning: false
      });

      setTimeout(async () => {
        setShowProgressModal(false);

         // Build success message
        let successMessage;
        if (hasPartialSuccess) {
          successMessage = `✅ Generated ${allVariations.length} variations were saved successfully! Due to network issues, the estimated generation could not be completed.`;
          console.warn('Partial success:', data.warning);
          showToast(successMessage, 'success');
          
          // Refresh papers list to show partial results
          await fetchPapers();
          await fetchExistingPaperNames();
          
          // Redirect to My Papers after showing message
          setTimeout(() => {
            navigate('/examiner/papers');
          }, 2000);
        } else {
          successMessage = data.usedPdfReference 
            ? `Generated ${allVariations.length} variations using PDF reference! Redirecting to My Papers...`
            : `Generated ${allVariations.length} variations! Redirecting to My Papers...`;
          showToast(successMessage, 'success');//have to set success again
await refreshCompletedQuestions();          
          // Redirect to My Papers after a short delay
          setTimeout(() => {
            navigate('/examiner/papers');
          }, 1500);
        }
      }, 1000);

    } catch (error) {
      console.error('Error generating variations:', error);

       // CRITICAL FIX: Clear progress interval on error to prevent memory leak
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      

      setShowProgressModal(false);
      
      // Check if it's a partial success (some variations generated)
      if (error.response?.status === 206 && error.response?.data?.variations) {
        const partialData = error.response.data;
        const generatedCount = partialData.variations.length;
        
        showToast(
          `✅ Generated ${generatedCount} variations were saved successfully! ` +
          `Due to network issues, the estimated generation could not be completed.`,
          'success'
        );
        
        // Refresh papers list to show partial results
        await fetchPapers();
        await fetchExistingPaperNames();
        
        // Refresh completed questions to unlock next question
        await refreshCompletedQuestions();
        
        showToast('✅ Next question is now available!', 'info');
        
      } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        // True timeout - backend might still be processing
        showToast(
          '⏱️ Request timeout. The generation may still be processing in the background. ' +
          'Please check "My Papers" in a moment to see if variations were generated.',
          'warning-partial'
        );
      } else if (error.response?.status === 400) {
        // Check if it's a topic not in PDF error
        const errorData = error.response?.data;
        if (errorData?.error === 'topic_not_in_pdf' || errorData?.error === 'parsing_failed_pdf_mismatch') {
          // Topic/chapters not found in PDF - show detailed error with options
          const topicName = errorData.topicRequested || paperForm.chapters || paperForm.topic;
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
          
          // Clear PDF validation to allow user to upload a new PDF or proceed without PDF
          setPdfValidation(null);
          setPdfFile(null);
        } else {
          // Other validation errors
          const errorMessage = error.response?.data?.message || 'Failed to generate variations';
          showToast(`❌ ${errorMessage}`, 'error');
        }
      } else if (error.response?.status === 500) {
        // Server error
        const errorMessage = error.response?.data?.message || 'Failed to generate variations';
        showToast(`❌ Server error: ${errorMessage}. Please try again.`, 'error');
      } else {
        // Generic error - complete failure
        const errorMessage = error.response?.data?.message || 'Failed to generate variations';
        showToast(`❌ ${errorMessage}`, 'error');
      }
      
      console.error('Batch generation error details:', error.response?.data?.error || error.message);
    } finally {
      setGenerating(false);
    }
  };



  const loadVariationsPage = async (subQuestionId, page = 1) => {
    try {
      setVariationsPagination(prev => ({
        ...prev,
        [subQuestionId]: { ...prev[subQuestionId], loading: true }
      }));

      const { data } = await API.get(`/sub-questions/sub-questions/${subQuestionId}/variations`, {
        params: { page, limit: 50 }
      });

      setPaginatedVariations(prev => ({
        ...prev,
        [subQuestionId]: data.variations
      }));

      // IMPORTANT: Also update editedQuestions with the paginated variations
      // This ensures editing works for newly loaded variations
      setEditedQuestions(prevQuestions => {
        const updatedQuestions = [...prevQuestions];
        
        // Find the question and sub-question that contains this subQuestionId
        for (let qIndex = 0; qIndex < updatedQuestions.length; qIndex++) {
          const question = updatedQuestions[qIndex];
          if (question.sub_questions) {
            for (let sqIndex = 0; sqIndex < question.sub_questions.length; sqIndex++) {
              const subQuestion = question.sub_questions[sqIndex];
              if (subQuestion.sub_question_id === subQuestionId) {
                // Merge paginated variations with existing variations
                const existingVariations = subQuestion.variations || [];
                const newVariations = data.variations || [];
                
                // Create a map of existing variations by ID
                const variationMap = new Map();
                existingVariations.forEach(v => variationMap.set(v.variation_id, v));
                
                // Add or update with new variations
                newVariations.forEach(v => variationMap.set(v.variation_id, v));
                
                // Convert back to array
                updatedQuestions[qIndex].sub_questions[sqIndex].variations = Array.from(variationMap.values());
                
                return updatedQuestions;
              }
            }
          }
        }
        
        return updatedQuestions;
      });

      setVariationsPagination(prev => ({
        ...prev,
        [subQuestionId]: {
          page: data.pagination.page,
          total: data.pagination.total,
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

  const toggleVariationSelection = (subQuestionId, variationId) => {
    setSelectedVariationsForSME(prev => {
      const currentSelections = prev[subQuestionId] || [];
      const isSelected = currentSelections.includes(variationId);

      return {
        ...prev,
        [subQuestionId]: isSelected
          ? currentSelections.filter(id => id !== variationId)
          : [...currentSelections, variationId]
      };
    });
  };

  // AI Recommendation functions for Examiner
  const handleAIRecommend = async (subQuestionId, variations, numToSelect = 1) => {
    if (!variations || variations.length === 0) {
      showToast('No variations available', 'warning');
      return;
    }

    // Filter variations that are draft (not yet sent)
    const draftVariations = variations.filter(v => v.status === 'draft');

    if (draftVariations.length === 0) {
      showToast('No draft variations to select', 'warning');
      return;
    }

    if (draftVariations.length < numToSelect) {
      numToSelect = draftVariations.length;
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
    const scoredVariations = draftVariations.map(v => {
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
  };

  const handleApplyAIRecommendations = (subQuestionId) => {
    const recommended = aiRecommendations[subQuestionId];

    if (!recommended || recommended.length === 0) {
      return;
    }

    // Just tick the recommended variations (add to selection)
    setSelectedVariationsForSME(prev => {
      const currentSelections = prev[subQuestionId] || [];
      const recommendedIds = recommended.map(v => v.variation_id);

      // Merge with existing selections (avoid duplicates)
      const newSelections = [...new Set([...currentSelections, ...recommendedIds])];

      return {
        ...prev,
        [subQuestionId]: newSelections
      };
    });

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

  const handleSendVariationsToSME = async (subQuestionId) => {
    // Check if paper is confirmed by examiner or finalized
    if (selectedPaper?.status === 'confirmed_by_examiner' || selectedPaper?.status === 'finalized') {
      showToast('Cannot send variations after paper has been confirmed', 'error');
      return;
    }

    const selectedVariationIds = selectedVariationsForSME[subQuestionId] || [];

    if (selectedVariationIds.length === 0) {
      showToast('Please select at least one variation to send to SME', 'error');
      return;
    }

    // Find the sub-question to check if variations have already been sent
    let alreadySentCount = 0;
    if (selectedPaper && selectedPaper.questions) {
      for (const question of selectedPaper.questions) {
        if (question.sub_questions) {
          const subQuestion = question.sub_questions.find(sq => sq.sub_question_id === subQuestionId);
          if (subQuestion && subQuestion.variations) {
            // Count variations that have been sent to SME (status is sent_to_sme or beyond)
            alreadySentCount = subQuestion.variations.filter(v =>
              v.status === 'sent_to_sme' || v.status === 'examiner_approved' || v.status === 'sme_approved' || v.status === 'moderator_approved'
            ).length;
            break;
          }
        }
      }
    }

    // Validation: First time must send more than 3, after that any number is allowed
    if (alreadySentCount === 0 && selectedVariationIds.length <= 39) {
      showToast('First submission requires more than 39 variations (minimum 40 required)', 'error');
      return;
    }

    try {
      setSaving(true);
      // Send without specifying SME - backend will assign to department SME automatically
      await API.post('/sub-questions/variations/send-to-sme', {
        variation_ids: selectedVariationIds
      });

      showToast(`Sent ${selectedVariationIds.length} variation(s) to your department SME!`, 'success');

      // Clear selections for this sub-question
      setSelectedVariationsForSME(prev => ({
        ...prev,
        [subQuestionId]: []
      }));

      // Reload paper to get updated status
      if (selectedPaper) {
        await loadPaperDetails(selectedPaper.paper_id);
      }

    } catch (error) {
      console.error('Error sending to SME:', error);
      showToast(error.response?.data?.message || 'Failed to send to SME', 'error');
    } finally {
      setSaving(false);
    }
  };



  const getStatusBadge = (status) => {
    const badges = {
      draft: { color: 'var(--text-secondary)', bg: 'var(--bg-secondary)', text: '📝 Draft' },
      sent_to_sme: { color: 'var(--info)', bg: 'var(--info-light)', text: '📤 Sent to SME' },
      selected_by_sme: { color: 'var(--info)', bg: 'var(--info-light)', text: '📤 Sent to SME' },
      examiner_approved: { color: 'var(--primary)', bg: 'var(--primary-light)', text: '✅ Examiner Approved' },
      sme_approved: { color: 'var(--success)', bg: 'var(--success-light)', text: '✓ SME Approved' },
      moderator_approved: { color: 'var(--success)', bg: 'var(--success-light)', text: '⭐ Moderator Approved' },
      // Keep old values for backward compatibility
      sme_rejected: { color: 'var(--error)', bg: 'var(--error-light)', text: '❌ SME Rejected' },
      examiner_finalized: { color: 'var(--primary)', bg: 'var(--primary-light)', text: '⭐ Examiner Finalized' },
      sent_to_moderator: { color: 'var(--info)', bg: 'var(--info-light)', text: '📤 Sent to Moderator' },
      moderator_rejected: { color: 'var(--error)', bg: 'var(--error-light)', text: '❌ Moderator Rejected' },
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
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Examiner's Dashboard</h1>
        <p className="dashboard-subtitle" style={{ color: 'white' }}>Welcome, {user?.name}</p>
      </div>

      {/* Dashboard View - Stats and Quick Actions */}
      {activeView === 'dashboard' && (
        <>
          <div className="stats-grid">
            <div className="stat-card" style={{borderWidth : 3,borderColor : 'blue'}}>
              <div className="stat-label" >Total Papers</div>
              <div className="stat-value">{papers.length}</div>
            </div>
            <div className="stat-card" style={{borderWidth : 3,borderColor : 'blue'}}>
              <div className="stat-label">Pending Papers</div>
              <div className="stat-value">{papers.filter(p => p.status === 'draft').length}</div>
            </div>
            <div className="stat-card" style={{borderWidth : 3,borderColor : 'blue'}}>
              <div className="stat-label">Finalized</div>
              <div className="stat-value">{papers.filter(p => p.status === 'finalized').length}</div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Quick Actions</h2>
            </div>
            <div style={{ padding: '1.5rem', display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
              <button
                className="btn btn-primary"
                onClick={() => window.location.href = '/examiner/create'}
                style={{ padding: '1.5rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}
              >
                <span style={{ fontSize: '1.5rem' }}>🤖</span>
                <span>Generate New Paper</span>
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => window.location.href = '/examiner/papers'}
                style={{ padding: '1.5rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}
              >
                <span style={{ fontSize: '1.5rem' }}>📄</span>
                <span>View My Papers</span>
              </button>
              {/* <button
                className="btn btn-secondary"
                onClick={() => window.location.href = '/pdf-library'}
                style={{ padding: '1.5rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}
              >
                <span style={{ fontSize: '1.5rem' }}>📚</span>
                <span>PDF Library</span>
              </button> */}
            </div>
          </div>
        </>
      )}

      {/* Generate Questions View - Premium Redesign */}
      {activeView === 'generate' && (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Hero Header */}
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '16px',
            padding: '2.5rem 2rem',
            marginBottom: '2rem',
            boxShadow: '0 10px 40px rgba(102, 126, 234, 0.3)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: '-50px',
              right: '-50px',
              width: '200px',
              height: '200px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '50%',
              filter: 'blur(40px)'
            }}></div>
            <div style={{
              position: 'absolute',
              bottom: '-30px',
              left: '-30px',
              width: '150px',
              height: '150px',
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '50%',
              filter: 'blur(30px)'
            }}></div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.75rem',
                  backdropFilter: 'blur(10px)'
                }}>
                  ✨
                </div>
                <div>
                  <h1 style={{
                    margin: 0,
                    fontSize: '2rem',
                    fontWeight: '800',
                    color: '#ffffff',
                    letterSpacing: '-0.02em'
                  }}>
                    Generate Question Paper
                  </h1>
                  <p style={{
                    margin: '0.25rem 0 0 0',
                    fontSize: '1rem',
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontWeight: '500'
                  }}>
                    Create AI-powered question variations from templates
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Auto-set generation method */}
          {(() => {
            if (!generationMethod) {
              setGenerationMethod('template');
            }
            return null;
          })()}

          {/* Main Content Card */}
          {generationMethod === 'template' && (
            <div style={{
              background: 'var(--bg-primary)',
              borderRadius: '16px',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border-color)',
              overflow: 'hidden'
            }}>
              {/* Step 1: Template Selection */}
              <div
                ref={templateFieldRef}
                style={{
                padding: '2rem',
                borderBottom: '1px solid var(--border-color)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    color: '#fff',
                    fontWeight: '700',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                  }}>
                    1
                  </div>
                  <div>
                    <h3 style={{
                      margin: 0,
                      fontSize: '1.25rem',
                      fontWeight: '700',
                      color: 'var(--text-primary)'
                    }}>
                      Select Paper Template
                    </h3>
                    <p style={{
                      margin: '0.25rem 0 0 0',
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)'
                    }}>
                      Choose a template with predefined question structure
                    </p>
                  </div>
                </div>

                <div style={{ maxWidth: '700px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.75rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'var(--text-primary)'
                  }}>
                    Paper Template *
                  </label>
                  <select
                    className="form-select"
                    value={selectedTemplate || ''}
                    onChange={(e) => {
                      const templateId = e.target.value;
                      setSelectedTemplate(templateId);
                      handleTemplateSelect(templateId);
                    }}
                    style={{
                      fontSize: '1rem',
                      padding: '0.875rem 1rem',
                      borderRadius: '10px',
                      border: '2px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      width: '100%',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <option value="">Select a template...</option>
                    {templates.map(t => (
                      <option key={t.template_id} value={t.template_id}>
                        {t.template_name} • {t.question_count} questions • {t.total_marks} marks
                        {t.is_default === 1 ? ' ⭐' : ''}
                        {t.is_admin_approved ? ' ✓' : ''}
                        {t.is_public && !t.is_admin_approved ? ' 🌐' : ''}
                      </option>
                    ))}
                  </select>

                  <div style={{
                    marginTop: '0.75rem',
                    padding: '0.75rem 1rem',
                    background: 'var(--info-light)',
                    borderRadius: '8px',
                    border: '1px solid var(--info)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span style={{ fontSize: '1rem' }}>💡</span>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                      Manage templates in the <a href="/paper-templates" style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'none' }}>Paper Templates</a> page
                    </span>
                  </div>
                </div>
              </div>

              {/* Template Details Card */}
              {selectedTemplate && (() => {
                const template = templates.find(t => t.template_id === parseInt(selectedTemplate, 10));
                if (!template) return null;

                return (
                  <div style={{
                    padding: '2rem',
                    background: 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--border-color)'
                  }}>
                    <div style={{
                      background: 'var(--bg-primary)',
                      borderRadius: '12px',
                      padding: '1.5rem',
                      border: '2px solid var(--border-color)',
                      boxShadow: 'var(--shadow-sm)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                        <div style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '12px',
                          background: 'linear-gradient(135deg, #667eea, #764ba2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.5rem'
                        }}>
                          📋
                        </div>
                        <div style={{ flex: 1 }}>
                          <h4 style={{
                            margin: 0,
                            fontSize: '1.125rem',
                            fontWeight: '700',
                            color: 'var(--text-primary)'
                          }}>
                            {template.template_name}
                            {template.is_admin_approved && (
                              <span style={{
                                marginLeft: '0.5rem',
                                fontSize: '0.875rem',
                                padding: '0.25rem 0.5rem',
                                background: 'rgba(16, 185, 129, 0.1)',
                                color: '#10b981',
                                borderRadius: '4px',
                                display: 'inline-block'
                              }}>
                                ✓ Approved
                              </span>
                            )}
                            {template.is_public && !template.is_admin_approved && (
                              <span style={{
                                marginLeft: '0.5rem',
                                fontSize: '0.875rem',
                                padding: '0.25rem 0.5rem',
                                background: 'rgba(59, 130, 246, 0.1)',
                                color: '#3b82f6',
                                borderRadius: '4px',
                                display: 'inline-block'
                              }}>
                                🌐 Public
                              </span>
                            )}
                          </h4>
                          {template.description && (
                            <p style={{
                              margin: '0.25rem 0 0 0',
                              fontSize: '0.875rem',
                              color: 'var(--text-secondary)'
                            }}>
                              {template.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{
                          padding: '0.75rem 1.25rem',
                          background: 'rgba(102, 126, 234, 0.1)',
                          borderRadius: '8px',
                          border: '1px solid rgba(102, 126, 234, 0.2)'
                        }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Questions</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#667eea' }}>{template.question_count || 0}</div>
                        </div>
                        <div style={{
                          padding: '0.75rem 1.25rem',
                          background: 'rgba(17, 153, 142, 0.1)',
                          borderRadius: '8px',
                          border: '1px solid rgba(17, 153, 142, 0.2)'
                        }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Total Marks</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#11998e' }}>{template.total_marks || 0}</div>
                        </div>
                        {template.class_level && (
                          <div style={{
                            padding: '0.75rem 1.25rem',
                            background: 'rgba(245, 158, 11, 0.1)',
                            borderRadius: '8px',
                            border: '1px solid rgba(245, 158, 11, 0.2)'
                          }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Class Level</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f59e0b' }}>{template.class_level}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Step 2: Paper Name */}
              {selectedTemplate && (
                <div
                  ref={paperNameFieldRef}
                  style={{
                  padding: '2rem',
                  borderBottom: '1px solid var(--border-color)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.25rem',
                      color: '#fff',
                      fontWeight: '700',
                      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                    }}>
                      2
                    </div>
                    <div>
                      <h3 style={{
                        margin: 0,
                        fontSize: '1.25rem',
                        fontWeight: '700',
                        color: 'var(--text-primary)'
                      }}>
                        Question Paper Details
                      </h3>
                      <p style={{
                        margin: '0.25rem 0 0 0',
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)'
                      }}>
                        Name your paper or add to existing one
                      </p>
                    </div>
                  </div>

                  <div style={{ maxWidth: '700px' }}>
                    {existingPaperNames.length > 0 && (
                      <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{
                          display: 'block',
                          marginBottom: '0.75rem',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: 'var(--text-primary)'
                        }}>
                          Select Existing Paper (Optional)
                        </label>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                          <select
                            className="form-select"
                            value={selectedExistingPaper || ''}
                            onChange={(e) => {
                              const paperId = e.target.value;
                              if (paperId) {
                                const paper = existingPaperNames.find(p => p.paper_id === parseInt(paperId));
                                setSelectedExistingPaper(paperId);
                            setPaperForm(prev => {
                              if (prev.topic !== paper.paper_title) {
                                setLanguageConfirmed(false);
                              }
                              return { ...prev, topic: paper.paper_title };
                            });
                              } else {
                                setSelectedExistingPaper(null);
                            setPaperForm(prev => {
                              if (prev.topic !== '') {
                                setLanguageConfirmed(false);
                              }
                              return { ...prev, topic: '' };
                            });
                              }
                            }}
                            style={{
                              fontSize: '1rem',
                              padding: '0.875rem 1rem',
                              borderRadius: '10px',
                              border: `2px solid ${selectedExistingPaper ? 'var(--success)' : 'var(--border-color)'}`,
                              background: selectedExistingPaper ? 'var(--success-light)' : 'var(--bg-secondary)',
                              flex: 1
                            }}
                          >
                            <option value="">-- Create New Paper --</option>
                            {existingPaperNames.map(paper => (
                              <option key={paper.paper_id} value={paper.paper_id}>
                                📄 {paper.paper_title}
                              </option>
                            ))}
                          </select>
                          {selectedExistingPaper && (
                            <button
                              onClick={() => {
                                const paper = existingPaperNames.find(p => p.paper_id === parseInt(selectedExistingPaper));
                                handleOpenPaperInfo(selectedExistingPaper, paper.paper_title);
                              }}
                              title="View questions in this paper"
                              style={{
                                padding: '0.875rem 1rem',
                                borderRadius: '10px',
                                border: '2px solid var(--primary)',
                                background: 'var(--primary-light)',
                                color: 'var(--primary)',
                                fontSize: '1.25rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: '48px'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'var(--primary)';
                                e.currentTarget.style.color = 'white';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'var(--primary-light)';
                                e.currentTarget.style.color = 'var(--primary)';
                              }}
                            >
                              ℹ️
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {!selectedExistingPaper && (
                      <div>
                        <label style={{
                          display: 'block',
                          marginBottom: '0.75rem',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: 'var(--text-primary)'
                        }}>
                          Question Paper Name *
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          value={paperForm.topic}
                        onChange={(e) => {
                          const value = e.target.value;
                          setPaperForm(prev => {
                            if (prev.topic !== value) {
                              setLanguageConfirmed(false);
                            }
                            return { ...prev, topic: value };
                          });
                        }}
                          placeholder="e.g., Mid-Term Exam 2024"
                          style={{
                            fontSize: '1rem',
                            padding: '0.875rem 1rem',
                            borderRadius: '10px',
                            border: '2px solid var(--border-color)',
                            background: 'var(--bg-secondary)',
                            width: '100%'
                          }}
                        />
                      </div>
                    )}

                    {selectedExistingPaper && (
                      <div style={{
                        padding: '1rem 1.25rem',
                        background: 'var(--success-light)',
                        borderRadius: '10px',
                        border: '2px solid var(--success)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem'
                      }}>
                        <span style={{ fontSize: '1.5rem' }}>✅</span>
                        <div>
                          <div style={{ fontWeight: '700', color: 'var(--success)', marginBottom: '0.25rem' }}>
                            Adding to: {paperForm.topic}
                          </div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            New questions will be added to this paper
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3 Language : Paper Language */}
              {selectedTemplate && paperForm.topic && templateQuestions.length > 0 && (
                <div
                  ref={languageFieldRef}
                  style={{
                  padding: '2rem',
                  borderBottom: '1px solid var(--border-color)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.25rem',
                      color: '#fff',
                      fontWeight: '700',
                      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                    }}>
                      3
                    </div>
                    <div>
                      <h3 style={{
                        margin: 0,
                        fontSize: '1.25rem',
                        fontWeight: '700',
                        color: 'var(--text-primary)'
                      }}>
                        Select Question Paper Language
                      </h3>
                      <p style={{
                        margin: '0.25rem 0 0 0',
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)'
                      }}>
                        Choose in which language question paper should be
                      </p>
                    </div>
                  </div>

                  <div style={{ maxWidth: '700px', display: 'grid', gap: '1.5rem' }}>
                    {/* Lanugage Selector */}
                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '0.75rem',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: 'var(--text-primary)'
                      }}>
                        Select Language *
                      </label>
                      <select
                        className="form-select"
                        value={selectedLanguage ? selectedLanguage : 'english'}
                        onChange={(e) => {
                          if (e.target.value) {
                            const language = e.target.value;
                            setSelectedLanguage(language);
                            setLanguageConfirmed(true);
                          } else {
                            setSelectedLanguage(null);
                            setLanguageConfirmed(false);
                          }
                        }}
                        style={{
                          fontSize: '1rem',
                          padding: '0.875rem 1rem',
                          borderRadius: '10px',
                          border: '2px solid var(--border-color)',
                          background: 'var(--bg-secondary)',
                          width: '100%'
                        }}
                      >
                        <option value="">Select a Language...</option>
                        <option value="english">English</option>
                        <option value="hindi">Hindi</option>
                        <option value="marathi">Marathi</option>
                        <option value="urdu">Urdu</option>
                      </select>
                    </div>

                  </div>
                </div>
              )}

              {/* Step 4: Question & Sub-Question Selection */}
              {selectedTemplate && paperForm.topic && templateQuestions.length > 0 && (
                <div
                  ref={questionFieldRef}
                  style={{
                  padding: '2rem',
                  borderBottom: '1px solid var(--border-color)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.25rem',
                      color: '#fff',
                      fontWeight: '700',
                      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                    }}>
                      4
                    </div>
                    <div>
                      <h3 style={{
                        margin: 0,
                        fontSize: '1.25rem',
                        fontWeight: '700',
                        color: 'var(--text-primary)'
                      }}>
                        Select Question & Sub-Question
                      </h3>
                      <p style={{
                        margin: '0.25rem 0 0 0',
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)'
                      }}>
                        Choose which question to generate variations for
                      </p>
                    </div>
                  </div>

                  <div style={{ maxWidth: '700px', display: 'grid', gap: '1.5rem' }}>
                    {/* Question Selector */}
                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '0.75rem',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: 'var(--text-primary)'
                      }}>
                        Select Question *
                      </label>
                      <select
                        key={`question-select-${selectedQuestion?.question_number || 'none'}`}
                        className="form-select"
                        value={selectedQuestion ? selectedQuestion.question_number : ''}
                        onChange={(e) => {
                          console.log('📝 Dropdown onChange:', e.target.value);
                          if (e.target.value) {
                            const question = templateQuestions.find(q => q.question_number === e.target.value);
                            console.log('📝 Found question:', question);
                            setSelectedQuestion(question);
                            setSelectedSubQuestion(null);
                          } else {
                            setSelectedQuestion(null);
                            setSelectedSubQuestion(null);
                          }
                        }}
                        style={{
                          fontSize: '1rem',
                          padding: '0.875rem 1rem',
                          borderRadius: '10px',
                          border: '2px solid var(--border-color)',
                          background: 'var(--bg-secondary)',
                          width: '100%'
                        }}
                      >
                        <option value="">Select a question...</option>
                        {templateQuestions.map((q, index) => {
                          const subQuestions = q.sub_questions || q.subquestions || [];
                          const hasSubQuestions = subQuestions.length > 0;
                          
                          // Check if this question is completed
                          let isCompleted = false;
                          if (hasSubQuestions) {
                            // All sub-questions must be completed
                            isCompleted = subQuestions.every(sq => 
                              completedSubQuestions.has(`${q.question_number}-${sq.sub_number}`)
                            );
                          } else {
                            isCompleted = completedQuestions.has(q.question_number);
                          }
                          
                          // Check if this is the next available question
                          const isNext = nextAvailable.nextQuestion?.question_number === q.question_number && !isCompleted;
                          
                          // Disable if not completed and not next (unless all completed)
                          const isDisabled = !nextAvailable.allCompleted && !isCompleted && !isNext;
                          
                          return (
                            <option key={index} value={q.question_number} disabled={isDisabled}>
                              {isCompleted && '✅ '}
                              {isNext && '👉 '}
                              {q.question_number} • {q.question_type} • {q.marks ?? q.total_marks ?? 0} marks{q.class_level ? ` • ${q.class_level}` : ''}
                              {isCompleted && ' (Completed)'}
                              {isNext && ' (Next)'}
                          </option>
                          );
                        })}
                      </select>

                      {selectedQuestion && (
                        <div style={{
                          marginTop: '1rem',
                          padding: '1rem 1.25rem',
                          background: 'var(--bg-primary)',
                          borderRadius: '10px',
                          border: '2px solid var(--border-color)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <span style={{ fontSize: '1.5rem' }}>📝</span>
                            <div style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-primary)' }}>
                              Question {selectedQuestion.question_number}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <span style={{
                              padding: '0.375rem 0.75rem',
                              background: 'rgba(102, 126, 234, 0.1)',
                              color: '#667eea',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              fontWeight: '600'
                            }}>
                              {selectedQuestion.question_type}
                            </span>
                            <span style={{
                              padding: '0.375rem 0.75rem',
                              background: 'rgba(17, 153, 142, 0.1)',
                              color: '#11998e',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              fontWeight: '600'
                            }}>
                              {selectedQuestion.marks ?? selectedQuestion.total_marks ?? 0} marks
                            </span>
                            <span style={{
                              padding: '0.375rem 0.75rem',
                              background: 'var(--bg-secondary)',
                              color: 'var(--text-secondary)',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              fontWeight: '600'
                            }}>
                              {(selectedQuestion.sub_questions || selectedQuestion.subquestions)?.length || 0} sub-questions
                            </span>
                            {(() => {
                              const template = templates.find(t => t.template_id === parseInt(selectedTemplate, 10));
                              return template?.class_level && (
                                <span style={{
                                  padding: '0.375rem 0.75rem',
                                  background: 'rgba(245, 158, 11, 0.1)',
                                  color: '#f59e0b',
                                  borderRadius: '6px',
                                  fontSize: '0.875rem',
                                  fontWeight: '600'
                                }}>
                                  📚 {template.class_level}
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Sub-Question Selector - Only show if question has sub-questions */}
                    {selectedQuestion && (selectedQuestion.sub_questions || selectedQuestion.subquestions) && (selectedQuestion.sub_questions || selectedQuestion.subquestions).length > 0 && (
                      <div ref={subQuestionFieldRef}>
                        <label style={{
                          display: 'block',
                          marginBottom: '0.75rem',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: 'var(--text-primary)'
                        }}>
                          Select Sub-Question *
                        </label>
                        <select
                          className="form-select"
                          value={selectedSubQuestion ? selectedSubQuestion.sub_number : ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              const subQuestions = selectedQuestion.sub_questions || selectedQuestion.subquestions || [];
                              const subQuestion = subQuestions.find(sq => sq.sub_number === e.target.value);
                              setSelectedSubQuestion(subQuestion);
                            } else {
                              setSelectedSubQuestion(null);
                            }
                          }}
                          style={{
                            fontSize: '1rem',
                            padding: '0.875rem 1rem',
                            borderRadius: '10px',
                            border: '2px solid var(--border-color)',
                            background: 'var(--bg-secondary)',
                            width: '100%'
                          }}
                        >
                          <option value="">Select a sub-question...</option>
                          {(selectedQuestion.sub_questions || selectedQuestion.subquestions).map((sq, index) => {
                            // Clean sub-question number (remove trailing parenthesis)
                            let cleanSubNumber = sq.sub_number;
                            if (typeof cleanSubNumber === 'string') {
                              cleanSubNumber = cleanSubNumber.replace(/\)$/, '');
                            }
                            
                            const key = `${selectedQuestion.question_number}-${cleanSubNumber}`;
                            const isCompleted = completedSubQuestions.has(key);
                            const isNext = nextAvailable.nextSubQuestion?.sub_number === sq.sub_number && !isCompleted;
                            
                            // Disable if not completed and not next (unless all completed)
                            const isDisabled = !nextAvailable.allCompleted && !isCompleted && !isNext;
                            
                            return (
                              <option key={index} value={sq.sub_number} disabled={isDisabled}>
                                {isCompleted && '✅ '}
                                {isNext && '👉 '}
                              Sub-{sq.sub_number} • {sq.marks} marks
                                {isCompleted && ' (Completed)'}
                                {isNext && ' (Next)'}
                            </option>
                            );
                          })}
                        </select>

                        {selectedSubQuestion && (
                          <div style={{
                            marginTop: '1rem',
                            padding: '1rem 1.25rem',
                            background: 'rgba(245, 158, 11, 0.05)',
                            borderRadius: '10px',
                            border: '2px solid rgba(245, 158, 11, 0.2)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '1.5rem' }}>📌</span>
                              <div style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-primary)' }}>
                                Sub-Question {selectedSubQuestion.sub_number}
                              </div>
                            </div>
                            <span style={{
                              padding: '0.375rem 0.75rem',
                              background: 'rgba(245, 158, 11, 0.1)',
                              color: '#d97706',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              fontWeight: '600',
                              display: 'inline-block'
                            }}>
                              {selectedSubQuestion.marks} marks
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Message for questions without sub-questions */}
                    {/* {selectedQuestion && (!selectedQuestion.sub_questions || (selectedQuestion.sub_questions || selectedQuestion.subquestions)?.length === 0) && (
                      <div style={{
                        padding: '1.5rem',
                        background: 'rgba(59, 130, 246, 0.05)',
                        borderRadius: '10px',
                        border: '2px solid rgba(59, 130, 246, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem'
                      }}>
                        <span style={{ fontSize: '2rem' }}>ℹ️</span>
                        <div>
                          <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                            No Sub-Questions
                          </div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            This question has no sub-questions. You can proceed directly to generate variations for the main question.
                          </div>
                        </div>
                      </div>
                    )} */}
                  </div>
                </div>
              )}

              {/* Step 5: Generation Configuration - Show if sub-question selected OR question has no sub-questions */}
              {(selectedSubQuestion || (selectedQuestion && (!selectedQuestion.sub_questions || (selectedQuestion.sub_questions || selectedQuestion.subquestions)?.length === 0))) && (
                <div style={{ padding: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.25rem',
                      color: '#fff',
                      fontWeight: '700',
                      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                    }}>
                      5
                    </div>
                    <div>
                      <h3 style={{
                        margin: 0,
                        fontSize: '1.25rem',
                        fontWeight: '700',
                        color: 'var(--text-primary)'
                      }}>
                        Configure Generation
                      </h3>
                      <p style={{
                        margin: '0.25rem 0 0 0',
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)'
                      }}>
                        Provide context for AI-powered question generation
                      </p>
                    </div>
                  </div>

                  <div style={{ maxWidth: '700px', display: 'grid', gap: '1.5rem' }}>
                    {/* Subject */}
                    <div ref={subjectFieldRef}>
                      <label style={{
                        display: 'block',
                        marginBottom: '0.75rem',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: 'var(--text-primary)'
                      }}>
                        Subject *
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={paperForm.subject}
                        onChange={(e) => setPaperForm({ ...paperForm, subject: e.target.value })}
                        placeholder="e.g., Computer Science, Mathematics"
                        style={{
                          fontSize: '1rem',
                          padding: '0.875rem 1rem',
                          borderRadius: '10px',
                          border: '2px solid var(--border-color)',
                          background: 'var(--bg-secondary)',
                          width: '100%'
                        }}
                      />
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: 0 }}>
                        The subject area for relevant question variations
                      </p>
                    </div>

                    {/* Chapters/Topics */}
                    <div ref={chaptersFieldRef}>
                      <label style={{
                        display: 'block',
                        marginBottom: '0.75rem',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: 'var(--text-primary)'
                      }}>
                        Topics / Chapters *
                      </label>
                      <textarea
                        className="form-input"
                        value={paperForm.chapters}
                        onChange={(e) => setPaperForm({ ...paperForm, chapters: e.target.value })}
                        placeholder="e.g., Data Structures, Algorithms, Database Management"
                        rows={3}
                        style={{
                          fontSize: '1rem',
                          padding: '0.875rem 1rem',
                          borderRadius: '10px',
                          border: '2px solid var(--border-color)',
                          background: 'var(--bg-secondary)',
                          width: '100%',
                          resize: 'vertical'
                        }}
                      />
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: 0 }}>
                        Specific topics to focus on for targeted generation
                      </p>
                    </div>

                    {/* Number of Variations */}
                    <div ref={numVariationsFieldRef}>
                      <label style={{
                        display: 'block',
                        marginBottom: '0.75rem',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: 'var(--text-primary)'
                      }}>
                        Number of Variations *
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={variationForm.num_variations}
                        onChange={(e) => setVariationForm({ ...variationForm, num_variations: parseInt(e.target.value) || 4 })}
                        min="4"
                        max="50"
                        placeholder="e.g., 10"
                        style={{
                          fontSize: '1rem',
                          padding: '0.875rem 1rem',
                          borderRadius: '10px',
                          border: '2px solid var(--border-color)',
                          background: 'var(--bg-secondary)',
                          width: '200px'
                        }}
                      />
                      {(() => {
                        // Calculate existing variations for selected sub-question
                        let existingCount = 0;
                        if (selectedExistingPaper && selectedQuestion && selectedSubQuestion && selectedPaper) {
                          const question = selectedPaper.questions?.find(q => {
                            const qNum = q.question_text?.match(/^(Q\.?\d+|[A-Z]\.?\d+|\d+)/i)?.[1]?.replace(/\)$/, '');
                            return qNum === selectedQuestion.question_number;
                          });
                          if (question && question.sub_questions) {
                            const subQ = question.sub_questions.find(sq => {
                              let cleanSubNumber = sq.sub_question_number;
                              if (typeof cleanSubNumber === 'string') {
                                cleanSubNumber = cleanSubNumber.replace(/\)$/, '');
                              }
                              let selectedCleanSubNumber = selectedSubQuestion.sub_number;
                              if (typeof selectedCleanSubNumber === 'string') {
                                selectedCleanSubNumber = selectedCleanSubNumber.replace(/\)$/, '');
                              }
                              return cleanSubNumber === selectedCleanSubNumber;
                            });
                            existingCount = subQ?.variations?.length || 0;
                          }
                        }
                        
                        if (existingCount >= 40) {
                          return (
                            <p style={{ fontSize: '0.8125rem', color: 'var(--success)', marginTop: '0.5rem', marginBottom: 0 }}>
                              ✅ {existingCount} variations exist. You can add more if needed.
                            </p>
                          );
                        } else if (existingCount > 0) {
                          return (
                            <p style={{ fontSize: '0.8125rem', color: 'var(--warning)', marginTop: '0.5rem', marginBottom: 0 }}>
                              ⚠️ {existingCount} variations exist. Need {40 - existingCount} more to reach minimum (40).
                            </p>
                          );
                        } else {
                          return (
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: 0 }}>
                        Minimum 40 variations required
                      </p>
                          );
                        }
                      })()}
                    </div>

                    {/* PDF Upload (Optional) */}
                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '0.75rem',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: 'var(--text-primary)'
                      }}>
                        Reference PDF (Optional)
                        <span style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)',
                          fontWeight: '400',
                          marginLeft: '0.5rem'
                        }}>
                          - Upload study material for context-aware questions
                        </span>
                      </label>
                      
                      {!pdfFile ? (
                        <div style={{
                          border: '2px dashed var(--border-color)',
                          borderRadius: '10px',
                          padding: '2rem',
                          textAlign: 'center',
                          background: 'var(--bg-secondary)',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.currentTarget.style.borderColor = 'var(--primary)';
                          e.currentTarget.style.background = 'var(--primary-light)';
                        }}
                        onDragLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border-color)';
                          e.currentTarget.style.background = 'var(--bg-secondary)';
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.style.borderColor = 'var(--border-color)';
                          e.currentTarget.style.background = 'var(--bg-secondary)';
                          const file = e.dataTransfer.files[0];
                          if (file) {
                            handlePdfSelect({ target: { files: [file] } });
                          }
                        }}
                        onClick={() => document.getElementById('pdf-upload-input').click()}>
                          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>
                          <div style={{ color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                            Click to upload or drag and drop
                          </div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            PDF files only (max 10MB)
                          </div>
                          <input
                            id="pdf-upload-input"
                            type="file"
                            accept="application/pdf"
                            onChange={handlePdfSelect}
                            style={{ display: 'none' }}
                          />
                        </div>
                      ) : (
                        <div style={{
                          border: '2px solid var(--success)',
                          borderRadius: '10px',
                          padding: '1rem',
                          background: 'var(--success-light)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ fontSize: '1.5rem' }}>📄</div>
                            <div>
                              <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
                                {pdfFile.name}
                              </div>
                              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={handlePdfRemove}
                            style={{
                              padding: '0.5rem 1rem',
                              borderRadius: '8px',
                              border: 'none',
                              background: 'var(--error)',
                              color: 'white',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              fontWeight: '500'
                            }}>
                            Remove
                          </button>
                        </div>
                      )}
                      
                      {/* Validation Button - Only show when PDF is uploaded but not validated */}
                      {pdfFile && !pdfValidation && !validatingPdf && (
                        <button
                          onClick={handleValidatePdf}
                          disabled={!paperForm.topic || !paperForm.subject}
                          style={{
                            marginTop: '0.75rem',
                            width: '100%',
                            padding: '0.75rem',
                            borderRadius: '8px',
                            border: 'none',
                            background: (!paperForm.topic || !paperForm.subject) ? 'var(--bg-secondary)' : 'var(--primary)',
                            color: (!paperForm.topic || !paperForm.subject) ? 'var(--text-secondary)' : 'white',
                            cursor: (!paperForm.topic || !paperForm.subject) ? 'not-allowed' : 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            transition: 'all 0.2s'
                          }}>
                          ✅ Validate Topic with PDF
                        </button>
                      )}
                      
                      {validatingPdf && (
                        <div style={{
                          marginTop: '0.75rem',
                          padding: '0.75rem',
                          borderRadius: '8px',
                          background: 'var(--info-light)',
                          color: 'var(--info)',
                          fontSize: '0.875rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}>
                          <div className="spinner-border spinner-border-sm" role="status"></div>
                          Uploading PDF to File Search Store...
                        </div>
                      )}
                      
                      {pdfValidation && pdfValidation.fileId && (
                        <div style={{
                          marginTop: '0.75rem',
                          padding: '0.75rem',
                          borderRadius: '8px',
                          background: pdfValidation.relevanceScore >= 70 ? 'var(--success-light)' : 
                                     pdfValidation.relevanceScore >= 30 ? 'var(--warning-light)' : 
                                     'rgba(220, 53, 69, 0.1)',
                          color: pdfValidation.relevanceScore >= 70 ? 'var(--success)' : 
                                pdfValidation.relevanceScore >= 30 ? 'var(--warning)' : 
                                '#dc3545',
                          fontSize: '0.875rem',
                          border: `1px solid ${pdfValidation.relevanceScore >= 70 ? 'var(--success)' : 
                                               pdfValidation.relevanceScore >= 30 ? 'var(--warning)' : 
                                               '#dc3545'}`
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '1.25rem' }}>
                              {pdfValidation.relevanceScore >= 70 ? '✅' : 
                               pdfValidation.relevanceScore >= 30 ? '⚠️' : '❌'}
                            </span>
                            <div style={{ fontWeight: '600' }}>
                              {pdfValidation.relevanceScore >= 70 ? 'PDF validated (High relevance)' : 
                               pdfValidation.relevanceScore >= 30 ? 'PDF validated (Medium relevance)' : 
                               'PDF validated (Low relevance)'}
                            </div>
                          </div>
                          <div style={{ fontSize: '0.75rem', opacity: 0.9, marginLeft: '2rem' }}>
                            <div>Relevance: {pdfValidation.relevanceScore}/100</div>
                            <div>File ID: {pdfValidation.fileId.substring(0, 20)}...</div>
                            {pdfValidation.reasoning && (
                              <div style={{ marginTop: '0.5rem', fontStyle: 'italic' }}>
                                {pdfValidation.reasoning}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Generate Button */}
                    <div style={{
                      marginTop: '1rem',
                      padding: '2rem',
                      background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05), rgba(118, 75, 162, 0.05))',
                      borderRadius: '12px',
                      border: '2px dashed var(--border-color)',
                      textAlign: 'center'
                    }}>
                      <button
                        className="btn btn-primary"
                        onClick={handleGenerateVariations}
                        disabled={!paperForm.subject || !paperForm.chapters || !variationForm.num_variations || generating || (pdfFile && !pdfValidation)}
                        style={{
                          padding: '1rem 2.5rem',
                          fontSize: '1.125rem',
                          fontWeight: '700',
                          borderRadius: '12px',
                          border: 'none',
                          cursor: (!paperForm.subject || !variationForm.num_variations || generating || (pdfFile && !pdfValidation)) ? 'not-allowed' : 'pointer',
                          background: 'linear-gradient(135deg, #667eea, #764ba2)',
                          color: '#fff',
                          minWidth: '280px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.75rem',
                          boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4)',
                          opacity: (!paperForm.subject || !variationForm.num_variations || (pdfFile && !pdfValidation)) ? 0.5 : 1,
                          transition: 'all 0.3s ease',
                          transform: (!paperForm.subject || !variationForm.num_variations || generating || (pdfFile && !pdfValidation)) ? 'none' : 'translateY(0)',
                        }}
                        onMouseEnter={(e) => {
                          if (paperForm.subject && variationForm.num_variations && !generating && !(pdfFile && !pdfValidation)) {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 12px 32px rgba(102, 126, 234, 0.5)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.4)';
                        }}
                      >
                        {generating ? (
                          <>
                            <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }}></div>
                            <span>Generating...</span>
                          </>
                        ) : (
                          <>
                            <span style={{ fontSize: '1.5rem' }}>✨</span>
                            <span>Generate Variations</span>
                          </>
                        )}
                      </button>

                      {/* Helper text when PDF is uploaded but not validated */}
                      {pdfFile && !pdfValidation && (
                        <div style={{
                          marginTop: '1rem',
                          padding: '0.75rem 1rem',
                          borderRadius: '8px',
                          background: 'rgba(255, 193, 7, 0.1)',
                          border: '1px solid var(--warning)',
                          color: 'var(--warning)',
                          fontSize: '0.875rem',
                          textAlign: 'center',
                          fontWeight: '500'
                        }}>
                          ⚠️ Please validate the PDF before generating variations
                        </div>
                      )}

                      {!paperForm.subject && (
                        <div style={{
                          marginTop: '1rem',
                          padding: '0.75rem 1rem',
                          background: 'var(--danger-light)',
                          borderRadius: '8px',
                          border: '1px solid var(--danger)',
                          fontSize: '0.875rem',
                          color: 'var(--danger)',
                          fontWeight: '600'
                        }}>
                          ⚠️ Please enter a subject to continue
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}


      {/* My Papers View */}
      {activeView === 'papers' && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">📄 My Papers</h2>
          </div>
          <div style={{ padding: '1.5rem' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <div className="spinner"></div>
              </div>
            ) : papers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                <p style={{ fontSize: '3rem', margin: '0 0 1rem 0' }}>📋</p>
                <p style={{ margin: 0 }}>No papers created yet</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {papers.map(paper => (
                  <div
                    key={paper.paper_id}
                    style={{
                      padding: '1rem 1.5rem',
                      background: paper.status === 'finalized' ? 'var(--success-light)' : 'var(--bg-secondary)',
                      borderRadius: '0.5rem',
                      border: paper.status === 'finalized' ? '2px solid var(--success)' : '1px solid var(--border-color)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                        📄 {paper.paper_title || 'Untitled Paper'}
                      </div>
                      {paper.status === 'finalized' && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: '600' }}>
                          Completed - No further edits allowed
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate(`/examiner/view/${paper.paper_id}`)}
                      >
                        View
                      </button>
                      {/* Show Delete button only if paper is draft AND no variations sent to SME */}
                      {paper.status === 'draft' && (!paper.variations_sent_to_sme || paper.variations_sent_to_sme === 0) && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeletePaper(paper.paper_id, paper.paper_title)}
                          title="Delete this paper"
                        >
                          🗑️ Delete
                        </button>
                      )}
                      {/* Show Confirm All button if paper is draft AND has variations sent to SME */}
                      {paper.status === 'draft' && paper.variations_sent_to_sme > 0 && (() => {
                        // Check if paper meets minimum requirements (40 variations per sub-question)
                        const meetsRequirements = paper.can_confirm === true;
                        const tooltipMessage = meetsRequirements 
                          ? 'Confirm all variations for SME review' 
                          : 'Some sub-questions have less than 40 variations sent to SME. Please send at least 40 variations for each sub-question before confirming.';
                        
                        return (
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                              className={`btn btn-sm ${meetsRequirements ? 'btn-success' : 'btn-danger'}`}
                              onClick={() => handleMarkAsComplete(paper.paper_id, paper.paper_title)}
                              disabled={saving}
                              title={tooltipMessage}
                              style={{
                                background: meetsRequirements 
                                  ? 'linear-gradient(135deg, #28a745, #20c997)' 
                                  : 'linear-gradient(135deg, #dc3545, #c82333)',
                                border: 'none',
                                color: '#fff',
                                fontWeight: '600',
                                cursor: saving ? 'not-allowed' : 'pointer'
                              }}
                              onMouseEnter={(e) => {
                                if (!meetsRequirements) {
                                  e.currentTarget.nextElementSibling.style.display = 'block';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!meetsRequirements) {
                                  e.currentTarget.nextElementSibling.style.display = 'none';
                                }
                              }}
                            >
                              {saving ? '⏳ Confirming...' : meetsRequirements ? '✅ Confirm All' : '⚠️ Confirm All'}
                            </button>
                            {!meetsRequirements && (
                              <div style={{
                                display: 'none',
                                position: 'absolute',
                                bottom: '100%',
                                right: '0',
                                marginBottom: '0.5rem',
                                padding: '0.75rem 1rem',
                                background: 'var(--bg-primary)',
                                border: '2px solid var(--danger)',
                                borderRadius: '0.5rem',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                zIndex: 1000,
                                minWidth: '300px',
                                maxWidth: '400px',
                                fontSize: '0.875rem',
                                color: 'var(--text-primary)',
                                lineHeight: '1.4',
                                whiteSpace: 'normal'
                              }}>
                                <div style={{ fontWeight: '600', color: 'var(--danger)', marginBottom: '0.25rem' }}>
                                  ⚠️ Cannot Confirm
                                </div>
                                {tooltipMessage}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {paper.status === 'confirmed_by_examiner' && (
                        <span style={{
                          padding: '0.5rem 1rem',
                          background: 'var(--success-light)',
                          color: 'var(--success)',
                          borderRadius: '0.5rem',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          border: '1px solid var(--success)'
                        }}>
                          ✅ Confirmed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* View 10 Sets from Request */}
      {activeView === 'papers' && viewingRequest && !selectedSetFromRequest && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={handleBackToRequests}>
                ← Back to Requests
              </button>
              <div>
                <h2 className="card-title" style={{ margin: 0 }}>
                  📝 {viewingRequest.subject} - {viewingRequest.topic}
                </h2>
                <span className="badge badge-info">{requestSets.length} Sets</span>
              </div>
            </div>
            {viewingRequest.status === 'draft' && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-danger"
                  onClick={async () => {
                    if (window.confirm(`Delete this request and all ${requestSets.length} sets? This cannot be undone.`)) {
                      try {
                        setSaving(true);
                        await API.delete(`/paper-generation/request/${viewingRequest.request_id}`);
                        showToast('Request deleted successfully', 'success');
                        handleBackToRequests();
                        fetchPapers();
                      } catch (err) {
                        showToast(err.response?.data?.message || 'Failed to delete request', 'error');
                      } finally {
                        setSaving(false);
                      }
                    }
                  }}
                  disabled={saving}
                >
                  {saving ? '⏳ Deleting...' : '🗑️ Delete Request'}
                </button>
              </div>
            )}
          </div>
          <div style={{ padding: '1.5rem' }}>
            {loading ? (
              <div className="loading">
                <div className="spinner"></div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {requestSets.map(set => (
                  <div
                    key={set.paper_id}
                    style={{
                      padding: '1.5rem',
                      background: set.selected_by_sme ? 'var(--success-light)' : 'var(--bg-secondary)',
                      borderRadius: '0.5rem',
                      border: set.selected_by_sme ? '2px solid var(--success)' : '1px solid var(--border-color)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.125rem' }}>
                          {set.selected_by_sme && '✅ '} Set {set.set_number}
                        </h3>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                          Quality Score: {set.ai_quality_score} | {set.question_count} questions | {set.total_marks} marks
                        </p>
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleViewSetFromRequest(set)}
                      >
                        👁️ View & Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* View Individual Set from Request */}
      {activeView === 'papers' && selectedSetFromRequest && (
        <div className="card">
          <div style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleBackToSets}
              >
                ← Back to 10 Sets
              </button>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {!editMode ? (
                  <>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => setEditMode(true)}
                    >
                      ✏️ Edit This Set
                    </button>
                    <button
                      className={`btn btn-sm ${showAnswers ? 'btn-warning' : 'btn-secondary'}`}
                      onClick={() => setShowAnswers(!showAnswers)}
                    >
                      {showAnswers ? '🔒 Hide Answers' : '🔓 Show Answers'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={handleSavePaper}
                      disabled={saving}
                    >
                      {saving ? '⏳ Saving...' : '💾 Save Changes'}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setEditMode(false);
                        setEditedQuestions(selectedSetFromRequest.questions || []);
                      }}
                    >
                      ❌ Cancel
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="paper-header">
              <h2>{selectedSetFromRequest.paper_title}</h2>
              <div className="paper-meta">
                <span>Total Marks: {selectedSetFromRequest.total_marks}</span>
                <span className={`badge ${getStatusBadge(selectedSetFromRequest.status)}`}>
                  {getStatusLabel(selectedSetFromRequest.status)}
                </span>
              </div>
            </div>

            <div className="questions-list">
              {editedQuestions.map((q, index) => (
                <div key={index} className="question-card">
                  <div className="question-header">
                    <span className="question-number">Question {index + 1}</span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span className={`badge badge-${q.question_type === 'mcq' ? 'primary' : q.question_type === 'short_answer' ? 'info' : 'warning'}`}>
                        {q.question_type === 'mcq' ? 'MCQ' : q.question_type === 'short_answer' ? 'Short Answer' : 'Long Answer'}
                      </span>
                      <span className="badge badge-success">{q.marks} marks</span>
                      {editMode && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteQuestion(index)}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>

                  {editMode ? (
                    <div className="question-edit">
                      {/* Question Type and Marks */}
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label">Question Type</label>
                          <select
                            className="form-select"
                            value={q.question_type}
                            onChange={(e) => {
                              const newType = e.target.value;
                              handleEditQuestion(index, 'question_type', newType);
                              // If changing to MCQ, add default options
                              if (newType === 'mcq' && (!q.options || q.options.length === 0)) {
                                const updated = [...editedQuestions];
                                updated[index].options = ['Option A', 'Option B', 'Option C', 'Option D'];
                                setEditedQuestions(updated);
                              }
                              // If changing from MCQ, remove options
                              if (newType !== 'mcq' && q.options) {
                                const updated = [...editedQuestions];
                                updated[index].options = null;
                                setEditedQuestions(updated);
                              }
                            }}
                          >
                            <option value="mcq">Multiple Choice (MCQ)</option>
                            <option value="short_answer">Short Answer</option>
                            <option value="long_answer">Long Answer</option>
                          </select>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label">Marks</label>
                          <input
                            type="number"
                            className="form-input"
                            value={q.marks}
                            onChange={(e) => handleEditQuestion(index, 'marks', parseInt(e.target.value) || 1)}
                            min="1"
                            max="100"
                          />
                        </div>
                      </div>

                      {/* Question Text */}
                      <div className="form-group">
                        <label className="form-label">Question Text</label>
                        <textarea
                          className="form-input"
                          value={q.question_text}
                          onChange={(e) => handleEditQuestion(index, 'question_text', e.target.value)}
                          rows="3"
                        />
                      </div>

                      {/* MCQ Options */}
                      {q.question_type === 'mcq' && q.options && (
                        <div style={{ marginTop: '1rem' }}>
                          <label className="form-label">Options:</label>
                          {q.options.map((opt, optIndex) => (
                            <input
                              key={optIndex}
                              className="form-input"
                              value={opt}
                              onChange={(e) => handleEditOption(index, optIndex, e.target.value)}
                              placeholder={`Option ${String.fromCharCode(65 + optIndex)}`}
                              style={{ marginBottom: '0.5rem' }}
                            />
                          ))}
                        </div>
                      )}

                      {/* Correct Answer */}
                      {showAnswers && (
                        <div style={{ marginTop: '1rem' }}>
                          <label className="form-label">Correct Answer:</label>
                          {q.question_type === 'mcq' ? (
                            <select
                              className="form-select"
                              value={q.correct_answer || ''}
                              onChange={(e) => handleEditQuestion(index, 'correct_answer', e.target.value)}
                            >
                              <option value="">Select correct option...</option>
                              {q.options && q.options.map((opt, optIndex) => (
                                <option key={optIndex} value={opt}>{String.fromCharCode(65 + optIndex)}. {opt}</option>
                              ))}
                            </select>
                          ) : (
                            <textarea
                              className="form-input"
                              value={q.correct_answer || ''}
                              onChange={(e) => handleEditQuestion(index, 'correct_answer', e.target.value)}
                              rows="3"
                              placeholder="Enter the correct answer or explanation..."
                            />
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="question-content">
                      <p className="question-text">{q.question_text}</p>

                      {q.question_type === 'mcq' && q.options && (
                        <div className="options-list">
                          {q.options.map((opt, optIndex) => (
                            <div
                              key={optIndex}
                              className={`option ${showAnswers && opt === q.correct_answer ? 'correct-option' : ''}`}
                            >
                              <span className="option-label">{String.fromCharCode(65 + optIndex)}.</span>
                              <span>{opt}</span>
                              {showAnswers && opt === q.correct_answer && <span className="correct-badge">✓ Correct</span>}
                            </div>
                          ))}
                        </div>
                      )}

                      {showAnswers && q.correct_answer && (
                        <div className="answer-section">
                          <strong>Answer:</strong>
                          <p>{q.correct_answer}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {editMode && (
                <button
                  className="btn btn-secondary"
                  onClick={handleAddQuestion}
                  style={{ marginTop: '1rem' }}
                >
                  ➕ Add Question
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View Paper Detail */}
      {activeView === 'view' && selectedPaper && (
        <div className="card">
          <div style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => window.location.href = '/examiner/papers'}
              >
                ← Back to Papers
              </button>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {!editMode ? (
                  <>
                    {(() => {
                      const hasExaminerApproved = selectedPaper.questions?.some(q =>
                        q.sub_questions?.some(sq =>
                          sq.variations?.some(v => v.status === 'examiner_approved' || v.status === 'sme_approved' || v.status === 'moderator_approved')
                        )
                      );

                      const isConfirmed = selectedPaper.status === 'confirmed_by_examiner';
                      const isFinalized = selectedPaper.status === 'finalized';
                      const cannotEdit = hasExaminerApproved || isConfirmed || isFinalized;

                      return (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => setEditMode(true)}
                          disabled={cannotEdit}
                          title={cannotEdit ? 'Cannot edit after confirming variations or when paper is confirmed/finalized' : 'Edit paper'}
                        >
                          ✏️ Edit Paper
                        </button>
                      );
                    })()}
                    <button
                      className={`btn btn-sm ${showAnswers ? 'btn-warning' : 'btn-secondary'}`}
                      onClick={() => setShowAnswers(!showAnswers)}
                    >
                      {showAnswers ? '🔒 Hide Answers' : '🔓 Show Answers'}
                    </button>
                    {!showAnswers && (
                      <span style={{
                        fontSize: '0.875rem',
                        color: 'var(--warning)',
                        fontWeight: '500',
                        padding: '0.25rem 0.5rem',
                        background: 'var(--warning-light)',
                        borderRadius: '0.25rem'
                      }}>
                        ⚠️ Answers Hidden
                      </span>
                    )}
                    {/* {selectedPaper.status === 'draft' && (
                      <button
                        className="btn btn-success btn-sm"
                        onClick={handleSendToAdmin}
                        disabled={saving}
                      >
                        📤 Confirm Submission
                      </button>
                    )} */}
                  </>
                ) : (
                  <>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={handleSavePaper}
                      disabled={saving}
                    >
                      💾 Save Changes
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setEditMode(false);
                        setEditedQuestions(selectedPaper.questions || []);
                      }}
                    >
                      ✖️ Cancel
                    </button>
                  </>
                )}
              </div>
            </div>

            <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-primary)' }}>{selectedPaper.paper_title}</h3>

            {/* Examiner Confirmed Banner */}
            {(() => {
              const hasExaminerApproved = selectedPaper.questions?.some(q =>
                q.sub_questions?.some(sq =>
                  sq.variations?.some(v => v.status === 'examiner_approved' || v.status === 'sme_approved' || v.status === 'moderator_approved')
                )
              );

              if (hasExaminerApproved) {
                return (
                  <div style={{
                    padding: '1rem',
                    background: 'var(--primary-light)',
                    border: '2px solid var(--primary)',
                    borderRadius: '0.5rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}>
                    <span style={{ fontSize: '2rem' }}>✅</span>
                    <div>
                      <div style={{ fontWeight: '600', color: 'var(--primary)', marginBottom: '0.25rem' }}>
                        Variations Confirmed
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        You have confirmed the variations. SME can now review and send to moderator. Editing is locked.
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* Finalized Banner */}
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
                <span style={{ fontSize: '2rem' }}>🎉</span>
                <div>
                  <div style={{ fontWeight: '600', color: 'var(--success)', marginBottom: '0.25rem' }}>
                    Paper Finalized
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    This paper has been finalized by the moderator. No further edits or variations can be sent.
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginBottom: '2rem' }}>
              <div className="stat-card" style={{ maxWidth: '300px' }}>
                <div className="stat-label">Created</div>
                <div className="stat-value" style={{ fontSize: '1rem' }}>
                  {new Date(selectedPaper.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>Questions ({editedQuestions.length})</h4>
              {editMode && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleAddQuestion}
                >
                  ➕ Add Question
                </button>
              )}
            </div>

            {editedQuestions && editedQuestions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {editedQuestions.map((q, index) => (
                  <div key={index} className={`question-card ${editMode ? 'edit-mode' : ''}`}>
                    
                    {/* Main Question Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <strong style={{ fontSize: '1.125rem', color: 'var(--text-primary)' }}>
                          Q{index + 1}
                        </strong>
                        {q.question_type && (
                          <span className={`badge badge-${q.question_type === 'mcq' ? 'primary' : q.question_type === 'short_answer' ? 'info' : 'warning'}`}>
                            {q.question_type === 'mcq' ? 'MCQ' : q.question_type === 'short_answer' ? 'Short Answer' : 'Long Answer'}
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
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        {editMode ? (
                          <>
                            <select
                              className="form-select"
                              value={q.difficulty}
                              onChange={(e) => handleEditQuestion(index, 'difficulty', e.target.value)}
                              style={{ width: 'auto', padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}
                            >
                              <option value="easy">Easy</option>
                              <option value="medium">Medium</option>
                              <option value="hard">Hard</option>
                            </select>
                            <select
                              className="form-select"
                              value={q.question_type}
                              onChange={(e) => handleEditQuestion(index, 'question_type', e.target.value)}
                              style={{ width: 'auto', padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}
                            >
                              <option value="mcq">MCQ</option>
                              <option value="short_answer">Short Answer</option>
                              <option value="long_answer">Long Answer</option>
                            </select>
                            <input
                              type="number"
                              className="form-input"
                              value={q.marks}
                              onChange={(e) => handleEditQuestion(index, 'marks', parseInt(e.target.value))}
                              style={{ width: '70px', padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}
                              min="1"
                            />
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeleteQuestion(index)}
                              style={{ padding: '0.375rem 0.75rem' }}
                            >
                              🗑️
                            </button>
                          </>
                        ) : (
                          <>
                            <span className={`badge badge-${q.difficulty === 'easy' ? 'success' : q.difficulty === 'medium' ? 'warning' : 'danger'}`}>
                              {q.difficulty}
                            </span>
                            <span className="badge badge-secondary">{q.question_type}</span>
                            <span className="badge badge-primary">{q.marks} marks</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Only show question text for questions without sub-questions (old flat structure) */}
                    {!q.sub_questions && (
                      <>
                        {editMode ? (
                          <textarea
                            className="form-input"
                            value={q.question_text}
                            onChange={(e) => handleEditQuestion(index, 'question_text', e.target.value)}
                            rows="3"
                            placeholder="Enter question text..."
                            style={{ marginBottom: '0.5rem', width: '100%' }}
                          />
                        ) : (
                          <p style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>{q.question_text}</p>
                        )}
                      </>
                    )}

                    {q.question_type === 'mcq' && !q.sub_questions && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>Options:</strong>
                        {editMode ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                            {(q.options || ['', '', '', '']).map((opt, i) => (
                              <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <span style={{ fontWeight: 'bold', minWidth: '20px', color: 'var(--text-primary)' }}>{String.fromCharCode(65 + i)}.</span>
                                <input
                                  type="text"
                                  className="form-input"
                                  value={opt}
                                  onChange={(e) => handleEditOption(index, i, e.target.value)}
                                  placeholder={`Option ${String.fromCharCode(65 + i)}`}
                                  style={{ flex: 1 }}
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <ul style={{ marginTop: '0.25rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                            {(q.options || []).map((opt, i) => (
                              <li
                                key={i}
                                style={{
                                  color: (showAnswers && opt === q.correct_answer) ? 'var(--success)' : 'var(--text-primary)',
                                  fontWeight: (showAnswers && opt === q.correct_answer) ? '600' : 'normal',
                                  marginBottom: '0.25rem'
                                }}
                              >
                                {opt} {showAnswers && opt === q.correct_answer && '✓ Correct'}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* Sub-Questions Section */}
                    {q.sub_questions && q.sub_questions.length > 0 && (() => {
                      // Check if this question actually has sub-questions or just a 'main' placeholder
                      const hasRealSubQuestions = q.sub_questions.some(sq => 
                        sq.sub_question_number !== 'main' && !sq.sub_question_number?.toString().toLowerCase().includes('main')
                      );
                      
                      return (
                        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '2px solid var(--border-color)' }}>
                          {/* Only show "Sub-Questions" header if there are real sub-questions */}
                          {hasRealSubQuestions && (
                            <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)', fontSize: '1rem' }}>
                              📋 Sub-Questions ({q.sub_questions.length})
                            </h4>
                          )}
                          {q.sub_questions.map((subQ, subIndex) => {
                            const isExpanded = expandedSubQuestions[`${index}-${subIndex}`];
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
                                {/* Sub-Question Header - Clickable */}
                                <div
                                  onClick={() => toggleSubQuestion(index, subIndex)}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '1rem',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s ease',
                                    background: isExpanded ? 'var(--primary-light)' : 'transparent'
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isExpanded) e.currentTarget.style.background = 'var(--bg-primary)';
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isExpanded) e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span style={{ fontSize: '1.25rem', transition: 'transform 0.2s ease', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                                      ▶
                                    </span>
                                    <strong style={{ color: 'var(--primary)', fontSize: '1rem' }}>
                                      {/* Show Q1.main format for main sub-questions, otherwise show normal numbering */}
                                      {isMainSubQuestion 
                                        ? `Q${index + 1}.main`
                                        : (subQ.full_question_number || `${index + 1}.${subQ.sub_question_number}`)
                                      }
                                    </strong>
                                  </div>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                  <span className="badge badge-info">{subQ.question_type}</span>
                                  <span className="badge badge-success">{subQ.marks} marks</span>
                                  {subQ.variations && (
                                    <span className="badge badge-primary">{subQ.variations.length} variations</span>
                                  )}
                                </div>
                              </div>

                              {/* Variations - Collapsible */}
                              {isExpanded && subQ.variations && subQ.variations.length > 0 && (
                                <div 
                                  ref={el => variationsRefs.current[subQ.sub_question_id] = el}
                                  style={{ padding: '1rem', paddingTop: '0.5rem', background: 'var(--bg-primary)' }}
                                >
                                  {/* AI Recommendation Section */}
                                  {selectedPaper?.status !== 'confirmed_by_examiner' && selectedPaper?.status !== 'finalized' && subQ.variations.filter(v => v.status === 'draft').length > 0 && !showingRecommendations[subQ.sub_question_id] && (
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
                                          max={subQ.variations.filter(v => v.status === 'draft').length}
                                          value={aiInputNumbers[subQ.sub_question_id] ?? ''}
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            if (value === '') {
                                              setAiInputNumbers(prev => ({
                                                ...prev,
                                                [subQ.sub_question_id]: ''
                                              }));
                                            } else {
                                              const numValue = parseInt(value);
                                              if (!isNaN(numValue)) {
                                                const maxValue = subQ.variations.filter(v => v.status === 'draft').length;
                                                setAiInputNumbers(prev => ({
                                                  ...prev,
                                                  [subQ.sub_question_id]: Math.max(1, Math.min(numValue, maxValue))
                                                }));
                                              }
                                            }
                                          }}
                                          onBlur={(e) => {
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
                                          / {subQ.variations.filter(v => v.status === 'draft').length} available
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
                                          Review the AI's top picks below and apply to select them
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

                                      {/*  */}
                                    </div>
                                  )}

                                  {/* Send to SME Button */}
                                  {selectedPaper?.status !== 'confirmed_by_examiner' && selectedPaper?.status !== 'finalized' && selectedVariationsForSME[subQ.sub_question_id]?.length > 0 && (
                                    <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'var(--primary-light)', borderRadius: '0.5rem', border: '1px solid var(--primary)' }}>
                                      <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: '600' }}>
                                        ✓ {selectedVariationsForSME[subQ.sub_question_id].length} variation(s) selected
                                      </span>
                                      <button
                                        className="btn btn-primary btn-sm"
                                        onClick={() => handleSendVariationsToSME(subQ.sub_question_id)}
                                        disabled={saving}
                                      >
                                        {saving ? '⏳ Sending...' : '📤 Send to SME'}
                                      </button>
                                    </div>
                                  )}
                                  {/* Variations Grid */}
                                  <div style={{
                                    display: 'grid',
                                    gap: '1rem',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))'
                                  }}>
                                    {(paginatedVariations[subQ.sub_question_id] || subQ.variations || []).map((variation, varIndex) => (
                                      <div key={varIndex} style={{
                                        padding: '0.75rem',
                                        background: variation.is_selected ? 'var(--success-light)' :
                                          (selectedVariationsForSME[subQ.sub_question_id]?.includes(variation.variation_id) ? 'var(--primary-light)' : 'var(--bg-primary)'),
                                        borderRadius: '0.5rem',
                                        border: variation.is_selected ? '2px solid var(--success)' :
                                          (selectedVariationsForSME[subQ.sub_question_id]?.includes(variation.variation_id) ? '2px solid var(--primary)' : '1px solid var(--border-color)'),
                                        position: 'relative',
                                        opacity: (editMode && variation.status !== 'draft') ? 0.6 : 1
                                      }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {/* Checkbox for selection */}
                                            {!editMode && selectedPaper?.status !== 'confirmed_by_examiner' && selectedPaper?.status !== 'finalized' && variation.status === 'draft' && !variation.is_selected && (
                                              <input
                                                type="checkbox"
                                                checked={selectedVariationsForSME[subQ.sub_question_id]?.includes(variation.variation_id) || false}
                                                onChange={() => toggleVariationSelection(subQ.sub_question_id, variation.variation_id)}
                                                style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                              />
                                            )}
                                            <span style={{
                                              fontSize: '0.75rem',
                                              fontWeight: '600',
                                              color: 'var(--text-secondary)',
                                              background: 'var(--bg-secondary)',
                                              padding: '0.25rem 0.5rem',
                                              borderRadius: '0.25rem'
                                            }}>
                                              Variation {variation.variation_number}
                                            </span>
                                            <QuestionMetadataInfo question={variation} />
                                            {/* Lock icon for non-draft variations in edit mode */}
                                            {editMode && variation.status !== 'draft' && (
                                              <span style={{ fontSize: '0.875rem', color: 'var(--warning)' }} title="Cannot edit - already sent to SME">
                                                🔒
                                              </span>
                                            )}
                                          </div>
                                          {variation.is_selected ? (
                                            <span style={{ fontSize: '1.25rem' }}>⭐</span>
                                          ) : null}
                                        </div>

                                        {/* Read-only banner for non-draft variations in edit mode */}
                                        {editMode && variation.status !== 'draft' && (
                                          <div style={{
                                            padding: '0.5rem',
                                            background: 'var(--warning-light)',
                                            border: '1px solid var(--warning)',
                                            borderRadius: '0.25rem',
                                            marginBottom: '0.5rem',
                                            fontSize: '0.75rem',
                                            fontWeight: '600',
                                            color: 'var(--warning)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem'
                                          }}>
                                            🔒 READ-ONLY - Already sent to SME
                                          </div>
                                        )}

                                        {/* Question Text - Editable in edit mode ONLY if status is draft */}
                                        {(() => {
                                          const isEditable = editMode && variation.status === 'draft';
                                          console.log(`Variation ${variation.variation_number}: editMode=${editMode}, status=${variation.status}, isEditable=${isEditable}`);
                                          return isEditable ? (
                                            <textarea
                                              className="form-input"
                                              value={variation.question_text}
                                              onChange={(e) => {
                                                const updatedQuestions = [...editedQuestions];
                                                // Find the actual variation by variation_id instead of using varIndex
                                                const actualVariationIndex = updatedQuestions[index].sub_questions[subIndex].variations.findIndex(
                                                  v => v.variation_id === variation.variation_id
                                                );
                                                if (actualVariationIndex !== -1) {
                                                  updatedQuestions[index].sub_questions[subIndex].variations[actualVariationIndex].question_text = e.target.value;
                                                  setEditedQuestions(updatedQuestions);
                                                }
                                              }}
                                              rows="3"
                                              style={{ fontSize: '0.875rem', marginBottom: '0.5rem', width: '100%' }}
                                            />
                                          ) : (
                                            <p style={{
                                              fontSize: '0.875rem',
                                              color: 'var(--text-primary)',
                                              marginBottom: '0.5rem',
                                              lineHeight: '1.4'
                                            }}>
                                              {variation.question_text}
                                            </p>
                                          );
                                        })()}

                                        {/* MCQ Options - Editable in edit mode ONLY if status is draft */}
                                        {variation.question_type === 'mcq' && variation.options && (
                                          <div style={{ marginTop: '0.5rem' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                                              Options:
                                            </div>
                                            {editMode && variation.status === 'draft' ? (
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                {variation.options.map((opt, optIndex) => (
                                                  <div key={optIndex} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                    <span style={{ fontWeight: 'bold', minWidth: '20px', fontSize: '0.75rem', color: 'var(--text-primary)' }}>
                                                      {String.fromCharCode(65 + optIndex)}.
                                                    </span>
                                                    <input
                                                      type="text"
                                                      className="form-input"
                                                      value={opt}
                                                      onChange={(e) => {
                                                        const updatedQuestions = [...editedQuestions];
                                                        // Find the actual variation by variation_id instead of using varIndex
                                                        const actualVariationIndex = updatedQuestions[index].sub_questions[subIndex].variations.findIndex(
                                                          v => v.variation_id === variation.variation_id
                                                        );
                                                        if (actualVariationIndex !== -1) {
                                                          updatedQuestions[index].sub_questions[subIndex].variations[actualVariationIndex].options[optIndex] = e.target.value;
                                                          setEditedQuestions(updatedQuestions);
                                                        }
                                                      }}
                                                      placeholder={`Option ${String.fromCharCode(65 + optIndex)}`}
                                                      style={{ flex: 1, fontSize: '0.75rem', padding: '0.375rem 0.5rem' }}
                                                    />
                                                  </div>
                                                ))}
                                              </div>
                                            ) : (
                                              <ul style={{
                                                margin: 0,
                                                paddingLeft: '1.25rem',
                                                fontSize: '0.8rem',
                                                color: 'var(--text-primary)'
                                              }}>
                                                {variation.options.map((opt, optIndex) => (
                                                  <li key={optIndex} style={{
                                                    marginBottom: '0.25rem',
                                                    color: (showAnswers && opt === variation.correct_answer) ? 'var(--success)' : 'var(--text-primary)',
                                                    fontWeight: (showAnswers && opt === variation.correct_answer) ? '600' : 'normal'
                                                  }}>
                                                    {opt} {showAnswers && opt === variation.correct_answer && '✓'}
                                                  </li>
                                                ))}
                                              </ul>
                                            )}
                                          </div>
                                        )}

                                        {/* Answer - Editable in edit mode ONLY if status is draft */}
                                        {((editMode && variation.status === 'draft') || showAnswers) && (
                                          <div style={{
                                            marginTop: '0.5rem',
                                            padding: '0.5rem',
                                            background: (editMode && variation.status === 'draft') ? 'var(--bg-secondary)' : 'var(--success-light)',
                                            borderRadius: '0.25rem',
                                            fontSize: '0.75rem',
                                            border: (editMode && variation.status === 'draft') ? '1px solid var(--border-color)' : 'none'
                                          }}>
                                            <strong style={{ color: (editMode && variation.status === 'draft') ? 'var(--text-primary)' : 'var(--success)' }}>
                                              {(editMode && variation.status === 'draft') ? 'Correct Answer:' : 'Answer:'}
                                            </strong>
                                            {(editMode && variation.status === 'draft') ? (
                                              variation.question_type === 'mcq' ? (
                                                <select
                                                  className="form-select"
                                                  value={variation.correct_answer || ''}
                                                  onChange={(e) => {
                                                    const updatedQuestions = [...editedQuestions];
                                                    // Find the actual variation by variation_id instead of using varIndex
                                                    const actualVariationIndex = updatedQuestions[index].sub_questions[subIndex].variations.findIndex(
                                                      v => v.variation_id === variation.variation_id
                                                    );
                                                    if (actualVariationIndex !== -1) {
                                                      updatedQuestions[index].sub_questions[subIndex].variations[actualVariationIndex].correct_answer = e.target.value;
                                                      setEditedQuestions(updatedQuestions);
                                                    }
                                                  }}
                                                  style={{ fontSize: '0.75rem', padding: '0.375rem 0.5rem', marginTop: '0.25rem' }}
                                                >
                                                  <option value="">Select correct option...</option>
                                                  {variation.options.map((opt, optIndex) => (
                                                    <option key={optIndex} value={opt}>
                                                      {String.fromCharCode(65 + optIndex)}. {opt}
                                                    </option>
                                                  ))}
                                                </select>
                                              ) : (
                                                <textarea
                                                  className="form-input"
                                                  value={variation.correct_answer || ''}
                                                  onChange={(e) => {
                                                    const updatedQuestions = [...editedQuestions];
                                                    // Find the actual variation by variation_id instead of using varIndex
                                                    const actualVariationIndex = updatedQuestions[index].sub_questions[subIndex].variations.findIndex(
                                                      v => v.variation_id === variation.variation_id
                                                    );
                                                    if (actualVariationIndex !== -1) {
                                                      updatedQuestions[index].sub_questions[subIndex].variations[actualVariationIndex].correct_answer = e.target.value;
                                                      setEditedQuestions(updatedQuestions);
                                                    }
                                                  }}
                                                  rows="2"
                                                  placeholder="Enter the correct answer..."
                                                  style={{ fontSize: '0.75rem', padding: '0.375rem 0.5rem', marginTop: '0.25rem' }}
                                                />
                                              )
                                            ) : (
                                              <div style={{ color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                                                {variation.correct_answer}
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        {/* Status Badge - Always visible */}
                                        <div style={{ marginTop: '0.5rem' }}>
                                          {getStatusBadge(variation.status)}
                                        </div>
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

                    {/* Answer section for all question types (old flat structure) */}
                    {!q.sub_questions && (
                      <div style={{ marginTop: '0.5rem' }}>
                        {editMode ? (
                          <div>
                            <label className="form-label">
                              {q.question_type === 'mcq' ? 'Correct Answer:' : 'Expected Answer:'}
                            </label>
                            {q.question_type === 'long_answer' ? (
                              <textarea
                                className="form-input"
                                value={q.correct_answer || ''}
                                onChange={(e) => handleEditQuestion(index, 'correct_answer', e.target.value)}
                                placeholder="Enter expected answer..."
                                rows={4}
                              />
                            ) : (
                              <input
                                type="text"
                                className="form-input"
                                value={q.correct_answer || ''}
                                onChange={(e) => handleEditQuestion(index, 'correct_answer', e.target.value)}
                                placeholder={q.question_type === 'mcq' ? 'Enter correct answer...' : 'Enter expected answer...'}
                              />
                            )}
                          </div>
                        ) : showAnswers && q.correct_answer && (
                          <div style={{
                            padding: '0.75rem',
                            background: 'var(--success-light)',
                            borderRadius: '0.5rem',
                            border: '1px solid var(--success)',
                            marginTop: '0.5rem'
                          }}>
                            <strong style={{ color: 'var(--success)' }}>
                              ✓ {q.question_type === 'mcq' ? 'Correct Answer:' : 'Expected Answer:'}
                            </strong>
                            <div style={{ color: 'var(--text-primary)', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
                              {q.correct_answer}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center' }}>No questions available. {editMode && 'Click "Add Question" to create one.'}</p>
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ isOpen: false })}
        onConfirm={modalConfig.onConfirm}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        confirmText={modalConfig.confirmText}
      />

      {/* PDF Relevance Warning Modal */}
      <Modal
        isOpen={showRelevanceWarning}
        onClose={handleCancelGeneration}
        title="⚠️ Low PDF Relevance"
        type="warning"
        confirmText="Continue with PDF"
        onConfirm={() => {
          // Set userProceeded to true to allow using the PDF despite low relevance
          setPdfValidation(prev => ({
            ...prev,
            userProceeded: true
          }));
          setShowRelevanceWarning(false);
          // Trigger generation again with the PDF
          setTimeout(() => handleGenerateVariations(), 100);
        }}
      >
        <div style={{ padding: '1rem 0' }}>
          <p>The uploaded PDF has a low relevance score ({pdfValidation?.relevanceScore}% &lt; 30%) for the specified topic and subject.</p>
          <p>You can still proceed with generation, but the questions may not be well-aligned with your PDF content.</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
            <button
              className="btn btn-outline"
              onClick={handleCancelGeneration}
              style={{ marginRight: 'auto' }}
            >
              Cancel
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleProceedWithoutPdf}
            >
              Continue without PDF
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                // Set userProceeded to true to allow using the PDF despite low relevance
                setPdfValidation(prev => ({
                  ...prev,
                  userProceeded: true
                }));
                setShowRelevanceWarning(false);
                // Trigger generation again with the PDF
                setTimeout(() => handleGenerateVariations(), 100);
              }}
            >
              Continue with PDF
            </button>
          </div>
        </div>
      </Modal>

      {/* Processing Modal - Removed (not used in current flow) */}

      {/* Progress Modal for Variation Generation */}
      {showProgressModal && (
        <div className="modal-overlay" style={{
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
          <div className="modal-content" style={{
            background: 'var(--bg-primary)',
            padding: '2.5rem',
            borderRadius: '1rem',
            maxWidth: '500px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
          }}>
            {/* Animated Spinner */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div className="spinner" style={{
                width: '60px',
                height: '60px',
                border: '4px solid var(--border-color)',
                borderTop: '4px solid var(--primary)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto'
              }}></div>
            </div>

            {/* Title */}
            <h3 style={{
              color: 'var(--text-primary)',
              marginBottom: '1rem',
              fontSize: '1.5rem',
              fontWeight: '600'
            }}>
              ✨ Generating Variations
            </h3>

            {/* Extended Wait Warning Banner */}
            {generationProgress.showExtendedWaitWarning && (
              <div style={{
                background: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '4px',
                padding: '12px',
                marginBottom: '16px',
                color: '#856404'
              }}>
                <strong>⚠️ Taking longer than expected</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px' }}>
                  Due to network conditions, generation is taking longer than expected. 
                  Please wait while we complete the process...
                </p>
              </div>
            )}

            {/* Progress Stage */}
            <p style={{
              color: 'var(--text-secondary)',
              fontSize: '1rem',
              marginBottom: '1.5rem'
            }}>
              {generationProgress.stage}
            </p>

            {/* Progress Bar */}
            <div style={{
              width: '100%',
              height: '12px',
              background: 'var(--bg-secondary)',
              borderRadius: '6px',
              overflow: 'hidden',
              marginBottom: '1rem',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{
                width: `${(generationProgress.current / generationProgress.total) * 100}%`,
                height: '100%',
                background: 'linear-gradient(90deg, var(--primary), var(--success))',
                transition: 'width 0.3s ease',
                borderRadius: '6px'
              }}></div>
            </div>

            {/* Progress Counter */}
            <div style={{
              fontSize: '1.75rem',
              fontWeight: '700',
              color: 'var(--primary)',
              marginBottom: '0.5rem'
            }}>
              {generationProgress.current} / {generationProgress.total}
            </div>

            <p style={{
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
              marginTop: '1rem',
              fontStyle: 'italic'
            }}>
              Please wait while we generate unique question variations...
            </p>

            {/* Percentage */}
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem',
              background: 'var(--info-light)',
              borderRadius: '0.5rem',
              border: '1px solid var(--info)'
            }}>
              <span style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--info)' }}>
                {Math.round((generationProgress.current / generationProgress.total) * 100)}% Complete
              </span>
            </div>

            {/* Show spinner when at 99% and waiting */}
            {generationProgress.current >= generationProgress.total * 0.99 && (
              <div style={{
                marginTop: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                color: 'var(--text-secondary)',
                fontSize: '0.875rem'
              }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  border: '3px solid var(--border-color)',
                  borderTop: '3px solid var(--primary)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <span>Finalizing...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cooldown Modal to Prevent Model Overload */}
      {showCooldownModal && (
        <div className="modal-overlay" style={{
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
          <div className="modal-content" style={{
            background: 'var(--bg-primary)',
            padding: '2.5rem',
            borderRadius: '1rem',
            maxWidth: '450px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
          }}>
            {/* Icon */}
            <div style={{ 
              fontSize: '4rem', 
              marginBottom: '1rem',
              animation: 'pulse 2s ease-in-out infinite'
            }}>
              ⏳
            </div>

            {/* Title */}
            <h3 style={{
              color: 'var(--text-primary)',
              marginBottom: '1rem',
              fontSize: '1.5rem',
              fontWeight: '600'
            }}>
              Preparing Generation
            </h3>

            {/* Message */}
            <p style={{
              color: 'var(--text-secondary)',
              fontSize: '1rem',
              marginBottom: '1.5rem',
              lineHeight: '1.6'
            }}>
              Please wait while we prepare the AI model for question generation. This prevents overload and ensures quality.
            </p>

            {/* Countdown Timer */}
            <div style={{
              fontSize: '3rem',
              fontWeight: '700',
              color: 'var(--primary)',
              marginBottom: '1rem',
              fontFamily: 'monospace'
            }}>
              {validationCooldown}s
            </div>

            {/* Progress Ring */}
            <div style={{
              width: '100px',
              height: '100px',
              margin: '0 auto',
              position: 'relative'
            }}>
              <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}>
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="var(--border-color)"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 45}`}
                  strokeDashoffset={`${2 * Math.PI * 45 * (validationCooldown / 10)}`}
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
            </div>

            <p style={{
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
              marginTop: '1.5rem',
              fontStyle: 'italic'
            }}>
              Generation will start automatically...
            </p>
          </div>
        </div>
      )}

      {/* Send to SME Confirmation Modal - Removed (old 10-set system) */}

      {/* Mark as Complete Confirmation Modal */}
      {showCompletionModal && paperToComplete && (
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
                <span style={{ fontSize: '1.5rem' }}>✅</span>
                Confirm All Variations
              </h3>
            </div>
            <div style={{ padding: '2rem' }}>
              <p style={{ fontSize: '1rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                Are you sure you want to confirm all variations for <strong>"{paperToComplete.paperTitle}"</strong>?
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
                  <li style={{ marginBottom: '0.5rem' }}>All variations will be marked as "Examiner Approved"</li>
                  <li style={{ marginBottom: '0.5rem' }}>SME can review and send to moderator</li>
                  <li>You can still add more variations if needed</li>
                  <li style={{color:'red', fontWeight:'bold'}}>Make sure you’ve selected all the questions before proceeding</li>
                </ul>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowCompletionModal(false);
                    setPaperToComplete(null);
                  }}
                  className="btn btn-secondary"
                  disabled={saving}
                  style={{ minWidth: '100px' }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmMarkAsComplete}
                  className="btn btn-success"
                  disabled={saving}
                  style={{ minWidth: '150px' }}
                >
                  {saving ? (
                    <>
                      <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px', marginRight: '0.5rem' }}></span>
                      Confirming...
                    </>
                  ) : (
                    <>✅ Yes, Confirm All</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Paper Confirmation Modal */}
      {showDeleteModal && paperToDelete && (
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
            <div className="card-header" style={{ background: 'var(--error-light)', borderBottom: '2px solid var(--error)' }}>
              <h3 className="card-title" style={{ color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🗑️</span>
                Delete Paper
              </h3>
            </div>
            <div style={{ padding: '2rem' }}>
              <p style={{ fontSize: '1rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                Are you sure you want to delete <strong>"{paperToDelete.paperTitle}"</strong>?
              </p>

              <div style={{
                background: 'var(--error-light)',
                border: '1px solid var(--error)',
                borderRadius: '0.5rem',
                padding: '1rem',
                marginBottom: '1.5rem'
              }}>
                <div style={{ fontWeight: '600', marginBottom: '0.75rem', color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>⚠️</span>
                  This will permanently delete:
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.5rem', color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                  <li style={{ marginBottom: '0.5rem' }}>The paper</li>
                  <li style={{ marginBottom: '0.5rem' }}>All questions</li>
                  <li style={{ marginBottom: '0.5rem' }}>All sub-questions</li>
                  <li style={{ marginBottom: '0.5rem' }}>All variations</li>
                </ul>
                <div style={{ 
                  marginTop: '1rem', 
                  padding: '0.75rem', 
                  background: 'rgba(220, 38, 38, 0.1)', 
                  borderRadius: '0.375rem',
                  fontWeight: '700',
                  color: 'var(--error)',
                  textAlign: 'center'
                }}>
                  ⚠️ This action cannot be undone!
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setPaperToDelete(null);
                  }}
                  className="btn btn-secondary"
                  disabled={saving}
                  style={{ minWidth: '100px' }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeletePaper}
                  className="btn btn-danger"
                  disabled={saving}
                  style={{ minWidth: '150px' }}
                >
                  {saving ? (
                    <>
                      <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px', marginRight: '0.5rem' }}></span>
                      Deleting...
                    </>
                  ) : (
                    <>🗑️ Yes, Delete</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Paper Info Modal */}
      {showPaperInfoModal && (
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
        }}
        onClick={handleClosePaperInfo}
        >
          <div 
            className="card" 
            style={{ width: '700px', maxWidth: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header" style={{ background: 'var(--primary-light)', borderBottom: '2px solid var(--primary)', flexShrink: 0 }}>
              <h3 className="card-title" style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.5rem' }}>📋</span>
                {paperInfoData?.paper_title || 'Paper Information'}
              </h3>
            </div>
            <div style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
              {paperInfoLoading && (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '4px', margin: '0 auto 1rem' }}></div>
                  <p style={{ color: 'var(--text-secondary)' }}>Loading paper information...</p>
                </div>
              )}

              {paperInfoError && (
                <div style={{
                  background: 'var(--error-light)',
                  border: '1px solid var(--error)',
                  borderRadius: '0.5rem',
                  padding: '1.5rem',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>❌</div>
                  <p style={{ color: 'var(--error)', fontWeight: '600', marginBottom: '1rem' }}>{paperInfoError}</p>
                  <button
                    onClick={() => {
                      const paper = existingPaperNames.find(p => p.paper_id === parseInt(selectedExistingPaper));
                      if (paper) {
                        handleOpenPaperInfo(selectedExistingPaper, paper.paper_title);
                      }
                    }}
                    className="btn btn-primary"
                    style={{ minWidth: '120px' }}
                  >
                    Retry
                  </button>
                </div>
              )}

              {!paperInfoLoading && !paperInfoError && paperInfoData && (
                <>
                  {paperInfoData.questions && paperInfoData.questions.length > 0 ? (
                    <div>
                      <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '0.5rem' }}>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                          Total Questions
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary)' }}>
                          {paperInfoData.questions.length}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {paperInfoData.questions.map((question, qIndex) => (
                          <div key={question.question_id} style={{
                            border: '2px solid var(--border-color)',
                            borderRadius: '0.75rem',
                            padding: '1.25rem',
                            background: 'var(--bg-primary)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.75rem' }}>
                              <div style={{
                                minWidth: '40px',
                                height: '40px',
                                borderRadius: '8px',
                                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontWeight: '700',
                                fontSize: '0.875rem'
                              }}>
                                Q{qIndex + 1}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', marginBottom: '0.5rem', lineHeight: '1.5' }}>
                                  {question.question_text?.substring(0, 100)}{question.question_text?.length > 100 ? '...' : ''}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <span style={{
                                    padding: '0.25rem 0.625rem',
                                    background: 'rgba(102, 126, 234, 0.1)',
                                    color: '#667eea',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: '600'
                                  }}>
                                    {question.question_type}
                                  </span>
                                  <span style={{
                                    padding: '0.25rem 0.625rem',
                                    background: 'rgba(17, 153, 142, 0.1)',
                                    color: '#11998e',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: '600'
                                  }}>
                                    {question.marks} marks
                                  </span>
                                  <span style={{
                                    padding: '0.25rem 0.625rem',
                                    background: question.variation_count > 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(156, 163, 175, 0.1)',
                                    color: question.variation_count > 0 ? '#22c55e' : '#6b7280',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: '600'
                                  }}>
                                    {question.variation_count} variations
                                  </span>
                                </div>
                              </div>
                            </div>

                            {question.sub_questions && question.sub_questions.length > 0 && (
                              <div style={{ marginTop: '1rem', paddingLeft: '1rem', borderLeft: '3px solid var(--border-color)' }}>
                                <div style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                                  Sub-Questions ({question.sub_questions.length})
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                  {question.sub_questions.map((subQ) => (
                                    <div key={subQ.sub_question_id} style={{
                                      padding: '0.75rem 1rem',
                                      background: 'var(--bg-secondary)',
                                      borderRadius: '0.5rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between'
                                    }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{
                                          width: '28px',
                                          height: '28px',
                                          borderRadius: '6px',
                                          background: 'rgba(245, 158, 11, 0.1)',
                                          border: '1px solid rgba(245, 158, 11, 0.3)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          color: '#d97706',
                                          fontWeight: '700',
                                          fontSize: '0.75rem'
                                        }}>
                                          {subQ.sub_question_number}
                                        </div>
                                        <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                                          {subQ.marks} marks
                                        </span>
                                      </div>
                                      <span style={{
                                        padding: '0.25rem 0.625rem',
                                        background: subQ.variation_count > 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(156, 163, 175, 0.1)',
                                        color: subQ.variation_count > 0 ? '#22c55e' : '#6b7280',
                                        borderRadius: '4px',
                                        fontSize: '0.75rem',
                                        fontWeight: '600'
                                      }}>
                                        {subQ.variation_count} variations
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      textAlign: 'center',
                      padding: '3rem 1rem',
                      background: 'var(--bg-secondary)',
                      borderRadius: '0.75rem'
                    }}>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
                      <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No Questions Yet</h4>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        This paper doesn't have any questions yet. Generate some variations to get started!
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
            <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
              <button
                onClick={handleClosePaperInfo}
                className="btn btn-primary"
                style={{ width: '100%' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Relevance Warning Modal */}
      {showRelevanceWarning && pdfValidation && (
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
            padding: '2rem',
            maxWidth: '600px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            border: '2px solid var(--warning)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '1rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{
                fontSize: '3rem',
                lineHeight: 1
              }}>⚠️</div>
              <div style={{ flex: 1 }}>
                <h3 style={{
                  margin: '0 0 0.5rem 0',
                  color: 'var(--warning)',
                  fontSize: '1.5rem'
                }}>
                  Low PDF Relevance
                </h3>
                <p style={{
                  margin: 0,
                  fontSize: '1rem',
                  color: 'var(--text-primary)',
                  lineHeight: 1.6
                }}>
                  The uploaded PDF does not appear to contain relevant content for the subject <strong>"{paperForm.subject}"</strong>{paperForm.chapters ? ` (Topics: ${paperForm.chapters})` : ''}.
                </p>
              </div>
            </div>

            <div style={{
              background: 'var(--bg-secondary)',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.5rem'
              }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Relevance Score:</span>
                <span style={{ color: 'var(--warning)', fontWeight: '600' }}>{pdfValidation.relevanceScore}/100</span>
              </div>
              {pdfValidation.reasoning && (
                <div style={{
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  marginTop: '0.75rem',
                  fontStyle: 'italic'
                }}>
                  "{pdfValidation.reasoning}"
                </div>
              )}
            </div>

            <div style={{
              background: 'var(--info-light)',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem',
              fontSize: '0.875rem',
              color: 'var(--text-primary)'
            }}>
              <strong>You have two options:</strong>
              <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem' }}>
                <li><strong>Proceed with PDF:</strong> Use the PDF anyway (may generate less relevant questions)</li>
                <li><strong>Proceed without PDF:</strong> Generate questions based on topic/subject only</li>
              </ul>
            </div>

            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'flex-end',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={handleCancelGeneration}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  border: '2px solid var(--border-color)',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}>
                Cancel
              </button>
              <button
                onClick={handleProceedWithoutPdf}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  border: '2px solid var(--primary)',
                  background: 'transparent',
                  color: 'var(--primary)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}>
                📝 Proceed Without PDF
              </button>
              <button
                onClick={handleProceedWithPdf}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--warning)',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600'
                }}>
                📄 Proceed With PDF Anyway
              </button>
            </div>
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

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
      `}</style>

      {/* Voice Assistant UI - Only show on Generate Questions page */}
      {isGeneratePage && (
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
          continuousMode={voiceAssistant.continuousMode}
          onToggleContinuousMode={voiceAssistant.setContinuousMode}
          currentSuggestions={voiceAssistant.currentSuggestions}
          workflowState={voiceAssistant.workflowState}
        />
      )}
    </div>
  );
};

export default FacultyDashboard;
