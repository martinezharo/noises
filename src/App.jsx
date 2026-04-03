import { useState, useRef } from 'react';
import { PlayIcon } from './icons/Play.jsx';
import { PauseIcon } from './icons/Pause.jsx';
import { TimerIcon } from './icons/Timer.jsx';
import { SkipNextIcon } from './icons/SkipNext.jsx';

const NOISES = [
  {
    name: 'brown',
    bgColor: 'bg-amber-900',
    textColor: 'text-amber-200',
    src: 'noises/brown-noise.mp3',
  },
  {
    name: 'white',
    bgColor: 'bg-black',
    textColor: 'text-white',
    src: 'noises/white-noise-looped.mp3',
  },
];

function App() {
  const [noiseIndex, setNoiseIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const buffersRef = useRef({});

  function getAudioCtx() {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  }

  function stopSource() {
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current = null;
    }
  }

  async function startSource(src) {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') await ctx.resume();

    stopSource();

    if (!buffersRef.current[src]) {
      const response = await fetch(src);
      const arrayBuffer = await response.arrayBuffer();
      buffersRef.current[src] = await ctx.decodeAudioData(arrayBuffer);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffersRef.current[src];
    source.loop = true;
    source.connect(ctx.destination);
    source.start();
    sourceRef.current = source;
  }

  async function handlePlayPause() {
    if (playing) {
      stopSource();
      setPlaying(false);
    } else {
      await startSource(NOISES[noiseIndex].src);
      setPlaying(true);
    }
  }

  async function handleSkip() {
    const next = (noiseIndex + 1) % NOISES.length;
    setNoiseIndex(next);
    if (playing) {
      await startSource(NOISES[next].src);
    }
  }

  const current = NOISES[noiseIndex];

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
          className={`${current.textColor} transition-transform hover:scale-110`}
          onClick={handlePlayPause}
        >
          {playing ? <PauseIcon size={52} /> : <PlayIcon size={52} />}
        </button>
        <button
          className={`${current.textColor} transition-transform hover:scale-110`}
          onClick={handleSkip}
        >
          <SkipNextIcon size={36} />
        </button>
      </nav>
    </div>
  );
}

export default App;
