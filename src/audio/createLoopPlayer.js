const CURVE_STEPS = 128;
const START_RAMP_SECONDS = 0.01;
const SCHEDULE_AHEAD_SECONDS = 0.25;

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
  const endWindowStart = endSample - overlapSamples;
  let total = 0;
  let count = 0;

  for (let index = 0; index < overlapSamples; index += stride) {
    const sampleA = channelData[startSample + index];
    const sampleB = channelData[endWindowStart + index];
    const nextIndex = Math.min(index + stride, overlapSamples - 1);
    const nextSampleA = channelData[startSample + nextIndex];
    const nextSampleB = channelData[endWindowStart + nextIndex];
    const slopeA = nextSampleA - sampleA;
    const slopeB = nextSampleB - sampleB;

    total += Math.abs(sampleA - sampleB) * 0.8;
    total += Math.abs(slopeA - slopeB) * 0.2;
    count += 1;
  }

  return count ? total / count : Number.POSITIVE_INFINITY;
}

function createLoopDescriptor(buffer, loopConfig = {}) {
  const strategy = loopConfig.strategy ?? 'native';
  const fallback = {
    buffer,
    strategy: 'native',
    loopStart: 0,
    loopEnd: buffer.duration,
    loopDuration: buffer.duration,
    crossfadeSeconds: 0,
  };

  if (strategy !== 'crossfade' || buffer.duration < 1) {
    return fallback;
  }

  const sampleRate = buffer.sampleRate;
  const edgeTrimSeconds = Math.min(loopConfig.edgeTrimSeconds ?? 0.04, buffer.duration / 8);
  const searchWindowSeconds = Math.min(loopConfig.searchWindowSeconds ?? 1.4, buffer.duration / 3);
  const requestedCrossfadeSeconds = loopConfig.crossfadeSeconds ?? 0.35;
  const crossfadeSeconds = Math.min(requestedCrossfadeSeconds, Math.max(0.12, buffer.duration / 6));
  const overlapSamples = Math.max(1024, Math.floor(crossfadeSeconds * sampleRate));
  const trimSamples = Math.floor(edgeTrimSeconds * sampleRate);
  const searchSamples = Math.max(overlapSamples * 2, Math.floor(searchWindowSeconds * sampleRate));
  const startSearchEnd = Math.min(trimSamples + searchSamples, buffer.length - overlapSamples * 3);
  const endSearchStart = Math.max(overlapSamples * 3, buffer.length - trimSamples - searchSamples);

  if (startSearchEnd <= trimSamples || endSearchStart >= buffer.length - trimSamples) {
    return fallback;
  }

  const candidateStep = Math.max(256, Math.floor((loopConfig.analysisStepSeconds ?? 0.02) * sampleRate));
  const analysisStride = Math.max(32, Math.floor(overlapSamples / 192));
  const mono = mixToMono(buffer);

  let bestStartSample = trimSamples;
  let bestEndSample = buffer.length - trimSamples;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let startSample = trimSamples; startSample <= startSearchEnd; startSample += candidateStep) {
    for (let endSample = endSearchStart; endSample <= buffer.length - trimSamples; endSample += candidateStep) {
      if (endSample - startSample < overlapSamples * 3) {
        continue;
      }

      const score = scoreLoopBoundary(mono, startSample, endSample, overlapSamples, analysisStride);

      if (score < bestScore) {
        bestScore = score;
        bestStartSample = startSample;
        bestEndSample = endSample;
      }
    }
  }

  const loopStart = bestStartSample / sampleRate;
  const loopEnd = bestEndSample / sampleRate;
  const loopDuration = loopEnd - loopStart;

  if (loopDuration <= crossfadeSeconds * 2) {
    return fallback;
  }

  return {
    buffer,
    strategy: 'crossfade',
    loopStart,
    loopEnd,
    loopDuration,
    crossfadeSeconds: Math.min(crossfadeSeconds, loopDuration / 4),
  };
}

export function createLoopPlayer(getAudioContext) {
  const buffers = new Map();
  const descriptors = new Map();

  let activeNodes = [];
  let scheduleTimerId = null;
  let requestId = 0;
  let sessionId = 0;
  let playback = {
    noiseSrc: null,
    offset: 0,
    startedAt: 0,
    duration: 0,
    isPlaying: false,
  };

  function getContext() {
    return getAudioContext();
  }

  function clearScheduler() {
    if (scheduleTimerId !== null) {
      window.clearTimeout(scheduleTimerId);
      scheduleTimerId = null;
    }
  }

  function removeNode(source) {
    activeNodes = activeNodes.filter((node) => node.source !== source);
  }

  function registerNode(source, gainNode) {
    activeNodes.push({ source, gainNode });
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
    for (const { source, gainNode } of activeNodes) {
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

    const ctx = getContext();
    const elapsed = Math.max(0, ctx.currentTime - playback.startedAt);

    return normalizePosition(playback.offset + elapsed, playback.duration);
  }

  function resetPlayback({ preservePosition = true } = {}) {
    sessionId += 1;
    clearScheduler();

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

    const ctx = getContext();
    const response = await fetch(src);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = await ctx.decodeAudioData(arrayBuffer);

    buffers.set(src, buffer);

    return buffer;
  }

  async function getDescriptor(noise) {
    if (descriptors.has(noise.src)) {
      return descriptors.get(noise.src);
    }

    const buffer = await loadBuffer(noise.src);
    const descriptor = {
      ...createLoopDescriptor(buffer, noise.loop),
      noiseSrc: noise.src,
    };

    descriptors.set(noise.src, descriptor);

    return descriptor;
  }

  function scheduleNativePlayback(descriptor, offset) {
    const ctx = getContext();
    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();
    const startTime = ctx.currentTime + START_RAMP_SECONDS;

    source.buffer = descriptor.buffer;
    source.loop = true;
    source.loopStart = descriptor.loopStart;
    source.loopEnd = descriptor.loopEnd;

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(1, startTime + START_RAMP_SECONDS);

    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start(startTime, descriptor.loopStart + offset);

    registerNode(source, gainNode);

    playback = {
      noiseSrc: descriptor.noiseSrc,
      offset,
      startedAt: startTime,
      duration: descriptor.loopDuration,
      isPlaying: true,
    };
  }

  function scheduleCrossfadePlayback(descriptor, offset) {
    const ctx = getContext();
    const currentSessionId = sessionId;
    const firstStartTime = ctx.currentTime + START_RAMP_SECONDS;

    const scheduleSegment = (segmentOffset, segmentStartTime, shouldFadeIn) => {
      if (currentSessionId !== sessionId) {
        return;
      }

      const remainingDuration = descriptor.loopEnd - segmentOffset;

      if (remainingDuration <= 0.02) {
        return;
      }

      const fadeDuration = Math.min(descriptor.crossfadeSeconds, remainingDuration / 2.5);
      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();
      const attackDuration = shouldFadeIn ? fadeDuration : Math.min(START_RAMP_SECONDS, remainingDuration / 4);
      const fullVolumeAt = segmentStartTime + Math.max(attackDuration, 0.005);
      const fadeOutStart = segmentStartTime + remainingDuration - fadeDuration;

      source.buffer = descriptor.buffer;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      gainNode.gain.setValueAtTime(0, segmentStartTime);

      if (shouldFadeIn && fadeDuration > 0.01) {
        gainNode.gain.setValueCurveAtTime(FADE_IN_CURVE, segmentStartTime, fadeDuration);
      } else {
        gainNode.gain.linearRampToValueAtTime(1, fullVolumeAt);
      }

      gainNode.gain.setValueAtTime(1, Math.min(fullVolumeAt, fadeOutStart));

      if (fadeOutStart > segmentStartTime) {
        gainNode.gain.setValueAtTime(1, fadeOutStart);
      }

      if (fadeDuration > 0.01) {
        gainNode.gain.setValueCurveAtTime(FADE_OUT_CURVE, fadeOutStart, fadeDuration);
      } else {
        gainNode.gain.linearRampToValueAtTime(0, segmentStartTime + remainingDuration);
      }

      source.start(segmentStartTime, segmentOffset);
      source.stop(segmentStartTime + remainingDuration);

      registerNode(source, gainNode);

      const nextStartTime = segmentStartTime + remainingDuration - fadeDuration;
      const timeoutMs = Math.max(0, (nextStartTime - ctx.currentTime - SCHEDULE_AHEAD_SECONDS) * 1000);

      scheduleTimerId = window.setTimeout(() => {
        scheduleTimerId = null;
        scheduleSegment(descriptor.loopStart, nextStartTime, true);
      }, timeoutMs);
    };

    scheduleSegment(descriptor.loopStart + offset, firstStartTime, false);

    playback = {
      noiseSrc: descriptor.noiseSrc,
      offset,
      startedAt: firstStartTime,
      duration: descriptor.loopDuration,
      isPlaying: true,
    };
  }

  async function prepare(noise) {
    const descriptor = await getDescriptor(noise);

    if (!playback.noiseSrc || playback.noiseSrc === noise.src) {
      playback = {
        ...playback,
        noiseSrc: noise.src,
        duration: descriptor.loopDuration,
      };
    }

    return descriptor;
  }

  async function start(noise, position = 0) {
    const currentRequestId = ++requestId;
    const ctx = getContext();

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const descriptor = await getDescriptor(noise);

    if (currentRequestId !== requestId) {
      return false;
    }

    const offset = normalizePosition(position, descriptor.loopDuration);
    resetPlayback({ preservePosition: false });

    if (descriptor.strategy === 'crossfade') {
      scheduleCrossfadePlayback(descriptor, offset);
    } else {
      scheduleNativePlayback(descriptor, offset);
    }

    return true;
  }

  async function seek(noise, position) {
    const descriptor = await getDescriptor(noise);
    const offset = normalizePosition(position, descriptor.loopDuration);

    if (playback.isPlaying && playback.noiseSrc === noise.src) {
      return start(noise, offset);
    }

    playback = {
      noiseSrc: noise.src,
      offset,
      startedAt: 0,
      duration: descriptor.loopDuration,
      isPlaying: false,
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
