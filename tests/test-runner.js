/**
 * test-runner.js
 * Shared utilities imported by every scenario page.
 * Provides: battery simulator, diff renderer, copy helpers, shared styles.
 */

// ── Battery Simulator ────────────────────────────────────────────────────────
// A fake BatteryManager object that mimics the real navigator.getBattery() API.
// Scenario pages call createBatterySimulator() instead of navigator.getBattery()
// when the real API is unavailable or when override mode is active.

export function createBatterySimulator(initialLevel = 0.5, initialCharging = false) {
  let _level    = initialLevel
  let _charging = initialCharging
  const _listeners = { levelchange: [], chargingchange: [] }

  const battery = {
    get level()    { return _level },
    get charging() { return _charging },

    addEventListener(event, fn) {
      if (_listeners[event]) _listeners[event].push(fn)
    },
    removeEventListener(event, fn) {
      if (_listeners[event]) _listeners[event] = _listeners[event].filter(f => f !== fn)
    },

    // Test helpers — call these to simulate changes
    _setLevel(v) {
      _level = Math.max(0, Math.min(1, v))
      _listeners.levelchange.forEach(fn => fn({ target: battery }))
    },
    _setCharging(v) {
      _charging = v
      _listeners.chargingchange.forEach(fn => fn({ target: battery }))
    }
  }

  return battery
}

// ── Get battery (real or simulated) ─────────────────────────────────────────
// Each scenario calls this. Returns { battery, simulated: bool }

export async function getBattery(forceSimulate = false) {
  if (!forceSimulate && navigator.getBattery) {
    try {
      const b = await navigator.getBattery()
      return { battery: b, simulated: false }
    } catch (_) {}
  }
  const sim = createBatterySimulator(0.5, false)
  return { battery: sim, simulated: true }
}

// ── Diff renderer ────────────────────────────────────────────────────────────
// Renders a red/green diff block given an array of file diff specs.

export function renderDiff(container, files) {
  container.innerHTML = files.map(f => `
    <div style="border-bottom:1px solid #111">
      <div style="padding:.5rem 1rem;background:#0d0d1f;display:flex;align-items:center;justify-content:space-between">
        <span style="font-family:monospace;font-size:11px;color:#555">${f.path}</span>
        <button onclick="copyText(this, \`${escapeForAttr(buildFileText(f))}\`)"
          style="font-size:10px;padding:2px 8px;border:1px solid #222;background:transparent;color:#555;cursor:pointer;font-family:monospace">
          Copy
        </button>
      </div>
      ${f.note ? `<p style="font-size:11px;color:#555;padding:.5rem 1rem .25rem;line-height:1.6">${f.note}</p>` : ''}
      <div style="padding:.75rem 1rem;font-family:monospace;font-size:12px;line-height:1.9;overflow-x:auto">
        ${f.lines.map(l => `<span style="display:block;padding:0 6px;border-radius:3px;margin:1px 0;${lineStyle(l.type)}">${l.type === 'remove' ? '− ' : l.type === 'add' ? '+ ' : '  '}${escapeHtml(l.text)}</span>`).join('')}
      </div>
    </div>
  `).join('')
}

function lineStyle(type) {
  if (type === 'remove') return 'color:#E24B4A;background:#1a0505'
  if (type === 'add')    return 'color:#1D9E75;background:#041a0f'
  if (type === 'comment')return 'color:#444;font-style:italic'
  return 'color:#666'
}

function buildFileText(f) {
  return f.lines.filter(l => l.type !== 'remove').map(l => l.text).join('\n')
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

function escapeForAttr(s) {
  return s.replace(/\\/g,'\\\\').replace(/`/g,'\\`').replace(/\$/g,'\\$')
}

// Exposed globally for inline onclick handlers inside renderDiff
window.copyText = function(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'Copied ✓'
    setTimeout(() => btn.textContent = 'Copy', 1500)
  })
}

// ── Shared page shell ────────────────────────────────────────────────────────
// Call this to inject the common header + shared CSS into a scenario page

export function injectShell(title, fileLabel) {
  document.head.insertAdjacentHTML('beforeend', `
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{background:#07070f;font-family:'Courier New',monospace;color:#ccc;padding:1.5rem;min-height:100vh}
      .page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem}
      .page-title{font-size:1rem;color:#f0c040;letter-spacing:.06em}
      .page-file{font-size:.7rem;color:#444;margin-top:.2rem}
      .back{font-size:.75rem;color:#333;text-decoration:none;padding:.3rem .75rem;border:1px solid #1a1a2e;border-radius:4px}
      .back:hover{color:#f0c040;border-color:#f0c040}
      .layout{display:grid;grid-template-columns:1fr 320px;gap:12px}
      @media(max-width:900px){.layout{grid-template-columns:1fr}}
      .panel{background:#0d0d1f;border:1px solid #1a1a2e;border-radius:6px;overflow:hidden}
      .panel-head{padding:.6rem 1rem;border-bottom:1px solid #111;font-size:.7rem;color:#444;letter-spacing:.08em;text-transform:uppercase;display:flex;align-items:center;justify-content:space-between}
      .panel-body{padding:1rem}
      label{font-size:.75rem;color:#666;display:block;margin-bottom:.25rem}
      .ctrl{margin-bottom:.85rem}
      input[type=range]{width:100%;accent-color:#f0c040;height:4px;margin-top:.25rem}
      .val-display{font-size:.8rem;color:#f0c040;font-weight:bold;float:right;margin-top:-.25rem}
      .stat-box{background:#07070f;border:1px solid #111;border-radius:4px;padding:.6rem .75rem;margin-bottom:.5rem}
      .stat-label{font-size:.65rem;color:#444;text-transform:uppercase;letter-spacing:.06em}
      .stat-value{font-size:1.1rem;color:#f0c040;font-weight:bold;margin-top:.1rem;font-family:monospace}
      .stat-sub{font-size:.65rem;color:#555;margin-top:.1rem}
      .show-code-btn{width:100%;padding:.6rem;font-size:.8rem;font-weight:bold;letter-spacing:.05em;border:1px solid #EF9F27;background:transparent;color:#EF9F27;cursor:pointer;border-radius:4px;margin-top:.75rem;transition:background .15s}
      .show-code-btn:hover{background:#1a1000}
      .show-code-btn.open{background:#1a1000}
      .code-panel{display:none;background:#0d0d1f;border:1px solid #1a1a2e;border-radius:6px;overflow:hidden;margin-top:12px}
      .code-panel.open{display:block}
      .code-panel-head{padding:.6rem 1rem;border-bottom:1px solid #111;display:flex;align-items:center;justify-content:space-between;font-size:.7rem;color:#444;text-transform:uppercase;letter-spacing:.08em}
      .sim-badge{display:inline-flex;align-items:center;gap:.3rem;font-size:.65rem;padding:2px 8px;border-radius:99px;border:1px solid #EF9F27;color:#EF9F27;background:#0d0800;margin-left:.5rem}
      .real-badge{display:inline-flex;align-items:center;gap:.3rem;font-size:.65rem;padding:2px 8px;border-radius:99px;border:1px solid #1D9E75;color:#1D9E75;background:#00100a;margin-left:.5rem}
      .toggle-row{display:flex;align-items:center;gap:.5rem;font-size:.75rem;color:#555;margin-bottom:.75rem}
      input[type=checkbox]{accent-color:#EF9F27}
    </style>
  `)
  document.body.insertAdjacentHTML('afterbegin', `
    <div class="page-header">
      <div>
        <div class="page-title">⚡ ${title}</div>
        <div class="page-file">${fileLabel}</div>
      </div>
      <a class="back" href="/tests/">← harness</a>
    </div>
  `)
}