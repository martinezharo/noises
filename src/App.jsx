import { useEffect, useRef, useState } from 'react';
import { createLoopPlayer } from './audio/createLoopPlayer.js';
import { PlayIcon } from './icons/Play.jsx';
import { PauseIcon } from './icons/Pause.jsx';
import { TimerIcon } from './icons/Timer.jsx';
import { SkipNextIcon } from './icons/SkipNext.jsx';

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

  const audioCtxRef = useRef(null);
  const playerRef = useRef(null);

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

  async function handlePlayPause() {
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
    const next = (noiseIndex + 1) % NOISES.length;
    const nextNoise = NOISES[next];

    setNoiseIndex(next);

    if (playing) {
      await playerRef.current.start(nextNoise, 0);
    } else {
      await playerRef.current.seek(nextNoise, 0);
    }
  }

  useEffect(() => {
    playerRef.current.prepare(current).catch(() => {});
  }, [current]);

  useEffect(() => {
    return () => {
      playerRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handlePlayPause();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleSkip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playing, noiseIndex]);

  return (
    <div className={`${current.bgColor} flex flex-col h-screen`}>
      <main className="h-4/5 flex items-center justify-center">
        <h1 className={`text-9xl font-bold ${current.textColor} tracking-wider`}>
          {current.name.toUpperCase()}
        </h1>
      </main>
      <nav className="h-1/5 flex items-center justify-center gap-20">
        <button className={`${current.textColor} opacity-40 cursor-not-allowed`} disabled>
          <TimerIcon size={36} />
        </button>
        <button
          className={`${current.textColor} transition-transform hover:scale-110 focus:outline-none focus:ring-0`}
          onClick={handlePlayPause}
        >
          {playing ? <PauseIcon size={52} /> : <PlayIcon size={52} />}
        </button>
        <button
          className={`${current.textColor} transition-transform hover:scale-110 focus:outline-none focus:ring-0`}
          onClick={handleSkip}
        >
          <SkipNextIcon size={36} />
        </button>
      </nav>
    </div>
  );
}

export default App;
