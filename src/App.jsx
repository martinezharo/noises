import { useEffect, useRef, useState } from 'react';
import { createLoopPlayer } from './audio/createLoopPlayer.js';
import { PlayIcon } from './icons/Play.jsx';
import { PauseIcon } from './icons/Pause.jsx';
import { TimerIcon } from './icons/Timer.jsx';
import { SkipNextIcon } from './icons/SkipNext.jsx';

function ChevronUpIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function ChevronDownIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function formatTimerDisplay(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Lista de ruidos
const NOISES = [
  {
    name: 'brown',
    bgColor: 'bg-amber-900',
    textColor: 'text-amber-200',
    src: 'noises/brown-noise.wav',
    loop: {
      strategy: 'crossfade',
      crossfadeSeconds: 0.4,
      searchWindowSeconds: 1.6,
      edgeTrimSeconds: 0.05,
      analysisStepSeconds: 0.02,
    },
  },
  {
    name: 'white',
    bgColor: 'bg-black',
    textColor: 'text-white',
    src: 'noises/white-noise-looped.mp3',
    loop: {
      strategy: 'native',
    },
  },
];

function App() {
  const [noiseIndex, setNoiseIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [isIdle, setIsIdle] = useState(false);

  // navigation: 0 (timer), 1 (play/pause), 2 (skip)
  const [focusedIndex, setFocusedIndex] = useState(1);

  // timerState: 'idle' | 'editing' | 'running' | 'paused'
  const [timerState, setTimerState] = useState('idle');
  const [timerMinutes, setTimerMinutes] = useState(5);
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(0);
  const timerIntervalRef = useRef(null);

  const audioCtxRef = useRef(null);
  const playerRef = useRef(null);
  const idleTimerRef = useRef(null);

  function getAudioCtx() {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }

    return audioCtxRef.current;
  }

  if (!playerRef.current) {
    playerRef.current = createLoopPlayer(getAudioCtx);
  }

  const current = NOISES[noiseIndex];

  const resetIdleTimer = useRef(() => {});
  
  resetIdleTimer.current = () => {
    setIsIdle(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

    if (!playing) return;

    idleTimerRef.current = setTimeout(() => {
      setIsIdle(true);
    }, 5000);
  };

  async function handlePlayPause() {
    resetIdleTimer.current();
    if (playing) {
      playerRef.current.stop();
      setPlaying(false);
    } else {
      const started = await playerRef.current.start(current, playerRef.current.getPosition());

      if (started) {
        setPlaying(true);
      }
    }
  }

  async function handleSkip() {
    resetIdleTimer.current();
    const next = (noiseIndex + 1) % NOISES.length;
    const nextNoise = NOISES[next];

    setNoiseIndex(next);

    if (playing) {
      await playerRef.current.start(nextNoise, 0);
    } else {
      await playerRef.current.seek(nextNoise, 0);
    }
  }

  function startTimer() {
    resetIdleTimer.current();
    clearInterval(timerIntervalRef.current);
    setTimerSecondsLeft(timerMinutes * 60);
    setTimerState('running');
  }

  function cancelTimer() {
    clearInterval(timerIntervalRef.current);
    setTimerState('idle');
    setTimerMinutes(5);
  }

  function handleTimerClick() {
    resetIdleTimer.current();
    if (timerState === 'idle') {
      setTimerState('editing');
    } else if (timerState === 'editing') {
      startTimer();
    } else if (timerState === 'running') {
      setTimerState('paused');
    } else if (timerState === 'paused') {
      setTimerState('running');
    }
  }

  function handleTimerUp() {
    resetIdleTimer.current();
    if (timerState === 'editing') {
      setTimerMinutes(prev => prev + 5);
    } else if (timerState === 'running' || timerState === 'paused') {
      setTimerSecondsLeft(prev => prev + 5 * 60);
    }
  }

  function handleTimerDown() {
    resetIdleTimer.current();
    if (timerState === 'editing') {
      setTimerMinutes(prev => Math.max(5, prev - 5));
    } else if (timerState === 'running' || timerState === 'paused') {
      setTimerSecondsLeft(prev => Math.max(60, prev - 5 * 60));
    }
  }


  // Countdown interval
  useEffect(() => {
    if (timerState === 'running') {
      timerIntervalRef.current = setInterval(() => {
        setTimerSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerIntervalRef.current);
  }, [timerState]);

  // When timer reaches 0
  useEffect(() => {
    if (timerState === 'running' && timerSecondsLeft === 0) {
      playerRef.current.stop();
      setPlaying(false);
      setTimerState('idle');
      setTimerMinutes(5);
    }
  }, [timerSecondsLeft, timerState]);

  useEffect(() => {
    playerRef.current.prepare(current).catch(() => {});
  }, [current]);

  useEffect(() => {
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'];
    
    const activityHandler = () => {
      resetIdleTimer.current();
    };

    activityEvents.forEach(event => {
      window.addEventListener(event, activityHandler);
    });

    resetIdleTimer.current();

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, activityHandler);
      });
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [playing]);

  useEffect(() => {
    return () => {
      playerRef.current?.dispose();
      clearInterval(timerIntervalRef.current);
    };
  }, []);

  // Keyboard handler via ref to always read fresh state without re-registering
  const handleKeyDownRef = useRef(() => {});
  handleKeyDownRef.current = (event) => {
    resetIdleTimer.current();

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setFocusedIndex(prev => (prev + 1) % 3);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setFocusedIndex(prev => (prev - 1 + 3) % 3);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (focusedIndex === 0 && timerState !== 'idle') {
        handleTimerUp();
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (focusedIndex === 0 && timerState !== 'idle') {
        handleTimerDown();
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (focusedIndex === 0) {
        handleTimerClick();
      } else if (focusedIndex === 1) {
        handlePlayPause();
      } else if (focusedIndex === 2) {
        handleSkip();
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      if (timerState !== 'idle') {
        cancelTimer();
      }
    }
  };

  useEffect(() => {
    const handler = (e) => handleKeyDownRef.current(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className={`${current.bgColor} flex flex-col h-screen transition-colors duration-1000 ${isIdle ? 'bg-black' : ''}`}>
      <div className={`flex flex-col h-full transition-opacity duration-1000 ${isIdle ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <main className="h-4/5 flex items-center justify-center">
          <h1 className={`text-9xl font-bold ${current.textColor} tracking-wider`}>
            {current.name.toUpperCase()}
          </h1>
        </main>
        <nav className="h-1/5 flex items-center justify-center gap-12">
          {/* Timer */}
          <div className="relative flex flex-col items-center group">
            <button
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const y = e.clientY - rect.top;
                if (timerState !== 'idle' && y < rect.height * 0.3) {
                  handleTimerUp();
                } else if (timerState !== 'idle' && y > rect.height * 0.7) {
                  handleTimerDown();
                } else {
                  setFocusedIndex(0);
                  handleTimerClick();
                }
              }}
              onMouseEnter={() => setFocusedIndex(0)}
              className={`${current.textColor} relative z-10 w-24 h-24 flex flex-col items-center justify-center rounded-full transition-all duration-300 focus:outline-none focus:ring-0 select-none ${focusedIndex === 0 ? 'bg-white/10 scale-110' : 'hover:bg-white/5'} ${timerState === 'idle' ? 'opacity-40' : ''}`}
              aria-label="Temporizador"
            >
              {timerState !== 'idle' && (
                <>
                  <div className="absolute top-2 transition-transform hover:scale-125 active:scale-95 pointer-events-none">
                    <ChevronUpIcon size={18} />
                  </div>
                  <div className="absolute bottom-2 transition-transform hover:scale-125 active:scale-95 pointer-events-none">
                    <ChevronDownIcon size={18} />
                  </div>
                </>
              )}
              
              <div className="z-10 flex items-center justify-center">
                {timerState === 'idle' && <TimerIcon size={36} />}
                {timerState === 'editing' && (
                  <span className="font-bold text-xl min-w-12 inline-block text-center leading-none">
                    {timerMinutes}m
                  </span>
                )}
                {(timerState === 'running' || timerState === 'paused') && (
                  <span className={`font-mono text-xl min-w-13 inline-block text-center leading-none${timerState === 'paused' ? ' opacity-50' : ''}`}>
                    {formatTimerDisplay(timerSecondsLeft)}
                  </span>
                )}
              </div>
            </button>
          </div>

          {/* Play/Pause */}
          <button
            onMouseEnter={() => setFocusedIndex(1)}
            onClick={() => { setFocusedIndex(1); handlePlayPause(); }}
            className={`${current.textColor} w-24 h-24 flex items-center justify-center rounded-full transition-all duration-300 focus:outline-none focus:ring-0 ${focusedIndex === 1 ? 'bg-white/10 scale-110' : 'hover:bg-white/5'}`}
          >
            {playing ? <PauseIcon size={52} /> : <PlayIcon size={52} />}
          </button>

          {/* Skip */}
          <button
            onMouseEnter={() => setFocusedIndex(2)}
            onClick={() => { setFocusedIndex(2); handleSkip(); }}
            className={`${current.textColor} w-20 h-20 flex items-center justify-center rounded-full transition-all duration-300 focus:outline-none focus:ring-0 ${focusedIndex === 2 ? 'bg-white/10 scale-110' : 'hover:bg-white/5'}`}
          >
            <SkipNextIcon size={36} />
          </button>
        </nav>
      </div>
    </div>
  );
}

export default App;
