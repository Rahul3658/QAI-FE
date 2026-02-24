/**
 * useVoiceAssistant - React hook for voice assistant functionality
 * 
 * Manages:
 * - Web Speech Recognition (STT)
 * - Web Speech Synthesis (TTS)
 * - Command sending to backend
 * - Response processing
 * - Error handling
 * - Browser compatibility
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import API from '../api/axios';

const useVoiceAssistant = ({ context, formState, onStateChange, onFieldSuggested, enabled = true }) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [assistantMessage, setAssistantMessage] = useState(null);
  const [error, setError] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isActive, setIsActive] = useState(false); // Track if assistant is actively running
  const [continuousMode, setContinuousMode] = useState(false); // Track continuous conversation mode
  const [currentSuggestions, setCurrentSuggestions] = useState([]); // Store current suggestions
  const [workflowState, setWorkflowState] = useState(null); // Store workflow state
  const [isPaused, setIsPaused] = useState(false); // Track if continuous mode is paused
  const [suggestedField, setSuggestedField] = useState(null); // Track which field is being suggested

  const recognitionRef = useRef(null);
  const speechQueueRef = useRef([]);
  const isSpeakingRef = useRef(false);
  const isListeningRef = useRef(false); // Track listening state in ref for real-time access
  const shouldContinueRef = useRef(false); // Track if we should continue listening
  const voicesLoadedRef = useRef(false);
  const sendCommandRef = useRef(null); // Store latest sendCommand function
  const isStartingRef = useRef(false); // Track if we're currently starting recognition
  const speakRef = useRef(null); // Store latest speak function

  // Check browser compatibility
  const isSupported = useCallback(() => {
    const hasSpeechRecognition = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
    const hasSpeechSynthesis = 'speechSynthesis' in window;
    return hasSpeechRecognition && hasSpeechSynthesis;
  }, []);

  // Load voices on mount
  useEffect(() => {
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          voicesLoadedRef.current = true;
          console.log('🔊 Available voices:', voices.map(v => `${v.name} (${v.lang})`).join(', '));
          
          const indianVoices = voices.filter(v => v.lang === 'en-IN' || v.lang.startsWith('en-IN'));
          if (indianVoices.length > 0) {
            console.log('✅ Indian English voices available:', indianVoices.map(v => v.name).join(', '));
          } else {
            console.log('⚠️  No Indian English voices found, will use fallback');
          }
        }
      };

      // Load voices immediately
      loadVoices();

      // Also listen for voiceschanged event (some browsers load voices asynchronously)
      window.speechSynthesis.addEventListener('voiceschanged', loadVoices);

      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      };
    }
  }, []);

  /**
   * Initialize speech recognition
   */
  const initializeRecognition = useCallback(() => {
    if (!isSupported()) {
      setError(new Error('Speech recognition not supported in this browser'));
      return null;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true; // Enable interim results for better feedback
    recognition.lang = 'en-IN'; // Indian English for better accent recognition
    recognition.maxAlternatives = 5; // Get multiple alternatives for better accuracy

    recognition.onstart = () => {
      console.log('🎤 Speech recognition started (Indian English)');
      isListeningRef.current = true;
      isStartingRef.current = false; // Clear starting flag
      setIsListening(true);
      setError(null);
      setAssistantMessage('Listening... (Speak clearly)');
    };

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      
      // Show interim results for real-time feedback
      if (!result.isFinal) {
        const interimTranscript = result[0].transcript;
        setAssistantMessage(`Hearing: "${interimTranscript}..."`);
        return;
      }

      // Get all alternatives
      const alternatives = [];
      for (let i = 0; i < result.length; i++) {
        alternatives.push({
          transcript: result[i].transcript,
          confidence: result[i].confidence
        });
      }

      // Sort by confidence
      alternatives.sort((a, b) => b.confidence - a.confidence);
      
      const bestTranscript = alternatives[0].transcript;
      const bestConfidence = alternatives[0].confidence;
      
      console.log(`📝 Final Transcript: "${bestTranscript}" (confidence: ${(bestConfidence * 100).toFixed(1)}%)`);
      console.log('📋 All alternatives:', alternatives.map(a => 
        `"${a.transcript}" (${(a.confidence * 100).toFixed(1)}%)`
      ).join(', '));
      
      setAssistantMessage(`You said: "${bestTranscript}"`);
      
      // Send command to backend using ref to always get latest version
      if (sendCommandRef.current) {
        sendCommandRef.current(bestTranscript);
      }
    };

    recognition.onerror = (event) => {
      console.error('❌ Speech recognition error:', event.error, {
        wasListening: isListeningRef.current,
        shouldContinue: shouldContinueRef.current
      });
      
      const errorMessages = {
        'no-speech': 'No speech detected. Please try again.',
        'audio-capture': 'Microphone not available. Please check permissions.',
        'not-allowed': 'Microphone permission denied. Please allow microphone access.',
        'network': 'Network error. Please check your connection.',
        'aborted': 'Speech recognition stopped.' // Changed from "aborted" to be less alarming
      };
      
      const errorMessage = errorMessages[event.error] || `Error: ${event.error}`;
      
      // Handle abort error gracefully - it's often intentional
      if (event.error === 'aborted') {
        console.log('ℹ️  Recognition aborted - likely intentional stop');
        // Don't show error for abort in continuous mode
        if (!shouldContinueRef.current) {
          setAssistantMessage('Voice assistant stopped');
        }
      } else if (event.error !== 'no-speech' || !shouldContinueRef.current) {
        // Only show error for serious issues, not for no-speech in continuous mode
        setError(new Error(errorMessage));
        setAssistantMessage(errorMessage);
      }
      
      // Always reset listening state
      isListeningRef.current = false;
      isStartingRef.current = false;
      setIsListening(false);
      
      // If it's a fatal error, stop continuous mode
      if (event.error === 'not-allowed' || event.error === 'audio-capture') {
        shouldContinueRef.current = false;
        setIsActive(false);
      }
    };

    recognition.onend = () => {
      console.log('🎤 Speech recognition ended', {
        wasListening: isListeningRef.current,
        shouldContinue: shouldContinueRef.current
      });
      isListeningRef.current = false;
      isStartingRef.current = false;
      setIsListening(false);
      
      // If we're not in continuous mode, deactivate
      if (!shouldContinueRef.current) {
        setIsActive(false);
      }
    };

    return recognition;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupported]);

  /**
   * Start listening for voice commands
   */
  const startListening = useCallback(() => {
    console.log('🎤 startListening called', {
      enabled,
      isSupported: isSupported(),
      isListening,
      isListeningRef: isListeningRef.current,
      isStarting: isStartingRef.current,
      continuousMode
    });

    if (!enabled) {
      setError(new Error('Voice assistant is disabled'));
      return;
    }

    if (!isSupported()) {
      setError(new Error('Speech recognition not supported in this browser'));
      return;
    }

    // Check if already listening OR currently starting
    if (isListeningRef.current || isStartingRef.current) {
      console.log('⚠️  Already listening or starting (ref check) - ignoring duplicate call');
      return;
    }

    try {
      if (!recognitionRef.current) {
        recognitionRef.current = initializeRecognition();
      }

      if (recognitionRef.current) {
        shouldContinueRef.current = true; // Enable continuous mode
        isStartingRef.current = true; // Mark as starting
        console.log('✅ Set shouldContinueRef.current = true');
        setIsActive(true);
        
        // Try to start recognition
        try {
          recognitionRef.current.start();
          console.log('✅ Recognition.start() called successfully');
          // Note: isStartingRef will be set to false in onstart callback
        } catch (startError) {
          // Reset state on error
          isListeningRef.current = false;
          setIsListening(false);
          isStartingRef.current = false;
          
          // If it fails because already started, just log and ignore
          if (startError.message && startError.message.includes('already')) {
            console.log('⚠️  Recognition already started - ignoring error');
            // Don't try to restart, just let it continue
          } else {
            console.error('❌ Error calling recognition.start():', startError);
            throw startError;
          }
        }
      }
    } catch (err) {
      console.error('❌ Failed to start recognition:', err);
      isListeningRef.current = false;
      setIsListening(false);
      isStartingRef.current = false;
      setIsActive(false);
      setError(err);
      setAssistantMessage('Failed to start listening. Please try again.');
    }
  }, [enabled, isSupported, isListening, initializeRecognition, continuousMode]);

  /**
   * Stop speaking
   */
  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    speechQueueRef.current = [];
    isSpeakingRef.current = false;
    setIsSpeaking(false);
  }, []);

  /**
   * Stop listening and deactivate assistant
   */
  const stopListening = useCallback(() => {
    console.log('🛑 stopListening called');
    shouldContinueRef.current = false; // Disable continuous mode
    setIsActive(false);
    
    if (recognitionRef.current) {
      try {
        // Abort instead of stop to prevent "aborted" error
        recognitionRef.current.abort();
        console.log('✅ Recognition aborted successfully');
      } catch (err) {
        console.error('❌ Failed to abort recognition:', err);
      }
    }
    isListeningRef.current = false;
    setIsListening(false);
    
    // Stop any ongoing speech
    window.speechSynthesis.cancel();
    speechQueueRef.current = [];
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    
    setAssistantMessage('Voice assistant stopped');
  }, []);

  /**
   * Send command to backend
   */
  const sendCommand = useCallback(async (transcript) => {
    try {
      setIsProcessing(true);
      setError(null);

      // Debug: Log formState to diagnose empty templates issue
      console.log('📤 Sending command to backend:', {
        transcript,
        context,
        formStateKeys: Object.keys(formState),
        templatesCount: formState.availableTemplates?.length || 0,
        templateNames: formState.availableTemplates?.map(t => t.template_name) || [],
        fullFormState: formState
      });

      const response = await API.post('/voice-assistant/process-command', {
        transcript,
        context,
        formState, // Always uses the latest formState from the callback closure
        conversationHistory: conversationHistory.slice(-10) // Keep last 10 exchanges
      });

      console.log('📥 Backend response:', response.data);

      if (response.data.success) {
        // Update conversation history
        setConversationHistory(prev => [
          ...prev,
          { role: 'user', content: transcript, timestamp: Date.now() },
          { role: 'assistant', content: response.data.response, timestamp: Date.now() }
        ]);

        // Apply state changes
        if (response.data.updatedState && onStateChange) {
          console.log('📤 Applying state changes:', {
            before: formState,
            changes: response.data.updatedState,
            note: 'Parent component should merge these changes, not replace entire state'
          });
          onStateChange(response.data.updatedState);
        }

        // Store suggestions and workflow state
        if (response.data.suggestions) {
          setCurrentSuggestions(response.data.suggestions.items || []);
          console.log('💡 Suggestions received:', response.data.suggestions.items);
          
          // Determine which field is being suggested and notify parent
          const highestPrioritySuggestion = response.data.suggestions.items?.[0];
          const workflowState = response.data.conversationContext?.workflowState;
          const fieldName = highestPrioritySuggestion?.scrollToField ||
            workflowState?.currentField ||
            workflowState?.nextField;

          if (fieldName && onFieldSuggested) {
            setSuggestedField(fieldName);
            onFieldSuggested(fieldName);
            console.log('📍 Suggested field for scrolling:', fieldName);
          }
        }
        
        if (response.data.conversationContext?.workflowState) {
          setWorkflowState(response.data.conversationContext.workflowState);
          console.log('📊 Workflow state:', response.data.conversationContext.workflowState);
        }

        // Build enhanced response with workflow progress
        let fullResponse = response.data.response;
        
        // Add workflow progress announcement in continuous mode
        if (continuousMode && response.data.conversationContext?.workflowState) {
          const workflowState = response.data.conversationContext.workflowState;
          
          // Announce completion progress
          if (workflowState.completionPercent > 0) {
            fullResponse += `. You are now ${workflowState.completionPercent}% complete`;
          }
          
          // Announce next milestone
          if (workflowState.nextMilestone) {
            fullResponse += `. Next step: ${workflowState.nextMilestone}`;
          }
        }
        
        // Add suggestions if in continuous mode
        if (response.data.suggestions?.text && continuousMode) {
          fullResponse += `. ${response.data.suggestions.text}`;
        }
        
        // Use ref to avoid circular dependency
        if (speakRef.current) {
          speakRef.current(fullResponse);
        }
      } else {
        // Handle error response
        // Check both error.message and response fields for error message
        const errorMessage = response.data.error?.message || 
                            response.data.response || 
                            'Failed to process command';
        setError(new Error(errorMessage));
        if (speakRef.current) {
          speakRef.current(errorMessage);
        }
      }

    } catch (err) {
      console.error('❌ Command processing error:', err);
      
      // Use user-friendly error messages
      let errorMessage = 'Sorry, I encountered an error. Please try again.';
      
      // Check for specific error types
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        errorMessage = 'Please check your internet connectivity and try again';
      } else if (err.response?.status === 500 || err.response?.status === 502) {
        errorMessage = 'Something went wrong on our end. Please try again in a moment';
      } else if (err.response?.status === 503 || err.response?.status === 504) {
        errorMessage = 'The service is temporarily unavailable. Please try again shortly';
      } else if (err.response?.data?.error?.message) {
        // Use backend's masked error message if available
        errorMessage = err.response.data.error.message;
      }
      
      setError(new Error(errorMessage));
      if (speakRef.current) {
        speakRef.current(errorMessage);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [context, formState, conversationHistory, onStateChange, continuousMode, onFieldSuggested]);

  /**
   * Process next item in speech queue
   */
  const processNextSpeech = useCallback(() => {
    console.log('🔍 processNextSpeech called', {
      queueLength: speechQueueRef.current.length,
      continuousMode,
      shouldContinue: shouldContinueRef.current,
      enabled,
      isSupported: isSupported()
    });

    if (speechQueueRef.current.length === 0) {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      
      console.log('🔍 Speech queue empty - checking auto-resume conditions:', {
        continuousMode,
        shouldContinue: shouldContinueRef.current,
        enabled,
        isSupported: isSupported(),
        allConditionsMet: continuousMode && shouldContinueRef.current && enabled && isSupported()
      });
      
      // Auto-restart listening if in continuous mode
      if (continuousMode && shouldContinueRef.current && enabled && isSupported()) {
        console.log('✅ All conditions met - scheduling auto-restart listening...');
        
        // Use a longer delay and retry mechanism to ensure recognition has fully ended
        const attemptRestart = (attempt = 1, maxAttempts = 5) => {
          setTimeout(() => {
            console.log(`🔄 Restart attempt ${attempt} - checking conditions...`, {
              shouldContinue: shouldContinueRef.current,
              isListeningRef: isListeningRef.current,
              isListeningState: isListening
            });
            
            if (!shouldContinueRef.current) {
              console.log('❌ shouldContinue is false, aborting restart');
              return;
            }
            
            // Check if still listening from previous session using REF (not state)
            if (isListeningRef.current) {
              console.log(`⚠️  Still listening from previous session (ref check), will retry (attempt ${attempt}/${maxAttempts})`);
              if (attempt < maxAttempts) {
                attemptRestart(attempt + 1, maxAttempts);
              } else {
                console.log('❌ Max retry attempts reached, forcing restart by stopping first');
                // Force stop and restart
                if (recognitionRef.current) {
                  try {
                    recognitionRef.current.stop();
                  } catch (e) {
                    console.log('Recognition already stopped');
                  }
                }
                // Force the ref to false
                isListeningRef.current = false;
                setTimeout(() => {
                  console.log('🎤 Calling startListening() after force stop...');
                  startListening();
                }, 300);
              }
            } else {
              console.log('✅ Not listening (ref check passed), calling startListening()...');
              startListening();
            }
          }, attempt === 1 ? 500 : 200); // First attempt after 500ms, retries after 200ms
        };
        
        attemptRestart();
      } else {
        console.log('❌ Auto-resume conditions not met - not restarting listening');
      }
      return;
    }

    const text = speechQueueRef.current.shift();
    isSpeakingRef.current = true;
    setIsSpeaking(true);
    setAssistantMessage(text);

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-IN'; // Indian English voice
      utterance.rate = 0.95; // Slightly slower for clarity
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Try to select an Indian English voice if available
      const voices = window.speechSynthesis.getVoices();
      const indianVoice = voices.find(voice => 
        voice.lang === 'en-IN' || 
        voice.lang.startsWith('en-IN') ||
        voice.name.toLowerCase().includes('india')
      );
      
      if (indianVoice) {
        utterance.voice = indianVoice;
        console.log('🔊 Using Indian English voice:', indianVoice.name);
      } else {
        // Fallback to any English voice
        const englishVoice = voices.find(voice => voice.lang.startsWith('en'));
        if (englishVoice) {
          utterance.voice = englishVoice;
          console.log('🔊 Using fallback English voice:', englishVoice.name);
        }
      }

      utterance.onend = () => {
        console.log('🔊 Speech synthesis ended');
        processNextSpeech(); // Process next in queue
      };

      utterance.onerror = (event) => {
        console.error('❌ Speech synthesis error:', event.error);
        processNextSpeech(); // Continue with next item
      };

      console.log('🔊 Speaking:', text.substring(0, 50));
      window.speechSynthesis.speak(utterance);

    } catch (err) {
      console.error('❌ Failed to speak:', err);
      processNextSpeech(); // Continue with next item
    }
  }, [enabled, isSupported, startListening, continuousMode, isListening]);

  /**
   * Speak text using TTS
   */
  const speak = useCallback((text) => {
    if (!text) return;

    // Add to queue
    speechQueueRef.current.push(text);

    // Process queue if not already speaking
    if (!isSpeakingRef.current) {
      processNextSpeech();
    }
  }, [processNextSpeech]);

  /**
   * Clear conversation history
   */
  const clearHistory = useCallback(() => {
    setConversationHistory([]);
  }, []);

  /**
   * Pause continuous mode
   */
  const pauseContinuousMode = useCallback(() => {
    setIsPaused(true);
    shouldContinueRef.current = false;
    
    // Stop listening if currently listening
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error('❌ Failed to stop recognition:', err);
      }
    }
    
    setAssistantMessage('Continuous mode paused. Say "continue" to resume.');
    console.log('⏸️  Continuous mode paused');
  }, [isListening]);

  /**
   * Resume continuous mode
   */
  const resumeContinuousMode = useCallback(() => {
    setIsPaused(false);
    shouldContinueRef.current = true;
    
    // Re-announce suggestions if available
    if (currentSuggestions.length > 0) {
      const suggestionText = currentSuggestions.map(s => s.text).join(', or ');
      if (speakRef.current) {
        speakRef.current(`Resuming. You can ${suggestionText}.`);
      }
    } else {
      if (speakRef.current) {
        speakRef.current('Resuming continuous mode.');
      }
    }
    
    console.log('▶️  Continuous mode resumed');
  }, [currentSuggestions]);

  // Keep sendCommandRef up to date
  useEffect(() => {
    sendCommandRef.current = sendCommand;
  }, [sendCommand]);

  // Keep speakRef up to date
  useEffect(() => {
    speakRef.current = speak;
  }, [speak]);

  // Periodic state synchronization check
  useEffect(() => {
    if (!isActive) return;
    
    const checkInterval = setInterval(() => {
      // Only log and act if we should be listening but we're not, and we're in continuous mode
      if (!isListeningRef.current && !isSpeakingRef.current && shouldContinueRef.current && isActive) {
        console.log('⚠️  State desync detected - should be listening but not. Attempting recovery...');
        // Try to restart listening
        if (recognitionRef.current) {
          try {
            recognitionRef.current.start();
            console.log('✅ Recovery: Recognition restarted');
          } catch (e) {
            // Only log if it's not the "already started" error
            if (!e.message || !e.message.includes('already')) {
              console.log('❌ Recovery failed:', e.message);
            }
          }
        }
      }
    }, 3000); // Check every 3 seconds (reduced frequency)
    
    return () => clearInterval(checkInterval);
  }, [isActive, isListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          // Ignore cleanup errors
        }
      }
      stopSpeaking();
    };
  }, [stopSpeaking]);

  return {
    isListening,
    isProcessing,
    isSpeaking,
    isActive,
    assistantMessage,
    error,
    isSupported: isSupported(),
    conversationHistory,
    continuousMode,
    currentSuggestions,
    workflowState,
    isPaused,
    suggestedField,
    
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    sendCommand,
    clearHistory,
    setContinuousMode,
    pauseContinuousMode,
    resumeContinuousMode
  };
};

export default useVoiceAssistant;
