// SENJA AIR — HUD: the DOM instruments. Compass strip with a scrolling
// tape, airspeed + altitude tapes, fuel / throttle / damage gauges, VSI,
// ring counter, timer, objective line, warning flashes and toasts.
// Everything here is a plain DOM update from the game state each frame.
const $ = (id) => document.getElementById(id);

export function createHUD() {
  const els = {
    compassTape: $('compassTape'), compassHdg: $('compassHdg'),
    objective: $('objective'), missionLine: $('missionLine'), warn: $('warn'),
    speedVal: $('speedVal'), speedFill: $('speedFill'), gearLine: $('gearLine'),
    altVal: $('altVal'), altFill: $('altFill'), headingLine: $('headingLine'),
    fuelVal: $('fuelVal'), fuelBar: $('fuelBar'),
    thrVal: $('thrVal'), thrBar: $('thrBar'), dmgVal: $('dmgVal'),
    vsiVal: $('vsiVal'), ringVal: $('ringVal'), scoreLine: $('scoreLine'),
    timer: $('timer'), toast: $('toast'),
    title: $('title'), endCard: $('endCard'), endTitle: $('endTitle'), endText: $('endText'),
    cockpitFrame: $('cockpitFrame'), status: $('status'),
  };
  let toastTimer = 0;

  function compassTapeText(hdg) {
    // 16-point compass, centred on the current heading.
    const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const idx = Math.round(hdg / 22.5) % 16;
    const parts = [];
    for (let k = -2; k <= 2; k++) {
      const p = points[(idx + k + 16) % 16];
      const d = Math.round(hdg / 10) * 10 + k * 20;
      parts.push(k === 0 ? `▸ ${p} ${((d % 360) + 360) % 360}° ▸` : p);
    }
    return parts.join('   ·   ');
  }

  function update(state) {
    const f = state.flight;
    const hdg = Math.round(state.headingDeg);
    els.compassTape.textContent = compassTapeText(state.headingDeg);
    els.compassHdg.textContent = String(hdg).padStart(3, '0');
    els.speedVal.textContent = String(Math.round(state.knots));
    els.speedFill.style.width = `${Math.min(100, state.knots / 120 * 100)}%`;
    els.altVal.textContent = String(Math.round(state.feet));
    els.altFill.style.width = `${Math.min(100, state.feet / 1200 * 100)}%`;
    els.headingLine.textContent = `HDG ${String(hdg).padStart(3, '0')}°`;
    els.gearLine.textContent = `${f.gear ? 'GEAR DOWN' : 'GEAR UP'} · ${f.flaps ? 'FLAPS DOWN' : 'FLAPS UP'}`;
    els.fuelVal.textContent = `${Math.round(f.fuel)}%`;
    els.fuelBar.style.width = `${f.fuel}%`;
    els.fuelBar.style.background = f.fuel < 20
      ? 'linear-gradient(90deg,#e23b2e,#ff7a5c)' : 'linear-gradient(90deg,#37d67a,#a8e063)';
    els.thrVal.textContent = `${Math.round(f.throttle * 100)}%`;
    els.thrBar.style.width = `${f.throttle * 100}%`;
    els.dmgVal.textContent = `${Math.round(f.damage)}%`;
    els.dmgVal.style.color = f.damage > 50 ? '#ff7a5c' : '#fff';
    const vsi = Math.round(f.verticalSpeed * 196.85);
    els.vsiVal.textContent = `${vsi >= 0 ? '+' : ''}${vsi}`;
    els.ringVal.textContent = `${state.ringsHit} / ${state.ringsTotal}`;
    els.scoreLine.textContent = `SCORE ${state.score}`;
    els.timer.textContent = formatTime(state.elapsed);
    els.objective.textContent = state.objective;
    els.missionLine.textContent = state.missionLine || '';

    // Warnings: stall flashes amber, low fuel red, crash overrides all.
    const warn = els.warn;
    if (state.crashed) {
      warn.style.display = 'block';
      warn.className = '';
      warn.textContent = '✕ CRASHED — PRESS R ✕';
    } else if (f.stalled) {
      warn.style.display = 'block';
      warn.className = 'stall';
      warn.textContent = '⚠ STALL — NOSE DOWN, ADD POWER ⚠';
    } else if (f.fuel <= 0) {
      warn.style.display = 'block';
      warn.className = '';
      warn.textContent = '⚠ FUEL EMPTY — GLIDING ⚠';
    } else if (f.fuel < 15) {
      warn.style.display = 'block';
      warn.className = 'stall';
      warn.textContent = '⚠ LOW FUEL ⚠';
    } else {
      warn.style.display = 'none';
    }
    if (toastTimer > 0) {
      toastTimer -= 1;
      if (toastTimer === 0) els.toast.textContent = '';
    }
  }

  function toast(text, frames = 150) {
    els.toast.textContent = text;
    toastTimer = frames;
  }

  function showTitle() {
    els.title.style.display = 'flex';
    els.endCard.style.display = 'none';
  }
  function hideTitle() { els.title.style.display = 'none'; }

  function showEnd(title, text) {
    els.endTitle.textContent = title;
    els.endText.innerHTML = text;
    els.endCard.style.display = 'flex';
  }
  function hideEnd() { els.endCard.style.display = 'none'; }

  function setCockpit(on) {
    els.cockpitFrame.style.display = on ? 'block' : 'none';
    if (on) buildCockpitFrame();
  }

  function buildCockpitFrame() {
    // Canopy frame + glareshield: thin A-pillars, a low panel with three
    // lit dials, and a slim top bow — a frame, not a wall.
    if (els.cockpitFrame.dataset.built) return;
    els.cockpitFrame.dataset.built = '1';
    els.cockpitFrame.innerHTML = `
      <svg width="100%" height="100%" viewBox="0 0 1280 720" preserveAspectRatio="none"
           style="position:absolute;inset:0">
        <path d="M0,720 L0,648 Q320,596 640,624 Q960,596 1280,648 L1280,720 Z" fill="#1c2436" opacity="0.97"/>
        <path d="M0,720 L0,682 Q320,646 640,668 Q960,646 1280,682 L1280,720 Z" fill="#2e3a55"/>
        <rect x="556" y="606" width="168" height="52" rx="10" fill="#141a2c" stroke="#ffb35c" stroke-width="2"/>
        <circle cx="596" cy="632" r="13" fill="#0a0f1e" stroke="#ffd166" stroke-width="2"/>
        <circle cx="640" cy="632" r="13" fill="#0a0f1e" stroke="#ffd166" stroke-width="2"/>
        <circle cx="684" cy="632" r="13" fill="#0a0f1e" stroke="#37d67a" stroke-width="2"/>
        <path d="M596,632 L596,622 M640,632 L648,622 M684,632 L684,620" stroke="#ffd166" stroke-width="2"/>
        <path d="M60,0 L150,640 M1220,0 L1130,640" stroke="#1c2436" stroke-width="11" opacity="0.9"/>
        <path d="M0,84 Q640,44 1280,84" stroke="#1c2436" stroke-width="10" fill="none" opacity="0.85"/>
      </svg>`;
  }

  function formatTime(s) {
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  function setStatus(text) { els.status.textContent = text; }

  return { update, toast, showTitle, hideTitle, showEnd, hideEnd, setCockpit, setStatus, formatTime, els };
}
