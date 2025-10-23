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

  // 🏋️ WORKOUT DATA
  const workoutDays = [
    {
      name: "Push (Petto/Spalle/Tricipiti)",
      shortName: "Push",
      color: "from-red-500 to-pink-500",
      icon: "💪",
      exercises: [
        {
          name: "Panca Piana con Bilanciere",
          sets: 3,
          repsRange: "8-12",
          rest: "120-180 sec",
          focus: "Petto (Tensione Meccanica)",
          weeklyPlan: [
            { week: 1, sets: "3x8", weight: "15kg" },
            { week: 2, sets: "3x9", weight: "" },
            { week: 3, sets: "3x10", weight: "" },
            { week: 4, sets: "3x11", weight: "" },
            { week: 5, sets: "3x12", weight: "" }
          ]
        },
        {
          name: "Lat Machine Presa Larga",
          sets: 3,
          repsRange: "10-15",
          rest: "90-120 sec",
          focus: "Dorsali (Larghezza)",
          weeklyPlan: [
            { week: 1, sets: "3x10", weight: "45kg" },
            { week: 2, sets: "3x11", weight: "" },
            { week: 3, sets: "3x12", weight: "" },
            { week: 4, sets: "3x13", weight: "" },
            { week: 5, sets: "3x12", weight: "" }
          ]
        },
        {
          name: "Dips o Chest Press Macchina",
          sets: 3,
          repsRange: "10-15",
          rest: "90-120 sec",
          focus: "Petto (Range Controllato)",
          weeklyPlan: [
            { week: 1, sets: "3x10", weight: "46kg" },
            { week: 2, sets: "3x11", weight: "" },
            { week: 3, sets: "3x12", weight: "" },
            { week: 4, sets: "3x13", weight: "" },
            { week: 5, sets: "3x14", weight: "" }
          ]
        },
        {
          name: "Rematore con Manubrio a 1 Braccio",
          sets: 3,
          repsRange: "8-12",
          rest: "90-120 sec",
          focus: "Spessore Schiena",
          weeklyPlan: [
            { week: 1, sets: "3x8", weight: "14kg" },
            { week: 2, sets: "3x9", weight: "" },
            { week: 3, sets: "3x10", weight: "" },
            { week: 4, sets: "3x11", weight: "" },
            { week: 5, sets: "3x12", weight: "" }
          ]
        },
        {
          name: "Alzate Laterali Cavi/Manubri",
          sets: 4,
          repsRange: "12-20",
          rest: "60-90 sec",
          focus: "Deltoidi Mediali (Massimo Pompaggio)",
          weeklyPlan: [
            { week: 1, sets: "4x12", weight: "9kg" },
            { week: 2, sets: "4x13", weight: "" },
            { week: 3, sets: "4x14", weight: "" },
            { week: 4, sets: "4x15", weight: "" },
            { week: 5, sets: "4x16", weight: "" }
          ]
        },
        {
          name: "Croci su Panca Inclinata",
          sets: 3,
          repsRange: "12-15",
          rest: "60-90 sec",
          focus: "Petto Alto (Stretch)",
          weeklyPlan: [
            { week: 1, sets: "3x12", weight: "10kg" },
            { week: 2, sets: "3x13", weight: "" },
            { week: 3, sets: "3x14", weight: "" },
            { week: 4, sets: "3x15", weight: "" },
            { week: 5, sets: "3x15", weight: "" }
          ]
        },
        {
          name: "French Press o Estensioni Cavo Alto",
          sets: 3,
          repsRange: "10-15",
          rest: "60-90 sec",
          focus: "Tricipiti (Capo Lungo)",
          weeklyPlan: [
            { week: 1, sets: "3x10", weight: "8kg" },
            { week: 2, sets: "3x11", weight: "" },
            { week: 3, sets: "3x12", weight: "" },
            { week: 4, sets: "3x13", weight: "" },
            { week: 5, sets: "3x14", weight: "" }
          ]
        }
      ]
    },
    {
      name: "Pull (Schiena/Bicipiti)",
      shortName: "Pull",
      color: "from-blue-500 to-cyan-500",
      icon: "🎯",
      exercises: [
        {
          name: "Stacco da Terra (Convenzionale/Sumo)",
          sets: 3,
          repsRange: "6-10",
          rest: "180-240 sec",
          focus: "Catena Posteriore",
          weeklyPlan: [
            { week: 1, sets: "3x6", weight: "40kg" },
            { week: 2, sets: "3x7", weight: "" },
            { week: 3, sets: "3x8", weight: "" },
            { week: 4, sets: "3x9", weight: "" },
            { week: 5, sets: "3x10", weight: "" }
          ]
        },
        {
          name: "Pulley Basso",
          sets: 3,
          repsRange: "10-15",
          rest: "90-120 sec",
          focus: "Spessore Dorsale",
          weeklyPlan: [
            { week: 1, sets: "3x10", weight: "50kg" },
            { week: 2, sets: "3x11", weight: "" },
            { week: 3, sets: "3x12", weight: "" },
            { week: 4, sets: "3x13", weight: "" },
            { week: 5, sets: "3x14", weight: "" }
          ]
        },
        {
          name: "Curl con Bilanciere EZ",
          sets: 3,
          repsRange: "8-12",
          rest: "90-120 sec",
          focus: "Bicipiti (Massa)",
          weeklyPlan: [
            { week: 1, sets: "3x8", weight: "20kg" },
            { week: 2, sets: "3x9", weight: "" },
            { week: 3, sets: "3x10", weight: "" },
            { week: 4, sets: "3x11", weight: "" },
            { week: 5, sets: "3x12", weight: "" }
          ]
        },
        {
          name: "Face Pull",
          sets: 3,
          repsRange: "15-20",
          rest: "60-90 sec",
          focus: "Deltoidi Posteriori + Salute Spalle",
          weeklyPlan: [
            { week: 1, sets: "3x15", weight: "15kg" },
            { week: 2, sets: "3x16", weight: "" },
            { week: 3, sets: "3x17", weight: "" },
            { week: 4, sets: "3x18", weight: "" },
            { week: 5, sets: "3x19", weight: "" }
          ]
        },
        {
          name: "Hammer Curl o Curl Presa Neutra",
          sets: 3,
          repsRange: "10-15",
          rest: "60-90 sec",
          focus: "Brachiale + Brachioradiale",
          weeklyPlan: [
            { week: 1, sets: "3x10", weight: "12kg" },
            { week: 2, sets: "3x11", weight: "" },
            { week: 3, sets: "3x12", weight: "" },
            { week: 4, sets: "3x13", weight: "" },
            { week: 5, sets: "3x14", weight: "" }
          ]
        },
        {
          name: "Shrug con Manubri",
          sets: 3,
          repsRange: "12-20",
          rest: "60-90 sec",
          focus: "Trapezi",
          weeklyPlan: [
            { week: 1, sets: "3x12", weight: "20kg" },
            { week: 2, sets: "3x13", weight: "" },
            { week: 3, sets: "3x14", weight: "" },
            { week: 4, sets: "3x15", weight: "" },
            { week: 5, sets: "3x16", weight: "" }
          ]
        }
      ]
    },
    {
      name: "Legs (Gambe Complete)",
      shortName: "Legs",
      color: "from-green-500 to-emerald-500",
      icon: "🦵",
      exercises: [
        {
          name: "Squat con Bilanciere",
          sets: 4,
          repsRange: "6-10",
          rest: "180-240 sec",
          focus: "Quadricipiti + Glutei",
          weeklyPlan: [
            { week: 1, sets: "4x6", weight: "30kg" },
            { week: 2, sets: "4x7", weight: "" },
            { week: 3, sets: "4x8", weight: "" },
            { week: 4, sets: "4x9", weight: "" },
            { week: 5, sets: "4x10", weight: "" }
          ]
        },
        {
          name: "Leg Curl Sdraiato",
          sets: 3,
          repsRange: "10-15",
          rest: "90-120 sec",
          focus: "Femorali",
          weeklyPlan: [
            { week: 1, sets: "3x10", weight: "35kg" },
            { week: 2, sets: "3x11", weight: "" },
            { week: 3, sets: "3x12", weight: "" },
            { week: 4, sets: "3x13", weight: "" },
            { week: 5, sets: "3x14", weight: "" }
          ]
        },
        {
          name: "Leg Press",
          sets: 3,
          repsRange: "12-20",
          rest: "90-120 sec",
          focus: "Quadricipiti (Volume)",
          weeklyPlan: [
            { week: 1, sets: "3x12", weight: "80kg" },
            { week: 2, sets: "3x13", weight: "" },
            { week: 3, sets: "3x14", weight: "" },
            { week: 4, sets: "3x15", weight: "" },
            { week: 5, sets: "3x16", weight: "" }
          ]
        },
        {
          name: "Affondi con Manubri",
          sets: 3,
          repsRange: "10-15 per gamba",
          rest: "90-120 sec",
          focus: "Glutei + Stabilizzazione",
          weeklyPlan: [
            { week: 1, sets: "3x10", weight: "12kg" },
            { week: 2, sets: "3x11", weight: "" },
            { week: 3, sets: "3x12", weight: "" },
            { week: 4, sets: "3x13", weight: "" },
            { week: 5, sets: "3x14", weight: "" }
          ]
        },
        {
          name: "Calf Raise in Piedi",
          sets: 4,
          repsRange: "15-20",
          rest: "60-90 sec",
          focus: "Polpacci",
          weeklyPlan: [
            { week: 1, sets: "4x15", weight: "40kg" },
            { week: 2, sets: "4x16", weight: "" },
            { week: 3, sets: "4x17", weight: "" },
            { week: 4, sets: "4x18", weight: "" },
            { week: 5, sets: "4x19", weight: "" }
          ]
        },
        {
          name: "Leg Extension",
          sets: 3,
          repsRange: "12-20",
          rest: "60-90 sec",
          focus: "Isolamento Quadricipiti",
          weeklyPlan: [
            { week: 1, sets: "3x12", weight: "30kg" },
            { week: 2, sets: "3x13", weight: "" },
            { week: 3, sets: "3x14", weight: "" },
            { week: 4, sets: "3x15", weight: "" },
            { week: 5, sets: "3x16", weight: "" }
          ]
        }
      ]
    }
  ];

  const currentWorkout = workoutDays[currentDay];

  // Timer countdown
  useEffect(() => {
    let interval;
    if (isResting && restTimer > 0) {
      interval = setInterval(() => {
        setRestTimer(prev => prev - 1);
      }, 1000);
    } else if (restTimer === 0 && isResting) {
      setIsResting(false);
    }
    return () => clearInterval(interval);
  }, [isResting, restTimer]);

  // 🎨 FUNZIONI HELPER
  const getSetKey = (exerciseIdx, setIdx) => {
    return `${currentDay}-${currentWeek}-${exerciseIdx}-${setIdx}`;
  };

  const isSetCompleted = (exerciseIdx, setIdx) => {
    return completedSets[getSetKey(exerciseIdx, setIdx)] || false;
  };

  const toggleSet = (exerciseIdx, setIdx) => {
    const key = getSetKey(exerciseIdx, setIdx);
    const newCompletedSets = { ...completedSets };
    
    if (newCompletedSets[key]) {
      delete newCompletedSets[key];
    } else {
      newCompletedSets[key] = true;
      
      // Vibrazione haptic
      if (settings.vibrationEnabled && 'vibrate' in navigator) {
        navigator.vibrate(50);
      }
      
      // Verifica nuovo record
      const exercise = currentWorkout.exercises[exerciseIdx];
      const currentWeight = getWeight(exerciseIdx);
      
      if (currentWeight && currentWeight !== '') {
        const weightValue = parseFloat(currentWeight);
        const existingRecord = personalRecords[exercise.name];
        
        if (!existingRecord || parseFloat(existingRecord.weight) < weightValue) {
          setPersonalRecords({
            ...personalRecords,
            [exercise.name]: {
              weight: currentWeight,
              date: new Date().toISOString()
            }
          });
          
          // Vibrazione speciale per nuovo record!
          if (settings.vibrationEnabled && 'vibrate' in navigator) {
            navigator.vibrate([100, 50, 100, 50, 100]);
          }
        }
      }
    }
    
    setCompletedSets(newCompletedSets);
  };

  const getWeight = (exerciseIdx) => {
    const key = `${currentDay}-${currentWeek}-${exerciseIdx}`;
    if (customWeights[key]) {
      return customWeights[key];
    }
    return currentWorkout.exercises[exerciseIdx].weeklyPlan[currentWeek - 1].weight;
  };

  const setWeight = (exerciseIdx, weight) => {
    const key = `${currentDay}-${currentWeek}-${exerciseIdx}`;
    setCustomWeights({
      ...customWeights,
      [key]: weight
    });
  };

  const getExerciseNote = (day, week, exerciseIdx) => {
    const key = `${day}-${week}-${exerciseIdx}`;
    return exerciseNotes[key] || '';
  };

  const saveExerciseNote = (day, week, exerciseIdx, note) => {
    const key = `${day}-${week}-${exerciseIdx}`;
    setExerciseNotes({
      ...exerciseNotes,
      [key]: note
    });
  };

  const isDayCompleted = () => {
    const exercises = currentWorkout.exercises;
    for (let i = 0; i < exercises.length; i++) {
      const totalSets = exercises[i].weeklyPlan[currentWeek - 1].sets.split('x')[0];
      for (let j = 0; j < parseInt(totalSets); j++) {
        if (!isSetCompleted(i, j)) {
          return false;
        }
      }
    }
    return true;
  };

  const markDayAsCompleted = () => {
    const today = new Date().toISOString();
    const workout = {
      date: today,
      dayName: currentWorkout.name,
      week: currentWeek,
      exercises: currentWorkout.exercises.length,
      day: currentDay
    };
    
    setWorkoutHistory([...workoutHistory, workout]);
    
    // Vibrazione celebrativa
    if (settings.vibrationEnabled && 'vibrate' in navigator) {
      navigator.vibrate([100, 50, 100, 50, 200]);
    }
  };

  const skipDay = () => {
    const key = `${currentDay}-${currentWeek}`;
    setSkippedDays({
      ...skippedDays,
      [key]: new Date().toISOString()
    });
  };

  const isDaySkipped = () => {
    const key = `${currentDay}-${currentWeek}`;
    return skippedDays[key] !== undefined;
  };

  // 🎮 PLAYER MODE HANDLERS
  const startPlayerMode = () => {
    setPlayerMode(true);
    setCurrentExercise(0);
    setCurrentSet(0);
  };

  const getCurrentExerciseData = () => {
    const exercise = currentWorkout.exercises[currentExercise];
    const totalSets = parseInt(exercise.weeklyPlan[currentWeek - 1].sets.split('x')[0]);
    return { exercise, totalSets };
  };

  const handleNext = () => {
    const { totalSets } = getCurrentExerciseData();
    
    if (currentSet < totalSets - 1) {
      setCurrentSet(currentSet + 1);
    } else if (currentExercise < currentWorkout.exercises.length - 1) {
      setCurrentExercise(currentExercise + 1);
      setCurrentSet(0);
    }
    
    if (settings.vibrationEnabled && 'vibrate' in navigator) {
      navigator.vibrate(30);
    }
  };

  const handlePrevious = () => {
    if (currentSet > 0) {
      setCurrentSet(currentSet - 1);
    } else if (currentExercise > 0) {
      const prevExercise = currentWorkout.exercises[currentExercise - 1];
      const prevTotalSets = parseInt(prevExercise.weeklyPlan[currentWeek - 1].sets.split('x')[0]);
      setCurrentExercise(currentExercise - 1);
      setCurrentSet(prevTotalSets - 1);
    }
    
    if (settings.vibrationEnabled && 'vibrate' in navigator) {
      navigator.vibrate(30);
    }
  };

  const toggleComplete = () => {
    toggleSet(currentExercise, currentSet);
    
    // Auto-start rest se abilitato
    if (settings.autoStartRest && !isSetCompleted(currentExercise, currentSet)) {
      const exercise = currentWorkout.exercises[currentExercise];
      const restSeconds = settings.defaultRestTime || parseInt(exercise.rest.split('-')[0]);
      setRestTimer(restSeconds);
      setIsResting(true);
    }
  };

  const startRest = () => {
    const exercise = currentWorkout.exercises[currentExercise];
    const restSeconds = settings.defaultRestTime || parseInt(exercise.rest.split('-')[0]);
    setRestTimer(restSeconds);
    setIsResting(true);
  };

  // 🤖 AI SUGGERIMENTI PESO
  const calculateAISuggestion = (exerciseIdx) => {
    const exercise = currentWorkout.exercises[exerciseIdx];
    const exerciseName = exercise.name;
    
    // Trova tutti i pesi usati per questo esercizio nelle settimane precedenti
    const historicalWeights = [];
    for (let w = 1; w <= currentWeek; w++) {
      const key = `${currentDay}-${w}-${exerciseIdx}`;
      const weight = customWeights[key] || exercise.weeklyPlan[w - 1].weight;
      if (weight && weight !== '') {
        historicalWeights.push({
          week: w,
          weight: parseFloat(weight),
          completed: (() => {
            const totalSets = parseInt(exercise.weeklyPlan[w - 1].sets.split('x')[0]);
            let completedCount = 0;
            for (let s = 0; s < totalSets; s++) {
              if (completedSets[`${currentDay}-${w}-${exerciseIdx}-${s}`]) {
                completedCount++;
              }
            }
            return completedCount === totalSets;
          })()
        });
      }
    }
    
    if (historicalWeights.length === 0) {
      return {
        suggestion: exercise.weeklyPlan[currentWeek - 1].weight || "N/A",
        confidence: "low",
        reason: "Nessuno storico disponibile. Usa il peso suggerito dal programma."
      };
    }
    
    // Analisi trend
    const lastWeight = historicalWeights[historicalWeights.length - 1];
    const avgWeight = historicalWeights.reduce((sum, w) => sum + w.weight, 0) / historicalWeights.length;
    
    // Se ultima settimana completata con successo -> suggerisci aumento
    if (lastWeight.completed) {
      const increase = lastWeight.weight * 0.025; // 2.5% aumento
      const suggestedWeight = Math.round((lastWeight.weight + increase) * 2) / 2; // Arrotonda a 0.5kg
      
      return {
        suggestion: `${suggestedWeight}kg`,
        confidence: "high",
        reason: `Settimana precedente completata! Aumentiamo del 2.5% (da ${lastWeight.weight}kg a ${suggestedWeight}kg)`
      };
    } else {
      // Se non completata -> mantieni o riduci leggermente
      return {
        suggestion: `${lastWeight.weight}kg`,
        confidence: "medium",
        reason: `Settimana precedente non completata. Mantieni ${lastWeight.weight}kg per consolidare.`
      };
    }
  };

  // 📊 CALCOLI GRAFICI
  const getProgressData = () => {
    // Calcola volume totale per settimana (peso x reps x sets)
    const volumeByWeek = {};
    
    for (let week = 1; week <= 5; week++) {
      let totalVolume = 0;
      
      for (let day = 0; day < workoutDays.length; day++) {
        const workout = workoutDays[day];
        
        for (let exIdx = 0; exIdx < workout.exercises.length; exIdx++) {
          const exercise = workout.exercises[exIdx];
          const key = `${day}-${week}-${exIdx}`;
          const weight = customWeights[key] || exercise.weeklyPlan[week - 1].weight;
          
          if (weight && weight !== '') {
            const weightValue = parseFloat(weight);
            const [sets, reps] = exercise.weeklyPlan[week - 1].sets.split('x').map(n => parseInt(n));
            
            // Conta set completati
            let completedSetsCount = 0;
            for (let s = 0; s < sets; s++) {
              if (completedSets[`${day}-${week}-${exIdx}-${s}`]) {
                completedSetsCount++;
              }
            }
            
            totalVolume += weightValue * reps * completedSetsCount;
          }
        }
      }
      
      volumeByWeek[week] = totalVolume;
    }
    
    return volumeByWeek;
  };

  const getExerciseProgressData = (exerciseName) => {
    // Trova progressione peso per un esercizio specifico
    const data = [];
    
    for (let day = 0; day < workoutDays.length; day++) {
      const workout = workoutDays[day];
      const exIdx = workout.exercises.findIndex(e => e.name === exerciseName);
      
      if (exIdx !== -1) {
        for (let week = 1; week <= 5; week++) {
          const key = `${day}-${week}-${exIdx}`;
          const weight = customWeights[key] || workout.exercises[exIdx].weeklyPlan[week - 1].weight;
          
          if (weight && weight !== '') {
            data.push({
              week,
              weight: parseFloat(weight),
              day: workout.shortName
            });
          }
        }
      }
    }
    
    return data;
  };

  // 🎥 MEDIA HANDLERS
  const getExerciseMedia = (exerciseName) => {
    return exerciseMedia[exerciseName] || { video: '', images: [] };
  };

  const saveExerciseMedia = (exerciseName, mediaData) => {
    setExerciseMedia({
      ...exerciseMedia,
      [exerciseName]: mediaData
    });
  };

  // 📱 PWA INSTALL
  const handleInstallPWA = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setShowPWAPrompt(false);
      }
      
      setInstallPrompt(null);
    }
  };

  // 👆 SWIPE GESTURES
  const handleTouchStart = (e) => {
    touchStartRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStartRef.current - touchEnd;
    
    // Swipe minimo 50px
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        // Swipe left -> next day
        if (currentDay < workoutDays.length - 1) {
          setCurrentDay(currentDay + 1);
          if (settings.vibrationEnabled && 'vibrate' in navigator) {
            navigator.vibrate(30);
          }
        }
      } else {
        // Swipe right -> previous day
        if (currentDay > 0) {
          setCurrentDay(currentDay - 1);
          if (settings.vibrationEnabled && 'vibrate' in navigator) {
            navigator.vibrate(30);
          }
        }
      }
    }
  };

  // 📊 GRAFICO SVG - Volume Chart
  const VolumeChart = ({ data }) => {
    const weeks = Object.keys(data).map(Number);
    const volumes = Object.values(data);
    const maxVolume = Math.max(...volumes, 1);
    
    const width = 300;
    const height = 150;
    const padding = 30;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    // Calcola punti
    const points = weeks.map((week, idx) => {
      const x = padding + (idx / (weeks.length - 1 || 1)) * chartWidth;
      const y = padding + chartHeight - (volumes[idx] / maxVolume) * chartHeight;
      return { x, y, week, volume: volumes[idx] };
    });
    
    // Path linea
    const linePath = points.map((p, idx) => 
      `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
    ).join(' ');
    
    // Path area
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`;
    
    return (
      <svg width={width} height={height} className="mx-auto">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => (
          <line
            key={idx}
            x1={padding}
            y1={padding + chartHeight * ratio}
            x2={width - padding}
            y2={padding + chartHeight * ratio}
            stroke="#374151"
            strokeWidth="1"
            opacity="0.3"
          />
        ))}
        
        {/* Area gradient */}
        <defs>
          <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        
        <path d={areaPath} fill="url(#volumeGradient)" />
        <path d={linePath} stroke="#3B82F6" strokeWidth="3" fill="none" />
        
        {/* Data points */}
        {points.map((p, idx) => (
          <g key={idx}>
            <circle cx={p.x} cy={p.y} r="5" fill="#3B82F6" stroke="white" strokeWidth="2" />
            <text x={p.x} y={height - 5} textAnchor="middle" fill="#9CA3AF" fontSize="12">
              W{p.week}
            </text>
          </g>
        ))}
        
        {/* Y-axis labels */}
        <text x="5" y={padding} fill="#9CA3AF" fontSize="10">{Math.round(maxVolume)}</text>
        <text x="5" y={height - padding} fill="#9CA3AF" fontSize="10">0</text>
      </svg>
    );
  };

  // 📊 GRAFICO SVG - Exercise Progress
  const ExerciseProgressChart = ({ data }) => {
    if (data.length === 0) return null;
    
    const weights = data.map(d => d.weight);
    const maxWeight = Math.max(...weights);
    const minWeight = Math.min(...weights);
    
    const width = 280;
    const height = 120;
    const padding = 25;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    const points = data.map((d, idx) => {
      const x = padding + (idx / (data.length - 1 || 1)) * chartWidth;
      const y = padding + chartHeight - ((d.weight - minWeight) / (maxWeight - minWeight || 1)) * chartHeight;
      return { x, y, ...d };
    });
    
    const linePath = points.map((p, idx) => 
      `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
    ).join(' ');
    
    return (
      <svg width={width} height={height} className="mx-auto">
        <defs>
          <linearGradient id="exerciseGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        
        {/* Grid */}
        {[0, 0.5, 1].map((ratio, idx) => (
          <line
            key={idx}
            x1={padding}
            y1={padding + chartHeight * ratio}
            x2={width - padding}
            y2={padding + chartHeight * ratio}
            stroke="#374151"
            strokeWidth="1"
            opacity="0.2"
          />
        ))}
        
        {/* Area */}
        <path 
          d={`${linePath} L ${points[points.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`} 
          fill="url(#exerciseGradient)" 
        />
        
        {/* Line */}
        <path d={linePath} stroke="#10B981" strokeWidth="2.5" fill="none" />
        
        {/* Points */}
        {points.map((p, idx) => (
          <g key={idx}>
            <circle cx={p.x} cy={p.y} r="4" fill="#10B981" stroke="white" strokeWidth="1.5" />
            <text x={p.x} y={height - 3} textAnchor="middle" fill="#9CA3AF" fontSize="9">
              W{p.week}
            </text>
          </g>
        ))}
        
        {/* Y labels */}
        <text x="3" y={padding + 5} fill="#9CA3AF" fontSize="9">{maxWeight}kg</text>
        <text x="3" y={height - padding + 5} fill="#9CA3AF" fontSize="9">{minWeight}kg</text>
      </svg>
    );
  };

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4"
      onTouchStart={!playerMode ? handleTouchStart : undefined}
      onTouchEnd={!playerMode ? handleTouchEnd : undefined}
    >
      <div className="max-w-6xl mx-auto">
        {/* 📱 PWA INSTALL PROMPT */}
        {showPWAPrompt && (
          <div className="fixed top-4 left-4 right-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-4 shadow-2xl z-50 animate-slideIn">
            <div className="flex items-start gap-3">
              <Download className="w-6 h-6 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h4 className="font-bold text-lg mb-1">Installa l'App!</h4>
                <p className="text-sm opacity-90 mb-3">
                  Aggiungi GymTracker alla home per accesso rapido e funzionalità offline
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleInstallPWA}
                    className="px-4 py-2 bg-white text-purple-600 rounded-lg font-semibold text-sm hover:bg-opacity-90 transition-all"
                  >
                    Installa
                  </button>
                  <button
                    onClick={() => setShowPWAPrompt(false)}
                    className="px-4 py-2 bg-white bg-opacity-20 rounded-lg font-semibold text-sm hover:bg-opacity-30 transition-all"
                  >
                    Dopo
                  </button>
                </div>
              </div>
              <button
                onClick={() => setShowPWAPrompt(false)}
                aria-label="Chiudi banner installazione"
                className="p-1 hover:bg-white hover:bg-opacity-20 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* HEADER */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Dumbbell className="w-8 h-8" />
                GymTracker Pro
              </h1>
              <p className="text-gray-400 text-sm mt-1">Il tuo allenamento intelligente</p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowGraphsModal(true)}
                className="p-3 bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-lg"                
                title="Statistiche e Grafici"
                aria-label="Statistiche e Grafici"
              >
                <BarChart3 className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => setShowStatsModal(true)}                
                className="p-3 bg-purple-600 hover:bg-purple-700 rounded-xl transition-all shadow-lg"                
                title="Record e Statistiche"
                aria-label="Record e Statistiche"
              >
                <Award className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => setShowHistoryModal(true)}                
                className="p-3 bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-lg"                
                title="Cronologia"
                aria-label="Cronologia"
              >
                <Calendar className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => setShowSettings(true)}                
                className="p-3 bg-gray-700 hover:bg-gray-600 rounded-xl transition-all shadow-lg"                
                title="Impostazioni"
                aria-label="Impostazioni"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* SETTIMANA SELECTOR */}
          <div className="bg-gray-800 rounded-xl p-4 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-400" />
              <span className="font-semibold">Settimana</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => currentWeek > 1 && setCurrentWeek(currentWeek - 1)}
                disabled={currentWeek === 1}
                className="p-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-2xl font-bold text-blue-400 min-w-[40px] text-center">
                {currentWeek}
              </span>
              <button
                onClick={() => currentWeek < 5 && setCurrentWeek(currentWeek + 1)}
                disabled={currentWeek === 5}
                className="p-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {!playerMode ? (
          <>
            {/* DAY SELECTOR con Swipe Support */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <button
                  onClick={() => currentDay > 0 && setCurrentDay(currentDay - 1)}
                  disabled={currentDay === 0}
                  className="p-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl transition-all shadow-lg"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <div className="flex-1 bg-gradient-to-r from-gray-800 to-gray-700 rounded-xl p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">{currentWorkout.icon}</span>
                      <div>
                        <h2 className="text-xl font-bold">{currentWorkout.shortName}</h2>
                        <p className="text-sm text-gray-400">{currentWorkout.name}</p>
                      </div>
                    </div>
                    {isDayCompleted() && (
                      <div className="bg-green-500 rounded-full p-2">
                        <Check className="w-6 h-6" />
                      </div>
                    )}
                    {isDaySkipped() && (
                      <div className="bg-yellow-500 rounded-full p-2">
                        <X className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                </div>
                
                <button
                  onClick={() => currentDay < workoutDays.length - 1 && setCurrentDay(currentDay + 1)}
                  disabled={currentDay === workoutDays.length - 1}
                  className="p-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl transition-all shadow-lg"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              
              <p className="text-center text-gray-400 text-sm">
                👆 Swipe left/right per cambiare giorno
              </p>
            </div>

            {/* EXERCISES LIST */}
            <div className="space-y-4 mb-6">
              {currentWorkout.exercises.map((exercise, exIdx) => {
                const plan = exercise.weeklyPlan[currentWeek - 1];
                const [sets, reps] = plan.sets.split('x');
                const totalSets = parseInt(sets);
                const currentWeight = getWeight(exIdx);
                const hasNote = getExerciseNote(currentDay, currentWeek, exIdx) !== '';
                const media = getExerciseMedia(exercise.name);
                const hasMedia = media.video || media.images.length > 0;
                
                // Calcola completamento
                let completedCount = 0;
                for (let i = 0; i < totalSets; i++) {
                  if (isSetCompleted(exIdx, i)) completedCount++;
                }
                const isExerciseComplete = completedCount === totalSets;
                
                return (
                  <div
                    key={exIdx}
                    className={`bg-gray-800 rounded-xl p-4 shadow-lg border-2 transition-all ${
                      isExerciseComplete ? 'border-green-500' : 'border-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                          {exercise.name}
                          {hasNote && <span className="text-sm">📝</span>}
                          {hasMedia && <span className="text-sm">🎥</span>}
                        </h3>
                        <p className="text-sm text-gray-400">{exercise.focus}</p>
                      </div>
                      
                      {isExerciseComplete && (
                        <div className="bg-green-500 rounded-full p-1.5">
                          <Check className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    {/* PESO E AI */}
                    <div className="flex gap-2 mb-3">
                      <div className="flex-1">
                        {editingWeight === exIdx ? (
                          <input
                            type="text"
                            value={currentWeight}
                            onChange={(e) => setWeight(exIdx, e.target.value)}
                            onBlur={() => setEditingWeight(null)}
                            className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="es. 20kg"
                            autoFocus
                          />
                        ) : (
                          <button
                            onClick={() => setEditingWeight(exIdx)}
                            className="w-full bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-left transition-all"
                          >
                            <span className="text-gray-400 text-sm">Peso:</span>
                            <span className="ml-2 font-bold text-yellow-400">
                              {currentWeight || 'Non impostato'}
                            </span>
                          </button>
                        )}
                      </div>
                      
                      <button
                        onClick={() => setShowAIModal({ day: currentDay, week: currentWeek, exerciseIdx: exIdx })}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg transition-all shadow-lg flex items-center gap-2"
                        title="Suggerimento AI"
                      >
                        <Lightbulb className="w-4 h-4" />
                        <span className="text-sm font-semibold">AI</span>
                      </button>
                    </div>

                    {/* SETS */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {Array.from({ length: totalSets }, (_, i) => (
                        <button
                          key={i}
                          onClick={() => toggleSet(exIdx, i)}
                          className={`flex-1 min-w-[60px] py-3 rounded-lg font-semibold transition-all ${
                            isSetCompleted(exIdx, i)
                              ? 'bg-green-500 hover:bg-green-600 shadow-lg scale-105'
                              : 'bg-gray-700 hover:bg-gray-600'
                          }`}
                        >
                          Set {i + 1}
                          <div className="text-xs opacity-75">{reps} reps</div>
                        </button>
                      ))}
                    </div>

                    {/* INFO E AZIONI */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex gap-3 text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {exercise.rest}
                        </span>
                        <span>
                          {completedCount}/{totalSets} completati
                        </span>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          aria-label="Aggiungi o visualizza media per l'esercizio"
                          onClick={() => setShowMediaModal({ day: currentDay, exerciseIdx: exIdx })}
                          className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-all"
                          title="Aggiungi Media"
                        >
                          <Video className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={() => setShowNoteModal(`${currentDay}-${currentWeek}-${exIdx}`)}
                          aria-label="Apri note esercizio"
                          className="p-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-all"
                          title="Note Esercizio"
                          
                        >
                          📝
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ACTIONS */}
            <div className="flex gap-3">
              <button
                onClick={startPlayerMode}
                className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-xl font-bold text-lg transition-all shadow-lg flex items-center justify-center gap-2"
                aria-label="Avvia Player Mode"
              >
                <Play className="w-6 h-6" />
                Player Mode
              </button>
              
              {!isDayCompleted() && !isDaySkipped() && (
                <button
                  aria-label="Salta giorno di allenamento"
                  onClick={skipDay}
                  className="px-6 py-4 bg-yellow-600 hover:bg-yellow-700 rounded-xl font-semibold transition-all shadow-lg"
                >
                  Salta
                </button>
              )}
              
              {isDayCompleted() && (
                <button
                  onClick={markDayAsCompleted}
                  className="px-6 py-4 bg-green-600 hover:bg-green-700 rounded-xl font-semibold transition-all shadow-lg flex items-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  Completato!
                </button>
              )}
            </div>
          </>
        ) : (
          /* PLAYER MODE */
          <div className="space-y-6">
            {/* KEYBOARD SHORTCUTS HINT */}
            <div className="bg-gray-800 rounded-xl p-3 text-center text-sm text-gray-400">
              ⌨️ Shortcuts: ← Indietro | → Avanti | Spazio/Enter Completa | Esc Esci
            </div>

            {(() => {
              const { exercise, totalSets } = getCurrentExerciseData();
              const plan = exercise.weeklyPlan[currentWeek - 1];
              const [, reps] = plan.sets.split('x');
              const isComplete = isSetCompleted(currentExercise, currentSet);
              const currentWeight = getWeight(currentExercise);

              return (
                <>
                  {/* EXERCISE INFO */}
                  <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-6 shadow-2xl">
                    <div className="text-center mb-4">
                      <div className="text-sm opacity-75 mb-1">
                        Esercizio {currentExercise + 1} di {currentWorkout.exercises.length}
                      </div>
                      <h2 className="text-2xl font-bold mb-2">{exercise.name}</h2>
                      <p className="text-sm opacity-90">{exercise.focus}</p>
                    </div>

                    <div className="bg-white bg-opacity-20 rounded-xl p-4 mb-4">
                      <div className="text-center mb-2">
                        <div className="text-6xl font-bold">
                          Set {currentSet + 1}/{totalSets}
                        </div>
                        <div className="text-2xl mt-2">
                          {reps} ripetizioni @ {currentWeight || '?'}
                        </div>
                      </div>
                    </div>

                    {/* PROGRESS BAR */}
                    <div className="bg-white bg-opacity-20 rounded-full h-3 mb-4 overflow-hidden">
                      <div
                        className="bg-green-400 h-full transition-all duration-300"
                        style={{
                          width: `${((currentExercise * totalSets + currentSet + (isComplete ? 1 : 0)) / 
                                   (currentWorkout.exercises.reduce((acc, ex) => 
                                     acc + parseInt(ex.weeklyPlan[currentWeek - 1].sets.split('x')[0]), 0))) * 100}%`
                        }}
                      />
                    </div>

                    {/* COMPLETE BUTTON */}
                    <button
                      onClick={toggleComplete}
                      className={`w-full py-6 rounded-xl font-bold text-xl transition-all mb-3 ${
                        isComplete
                          ? 'bg-green-500 hover:bg-green-600'
                          : 'bg-white bg-opacity-20 hover:bg-opacity-30'
                      }`}
                    >
                      {isComplete ? (
                        <span className="flex items-center justify-center gap-2">
                          <Check className="w-6 h-6" />
                          Completato!
                        </span>
                      ) : (
                        'Segna come Completato'
                      )}
                    </button>

                    {/* REST TIMER */}
                    {isResting ? (
                      <div className="bg-yellow-500 rounded-xl p-4 text-center">
                        <div className="text-sm font-semibold mb-1">⏱️ RIPOSO</div>
                        <div className="text-4xl font-bold">{restTimer}s</div>
                        <button
                          onClick={() => {
                            setIsResting(false);
                            setRestTimer(0);
                          }}
                          className="mt-3 px-4 py-2 bg-white text-yellow-600 rounded-lg font-semibold text-sm hover:bg-opacity-90"
                        >
                          Salta Riposo
                        </button>
                      </div>
                    ) : (
                      isComplete && (
                        <button
                          onClick={startRest}
                          className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                        >
                          <Timer className="w-5 h-5" />
                          Inizia Riposo
                        </button>
                      )
                    )}
                  </div>

                  {/* NAVIGATION */}
                  <div className="flex gap-3">
                    <button
                      onClick={handlePrevious}
                      disabled={currentExercise === 0 && currentSet === 0}
                      aria-label="Precedente"
                      className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                    >
                      <SkipBack className="w-5 h-5" />
                      Indietro
                    </button>

                    <button
                      onClick={() => setPlayerMode(false)}
                      aria-label="Esci da Player Mode"
                      className="px-6 py-4 bg-red-600 hover:bg-red-700 rounded-xl font-semibold transition-all"
                    >
                      <X className="w-5 h-5" />
                    </button>

                    <button
                      onClick={handleNext}
                      disabled={currentExercise === currentWorkout.exercises.length - 1 && currentSet === totalSets - 1}
                      aria-label="Successivo"
                      className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                    >
                      Avanti
                      <SkipForward className="w-5 h-5" />
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* 📊 MODALE GRAFICI */}
        {showGraphsModal && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowGraphsModal(false)}
          >
            <div 
              className="bg-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl border border-gray-700 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 flex justify-between items-center sticky top-0">
                <h3 className="text-white font-bold text-xl flex items-center gap-2">
                  <BarChart3 className="w-6 h-6" />
                  Grafici e Progressi
                </h3>
                <button
                  onClick={() => setShowGraphsModal(false)}
                  className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition-all"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
              
              <div className="p-6 space-y-8">
                {/* Volume Totale */}
                <div>
                  <h4 className="font-bold text-lg mb-3 text-blue-400 flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Volume Totale per Settimana
                  </h4>
                  <div className="bg-gray-700 rounded-xl p-4">
                    <VolumeChart data={getProgressData()} />
                    <p className="text-sm text-gray-400 text-center mt-3">
                      Volume = Peso × Ripetizioni × Serie completate
                    </p>
                  </div>
                </div>

                {/* Progressi per Esercizio */}
                <div>
                  <h4 className="font-bold text-lg mb-3 text-green-400 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Progresso Peso per Esercizio
                  </h4>
                  
                  {(() => {
                    // Trova esercizi con progressione
                    const exercisesWithProgress = [];
                    workoutDays.forEach(day => {
                      day.exercises.forEach(ex => {
                        const data = getExerciseProgressData(ex.name);
                        if (data.length > 0) {
                          exercisesWithProgress.push({ name: ex.name, data });
                        }
                      });
                    });
                    
                    if (exercisesWithProgress.length === 0) {
                      return (
                        <div className="bg-gray-700 rounded-xl p-8 text-center">
                          <TrendingUp className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                          <p className="text-gray-400">
                            Nessun dato disponibile ancora.
                            <br />
                            Completa alcuni allenamenti per vedere i grafici!
                          </p>
                        </div>
                      );
                    }
                    
                    return (
                      <div className="space-y-4">
                        {exercisesWithProgress.slice(0, 3).map(({ name, data }) => (
                          <div key={name} className="bg-gray-700 rounded-xl p-4">
                            <h5 className="font-semibold mb-3">{name}</h5>
                            <ExerciseProgressChart data={data} />
                          </div>
                        ))}
                        
                        {exercisesWithProgress.length > 3 && (
                          <p className="text-sm text-gray-400 text-center">
                            Mostrando i primi 3 esercizi...
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Stats Veloci */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-600 bg-opacity-20 rounded-xl p-4 border border-blue-500">
                    <div className="text-2xl font-bold">{workoutHistory.length}</div>
                    <div className="text-sm text-gray-400">Allenamenti</div>
                  </div>
                  <div className="bg-green-600 bg-opacity-20 rounded-xl p-4 border border-green-500">
                    <div className="text-2xl font-bold">{Object.keys(personalRecords).length}</div>
                    <div className="text-sm text-gray-400">Record</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 🎥 MODALE MEDIA */}
        {showMediaModal && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowMediaModal(null)}
          >
            <div 
              className="bg-gray-800 rounded-2xl w-full max-w-lg shadow-2xl border border-gray-700 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const exercise = workoutDays[showMediaModal.day].exercises[showMediaModal.exerciseIdx];
                const media = getExerciseMedia(exercise.name);
                const [videoUrl, setVideoUrl] = useState(media.video || '');
                const [imageUrl, setImageUrl] = useState('');
                
                return (
                  <>
                    <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-4 flex justify-between items-center sticky top-0">
                      <div>
                        <h3 className="text-white font-bold text-lg">{exercise.name}</h3>
                        <p className="text-white text-sm opacity-80">Aggiungi Video o Immagini</p>
                      </div>
                      <button
                        onClick={() => setShowMediaModal(null)}
                        aria-label="Chiudi modale media"
                        className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition-all"
                      >
                        <X className="w-5 h-5 text-white" />
                      </button>
                    </div>
                    
                    <div className="p-6 space-y-6">
                      {/* Video Link */}
                      <div>
                        <label className="block mb-2 font-semibold text-blue-400 flex items-center gap-2">
                          <Video className="w-5 h-5" />
                          Link Video (es. YouTube)
                        </label>
                        <input
                          type="text"
                          value={videoUrl}
                          onChange={(e) => setVideoUrl(e.target.value)}
                          placeholder="https://youtube.com/watch?v=..."
                          className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {media.video && (
                          <a
                            href={media.video}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
                          >
                            <Video className="w-4 h-4" />
                            Vedi video attuale
                          </a>
                        )}
                      </div>

                      {/* Image Links */}
                      <div>
                        <label className="block mb-2 font-semibold text-purple-400 flex items-center gap-2">
                          <ImageIcon className="w-5 h-5" />
                          Link Immagine
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            placeholder="https://esempio.com/immagine.jpg"
                            className="flex-1 bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                          <button
                            onClick={() => {
                              if (imageUrl.trim()) {
                                const currentImages = media.images || [];
                                saveExerciseMedia(exercise.name, {
                                  video: media.video,
                                  images: [...currentImages, imageUrl.trim()]
                                });
                                setImageUrl('');
                              }
                            }}
                            className="px-4 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-all"
                          >
                            Aggiungi
                          </button>
                        </div>
                        
                        {media.images && media.images.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <p className="text-sm text-gray-400">Immagini salvate:</p>
                            {media.images.map((img, idx) => (
                              <div key={idx} className="flex items-center gap-2 bg-gray-700 rounded-lg p-2">
                                <img 
                                  src={img} 
                                  alt={`Ref ${idx + 1}`} 
                                  className="w-12 h-12 object-cover rounded"
                                  onError={(e) => e.target.style.display = 'none'}
                                />
                                <span className="text-xs text-gray-400 flex-1 truncate">{img}</span>
                                <button aria-label={`Rimuovi immagine ${idx + 1}`}
                                  onClick={() => {
                                    const newImages = media.images.filter((_, i) => i !== idx);
                                    saveExerciseMedia(exercise.name, {
                                      video: media.video,
                                      images: newImages
                                    });
                                  }}
                                  className="p-1 bg-red-600 hover:bg-red-700 rounded"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Salva */}
                      <button
                        onClick={() => {
                          saveExerciseMedia(exercise.name, {
                            video: videoUrl.trim(),
                            images: media.images || []
                          });
                          setShowMediaModal(null);
                        }}
                        className="w-full px-4 py-3 bg-green-500 hover:bg-green-600 rounded-lg font-semibold transition-all"
                      >
                        Salva e Chiudi
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* 🤖 MODALE AI SUGGERIMENTI */}
        {showAIModal && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowAIModal(null)}
          >
            <div 
              className="bg-gray-800 rounded-2xl w-full max-w-lg shadow-2xl border border-gray-700"
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const { day, week, exerciseIdx } = showAIModal;
                const exercise = workoutDays[day].exercises[exerciseIdx];
                const aiResult = calculateAISuggestion(exerciseIdx);
                
                return (
                  <>
                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="w-6 h-6 text-white" />
                        <h3 className="text-white font-bold text-lg">Suggerimento AI</h3>
                      </div>
                      <button
                        onClick={() => setShowAIModal(null)}
                        aria-label="Chiudi suggerimento AI"
                        className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition-all"
                      >
                        <X className="w-5 h-5 text-white" />
                      </button>
                    </div>
                    
                    <div className="p-6 space-y-4">
                      <div>
                        <h4 className="font-semibold text-lg mb-2">{exercise.name}</h4>
                        <p className="text-sm text-gray-400">{exercise.focus}</p>
                      </div>

                      {/* Suggerimento */}
                      <div className={`rounded-xl p-4 ${
                        aiResult.confidence === 'high' ? 'bg-green-600 bg-opacity-20 border border-green-500' :
                        aiResult.confidence === 'medium' ? 'bg-yellow-600 bg-opacity-20 border border-yellow-500' :
                        'bg-gray-600 bg-opacity-20 border border-gray-500'
                      }`}>
                        <div className="flex items-start gap-3">
                          <Zap className={`w-6 h-6 flex-shrink-0 ${
                            aiResult.confidence === 'high' ? 'text-green-400' :
                            aiResult.confidence === 'medium' ? 'text-yellow-400' :
                            'text-gray-400'
                          }`} />
                          <div className="flex-1">
                            <div className="font-bold text-2xl mb-2">{aiResult.suggestion}</div>
                            <p className="text-sm opacity-90">{aiResult.reason}</p>
                            <div className="mt-2 text-xs opacity-75">
                              Confidenza: {aiResult.confidence === 'high' ? 'Alta' : aiResult.confidence === 'medium' ? 'Media' : 'Bassa'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Applica suggerimento */}
                      <button
                        onClick={() => {
                          setWeight(exerciseIdx, aiResult.suggestion);
                          
                          setShowAIModal(null);
                        }}
                        className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                      >
                        <Zap className="w-5 h-5" />
                        Applica Suggerimento
                      </button>

                      <button
                        onClick={() => setShowAIModal(null)}
                        className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-all"
                      >
                        Ignora
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* ⚙️ MODALE SETTINGS */}
        {showSettings && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowSettings(false)}
          >
            <div 
              className="bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl border border-gray-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-gray-700 to-gray-600 p-4 flex justify-between items-center">
                <h3 className="text-white font-bold text-xl">⚙️ Impostazioni</h3>
                <button
                  onClick={() => setShowSettings(false)}
                  aria-label="Chiudi impostazioni"
                  className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition-all"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                {/* Sound */}
                <div className="flex items-center justify-between">
                  <span className="font-semibold">🔊 Suoni</span>
                  <button
                    onClick={() => setSettings({ ...settings, soundEnabled: !settings.soundEnabled })}
                    className={`w-14 h-7 rounded-full transition-all ${
                      settings.soundEnabled ? 'bg-green-500' : 'bg-gray-600'
                    }`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full transition-all ${
                      settings.soundEnabled ? 'ml-8' : 'ml-1'
                    }`} />
                  </button>
                </div>

                {/* Vibration */}
                <div className="flex items-center justify-between">
                  <span className="font-semibold">📳 Vibrazione</span>
                  <button
                    onClick={() => setSettings({ ...settings, vibrationEnabled: !settings.vibrationEnabled })}
                    className={`w-14 h-7 rounded-full transition-all ${
                      settings.vibrationEnabled ? 'bg-green-500' : 'bg-gray-600'
                    }`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full transition-all ${
                      settings.vibrationEnabled ? 'ml-8' : 'ml-1'
                    }`} />
                  </button>
                </div>

                {/* Auto Start Rest */}
                <div className="flex items-center justify-between">
                  <span className="font-semibold">⏱️ Auto-start Riposo</span>
                  <button
                    onClick={() => setSettings({ ...settings, autoStartRest: !settings.autoStartRest })}
                    className={`w-14 h-7 rounded-full transition-all ${
                      settings.autoStartRest ? 'bg-green-500' : 'bg-gray-600'
                    }`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full transition-all ${
                      settings.autoStartRest ? 'ml-8' : 'ml-1'
                    }`} />
                  </button>
                </div>

                {/* Default Rest Time */}
                <div>
                  <label className="block mb-2 font-semibold">⏲️ Tempo Riposo Default (sec)</label>
                  <input
                    type="number"
                    value={settings.defaultRestTime || ''}
                    onChange={(e) => setSettings({ ...settings, defaultRestTime: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="Auto (da esercizio)"
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  onClick={() => setShowSettings(false)}
                  className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-all"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 📊 MODALE STATISTICHE */}
        {showStatsModal && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowStatsModal(false)}
          >
            <div 
              className="bg-gray-800 rounded-2xl w-full max-w-lg shadow-2xl border border-gray-700 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 flex justify-between items-center sticky top-0">
                <h3 className="text-white font-bold text-xl flex items-center gap-2">
                  <Award className="w-6 h-6" />
                  Statistiche
                </h3>
                <button
                  onClick={() => setShowStatsModal(false)}
                  className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition-all"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
              
              <div className="p-6">
                {(() => {
                  // Calcola statistiche
                  const totalWorkouts = workoutHistory.length;
                  const totalSetsCompleted = Object.keys(completedSets).length;
                  const currentWeekCompletedDays = workoutHistory.filter(w => w.week === currentWeek).length;
                  
                  return (
                    <>
                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-blue-600 bg-opacity-20 rounded-xl p-4 border border-blue-500">
                          <div className="text-3xl font-bold">{totalWorkouts}</div>
                          <div className="text-sm text-gray-400">Allenamenti</div>
                        </div>
                        <div className="bg-green-600 bg-opacity-20 rounded-xl p-4 border border-green-500">
                          <div className="text-3xl font-bold">{totalSetsCompleted}</div>
                          <div className="text-sm text-gray-400">Set Completati</div>
                        </div>
                        <div className="bg-purple-600 bg-opacity-20 rounded-xl p-4 border border-purple-500">
                          <div className="text-3xl font-bold">{currentWeekCompletedDays}/3</div>
                          <div className="text-sm text-gray-400">Giorni Settimana</div>
                        </div>
                        <div className="bg-yellow-600 bg-opacity-20 rounded-xl p-4 border border-yellow-500">
                          <div className="text-3xl font-bold">{Object.keys(personalRecords).length}</div>
                          <div className="text-sm text-gray-400">Record</div>
                        </div>
                      </div>

                      {/* Record Personali */}
                      <div className="mb-6">
                        <h4 className="font-bold text-lg mb-3 text-yellow-400">🏆 Record Personali</h4>
                        {Object.keys(personalRecords).length === 0 ? (
                          <p className="text-gray-400 text-center py-4">Nessun record ancora!</p>
                        ) : (
                          <div className="space-y-2">
                            {Object.entries(personalRecords).map(([exerciseName, record]) => (
                              <div key={exerciseName} className="bg-gray-700 rounded-lg p-3 flex justify-between items-center">
                                <span className="font-semibold">{exerciseName}</span>
                                <div className="text-right">
                                  <div className="text-yellow-400 font-bold">{record.weight}</div>
                                  <div className="text-xs text-gray-400">{new Date(record.date).toLocaleDateString('it-IT')}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
        
        {/* 📅 MODALE CRONOLOGIA */}
        {showHistoryModal && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowHistoryModal(false)}
          >
            <div 
              className="bg-gray-800 rounded-2xl w-full max-w-lg shadow-2xl border border-gray-700 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-4 flex justify-between items-center sticky top-0">
                <h3 className="text-white font-bold text-xl">📅 Cronologia Allenamenti</h3>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition-all"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
              
              <div className="p-6">
                {workoutHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">Nessun allenamento completato ancora!</p>
                    <p className="text-gray-500 text-sm mt-2">Completa il tuo primo workout per iniziare a tracciare</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {[...workoutHistory].reverse().map((workout, idx) => (
                      <div key={idx} className="bg-gray-700 rounded-xl p-4 border border-gray-600">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="text-sm text-gray-400">Settimana {workout.week}</p>
                          </div>
                          <div className="bg-green-500 rounded-full p-2">
                            <Check className="w-5 h-5 text-white" />
                            <span className="sr-only">Completato</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                          <span>📅 {new Date(workout.date).toLocaleDateString('it-IT')}</span>
                          <span>🕒 {new Date(workout.date).toLocaleTimeString('it-IT', {hour: '2-digit', minute: '2-digit'})}</span>
                          <span>💪 {workout.exercises} esercizi</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* 📝 MODALE NOTE ESERCIZIO */}
        {showNoteModal && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowNoteModal(null)}
          >
            <div 
              className="bg-gray-800 rounded-2xl w-full max-w-lg shadow-2xl border border-gray-700 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const [day, week, exIdx] = showNoteModal.split('-').map(n => parseInt(n));
                const exercise = workoutDays[day].exercises[exIdx];
                const currentNote = getExerciseNote(day, week, exIdx);
                
                // Trova note storiche
                const historicalNotes = [];
                for (let w = 1; w <= 5; w++) {
                  const note = getExerciseNote(day, w, exIdx);
                  if (note && w !== week) {
                    historicalNotes.push({ week: w, note });
                  }
                }
                
                return (
                  <>
                    <div className="bg-gradient-to-r from-green-500 to-teal-500 p-4 flex justify-between items-center sticky top-0">
                      <div>
                        <h3 className="text-white font-bold text-lg">{exercise.name}</h3>
                        <p className="text-white text-sm opacity-80">Settimana {week}</p>
                        
                      </div>
                      <button onClick={() => setShowNoteModal(null)} className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition-all" aria-label="Chiudi note esercizio">
                        <X className="w-5 h-5 text-white" />
                      </button>
                    </div>
                    
                    <div className="p-6 space-y-6">
                      {/* Textarea nota corrente */}
                      <div>
                        <label className="block mb-2 font-semibold text-blue-400">📝 Nota per questa settimana</label>
                        <textarea
                          value={currentNote}
                          onChange={(e) => saveExerciseNote(day, week, exIdx, e.target.value)}
                          placeholder="Scrivi qui le tue osservazioni... (es. 'Sentito bene il pump', 'Aumentare peso prossima volta', 'Forma migliorata')"
                          className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[120px] resize-y"
                        />
                        <p className="text-xs text-gray-400 mt-2">💡 Usa le note per tracciare sensazioni, progressi, o punti da migliorare</p>
                      </div>
                      
                      {/* Note storiche */}
                      {historicalNotes.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-yellow-400 mb-3">📚 Note delle settimane precedenti</h4>
                          <div className="space-y-2">
                            {historicalNotes.map(({ week: w, note }) => (
                              <div key={w} className="bg-gray-700 rounded-lg p-3 border-l-4 border-yellow-500">
                                <div className="text-xs text-yellow-400 font-semibold mb-1">Settimana {w}</div>
                                <p className="text-sm text-gray-300">{note}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Info esercizio */}
                      <div className="bg-gray-700 rounded-lg p-4">
                        <h4 className="font-semibold mb-2 text-purple-400">ℹ️ Info Esercizio</h4>
                        <p className="text-sm text-gray-400 mb-2">{exercise.focus}</p>
                        <div className="flex gap-2 text-xs">
                          <span className="bg-blue-500 bg-opacity-20 px-2 py-1 rounded">
                            {exercise.weeklyPlan[week - 1].sets}
                          </span>
                          <span className="bg-yellow-500 bg-opacity-20 px-2 py-1 rounded">
                            {exercise.rest}
                          </span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => setShowNoteModal(null)}
                        className="w-full px-4 py-3 bg-green-500 hover:bg-green-600 rounded-lg font-semibold transition-all"
                      >
                        Salva e Chiudi
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};



// Rendi disponibile globalmente per l'HTML
if (typeof window !== 'undefined') {
  window.GymTrackerComponent = GymTracker;
}
