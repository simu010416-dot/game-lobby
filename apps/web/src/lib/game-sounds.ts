const PREFS_KEY = 'game-audio-prefs';

interface AudioPrefs {
  sfx: boolean;
  music: boolean;
}

function loadPrefs(): AudioPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AudioPrefs>;
      return { sfx: p.sfx !== false, music: p.music !== false };
    }
  } catch {
    /* ignore */
  }
  return { sfx: true, music: true };
}

let prefs = loadPrefs();

function savePrefs() {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function isSfxEnabled() {
  return prefs.sfx;
}

export function isMusicEnabled() {
  return prefs.music;
}

export function setSfxEnabled(enabled: boolean) {
  prefs = { ...prefs, sfx: enabled };
  savePrefs();
}

export function setMusicEnabled(enabled: boolean) {
  prefs = { ...prefs, music: enabled };
  savePrefs();
  if (!enabled) stopBackgroundMusic();
}

let audioCtx: AudioContext | null = null;

function ctx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  if (bgmWantsPlay && prefs.music) void tryPlayBgm();
  return audioCtx;
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.12,
  attack = 0.01,
  release = 0.08,
) {
  if (!prefs.sfx) return;
  const ac = ctx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = ac.currentTime;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration + release);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(t);
  osc.stop(t + duration + release + 0.05);
}

function noiseBurst(duration: number, volume = 0.06) {
  if (!prefs.sfx) return;
  const ac = ctx();
  const bufferSize = Math.floor(ac.sampleRate * duration);
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0)!;
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const gain = ac.createGain();
  const t = ac.currentTime;
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  src.connect(gain);
  gain.connect(ac.destination);
  src.start(t);
}

/** Soft card slide when a tile is drawn from the deck. */
export function playDrawSound() {
  noiseBurst(0.07, 0.05);
  tone(320, 0.04, 'triangle', 0.07);
}

/** Short positive chime on a correct guess. */
export function playGuessCorrect() {
  tone(523, 0.1, 'sine', 0.1);
  setTimeout(() => tone(659, 0.12, 'sine', 0.09), 70);
}

/** Low buzz on a wrong guess. */
export function playGuessWrong() {
  tone(180, 0.14, 'sawtooth', 0.07);
  tone(140, 0.18, 'triangle', 0.05);
}

/** Click when placing a Joker. */
export function playPlaceJoker() {
  tone(440, 0.05, 'square', 0.06);
  tone(330, 0.07, 'triangle', 0.05);
}

/** Subtle tick when a new turn begins. */
export function playTurnSound() {
  tone(392, 0.06, 'sine', 0.05);
}

/** Triumphant fanfare when the game ends with a winner. */
export function playVictorySound() {
  if (!prefs.sfx) return;
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    setTimeout(() => tone(freq, 0.22, 'sine', 0.11, 0.02, 0.15), i * 110);
  });
  setTimeout(() => tone(1319, 0.35, 'triangle', 0.08, 0.02, 0.25), 480);
}

// --- Background music (looped MP3) ---
// Track: "Ambient Pad I" by Gregor Quendel — https://opengameart.org/content/ambient-vol-1

const BGM_URL = '/audio/da-vinci-bgm.mp3';
const BGM_TARGET_VOLUME = 0.22;
const BGM_FADE_MS = 900;

let bgmAudio: HTMLAudioElement | null = null;
let bgmFadeTimer: ReturnType<typeof setInterval> | null = null;
let bgmWantsPlay = false;

function getBgmAudio(): HTMLAudioElement {
  if (!bgmAudio) {
    bgmAudio = new Audio(BGM_URL);
    bgmAudio.loop = true;
    bgmAudio.preload = 'auto';
    bgmAudio.volume = 0;
  }
  return bgmAudio;
}

function clearBgmFade() {
  if (bgmFadeTimer) {
    clearInterval(bgmFadeTimer);
    bgmFadeTimer = null;
  }
}

function fadeBgmVolume(to: number, durationMs: number, onDone?: () => void) {
  const audio = bgmAudio;
  if (!audio) {
    onDone?.();
    return;
  }
  clearBgmFade();
  const from = audio.volume;
  const steps = 24;
  const stepMs = durationMs / steps;
  let step = 0;
  bgmFadeTimer = setInterval(() => {
    step++;
    audio.volume = Math.max(0, Math.min(1, from + (to - from) * (step / steps)));
    if (step >= steps) {
      clearBgmFade();
      audio.volume = to;
      onDone?.();
    }
  }, stepMs);
}

function scheduleBgmUnlockRetry() {
  document.addEventListener(
    'pointerdown',
    () => {
      void tryPlayBgm();
    },
    { once: true },
  );
}

async function tryPlayBgm() {
  if (!prefs.music || !bgmWantsPlay) return;
  const audio = getBgmAudio();
  if (!audio.paused && audio.volume > 0.01) return;
  try {
    await audio.play();
    fadeBgmVolume(BGM_TARGET_VOLUME, BGM_FADE_MS);
  } catch {
    scheduleBgmUnlockRetry();
  }
}

/** Resume audio output after a user gesture (autoplay policy). */
export function unlockAudio() {
  if (audioCtx?.state === 'suspended') void audioCtx.resume();
  void tryPlayBgm();
}

export function startBackgroundMusic() {
  if (!prefs.music) return;
  bgmWantsPlay = true;
  void tryPlayBgm();
}

export function stopBackgroundMusic() {
  bgmWantsPlay = false;
  if (!bgmAudio) return;
  const audio = bgmAudio;
  if (audio.paused) {
    audio.volume = 0;
    return;
  }
  fadeBgmVolume(0, BGM_FADE_MS, () => {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 0;
  });
}
