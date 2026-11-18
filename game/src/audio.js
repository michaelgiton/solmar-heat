// All sound is synthesized with WebAudio: no audio files, nothing fetched.
// The engine is a filtered sawtooth whose pitch follows speed; the siren is a
// two-tone square wave; shots and punches are shaped noise bursts; the music
// is a slow synth pad cycling a four-chord progression. Audio starts on the
// first user gesture, as browsers require, and M toggles mute.

const CHORDS = [
  [220.0, 261.63, 329.63],
  [174.61, 220.0, 261.63],
  [196.0, 246.94, 293.66],
  [164.81, 196.0, 246.94],
];

export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicGain = null;
  let musicTimer = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return true;
    try {
      context = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return false;
    }
    started = true;
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(context.destination);

    // Engine drone: sawtooth through a lowpass, gain follows throttle.
    engineOsc = context.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineFilter = context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    engineGain = context.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter).connect(engineGain).connect(master);
    engineOsc.start();

    // Police siren: square wave alternating between two tones.
    sirenOsc = context.createOscillator();
    sirenOsc.type = 'square';
    sirenOsc.frequency.value = 660;
    sirenGain = context.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain).connect(master);
    sirenOsc.start();
    let high = false;
    setInterval(() => {
      if (!context || sirenGain.gain.value === 0) return;
      high = !high;
      sirenOsc.frequency.setTargetAtTime(high ? 880 : 660, context.currentTime, 0.02);
    }, 320);

    startMusic();
    return true;
  }

  function startMusic() {
    musicGain = context.createGain();
    musicGain.gain.value = 0.05;
    musicGain.connect(master);
    let chord = 0;
    const playChord = () => {
      if (!context) return;
      const notes = CHORDS[chord % CHORDS.length];
      chord += 1;
      for (const freq of notes) {
        const osc = context.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const gain = context.createGain();
        gain.gain.setValueAtTime(0, context.currentTime);
        gain.gain.linearRampToValueAtTime(0.5, context.currentTime + 0.8);
        gain.gain.linearRampToValueAtTime(0, context.currentTime + 3.8);
        osc.connect(gain).connect(musicGain);
        osc.start();
        osc.stop(context.currentTime + 4);
      }
      // Soft bass root, one octave down.
      const bass = context.createOscillator();
      bass.type = 'sine';
      bass.frequency.value = notes[0] / 2;
      const bassGain = context.createGain();
      bassGain.gain.setValueAtTime(0.35, context.currentTime);
      bassGain.gain.linearRampToValueAtTime(0, context.currentTime + 3.8);
      bass.connect(bassGain).connect(musicGain);
      bass.start();
      bass.stop(context.currentTime + 4);
    };
    playChord();
    musicTimer = setInterval(playChord, 4000);
  }

  function noiseBurst(duration, filterFreq, volume, type = 'lowpass') {
    if (!context) return;
    const length = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(master);
    source.start();
  }

  function blip(freq, duration, volume, type = 'sine', when = 0) {
    if (!context) return;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = context.createGain();
    const start = context.currentTime + when;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain).connect(master);
    osc.start(start);
    osc.stop(start + duration);
  }

  return {
    /** Call on any user gesture; safe to call repeatedly. */
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.55;
    },
    isMuted() {
      return muted;
    },
    /** Continuous engine sound; speed in m/s, throttle 0..1, driving or not. */
    engine(speed, throttle, driving) {
      if (!context) return;
      const target = driving ? 0.05 + 0.1 * throttle + Math.min(0.08, Math.abs(speed) * 0.002) : 0;
      engineGain.gain.setTargetAtTime(target, context.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(50 + Math.abs(speed) * 3.2 + throttle * 22, context.currentTime, 0.08);
      engineFilter.frequency.setTargetAtTime(280 + Math.abs(speed) * 14, context.currentTime, 0.1);
    },
    /** Siren audible while any police car is near; loudness 0..1. */
    siren(level) {
      if (!context) return;
      sirenGain.gain.setTargetAtTime(level * 0.045, context.currentTime, 0.2);
    },
    gunshot() {
      noiseBurst(0.16, 1800, 0.5);
      blip(160, 0.1, 0.3, 'square');
    },
    punch() {
      noiseBurst(0.09, 300, 0.55);
    },
    crash(strength) {
      noiseBurst(0.22, 500, Math.min(0.6, 0.15 + strength * 0.02));
    },
    pickup() {
      blip(880, 0.09, 0.25);
      blip(1318, 0.14, 0.25, 'sine', 0.07);
    },
    click() {
      blip(660, 0.05, 0.18, 'square');
    },
    door() {
      noiseBurst(0.08, 900, 0.3);
    },
    missionComplete() {
      blip(523, 0.16, 0.3);
      blip(659, 0.16, 0.3, 'sine', 0.12);
      blip(784, 0.3, 0.3, 'sine', 0.24);
    },
    missionFailed() {
      blip(392, 0.2, 0.3, 'triangle');
      blip(311, 0.35, 0.3, 'triangle', 0.18);
    },
    wantedUp() {
      blip(440, 0.1, 0.25, 'square');
      blip(440, 0.1, 0.25, 'square', 0.14);
    },
    horn() {
      blip(370, 0.25, 0.2, 'sawtooth');
    },
    stop() {
      if (musicTimer) clearInterval(musicTimer);
      if (context) context.close();
    },
  };
}
