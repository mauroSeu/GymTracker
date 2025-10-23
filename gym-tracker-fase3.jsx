const { useState, useEffect, useRef } = React;
const { ChevronLeft, ChevronRight, Dumbbell, Calendar, Target, Clock, Play, Pause, SkipForward, SkipBack, Check, X, Timer, TrendingUp, Video, Image: ImageIcon, Lightbulb, Zap, Download, Menu, BarChart3, Activity, Award } = lucide;

const GymTracker = () => {
  const [currentDay, setCurrentDay] = useState(0);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [completedSets, setCompletedSets] = useState({});
  const [customWeights, setCustomWeights] = useState({});
  const [playerMode, setPlayerMode] = useState(false);
  const [currentExercise, setCurrentExercise] = useState(0);
  const [currentSet, setCurrentSet] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [restTimer, setRestTimer] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [skippedDays, setSkippedDays] = useState({});
  const [editingWeight, setEditingWeight] = useState(null);
  
  // Stati esistenti
  const [exerciseNotes, setExerciseNotes] = useState({});
  const [personalRecords, setPersonalRecords] = useState({});
  const [workoutHistory, setWorkoutHistory] = useState([]);
  const [settings, setSettings] = useState({
    soundEnabled: true,
    vibrationEnabled: true,
    autoStartRest: true,
    defaultRestTime: null,
    theme: 'default'
  });
  const [showNoteModal, setShowNoteModal] = useState(null);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  
  // 🆕 NUOVI STATI FASE 3
  const [showGraphsModal, setShowGraphsModal] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(null); // {day, exerciseIdx}
  const [exerciseMedia, setExerciseMedia] = useState({}); // key: "exerciseName", value: {video: "url", images: ["url1", "url2"]}
  const [showAIModal, setShowAIModal] = useState(null); // {day, week, exerciseIdx}
  const [aiSuggestions, setAISuggestions] = useState({});
  const [swipeStartX, setSwipeStartX] = useState(0);
  const [showPWAPrompt, setShowPWAPrompt] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  
  const modalScrollRef = useRef(null);
  const touchStartRef = useRef(0);

  // 💾 PERSISTENZA - Carica dati
  useEffect(() => {
    try {
      const savedData = localStorage.getItem('gymTrackerData');
      if (savedData) {
        const data = JSON.parse(savedData);
        setCompletedSets(data.completedSets || {});
        setCustomWeights(data.customWeights || {});
        setSkippedDays(data.skippedDays || {});
        setExerciseNotes(data.exerciseNotes || {});
        setPersonalRecords(data.personalRecords || {});
        setWorkoutHistory(data.workoutHistory || []);
        setExerciseMedia(data.exerciseMedia || {});
        setAISuggestions(data.aiSuggestions || {});
        setSettings(data.settings || {
          soundEnabled: true,
          vibrationEnabled: true,
          autoStartRest: true,
          defaultRestTime: null,
          theme: 'default'
        });
        setCurrentWeek(data.currentWeek || 1);
        setCurrentDay(data.currentDay || 0);
      }
    } catch (error) {
      console.error('Errore caricamento:', error);
    }
  }, []);

  // 💾 PERSISTENZA - Salva dati
  useEffect(() => {
    try {
      const dataToSave = {
        completedSets,
        customWeights,
        skippedDays,
        exerciseNotes,
        personalRecords,
        workoutHistory,
        exerciseMedia,
        aiSuggestions,
        settings,
        currentWeek,
        currentDay,
        lastSaved: new Date().toISOString()
      };
      localStorage.setItem('gymTrackerData', JSON.stringify(dataToSave));
    } catch (error) {
      console.error('Errore salvataggio:', error);
    }
  }, [completedSets, customWeights, skippedDays, exerciseNotes, personalRecords, workoutHistory, exerciseMedia, aiSuggestions, settings, currentWeek, currentDay]);

  // 🔔 NOTIFICHE Audio/Vibrazione
  useEffect(() => {
    if (restTimer === 0 && isResting) {
      if (settings.soundEnabled) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
      }
      
      if (settings.vibrationEnabled && 'vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 200]);
      }
    }
  }, [restTimer, isResting, settings]);

  // ⌨️ KEYBOARD SHORTCUTS
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Solo in player mode
      if (!playerMode) return;
      
      // Previeni default solo per i nostri shortcuts
      if (['ArrowLeft', 'ArrowRight', ' ', 'Enter', 'n', 'p'].includes(e.key)) {
        e.preventDefault();
      }
      
      switch(e.key) {
        case 'ArrowRight':
        case 'n': // Next
          handleNext();
          break;
        case 'ArrowLeft':
        case 'p': // Previous
          handlePrevious();
          break;
        case ' ': // Space
        case 'Enter':
          toggleComplete();
          break;
        case 'Escape':
          setPlayerMode(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [playerMode, currentExercise, currentSet]);

  // 📱 PWA - Intercetta evento install
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowPWAPrompt(true);
    };
    
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

// 🆕 RISOLUZIONE CRITICA (Aggiunto per risolvere il TypeError: Cannot use 'in' operator to search for 'sync' in undefined)
// Questo blocco isola e protegge la logica del Background Sync che altrimenti causerebbe il crash all'avvio.
  useEffect(() => {
    try {
      // Verifica che il Service Worker sia supportato
      if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(registration => {
          
          // IL CONTROLLO FONDAMENTALE: verifica se la proprietà 'sync' è supportata sull'oggetto registration
          // Questo impedisce l'errore "in undefined"
          if (registration && 'sync' in registration) { 
            console.log("✅ Background Sync API disponibile e Service Worker pronto.");
            // Qui andrebbe la tua eventuale logica per registration.sync.register(...)
          } else {
            console.warn("Background Sync API non disponibile su Service Worker Registration. App avviata.");
          }
        }).catch(e => {
          console.error("Errore PWA ready promise (Service Worker):", e);
        });
      }
    } catch (e) {
      // Cattura qualsiasi errore imprevisto di inizializzazione PWA che altrimenti bloccherebbe l'app
      console.error("🚨 Errore fatale di inizializzazione PWA catturato. Continuo l'avvio.", e);
    }
  }, []);
// 🆕 FINE RISOLUZIONE CRITICA

  // 🏋️ WORKOUT DATA
  const workoutDays = [
// ... [RESTO DEL TUO CODICE]
