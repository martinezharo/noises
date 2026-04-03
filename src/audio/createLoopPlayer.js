const CURVE_STEPS = 256;
const START_RAMP_SECONDS = 0.01;
const DEFAULT_ANALYSIS_STEP_SECONDS = 0.02;

const FADE_IN_CURVE = createFadeCurve('in');
const FADE_OUT_CURVE = createFadeCurve('out');

function createFadeCurve(direction) {
  const curve = new Float32Array(CURVE_STEPS);

  for (let index = 0; index < CURVE_STEPS; index += 1) {
    const progress = index / (CURVE_STEPS - 1);

    curve[index] = direction === 'in'
      ? Math.sin((progress * Math.PI) / 2)
      : Math.cos((progress * Math.PI) / 2);
  }

  return curve;
}

function normalizePosition(position, duration) {
  if (!duration) {
    return 0;
  }

  return ((position % duration) + duration) % duration;
}

function mixToMono(buffer) {
  const mono = new Float32Array(buffer.length);

  for (let channelIndex = 0; channelIndex < buffer.numberOfChannels; channelIndex += 1) {
    const channelData = buffer.getChannelData(channelIndex);

    for (let sampleIndex = 0; sampleIndex < buffer.length; sampleIndex += 1) {
      mono[sampleIndex] += channelData[sampleIndex] / buffer.numberOfChannels;
    }
  }

  return mono;
}

function scoreLoopBoundary(channelData, startSample, endSample, overlapSamples, stride) {
  const tailStartSample = endSample - overlapSamples;
  let total = 0;
  let count = 0;

  for (let index = 0; index < overlapSamples; index += stride) {
    const sampleA = channelData[startSample + index];
    const sampleB = channelData[tailStartSample + index];
    const nextIndex = Math.min(index + stride, overlapSamples - 1);
    const nextSampleA = channelData[startSample + nextIndex];
    const nextSampleB = channelData[tailStartSample + nextIndex];
    const slopeA = nextSampleA - sampleA;
    const slopeB = nextSampleB - sampleB;

    total += Math.abs(sampleA - sampleB) * 0.75;
    total += Math.abs(slopeA - slopeB) * 0.2;
    total += Math.abs(Math.abs(sampleA) - Math.abs(sampleB)) * 0.05;
    count += 1;
  }

  return count ? total / count : Number.POSITIVE_INFINITY;
}

function searchBestLoopPair(channelData, options) {
  const {
    analysisStride,
    candidateStep,
    endFrom,
    endTo,
    minimumDistanceSamples,
    overlapSamples,
    startFrom,
    startTo,
  } = options;

  let best = null;

  for (let startSample = startFrom; startSample <= startTo; startSample += candidateStep) {
    for (let endSample = endFrom; endSample <= endTo; endSample += candidateStep) {
      if (endSample - startSample < minimumDistanceSamples) {
        continue;
      }

      const score = scoreLoopBoundary(channelData, startSample, endSample, overlapSamples, analysisStride);

      if (!best || score < best.score) {
        best = {
          endSample,
          score,
          startSample,
        };
      }
    }
  }

  return best;
}

function findBestLoopSamples(buffer, loopConfig = {}) {
  const sampleRate = buffer.sampleRate;
  const edgeTrimSeconds = Math.min(loopConfig.edgeTrimSeconds ?? 0.04, buffer.duration / 8);
  const searchWindowSeconds = Math.min(loopConfig.searchWindowSeconds ?? 1.4, buffer.duration / 3);
  const requestedCrossfadeSeconds = loopConfig.crossfadeSeconds ?? 0.35;
  const crossfadeSeconds = Math.min(requestedCrossfadeSeconds, Math.max(0.12, buffer.duration / 6));
  const overlapSamples = Math.max(2048, Math.floor(crossfadeSeconds * sampleRate));
  const trimSamples = Math.floor(edgeTrimSeconds * sampleRate);
  const searchSamples = Math.max(overlapSamples * 2, Math.floor(searchWindowSeconds * sampleRate));
  const maxStartSample = Math.min(trimSamples + searchSamples, buffer.length - overlapSamples * 3);
  const minEndSample = Math.max(overlapSamples * 3, buffer.length - trimSamples - searchSamples);

  if (maxStartSample <= trimSamples || minEndSample >= buffer.length - trimSamples) {
    return null;
  }

  const mono = mixToMono(buffer);
  const coarseStep = Math.max(256, Math.floor((loopConfig.analysisStepSeconds ?? DEFAULT_ANALYSIS_STEP_SECONDS) * sampleRate));
  const fineStep = Math.max(16, Math.floor(coarseStep / 8));
  const refineWindow = coarseStep * 2;
  const analysisStride = Math.max(8, Math.floor(overlapSamples / 384));
  const minimumDistanceSamples = overlapSamples * 3;

  const coarseBest = searchBestLoopPair(mono, {
    analysisStride,
    candidateStep: coarseStep,
    endFrom: minEndSample,
    endTo: buffer.length - trimSamples,
    minimumDistanceSamples,
    overlapSamples,
    startFrom: trimSamples,
    startTo: maxStartSample,
  });

  if (!coarseBest) {
    return null;
  }

  const fineBest = searchBestLoopPair(mono, {
    analysisStride,
    candidateStep: fineStep,
    endFrom: Math.max(minEndSample, coarseBest.endSample - refineWindow),
    endTo: Math.min(buffer.length - trimSamples, coarseBest.endSample + refineWindow),
    minimumDistanceSamples,
    overlapSamples,
    startFrom: Math.max(trimSamples, coarseBest.startSample - refineWindow),
    startTo: Math.min(maxStartSample, coarseBest.startSample + refineWindow),
  });

  const best = fineBest ?? coarseBest;
  const loopLengthSamples = best.endSample - best.startSample;
  const safeOverlapSamples = Math.min(overlapSamples, Math.floor(loopLengthSamples / 4));

  if (safeOverlapSamples < 1024 || loopLengthSamples <= safeOverlapSamples * 2) {
    return null;
  }

  return {
    crossfadeSamples: safeOverlapSamples,
    loopEndSample: best.endSample,
    loopStartSample: best.startSample,
  };
}

function renderCrossfadedLoopBuffer(context, buffer, loopSamples) {
  const { crossfadeSamples, loopEndSample, loopStartSample } = loopSamples;
  const loopLengthSamples = loopEndSample - loopStartSample;
  const outputLength = loopLengthSamples - crossfadeSamples;

  if (outputLength <= crossfadeSamples) {
    return null;
  }

  const renderedBuffer = context.createBuffer(
    buffer.numberOfChannels,
    outputLength,
    buffer.sampleRate,
  );
  const tailStartSample = loopEndSample - crossfadeSamples;

  for (let channelIndex = 0; channelIndex < buffer.numberOfChannels; channelIndex += 1) {
    const input = buffer.getChannelData(channelIndex);
    const output = renderedBuffer.getChannelData(channelIndex);

    for (let sampleIndex = 0; sampleIndex < crossfadeSamples; sampleIndex += 1) {
      const curveIndex = Math.round((sampleIndex / (crossfadeSamples - 1)) * (CURVE_STEPS - 1));
      const fadeIn = FADE_IN_CURVE[curveIndex];
      const fadeOut = FADE_OUT_CURVE[curveIndex];
      const headSample = input[loopStartSample + sampleIndex];
      const tailSample = input[tailStartSample + sampleIndex];

      output[sampleIndex] = (tailSample * fadeOut) + (headSample * fadeIn);
    }

    for (let sampleIndex = crossfadeSamples; sampleIndex < outputLength; sampleIndex += 1) {
      output[sampleIndex] = input[loopStartSample + sampleIndex];
    }
  }

  return renderedBuffer;
}

function createLoopDescriptor(context, buffer, loopConfig = {}) {
  const strategy = loopConfig.strategy ?? 'native';
  const fallback = {
    buffer,
    loopDuration: buffer.duration,
    loopEnd: buffer.duration,
    loopStart: 0,
    strategy: 'native',
  };

  if (strategy !== 'crossfade' || buffer.duration < 1) {
    return fallback;
  }

  const loopSamples = findBestLoopSamples(buffer, loopConfig);

  if (!loopSamples) {
    return fallback;
  }

  const renderedBuffer = renderCrossfadedLoopBuffer(context, buffer, loopSamples);

  if (!renderedBuffer) {
    return fallback;
  }

  return {
    buffer: renderedBuffer,
    loopDuration: renderedBuffer.duration,
    loopEnd: renderedBuffer.duration,
    loopStart: 0,
    sourceLoopEnd: loopSamples.loopEndSample / buffer.sampleRate,
    sourceLoopStart: loopSamples.loopStartSample / buffer.sampleRate,
    strategy: 'native',
  };
}

export function createLoopPlayer(getAudioContext) {
  const buffers = new Map();
  const descriptors = new Map();

  let activeNodes = [];
  let requestId = 0;
  let playback = {
    duration: 0,
    isPlaying: false,
    noiseSrc: null,
    offset: 0,
    startedAt: 0,
  };

  function getContext() {
    return getAudioContext();
  }

  function removeNode(source) {
    activeNodes = activeNodes.filter((node) => node.source !== source);
  }

  function registerNode(source, gainNode) {
    activeNodes.push({ gainNode, source });

    source.onended = () => {
      removeNode(source);

      try {
        source.disconnect();
      } catch {
        // noop
      }

      try {
        gainNode.disconnect();
      } catch {
        // noop
      }
    };
  }

  function stopNodes() {
    for (const { gainNode, source } of activeNodes) {
      try {
        source.stop(0);
      } catch {
        // noop
      }

      try {
        source.disconnect();
      } catch {
        // noop
      }

      try {
        gainNode.disconnect();
      } catch {
        // noop
      }
    }

    activeNodes = [];
  }

  function getCurrentPosition() {
    if (!playback.duration || !playback.noiseSrc) {
      return 0;
    }

    if (!playback.isPlaying) {
      return normalizePosition(playback.offset, playback.duration);
    }

    const context = getContext();
    const elapsed = Math.max(0, context.currentTime - playback.startedAt);

    return normalizePosition(playback.offset + elapsed, playback.duration);
  }

  function resetPlayback({ preservePosition = true } = {}) {
    if (preservePosition) {
      playback.offset = getCurrentPosition();
    } else {
      playback.offset = 0;
    }

    playback.isPlaying = false;
    playback.startedAt = 0;

    stopNodes();
  }

  async function loadBuffer(src) {
    if (buffers.has(src)) {
      return buffers.get(src);
    }

    const context = getContext();
    const response = await fetch(src);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = await context.decodeAudioData(arrayBuffer);

    buffers.set(src, buffer);

    return buffer;
  }

  async function getDescriptor(noise) {
    if (descriptors.has(noise.src)) {
      return descriptors.get(noise.src);
    }

    const context = getContext();
    const buffer = await loadBuffer(noise.src);
    const descriptor = {
      ...createLoopDescriptor(context, buffer, noise.loop),
      noiseSrc: noise.src,
    };

    descriptors.set(noise.src, descriptor);

    return descriptor;
  }

  function startBufferedPlayback(descriptor, offset) {
    const context = getContext();
    const source = context.createBufferSource();
    const gainNode = context.createGain();
    const startTime = context.currentTime + START_RAMP_SECONDS;

    source.buffer = descriptor.buffer;
    source.loop = true;
    source.loopStart = descriptor.loopStart;
    source.loopEnd = descriptor.loopEnd;

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(1, startTime + START_RAMP_SECONDS);

    source.connect(gainNode);
    gainNode.connect(context.destination);
    source.start(startTime, descriptor.loopStart + offset);

    registerNode(source, gainNode);

    playback = {
      duration: descriptor.loopDuration,
      isPlaying: true,
      noiseSrc: descriptor.noiseSrc,
      offset,
      startedAt: startTime,
    };
  }

  async function prepare(noise) {
    const descriptor = await getDescriptor(noise);

    if (!playback.noiseSrc || playback.noiseSrc === noise.src) {
      playback = {
        ...playback,
        duration: descriptor.loopDuration,
        noiseSrc: noise.src,
      };
    }

    return descriptor;
  }

  async function start(noise, position = 0) {
    const currentRequestId = ++requestId;
    const context = getContext();

    if (context.state === 'suspended') {
      await context.resume();
    }

    const descriptor = await getDescriptor(noise);

    if (currentRequestId !== requestId) {
      return false;
    }

    const offset = normalizePosition(position, descriptor.loopDuration);

    resetPlayback({ preservePosition: false });
    startBufferedPlayback(descriptor, offset);

    return true;
  }

  async function seek(noise, position) {
    const descriptor = await getDescriptor(noise);
    const offset = normalizePosition(position, descriptor.loopDuration);

    if (playback.isPlaying && playback.noiseSrc === noise.src) {
      return start(noise, offset);
    }

    playback = {
      duration: descriptor.loopDuration,
      isPlaying: false,
      noiseSrc: noise.src,
      offset,
      startedAt: 0,
    };

    return true;
  }

  function stop() {
    resetPlayback({ preservePosition: true });
  }

  function getDuration(noise) {
    if (!noise) {
      return playback.duration || 0;
    }

    return descriptors.get(noise.src)?.loopDuration || 0;
  }

  function isPlaying() {
    return playback.isPlaying;
  }

  function dispose() {
    requestId += 1;
    resetPlayback({ preservePosition: false });
  }

  return {
    dispose,
    getDuration,
    getPosition: getCurrentPosition,
    isPlaying,
    loadBuffer,
    prepare,
    seek,
    start,
    stop,
  };
}
