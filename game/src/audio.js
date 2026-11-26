// SENJA AIR — audio: fully procedural Web Audio. No sound files.
// Engine hum (two detuned saws through a lowpass, pitch follows throttle),
// wind (filtered noise, louder with speed), ring chime, touchdown thump,
// crash noise burst, and a soft dusk pad on the title screen.
export function createAudio() {
  let ctx = null;
  let engineOsc1 = null, engineOsc2 = null, engineGain = null, engineFilter = null;
  let windSrc = null, windGain = null, windFilter = null;
  let padOsc = null, padGain = null;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    } catch {
      return false;
    }
    // Engine: two saws, one a fifth-ish above, into a lowpass.
    engineOsc1 = ctx.createOscillator(); engineOsc1.type = 'sawtooth'; engineOsc1.frequency.value = 55;
    engineOsc2 = ctx.createOscillator(); engineOsc2.type = 'sawtooth'; engineOsc2.frequency.value = 82;
    engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 320;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    engineOsc1.connect(engineFilter); engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain); engineGain.connect(ctx.destination);
    engineOsc1.start(); engineOsc2.start();
    // Wind: looped noise buffer through a bandpass.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    windSrc = ctx.createBufferSource(); windSrc.buffer = buf; windSrc.loop = true;
    windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 500; windFilter.Q.value = 0.6;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    windSrc.connect(windFilter); windFilter.connect(windGain); windGain.connect(ctx.destination);
    windSrc.start();
    // Dusk pad: two slow sine/triangle voices, very quiet.
    padOsc = ctx.createOscillator(); padOsc.type = 'triangle'; padOsc.frequency.value = 110;
    const padOsc2 = ctx.createOscillator(); padOsc2.type = 'sine'; padOsc2.frequency.value = 164.8;
    padGain = ctx.createGain(); padGain.gain.value = 0;
    padOsc.connect(padGain); padOsc2.connect(padGain); padGain.connect(ctx.destination);
    padOsc.start(); padOsc2.start();
    started = true;
    return true;
  }

  function resume() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  // Called every frame while flying: throttle 0..1, speed m/s, stalled bool.
  function updateFlight(throttle, speed, stalled) {
    if (!ctx || !started) return;
    const t = ctx.currentTime;
    const rpm = 40 + throttle * 90 + (stalled ? -8 : 0);
    engineOsc1.frequency.setTargetAtTime(rpm, t, 0.08);
    engineOsc2.frequency.setTargetAtTime(rpm * 1.5, t, 0.08);
    engineFilter.frequency.setTargetAtTime(220 + throttle * 900, t, 0.1);
    engineGain.gain.setTargetAtTime(0.02 + throttle * 0.075, t, 0.1);
    const windLevel = Math.min(0.16, Math.max(0, (speed - 12) / 50) * 0.16);
    windGain.gain.setTargetAtTime(windLevel, t, 0.15);
    windFilter.frequency.setTargetAtTime(350 + speed * 18, t, 0.15);
    padGain.gain.setTargetAtTime(0, t, 0.5);
  }

  function titlePad(on) {
    if (!ensure()) return;
    padGain.gain.setTargetAtTime(on ? 0.035 : 0, ctx.currentTime, 0.8);
    if (on) { engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.3); windGain.gain.setTargetAtTime(0, ctx.currentTime, 0.3); }
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function ringChime() {
    blip(880, 0.35, 'sine', 0.22);
    blip(1318.5, 0.5, 'sine', 0.18, 0.07);
    blip(1760, 0.4, 'sine', 0.1, 0.14);
  }

  function thump() {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(90, t0);
    o.frequency.exponentialRampToValueAtTime(38, t0 + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
    o.connect(g); g.connect(ctx.destination);
    o.start(t0); o.stop(t0 + 0.3);
  }

  function crash() {
    if (!ctx) return;
    const len = ctx.sampleRate * 0.7;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = ctx.createGain(); g.gain.value = 0.5;
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start();
    blip(55, 0.7, 'sawtooth', 0.25);
  }

  function fanfare() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => blip(n, 0.5, 'triangle', 0.2, i * 0.12));
  }

  return { resume, updateFlight, titlePad, ringChime, thump, crash, fanfare };
}
