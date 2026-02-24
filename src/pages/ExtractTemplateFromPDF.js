import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';
import { useToast } from '../context/ToastContext';
import './PaperTemplates.css';

const ExtractTemplateFromPDF = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedStructure, setExtractedStructure] = useState(null);
  const [saving, setSaving] = useState(false);
  const [autoAdjustEnabled, setAutoAdjustEnabled] = useState(false);
  const [formData, setFormData] = useState({
    template_name: '',
    description: '',
    questions: [],
    difficulty_weightage: {
      easy: 30,
      medium: 50,
      hard: 20
    },
    class_weightage: {
      class_11: 50,
      class_12: 50
    }
  });
  console.log("RETURNED WEIGHTAGE →", formData.class_weightage);


  // Class level options
  const CLASS_LEVELS = [
    { value: '', label: 'Not Specified' },
    { value: 'Class 11', label: 'Class 11' },
    { value: 'Class 12', label: 'Class 12' }
  ];

  // Helper function to safely get difficulty weightage
  const getDifficultyWeightage = () => {
    return formData.difficulty_weightage || { easy: 30, medium: 50, hard: 20 };
  };

  // Helper function to safely get class weightage
  const getClassWeightage = () => {
    return formData.class_weightage || { class_11: 50, class_12: 50 };
  };

  // Utility to shuffle arrays for randomization
  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Helper function to generate unique template name
  const generateUniqueTemplateName = (baseName, existingTemplates) => {
    if (!baseName) return baseName;
    
    const templateNames = existingTemplates.map(t => t.template_name);
    
    // Check if base name already exists
    if (!templateNames.includes(baseName)) {
      return baseName;
    }

    // Check for existing numbered versions (e.g., "Template 1", "Template 2")
    // Pattern matches: "BaseName" or "BaseName 1", "BaseName 2", etc.
    const escapedBaseName = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const namePattern = new RegExp(`^${escapedBaseName}(?:\\s+(\\d+))?$`);
    
    const numberedMatches = templateNames
      .map(name => {
        const match = name.match(namePattern);
        if (match) {
          // If no number group, it's the base name (count as 0)
          return match[1] ? parseInt(match[1], 10) : 0;
        }
        return null;
      })
      .filter(num => num !== null);

    // Find the next available number (starting from 1)
    if (numberedMatches.length === 0) {
      return `${baseName} 1`;
    }

    const maxNumber = Math.max(...numberedMatches);
    return `${baseName} ${maxNumber + 1}`;
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setExtractedStructure(null);
    } else {
      showToast('Please select a valid PDF file', 'error');
      e.target.value = '';
    }
  };

  const handleExtract = async () => {
    if (!file) {
      showToast('Please select a PDF file first', 'error');
      return;
    }

    setExtracting(true);
    const formDataObj = new FormData();
    formDataObj.append('pdf', file);

    try {
      // Fetch existing templates to check for duplicates
      const templatesResponse = await API.get('/templates');
      const existingTemplates = templatesResponse.data.templates || [];

      const { data } = await API.post('/template-extraction/extract-structure', formDataObj, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (data.success) {
        // Generate unique template name
        const baseTemplateName = data.structure.template_name || '';
        const uniqueTemplateName = generateUniqueTemplateName(baseTemplateName, existingTemplates);

        setExtractedStructure(data.structure);
        setFormData({
          template_name: uniqueTemplateName,
          description: data.structure.description || '',
          questions: data.structure.questions || [],
          difficulty_weightage: data.structure.difficulty_weightage || {
            easy: 30,
            medium: 50,
            hard: 20
          },
          class_weightage: data.structure.class_weightage || {
            class_11: 50,
            class_12:50
          }
        });
        showToast('Structure extracted successfully! Review and save.', 'success');
      }
    } catch (error) {
      console.error('Extraction error:', error);
      showToast(error.response?.data?.message || 'Failed to extract structure', 'error');
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!formData.template_name.trim()) {
      showToast('Please enter a template name', 'error');
      return;
    }

    if (formData.questions.length === 0) {
      showToast('No questions found to save', 'error');
      return;
    }

    // Ensure difficulty_weightage exists with defaults if missing
    const weightage = formData.difficulty_weightage || { easy: 30, medium: 50, hard: 20 };

    // Validate weightage totals 100%
    const totalWeightage = (weightage.easy || 0) + (weightage.medium || 0) + (weightage.hard || 0);
    if (totalWeightage !== 100) {
      showToast(`Difficulty weightage must total 100%. Current total: ${totalWeightage}%`, 'error');
      return;
    }

    // Validate class weightage totals 100%
    const classWeightage = getClassWeightage();
    const class11Val = Number(classWeightage.class_11) || 0;
    const class12Val = Number(classWeightage.class_12) || 0;
    const totalClassWeightage = class11Val + class12Val;
    console.log('Class weightage validation:', { class11Val, class12Val, totalClassWeightage, classWeightage });
    if (totalClassWeightage !== 100) {
      showToast(`Class weightage must total 100%. Current total: ${totalClassWeightage}%`, 'error');
      return;
    }

    // Update formData with validated weightage
    const dataToSave = {
      ...formData,
      difficulty_weightage: weightage,
      class_weightage: classWeightage
    };

    setSaving(true);
    try {
      await API.post('/template-extraction/save-extracted-template', dataToSave);
      showToast('Template created successfully with difficulty weightage!', 'success');
      navigate('/paper-templates');
    } catch (error) {
      console.error('Save error:', error);
      showToast(error.response?.data?.message || 'Failed to save template', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleQuestionChange = (index, field, value) => {
    const newQuestions = [...formData.questions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };

    // If toggling has_subquestions
    if (field === 'has_subquestions') {
      if (value && newQuestions[index].subquestions.length === 0) {
        newQuestions[index].subquestions = [
          { 
            sub_number: 'a', 
            marks: 2, 
            difficulty: newQuestions[index].difficulty || 'medium',
            class_level: newQuestions[index].class_level || 'Class 11'
          }
        ];
      }
    }

    // Update formData with new questions
    const updatedFormData = { ...formData, questions: newQuestions };

    // If difficulty changed and NOT in auto-adjust mode, update target weightage to match actual distribution
    if (field === 'difficulty' && !autoAdjustEnabled) {
      const actualDist = calculateActualDistribution(newQuestions);
      updatedFormData.difficulty_weightage = {
        easy: actualDist.easy,
        medium: actualDist.medium,
        hard: actualDist.hard
      };
    }

    setFormData(updatedFormData);
  };

  // Removed getDifficultyBadge function - not needed

  const handleSubQuestionChange = (qIndex, sqIndex, field, value) => {
    const newQuestions = [...formData.questions];
    newQuestions[qIndex].subquestions[sqIndex] = {
      ...newQuestions[qIndex].subquestions[sqIndex],
      [field]: value
    };

    // Update formData with new questions
    const updatedFormData = { ...formData, questions: newQuestions };

    // If difficulty changed and NOT in auto-adjust mode, update target weightage to match actual distribution
    if (field === 'difficulty' && !autoAdjustEnabled) {
      const actualDist = calculateActualDistribution(newQuestions);
      updatedFormData.difficulty_weightage = {
        easy: actualDist.easy,
        medium: actualDist.medium,
        hard: actualDist.hard
      };
    }

    setFormData(updatedFormData);
  };

  const handleAddQuestion = () => {
    const nextNumber = formData.questions.length + 1;
    setFormData({
      ...formData,
      questions: [...formData.questions, {
        question_number: `Q${nextNumber}`,
        question_type: 'mcq',
        difficulty: 'medium',
        class_level: 'Class 11',
        has_subquestions: false,
        marks: 5,
        subquestions: []
      }]
    });
  };

  const handleRemoveQuestion = (index) => {
    const newQuestions = formData.questions.filter((_, i) => i !== index);
    const renumbered = newQuestions.map((q, i) => ({
      ...q,
      question_number: `Q${i + 1}`
    }));
    setFormData({ ...formData, questions: renumbered });
  };

  const handleAddSubQuestion = (qIndex) => {
    const newQuestions = [...formData.questions];
    const subCount = newQuestions[qIndex].subquestions.length;
    const nextLetter = String.fromCharCode(97 + subCount);

    newQuestions[qIndex].subquestions.push({
      sub_number: nextLetter,
      marks: 2,
      difficulty: newQuestions[qIndex].difficulty || 'medium',
      class_level: newQuestions[qIndex].class_level || 'Class 11'
    });

    setFormData({ ...formData, questions: newQuestions });
  };

  const handleRemoveSubQuestion = (qIndex, sqIndex) => {
    const newQuestions = [...formData.questions];
    newQuestions[qIndex].subquestions = newQuestions[qIndex].subquestions.filter((_, i) => i !== sqIndex);

    // Renumber sub-questions
    newQuestions[qIndex].subquestions = newQuestions[qIndex].subquestions.map((sq, i) => ({
      ...sq,
      sub_number: String.fromCharCode(97 + i)
    }));

    setFormData({ ...formData, questions: newQuestions });
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

  // Helper function to calculate total marks from questions array
  const calculateTotalMarks = (questions) => {
    return questions.reduce((sum, q) => {
      if (q.has_subquestions) {
        return sum + q.subquestions.reduce((subSum, sq) => subSum + (parseInt(sq.marks) || 0), 0);
      }
      return sum + (parseInt(q.marks) || 0);
    }, 0);
  };

  // Helper function to calculate actual distribution from questions array
  const calculateActualDistribution = (questions) => {
    let easyMarks = 0, mediumMarks = 0, hardMarks = 0;

    questions.forEach(q => {
      if (q.has_subquestions && q.subquestions) {
        q.subquestions.forEach(sq => {
          const marks = parseInt(sq.marks) || 0;
          if (sq.difficulty === 'easy') easyMarks += marks;
          else if (sq.difficulty === 'hard') hardMarks += marks;
          else mediumMarks += marks;
        });
      } else {
        const marks = parseInt(q.marks) || 0;
        if (q.difficulty === 'easy') easyMarks += marks;
        else if (q.difficulty === 'hard') hardMarks += marks;
        else mediumMarks += marks;
      }
    });

    const totalMarks = calculateTotalMarks(questions);
    if (totalMarks === 0) return { easy: 0, medium: 0, hard: 0 };

    return {
      easy: Math.round((easyMarks / totalMarks) * 100),
      medium: Math.round((mediumMarks / totalMarks) * 100),
      hard: Math.round((hardMarks / totalMarks) * 100)
    };
  };

  // Calculate actual difficulty distribution based on questions
  const getActualDifficultyDistribution = () => {
    let easyMarks = 0, mediumMarks = 0, hardMarks = 0;

    formData.questions.forEach(q => {
      if (q.has_subquestions && q.subquestions) {
        q.subquestions.forEach(sq => {
          const marks = parseInt(sq.marks) || 0;
          if (sq.difficulty === 'easy') easyMarks += marks;
          else if (sq.difficulty === 'hard') hardMarks += marks;
          else mediumMarks += marks;
        });
      } else {
        const marks = parseInt(q.marks) || 0;
        if (q.difficulty === 'easy') easyMarks += marks;
        else if (q.difficulty === 'hard') hardMarks += marks;
        else mediumMarks += marks;
      }
    });

    const totalMarks = getTotalMarks();
    if (totalMarks === 0) return { easy: 0, medium: 0, hard: 0, easyMarks: 0, mediumMarks: 0, hardMarks: 0 };

    return {
      easy: Math.round((easyMarks / totalMarks) * 100),
      medium: Math.round((mediumMarks / totalMarks) * 100),
      hard: Math.round((hardMarks / totalMarks) * 100),
      easyMarks,
      mediumMarks,
      hardMarks
    };
  };

  // Auto-adjust question difficulties based on target weightage
  const autoAdjustDifficulties = (silent = false) => {
    const totalMarks = getTotalMarks();
    if (totalMarks === 0 || formData.questions.length === 0) {
      if (!silent) showToast('No questions to adjust', 'warning');
      return;
    }

    const weightage = getDifficultyWeightage();
    const targetEasyMarks = Math.round((totalMarks * weightage.easy) / 100);
    const targetMediumMarks = Math.round((totalMarks * weightage.medium) / 100);
    const targetHardMarks = totalMarks - targetEasyMarks - targetMediumMarks;

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
            currentDifficulty: sq.difficulty || 'medium'
          });
        });
      } else {
        items.push({
          type: 'question',
          qIndex,
          marks: parseInt(q.marks) || 0,
          currentDifficulty: q.difficulty || 'medium'
        });
      }
    });

    // Sort by marks (descending) to assign harder questions to hard difficulty
    items.sort((a, b) => b.marks - a.marks);

    // Assign difficulties to match target distribution
    let easyMarks = 0,
      // eslint-disable-next-line no-unused-vars
      mediumMarks = 0,
      hardMarks = 0;
    const newQuestions = JSON.parse(JSON.stringify(formData.questions));

    items.forEach(item => {
      let assignedDifficulty = 'medium';

      // Assign based on which bucket needs more marks
      if (hardMarks < targetHardMarks) {
        assignedDifficulty = 'hard';
        hardMarks += item.marks;
      } else if (easyMarks < targetEasyMarks) {
        assignedDifficulty = 'easy';
        easyMarks += item.marks;
      } else {
        assignedDifficulty = 'medium';
        mediumMarks += item.marks;
      }

      // Apply the difficulty
      if (item.type === 'subquestion') {
        newQuestions[item.qIndex].subquestions[item.sqIndex].difficulty = assignedDifficulty;
      } else {
        newQuestions[item.qIndex].difficulty = assignedDifficulty;
      }
    });

    setFormData({ ...formData, questions: newQuestions });
    if (!silent) showToast('Question difficulties adjusted to match target weightage!', 'success');
  };

  // Handle difficulty weightage change with optional auto-adjust
  const handleWeightageChange = (level, value) => {
    const currentWeightage = getDifficultyWeightage();
    const newWeightage = { ...currentWeightage, [level]: value };
    setFormData({
      ...formData,
      difficulty_weightage: newWeightage
    });

    // If auto-adjust is enabled and total is 100%, automatically adjust questions
    if (autoAdjustEnabled) {
      const total = newWeightage.easy + newWeightage.medium + newWeightage.hard;
      if (total === 100) {
        // Use setTimeout to ensure state is updated first
        setTimeout(() => {
          autoAdjustDifficulties(true);
        }, 100);
      }
    }
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

    const weightage = getClassWeightage();
    const targetClass11Marks = Math.round((totalMarks * weightage.class_11) / 100);
    const targetClass12Marks = totalMarks - targetClass11Marks;

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

    // Shuffle for randomized distribution to avoid predictable assignments
    const shuffledItems = shuffleArray(items);

    // Assign class levels to match target distribution
    let class11Marks = 0, class12Marks = 0;
    const newQuestions = JSON.parse(JSON.stringify(formData.questions));

    shuffledItems.forEach(item => {
      let assignedClass = 'Class 11';

      // Assign based on which bucket needs more marks to reach its target
      const class11Deficit = targetClass11Marks - class11Marks;
      const class12Deficit = targetClass12Marks - class12Marks;

      if (class12Deficit > class11Deficit && class12Marks < targetClass12Marks) {
        assignedClass = 'Class 12';
        class12Marks += item.marks;
      } else if (class11Marks < targetClass11Marks) {
        assignedClass = 'Class 11';
        class11Marks += item.marks;
      } else {
        // If Class 11 is full, assign to Class 12
        assignedClass = 'Class 12';
        class12Marks += item.marks;
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

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">📄 Extract Template from PDF</h1>
          <p className="dashboard-subtitle" style={{ color: '#ffffff' }}>
            Upload a question paper PDF to automatically extract its structure
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/paper-templates')}>
          ← Back to Templates
        </button>
      </div>

      {/* Upload Section */}
      {!extractedStructure && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">📤 Upload Question Paper PDF</h2>
          </div>
          <div style={{ padding: '2rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Select PDF File</label>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="form-input"
                style={{ padding: '0.75rem' }}
              />
              {file && (
                <p style={{ marginTop: '0.5rem', color: 'var(--success)', fontSize: '0.875rem' }}>
                  ✓ Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                </p>
              )}
            </div>

            <button
              className="btn btn-primary"
              onClick={handleExtract}
              disabled={!file || extracting}
              style={{ width: '100%' }}
            >
              {extracting ? (
                <>
                  <span className="spinner" style={{ marginRight: '0.5rem' }}></span>
                  Extracting Structure...
                </>
              ) : (
                '🔍 Extract Structure'
              )}
            </button>

            <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <h4 style={{ marginBottom: '0.5rem', color: 'var(--primary)' }}>ℹ️ How it works:</h4>
              <ul style={{ marginLeft: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                <li>Upload a question paper PDF</li>
                <li>AI will analyze and extract the structure</li>
                <li>Review and edit the extracted questions</li>
                <li>Save as a reusable template</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Extracted Structure Review */}
      {extractedStructure && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">✏️ Review & Edit Extracted Structure</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => {
              setExtractedStructure(null);
              setFile(null);
              setFormData({
                template_name: '',
                description: '',
                questions: [],
                difficulty_weightage: {
                  easy: 30,
                  medium: 50,
                  hard: 20
                },
                class_weightage: {
                  class_11: 50,
                  class_12: 50
                }
              });
            }}>
              ↺ Upload Different PDF
            </button>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} style={{ padding: '1.5rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Template Name *</label>
              <input
                type="text"
                className="form-input"
                value={formData.template_name}
                onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                placeholder="e.g., Mid-Term Exam Template"
                required
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Description</label>
              <textarea
                className="form-input"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description..."
                rows={2}
              />
            </div>

            {/* Difficulty Weightage Section */}
            <div style={{ marginBottom: '1.5rem', padding: '1.5rem', background: 'var(--bg-secondary)', borderRadius: '12px', border: '2px solid var(--border-color)' }}>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>⚖️</span>
                    <span>Difficulty Weightage Distribution</span>
                  </h4>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600', color: 'var(--primary)' }} title="Toggle between manual question adjustment and automatic percentage-based adjustment">
                    <input
                      type="checkbox"
                      checked={autoAdjustEnabled}
                      onChange={(e) => setAutoAdjustEnabled(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>{autoAdjustEnabled ? '🔄 Auto-Adjust Mode' : '✋ Manual Mode'}</span>
                  </label>
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {autoAdjustEnabled
                    ? '🔄 Auto-Adjust Mode: Change percentages to automatically redistribute question difficulties to match your targets.'
                    : '📊 Manual Mode: Change percentages as needed. When you change question difficulties, percentages will auto-update to reflect reality.'}
                </p>
                <details style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: '600' }}>ℹ️ How AI determines difficulty (based on cognitive depth, not length)</summary>
                  <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg-primary)', borderRadius: '6px' }}>
                    <ul style={{ marginLeft: '1.5rem', lineHeight: '1.8', listStyle: 'none', paddingLeft: 0 }}>
                      <li style={{ marginBottom: '0.5rem' }}>
                        <strong style={{ color: 'var(--success)' }}>🟢 Easy:</strong> Requires only <strong>memorization/recall</strong>
                        <div style={{ marginLeft: '1.5rem', fontSize: '0.7rem', marginTop: '0.25rem' }}>
                          Can answer by remembering facts (e.g., "What is...?", "Define...", "List...")
                        </div>
                      </li>
                      <li style={{ marginBottom: '0.5rem' }}>
                        <strong style={{ color: 'var(--warning)' }}>🟡 Medium:</strong> Requires <strong>understanding & application</strong>
                        <div style={{ marginLeft: '1.5rem', fontSize: '0.7rem', marginTop: '0.25rem' }}>
                          Must understand concepts and apply them (e.g., "Why...?", "How...?", "Compare...")
                        </div>
                      </li>
                      <li>
                        <strong style={{ color: 'var(--danger)' }}>🔴 Hard:</strong> Requires <strong>deep thinking & synthesis</strong>
                        <div style={{ marginLeft: '1.5rem', fontSize: '0.7rem', marginTop: '0.25rem' }}>
                          Must integrate concepts and think critically (e.g., "Evaluate...", "Derive...", "Design...")
                        </div>
                      </li>
                    </ul>
                    <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: 'var(--warning-light)', borderRadius: '4px', fontSize: '0.7rem' }}>
                      <strong>⚠️ Important:</strong> Difficulty is based on <strong>depth of understanding</strong> required, NOT answer length or question type!
                    </div>
                  </div>
                </details>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                {/* Easy */}
                <div style={{ padding: '1rem', background: '#d4edda', borderRadius: '8px', border: '2px solid #28a745' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: '700', color: '#155724' }}>
                      🟢 Easy
                    </label>
                    {formData.questions.length > 0 && (() => {
                      const actual = getActualDifficultyDistribution();
                      return (
                        <span style={{ fontSize: '0.75rem', color: '#155724', fontWeight: '600' }}>
                          {actual.easyMarks}/{getTotalMarks()} marks
                        </span>
                      );
                    })()}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="number"
                      className="form-input"
                      value={getDifficultyWeightage().easy}
                      onChange={(e) => {
                        const value = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                        handleWeightageChange('easy', value);
                      }}
                      min="0"
                      max="100"
                      step="1"
                      style={{
                        padding: '0.5rem',
                        textAlign: 'center',
                        fontWeight: '700',
                        fontSize: '1.1rem'
                      }}
                      title={autoAdjustEnabled ? 'Edit to auto-adjust questions to match this percentage' : 'Edit target percentage (updates when you change question difficulties)'}
                    />
                    <span style={{ fontWeight: '700', color: '#155724', fontSize: '1.1rem' }}>%</span>
                  </div>
                </div>

                {/* Medium */}
                <div style={{ padding: '1rem', background: '#fff3cd', borderRadius: '8px', border: '2px solid #ffc107' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: '700', color: '#856404' }}>
                      🟡 Medium
                    </label>
                    {formData.questions.length > 0 && (() => {
                      const actual = getActualDifficultyDistribution();
                      return (
                        <span style={{ fontSize: '0.75rem', color: '#856404', fontWeight: '600' }}>
                          {actual.mediumMarks}/{getTotalMarks()} marks
                        </span>
                      );
                    })()}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="number"
                      className="form-input"
                      value={getDifficultyWeightage().medium}
                      onChange={(e) => {
                        const value = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                        handleWeightageChange('medium', value);
                      }}
                      min="0"
                      max="100"
                      step="1"
                      style={{
                        padding: '0.5rem',
                        textAlign: 'center',
                        fontWeight: '700',
                        fontSize: '1.1rem'
                      }}
                      title={autoAdjustEnabled ? 'Edit to auto-adjust questions to match this percentage' : 'Edit target percentage (updates when you change question difficulties)'}
                    />
                    <span style={{ fontWeight: '700', color: '#856404', fontSize: '1.1rem' }}>%</span>
                  </div>
                </div>

                {/* Hard */}
                <div style={{ padding: '1rem', background: '#f8d7da', borderRadius: '8px', border: '2px solid #dc3545' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: '700', color: '#721c24' }}>
                      🔴 Hard
                    </label>
                    {formData.questions.length > 0 && (() => {
                      const actual = getActualDifficultyDistribution();
                      return (
                        <span style={{ fontSize: '0.75rem', color: '#721c24', fontWeight: '600' }}>
                          {actual.hardMarks}/{getTotalMarks()} marks
                        </span>
                      );
                    })()}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="number"
                      className="form-input"
                      value={getDifficultyWeightage().hard}
                      onChange={(e) => {
                        const value = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                        handleWeightageChange('hard', value);
                      }}
                      min="0"
                      max="100"
                      step="1"
                      style={{
                        padding: '0.5rem',
                        textAlign: 'center',
                        fontWeight: '700',
                        fontSize: '1.1rem'
                      }}
                      title={autoAdjustEnabled ? 'Edit to auto-adjust questions to match this percentage' : 'Edit target percentage (updates when you change question difficulties)'}
                    />
                    <span style={{ fontWeight: '700', color: '#721c24', fontSize: '1.1rem' }}>%</span>
                  </div>
                </div>
              </div>

              {/* Total Indicator */}
              <div style={{
                padding: '0.75rem 1rem',
                background: (() => {
                  const weightage = getDifficultyWeightage();
                  const total = weightage.easy + weightage.medium + weightage.hard;
                  return total === 100 ? 'var(--success-light)' : 'var(--danger-light)';
                })(),
                borderRadius: '8px',
                border: `2px solid ${(() => {
                  const weightage = getDifficultyWeightage();
                  const total = weightage.easy + weightage.medium + weightage.hard;
                  return total === 100 ? 'var(--success)' : 'var(--danger)';
                })()}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontWeight: '600', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  Total Weightage:
                </span>
                <span style={{
                  fontWeight: '700',
                  fontSize: '1.25rem',
                  color: (() => {
                    const weightage = getDifficultyWeightage();
                    const total = weightage.easy + weightage.medium + weightage.hard;
                    return total === 100 ? 'var(--success)' : 'var(--danger)';
                  })()
                }}>
                  {(() => {
                    const weightage = getDifficultyWeightage();
                    return weightage.easy + weightage.medium + weightage.hard;
                  })()}%
                  {(() => {
                    const weightage = getDifficultyWeightage();
                    return (weightage.easy + weightage.medium + weightage.hard) === 100 ? ' ✓' : ' ⚠️';
                  })()}
                </span>
              </div>

              {/* Auto-Adjust Button */}
              {formData.questions.length > 0 && (() => {
                const weightage = getDifficultyWeightage();
                return (weightage.easy + weightage.medium + weightage.hard) === 100;
              })() && (
                  <div style={{ marginTop: '1rem' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={autoAdjustDifficulties}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    >
                      <span>🎯</span>
                      <span>Auto-Adjust Questions to Match Target Weightage</span>
                    </button>
                    <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                      This will automatically reassign question difficulties to match your target percentages
                    </p>
                  </div>
                )}

              {(() => {
                const weightage = getDifficultyWeightage();
                const total = weightage.easy + weightage.medium + weightage.hard;
                return total !== 100 && (
                  <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--warning-light)', borderRadius: '6px', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                    ⚠️ Total must equal 100%. Current total: {total}%
                  </div>
                );
              })()}
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
                      value={getClassWeightage().class_11 ?? 0}
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
                      min="0"
                      max="100"
                      step="1"
                      style={{
                        padding: '0.5rem',
                        textAlign: 'center',
                        fontWeight: '700',
                        fontSize: '1.1rem'
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
                      value={getClassWeightage().class_12 ?? 0}
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
                      min="0"
                      max="100"
                      step="1"
                      style={{
                        padding: '0.5rem',
                        textAlign: 'center',
                        fontWeight: '700',
                        fontSize: '1.1rem'
                      }}
                    />
                    <span style={{ fontWeight: '700', color: '#4a148c', fontSize: '1.1rem' }}>%</span>
                  </div>
                </div>
              </div>

              {/* Total Indicator */}
              <div style={{
                padding: '0.75rem 1rem',
                background: (() => {
                  const weightage = getClassWeightage();
                  const total = weightage.class_11 + weightage.class_12;
                  return total === 100 ? 'var(--success-light)' : 'var(--danger-light)';
                })(),
                borderRadius: '8px',
                border: `2px solid ${(() => {
                  const weightage = getClassWeightage();
                  const total = weightage.class_11 + weightage.class_12;
                  return total === 100 ? 'var(--success)' : 'var(--danger)';
                })()}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontWeight: '600', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  Total Class Distribution:
                </span>
                <span style={{
                  fontWeight: '700',
                  fontSize: '1.25rem',
                  color: (() => {
                    const weightage = getClassWeightage();
                    const total = weightage.class_11 + weightage.class_12;
                    return total === 100 ? 'var(--success)' : 'var(--danger)';
                  })()
                }}>
                  {(() => {
                    const weightage = getClassWeightage();
                    return weightage.class_11 + weightage.class_12;
                  })()}%
                  {(() => {
                    const weightage = getClassWeightage();
                    return (weightage.class_11 + weightage.class_12) === 100 ? ' ✓' : ' ⚠️';
                  })()}
                </span>
              </div>

              {(() => {
                const weightage = getClassWeightage();
                const total = weightage.class_11 + weightage.class_12;
                return total !== 100 && (
                  <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--warning-light)', borderRadius: '6px', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                    ⚠️ Total must equal 100%. Current total: {total}%
                  </div>
                );
              })()}

              {/* Auto-Adjust Button */}
              {formData.questions.length > 0 && (() => {
                const weightage = getClassWeightage();
                return (weightage.class_11 + weightage.class_12) === 100;
              })() && (
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
                <h3 className="form-section-title">Extracted Questions</h3>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <span className="total-marks-badge">
                    {formData.questions.length} Questions | {getTotalMarks()} Marks
                  </span>
                  <button type="button" className="btn-add-question" onClick={handleAddQuestion}>
                    ➕ Add Question
                  </button>
                </div>
              </div>

              <div className="template-questions-list">
                {formData.questions.map((q, qIndex) => (
                  <div key={qIndex} className="template-question-item">
                    <div className="question-header">
                      <span className="question-number-badge">{q.question_number}</span>

                      <div style={{ flex: 1, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Type:</span>
                        <input
                          type="text"
                          className="form-input"
                          value={q.question_type}
                          onChange={(e) => handleQuestionChange(qIndex, 'question_type', e.target.value)}
                          placeholder="e.g., mcq, short_answer, case_study"
                          list={`question-types-${qIndex}`}
                          style={{ flex: 1, padding: '0.5rem' }}
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

                      {/* Class Level and Difficulty Selectors */}
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
                        >
                          {CLASS_LEVELS.map(level => (
                            <option key={level.value} value={level.value}>
                              {level.label}
                            </option>
                          ))}
                        </select>

                        {/* Difficulty Selector */}
                        <select
                          className="form-input"
                          value={q.difficulty || 'medium'}
                          onChange={(e) => handleQuestionChange(qIndex, 'difficulty', e.target.value)}
                          style={{ padding: '0.5rem', minWidth: '120px' }}
                          title={q.difficulty_reason || 'AI-assigned difficulty based on question content'}
                        >
                          <option value="easy">🟢 Easy</option>
                          <option value="medium">🟡 Medium</option>
                          <option value="hard">🔴 Hard</option>
                        </select>
                        {q.difficulty_reason && (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-secondary)',
                              fontStyle: 'italic',
                              maxWidth: '150px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            title={q.difficulty_reason}
                          >
                            💡 {q.difficulty_reason}
                          </span>
                        )}
                      </div>

                      {!q.has_subquestions && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input
                            type="number"
                            className="marks-input"
                            value={q.marks}
                            onChange={(e) => handleQuestionChange(qIndex, 'marks', parseInt(e.target.value))}
                            min="1"
                          />
                          <span style={{ fontWeight: '600', color: 'var(--success)' }}>marks</span>
                        </div>
                      )}

                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={q.has_subquestions}
                          onChange={(e) => handleQuestionChange(qIndex, 'has_subquestions', e.target.checked)}
                        />
                        <span>Has Sub-questions</span>
                      </label>

                      <button
                        type="button"
                        className="btn-delete-question"
                        onClick={() => handleRemoveQuestion(qIndex)}
                        title="Delete Question"
                      >
                        🗑️
                      </button>
                    </div>

                    {q.has_subquestions && (
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

                            <span className="subquestion-type">{q.question_type}</span>

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
                              title={sq.difficulty_reason || 'AI-assigned difficulty based on question content'}
                            >
                              <option value="easy">🟢 Easy</option>
                              <option value="medium">🟡 Medium</option>
                              <option value="hard">🔴 Hard</option>
                            </select>
                            {sq.difficulty_reason && (
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  color: 'var(--text-secondary)',
                                  fontStyle: 'italic',
                                  maxWidth: '120px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                                title={sq.difficulty_reason}
                              >
                                💡 {sq.difficulty_reason}
                              </span>
                            )}

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
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setExtractedStructure(null);
                  setFile(null);
                  setFormData({
                    template_name: '',
                    description: '',
                    questions: [],
                    difficulty_weightage: {
                      easy: 30,
                      medium: 50,
                      hard: 20
                    },
                    class_weightage: {
                      class_11: 0,
                      class_12: 0
                    }
                  });
                }}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? (
                  <>
                    <span className="spinner" style={{ marginRight: '0.5rem' }}></span>
                    Saving...
                  </>
                ) : (
                  '💾 Save Template'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ExtractTemplateFromPDF;