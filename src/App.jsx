import { useEffect, useRef, useState } from 'react';
import { createLoopPlayer } from './audio/createLoopPlayer.js';
import { PlayIcon } from './icons/Play.jsx';
import { PauseIcon } from './icons/Pause.jsx';
import { TimerIcon } from './icons/Timer.jsx';
import { SkipNextIcon } from './icons/SkipNext.jsx';

function ChevronUpIcon({ size = 24, smSize = 24 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: `var(--width, ${size}px)`, height: `var(--height, ${size}px)` }} className="[--width:16px] sm:[--width:18px] [--height:16px] sm:[--height:18px]">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function ChevronDownIcon({ size = 24, smSize = 24 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: `var(--width, ${size}px)`, height: `var(--height, ${size}px)` }} className="[--width:16px] sm:[--width:18px] [--height:16px] sm:[--height:18px]">
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
    themeClassName: 'theme-brown',
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
    themeClassName: 'theme-white',
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
      const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

      if (!AudioContextConstructor) {
        throw new Error('AudioContext is not available in this browser');
      }

      try {
        audioCtxRef.current = new AudioContextConstructor({
          latencyHint: 'playback',
        });
      } catch {
        audioCtxRef.current = new AudioContextConstructor();
      }
    }

    return audioCtxRef.current;
  }

  if (!playerRef.current) {
    playerRef.current = createLoopPlayer(getAudioCtx);
  }

  const current = NOISES[noiseIndex];

  function getControlButtonClass({
    isDimmed = false,
    isFocusedButton = false,
    variant = 'default',
  } = {}) {
    const classNames = ['control-button'];

    if (variant === 'timer') {
      classNames.push('timer-button');
    } else if (variant === 'play') {
      classNames.push('play-button');
    } else if (variant === 'skip') {
      classNames.push('skip-button');
    }

    if (isFocusedButton) {
      classNames.push('is-focused');
    }

    if (isDimmed) {
      classNames.push('is-dimmed');
    }

    return classNames.join(' ');
  }

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
      let started = false;

      try {
        started = await playerRef.current.start(current, playerRef.current.getPosition());
      } catch {
        started = false;
      }

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

    try {
      if (playing) {
        await playerRef.current.start(nextNoise, 0);
      } else {
        await playerRef.current.seek(nextNoise, 0);
      }
    } catch {
      // Keep the UI responsive if an older WebView fails to initialize audio.
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
    <div className={`app-shell ${current.themeClassName}${isIdle ? ' is-idle' : ''}`}>
      <div className={`app-layout${isIdle ? ' is-idle' : ''}`}>
        <main className="app-main">
          <h1 className="noise-title">
            {current.name.toUpperCase()}
          </h1>
        </main>
        <nav className="control-bar">
          {/* Timer */}
          <div className="control-group">
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
              className={getControlButtonClass({
                isDimmed: timerState === 'idle',
                isFocusedButton: focusedIndex === 0,
                variant: 'timer',
              })}
              aria-label="Temporizador"
            >
              {timerState !== 'idle' && (
                <>
                  <div className="timer-chevron timer-chevron-up">
                    <ChevronUpIcon size={16} smSize={18} />
                  </div>
                  <div className="timer-chevron timer-chevron-down">
                    <ChevronDownIcon size={16} smSize={18} />
                  </div>
                </>
              )}
              
              <div className="timer-display">
                {timerState === 'idle' && <TimerIcon size={32} smSize={36} />}
                {timerState === 'editing' && (
                  <span className="timer-edit-value">
                    {timerMinutes}m
                  </span>
                )}
                {(timerState === 'running' || timerState === 'paused') && (
                  <span className={`timer-running-value${timerState === 'paused' ? ' is-paused' : ''}`}>
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
            className={getControlButtonClass({
              isFocusedButton: focusedIndex === 1,
              variant: 'play',
            })}
          >
            {playing ? <PauseIcon size={44} smSize={52} /> : <PlayIcon size={44} smSize={52} />}
          </button>

          {/* Skip */}
          <button
            onMouseEnter={() => setFocusedIndex(2)}
            onClick={() => { setFocusedIndex(2); handleSkip(); }}
            className={getControlButtonClass({
              isFocusedButton: focusedIndex === 2,
              variant: 'skip',
            })}
          >
            <SkipNextIcon size={32} smSize={36} />
          </button>
        </nav>
      </div>
    </div>
  );
}

export default App;
