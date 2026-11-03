const VERSION = "1.0.0";

class KMClimateCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._timer = null;
    this._lastSignature = "";
  }

  setConfig(config) {
    if (!config || !config.entity) throw new Error("KM Climate Card: 'entity' fehlt.");
    this._config = {
      sensors: {},
      controls: { boost: { enabled: true, duration: 5 }, temperature: { enabled: true }, presets: [] },
      graph: { enabled: true, hours: 24 },
      appearance: { theme: "glass", accent_color: "#E0386A", radius: 24 },
      ...config,
      sensors: { ...(config.sensors || {}) },
      controls: {
        boost: { enabled: true, duration: 5, ...(config.controls?.boost || {}) },
        temperature: { enabled: true, step: 0.5, ...(config.controls?.temperature || {}) },
        presets: config.controls?.presets || []
      },
      graph: { enabled: true, hours: 24, ...(config.graph || {}) },
      appearance: { theme: "glass", accent_color: "#E0386A", radius: 24, ...(config.appearance || {}) }
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  connectedCallback() {
    this._timer = window.setInterval(() => {
      if (this._hass && this._config) this._render();
    }, 1000);
  }

  disconnectedCallback() {
    if (this._timer) window.clearInterval(this._timer);
  }

  getCardSize() { return this._config.graph?.enabled ? 8 : 6; }

  _state(id) { return id && this._hass?.states?.[id] ? this._hass.states[id] : null; }
  _num(id, fallback = null) {
    const v = Number.parseFloat(this._state(id)?.state);
    return Number.isFinite(v) ? v : fallback;
  }
  _fmt(v, digits = 0) {
    return v === null || v === undefined || !Number.isFinite(Number(v))
      ? "–" : Number(v).toFixed(digits).replace(".", ",");
  }
  _esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  }
  _call(domain, service, data) {
    if (!this._hass) return;
    this._hass.callService(domain, service, data);
  }
  _climate() { return this._state(this._config.entity); }
  _preset() { return this._climate()?.attributes?.preset_mode; }
  _hvac() { return this._climate()?.state; }
  _valves() {
    const raw = this._config.valves || [
      this._config.sensors.heating_left,
      this._config.sensors.heating_right
    ].filter(Boolean);
    return raw.map(v => typeof v === "string" ? v : v?.entity).filter(Boolean)
      .map(entity => ({ entity, value: this._num(entity, null) }))
      .filter(v => v.value !== null);
  }
  _heating() { return this._valves().some(v => v.value > 0); }

  _temperatureStatus(t) {
    if (t < 17) return ["Zu kalt", "mdi:thermometer-low", "rgba(111,123,134,.30)", "#c5ced6"];
    if (t < 20) return ["Kühl", "mdi:thermometer-low", "rgba(160,160,165,.24)", "#e0e0e3"];
    if (t <= 22.5) return ["Ideal", "mdi:check-circle", "rgba(232,232,234,.22)", "#fff"];
    if (t <= 24.9) return ["Warm", "mdi:thermometer-high", "rgba(236,106,147,.28)", "#f8bbd0"];
    return ["Zu warm", "mdi:thermometer-alert", "rgba(224,56,106,.32)", "#f8bbd0"];
  }

  _modeStatus() {
    const state = this._hvac(), preset = this._preset();
    const winter = this._state(this._config.winter_mode)?.state === "on";
    if (state === "auto") {
      const names = { Default:"Standard", "Alternative 1":"Alternative", "Morgens / Abends":"Morgens / Abends", Abends:"Abendmodus" };
      return ["Auto · " + (names[preset] || preset || "Profil"), "mdi:calendar-clock", "rgba(224,56,106,.30)", "#f8bbd0"];
    }
    if (state === "heat") return [winter ? "Wintermodus" : "Manuell", winter ? "mdi:snowflake" : "mdi:hand-back-right", "rgba(160,160,165,.24)", "#e0e0e3"];
    return ["Aus", "mdi:power", "rgba(255,255,255,.10)", "rgba(255,255,255,.75)"];
  }

  _chip(icon, label, bg, color) {
    return `<div class="chip" style="background:${bg};color:${color}">
      <ha-icon icon="${this._esc(icon)}"></ha-icon><span>${this._esc(label)}</span>
    </div>`;
  }

  _heaterSvg() {
    const heating = this._heating();
    const valves = this._valves();
    const slot = heating ? "#e0386a" : "#a0a0a5";
    const waves = heating ? `
      <path d="M30 44 q-6 -8 0 -16 t0 -16" fill="none" stroke="#e0386a" stroke-width="3" stroke-linecap="round" opacity=".95"/>
      <path d="M60 44 q-6 -8 0 -16 t0 -16" fill="none" stroke="#f48fb1" stroke-width="3" stroke-linecap="round" opacity=".7"/>
      <path d="M90 44 q-6 -8 0 -16 t0 -16" fill="none" stroke="#f48fb1" stroke-width="3" stroke-linecap="round" opacity=".4"/>` : "";
    const flame = heating ? `
      <path d="M122 8 C126 20 136 24 134 38 C132 48 112 48 110 36 C109 28 116 24 118 16 C119 12 120 10 122 8 Z" fill="#e0386a"/>
      <path d="M122 28 C125 34 129 36 128 41 C127 46 117 46 116 40 C116 36 120 34 122 28 Z" fill="#f48fb1"/>` : "";
    const slots = [19,37,55,73,91].map(x => `<rect x="${x}" y="62" width="10" height="32" rx="5" fill="${slot}"/>`).join("");
    const vent = valves.length === 1
      ? `<text x="66" y="116" text-anchor="middle" font-size="8" fill="rgba(255,255,255,.7)">1 Ventil</text>`
      : valves.length >= 2 ? `<text x="66" y="116" text-anchor="middle" font-size="8" fill="rgba(255,255,255,.7)">2 Ventile</text>` : "";
    return `<svg viewBox="0 0 140 122" width="118" height="103" aria-label="Heizkörper">
      <circle cx="66" cy="70" r="52" fill="rgba(160,160,165,.10)"/>
      ${waves}<rect x="8" y="52" width="112" height="52" rx="12" fill="#f3f6f8"/>
      ${slots}${flame}${vent}</svg>`;
  }

  _boostLabel() {
    const timer = this._state(this._config.controls.boost.timer);
    const active = this._preset() === "boost";
    if (active && timer?.state === "active" && timer.attributes.finishes_at) {
      const seconds = Math.max(0, Math.ceil((new Date(timer.attributes.finishes_at).getTime() - Date.now()) / 1000));
      return `BOOST · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} Min.`;
    }
    return active ? "BOOST · aktiv" : `BOOST · ${this._config.controls.boost.duration || 5} Min. · 30 °C`;
  }

  _presetButton(preset, label) {
    const active = this._preset() === preset;
    return `<button class="preset ${active ? "active" : ""}" data-action="preset" data-value="${this._esc(preset)}">${this._esc(label)}</button>`;
  }

  _graphSvg() {
    const cfg = this._config.graph || {};
    const ids = [this._config.sensors.temperature, this._config.sensors.humidity].filter(Boolean);
    if (!cfg.enabled || !ids.length) return "";
    const hist = this._hass?.history;
    // History is not exposed consistently in Lovelace; render a clean, live placeholder
    // rather than fabricating historical samples. The card can use HA statistics when configured later.
    const t = this._num(this._config.sensors.temperature, 0);
    const h = this._num(this._config.sensors.humidity, 0);
    const tLabel = this._config.graph.temperature_name || "Temperatur";
    const hLabel = this._config.graph.humidity_name || "Luftfeuchtigkeit";
    return `<div class="legend">
      <span><i class="pink"></i>${this._esc(tLabel)}</span>
      ${this._config.sensors.humidity ? `<span><i class="grey"></i>${this._esc(hLabel)}</span>` : ""}
    </div>
    <div class="graph-note">Live: ${this._fmt(t,1)} °C${this._config.sensors.humidity ? ` · ${this._fmt(h,0)} %` : ""} <span>· Verlauf: ${cfg.hours || 24} Std.</span></div>`;
  }

  _render() {
    if (!this.shadowRoot || !this._config || !this._hass) return;
    const c = this._climate();
    if (!c) {
      this.shadowRoot.innerHTML = `<ha-card><div class="error">Entität nicht gefunden: ${this._esc(this._config.entity)}</div></ha-card>`;
      return;
    }
    const cfg = this._config, s = cfg.sensors || {}, a = c.attributes || {};
    const temp = this._num(s.temperature, 0), hum = this._num(s.humidity, null);
    const setpoint = a.temperature;
    const valves = this._valves();
    const valveLabel = valves.length === 0 ? "" : valves.length === 1
      ? `${Math.round(valves[0].value)} %`
      : `${Math.round(valves[0].value)} % · ${Math.round(valves[1].value)} %`;
    const mode = this._modeStatus(), quality = this._temperatureStatus(temp);
    const accent = cfg.appearance.accent_color || "#E0386A";
    const heating = this._heating();
    const pink = heating ? "rgba(224,56,106,.34)" : "rgba(224,56,106,.12)";
    const grey = heating ? "rgba(160,160,165,.20)" : "rgba(160,160,165,.14)";
    const boostEnabled = cfg.controls.boost.enabled;
    const presets = (cfg.controls.presets || []).map(p => {
      const item = typeof p === "string" ? { value:p, label:({Default:"Std", eco:"Eco", Abends:"Abends", "Morgens / Abends":"Morgens"}[p] || p) } : p;
      return this._presetButton(item.value, item.label || item.value);
    }).join("");
    const showTempControls = cfg.controls.temperature.enabled;
    const graph = this._graphSvg();
    const hidden = cfg.visibility_entity && this._state(cfg.visibility_entity)?.state !== (cfg.visibility_state || "on");
    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block;color:#fff}
        *{box-sizing:border-box}
        ha-card{border-radius:${Number(cfg.appearance.radius)||24}px;overflow:hidden;box-shadow:none;border:0;padding:18px 16px 16px;background:
          radial-gradient(circle at 92% 8%,${pink} 0%,rgba(0,0,0,0) 55%),
          radial-gradient(circle at 6% 100%,${grey} 0%,rgba(0,0,0,0) 50%),rgba(31,44,52,.50)}
        .grid{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));column-gap:8px;row-gap:14px;align-items:center}
        .kopf{grid-column:1/span 5;grid-row:1;margin-top:2px;line-height:1}
        .bigtemp{font-size:54px;font-weight:500;color:#fff}
        .unit{font-size:20px;color:rgba(255,255,255,.8)}
        .humidity{font-size:13px;margin-top:8px;color:rgba(255,255,255,.62)}
        .bild{grid-column:6/span 3;grid-row:1;justify-self:end;align-self:start}
        .chips{grid-column:1/span 8;display:flex;gap:6px;flex-wrap:wrap;min-width:0}
        .chip{display:flex;align-items:center;gap:5px;padding:8px 10px;border-radius:18px;font-size:12px;white-space:nowrap;max-width:100%}
        .chip ha-icon{--mdc-icon-size:15px}
        .scale{grid-column:1/span 8}
        .bar{display:flex;gap:3px;position:relative}
        .seg{height:6px;border-radius:3px}
        .marker{position:absolute;top:-3px;width:3px;height:12px;border-radius:2px;background:#fff;transform:translateX(-50%)}
        .hint{font-size:12px;margin-top:8px;color:rgba(255,255,255,.62)}
        .minus{grid-column:1/span 2;justify-self:start}
        .target{grid-column:3/span 4;text-align:center}
        .plus{grid-column:7/span 2;justify-self:end}
        .target-value{font-size:34px;font-weight:500;line-height:1;color:#fff}
        .target-unit{font-size:16px;color:rgba(255,255,255,.65)}
        .target-label{font-size:11px;margin-top:4px;color:rgba(255,255,255,.62)}
        button{font:inherit;color:inherit;border:0;cursor:pointer}
        .round{width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.10);display:grid;place-items:center}
        .round ha-icon{--mdc-icon-size:22px}
        .actions{grid-column:1/span 8;display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:8px}
        .action{height:38px;border-radius:14px;background:rgba(255,255,255,.10);display:flex;align-items:center;justify-content:center;gap:6px;font-size:12px;color:rgba(255,255,255,.88);min-width:0}
        .action ha-icon{--mdc-icon-size:18px;flex:none}
        .boost{grid-column:span 4;background:rgba(224,56,106,.20);color:#f8bbd0;height:38px;font-size:13px;font-weight:500}
        .boost ha-icon{color:#e0386a}
        .boost.active{background:rgba(224,56,106,.40)}
        .mode{grid-column:span 4}
        .presets{grid-column:1/span 8;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
        .preset{height:30px;border-radius:7px;padding:4px 2px;background:rgba(255,255,255,.07);font-size:13px;color:rgba(255,255,255,.82);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .preset.active{background:rgba(224,56,106,.30);color:#f48fb1}
        .graph{grid-column:1/span 8;margin:0 -16px -16px;padding:0 16px 16px;min-width:0}
        .legend{display:flex;gap:14px;align-items:center;font-size:12px;color:rgba(255,255,255,.62);margin-bottom:8px}
        .legend span{display:flex;align-items:center;gap:6px}
        .legend i{width:14px;height:3px;border-radius:2px;display:inline-block}
        .legend .pink{background:${accent}} .legend .grey{background:#a0a0a5}
        .graph-note{font-size:12px;color:rgba(255,255,255,.72);padding:12px 0 0;border-top:1px solid rgba(255,255,255,.08)}
        .graph-note span{color:rgba(255,255,255,.45)}
        .error{padding:16px;color:var(--error-color)}
        @media(max-width:380px){.bigtemp{font-size:48px}.chip{font-size:11px;padding:7px 8px}.actions{gap:6px}}
      </style>
      ${hidden ? "" : `<div class="grid">
        <div class="kopf"><div><span class="bigtemp">${this._fmt(temp,1)}</span><span class="unit"> °C</span></div>
          <div class="humidity">Luftfeuchtigkeit ${this._fmt(hum,0)} %</div></div>
        <div class="bild">${this._heaterSvg()}</div>
        <div class="chips">
          ${this._chip(mode[1],mode[0],mode[2],mode[3])}
          ${valves.length ? this._chip("mdi:gauge",valveLabel,"rgba(255,255,255,.12)","#fff") : ""}
          ${this._chip(quality[1],quality[0],quality[2],quality[3])}
        </div>
        <div class="scale">
          <div class="bar">
            <div class="seg" style="flex:3;background:#6f7b86;opacity:${temp<17?1:.3}"></div>
            <div class="seg" style="flex:3;background:#a0a0a5;opacity:${temp>=17&&temp<20?1:.3}"></div>
            <div class="seg" style="flex:2.5;background:#e8e8ea;opacity:${temp>=20&&temp<=22.5?1:.3}"></div>
            <div class="seg" style="flex:2.5;background:#ec6a93;opacity:${temp>22.5&&temp<=24.9?1:.3}"></div>
            <div class="seg" style="flex:3;background:#e0386a;opacity:${temp>24.9?1:.3}"></div>
            <div class="marker" style="left:${Math.max(0,Math.min(100,(temp-14)/14*100))}%"></div>
          </div>
          <div class="hint">${temp<17?"Deutlich zu kalt – evtl. Heizung prüfen.":temp<20?"Etwas kühl – gut zum Schlafen, nicht zum Sitzen.":temp<=22.5?"Ideale Raumtemperatur für Komfort und Gesundheit.":temp<=24.9?"Leicht erhöht – Lüften empfehlenswert.":"Unangenehm warm – Raum ggf. überhitzt."}</div>
        </div>
        ${showTempControls ? `<button class="round minus" data-action="temperature" data-delta="-1"><ha-icon icon="mdi:minus"></ha-icon></button>
          <div class="target"><div class="target-value">${this._fmt(setpoint,1)}<span class="target-unit"> °C</span></div><div class="target-label">Soll</div></div>
          <button class="round plus" data-action="temperature" data-delta="1"><ha-icon icon="mdi:plus"></ha-icon></button>` : `<div class="target" style="grid-column:1/span 8"><div class="target-value">${this._fmt(setpoint,1)}<span class="target-unit"> °C</span></div><div class="target-label">Soll</div></div>`}
        <div class="actions">
          ${boostEnabled ? `<button class="action boost ${this._preset()==="boost"?"active":""}" data-action="boost"><ha-icon icon="mdi:fire"></ha-icon>${this._esc(this._boostLabel())}</button>` : ""}
          <button class="action mode" data-action="mode"><ha-icon icon="${this._hvac()==="auto"?"mdi:hand-back-right":"mdi:calendar-clock"}"></ha-icon>${this._hvac()==="auto"?"Manuell aktivieren":"Automatik aktivieren"}</button>
        </div>
        ${presets ? `<div class="presets">${presets}</div>` : ""}
        ${graph ? `<div class="graph">${graph}</div>` : ""}
      </div>`}`;
    this.shadowRoot.querySelectorAll("[data-action]").forEach(el => el.addEventListener("click", ev => this._handleAction(ev.currentTarget)));
  }

  _handleAction(el) {
    const action = el.dataset.action, c = this._climate(), a = c?.attributes || {};
    if (action === "mode") {
      this._call("climate","set_hvac_mode",{ entity_id:this._config.entity, hvac_mode:this._hvac()==="auto"?"heat":"auto" });
    } else if (action === "boost") {
      this._call("climate","set_preset_mode",{ entity_id:this._config.entity, preset_mode:"boost" });
    } else if (action === "preset") {
      this._call("climate","set_preset_mode",{ entity_id:this._config.entity, preset_mode:el.dataset.value });
    } else if (action === "temperature") {
      const step = Number(this._config.controls.temperature.step || a.target_temp_step || 0.5);
      const next = Math.round(((Number(a.temperature ?? 20) + Number(el.dataset.delta) * step) * 10)) / 10;
      const bounded = Math.max(Number(a.min_temp ?? 5),Math.min(Number(a.max_temp ?? 30),next));
      this._call("climate","set_temperature",{ entity_id:this._config.entity, temperature:bounded });
    }
  }

  static getConfigElement() { return document.createElement("km-climate-card-editor"); }
  static getStubConfig() {
    return { entity:"climate.wohnzimmer", sensors:{temperature:"sensor.wandthermostat_temperature_2",humidity:"sensor.wandthermostat_humidity_2"}, graph:{enabled:true,hours:24} };
  }
}

class KMClimateCardEditor extends HTMLElement {
  setConfig(config) { this._config = structuredClone(config); this._render(); }
  set hass(hass) { this._hass = hass; }
  _render() {
    if (!this._config) return;
    this.innerHTML = `<div class="editor">
      <style>.editor{display:grid;gap:12px;padding:8px 0}.editor label{display:grid;gap:4px;font-size:13px}.editor input,.editor select{width:100%;padding:9px;border:1px solid var(--divider-color);border-radius:8px;background:var(--card-background-color);color:var(--primary-text-color)}.editor h3{margin:8px 0 0;font-size:14px}</style>
      <label>Climate-Entität<input data-path="entity" value="${this._esc(this._config.entity||"")}"></label>
      <h3>Sensoren</h3>
      <label>Temperatur<input data-path="sensors.temperature" value="${this._esc(this._config.sensors?.temperature||"")}"></label>
      <label>Luftfeuchtigkeit<input data-path="sensors.humidity" value="${this._esc(this._config.sensors?.humidity||"")}"></label>
      <label>Ventil 1<input data-path="valves.0" value="${this._esc(this._config.valves?.[0]||this._config.sensors?.heating_left||"")}"></label>
      <label>Ventil 2 (optional)<input data-path="valves.1" value="${this._esc(this._config.valves?.[1]||this._config.sensors?.heating_right||"")}"></label>
      <label>Wintermodus-Boolean<input data-path="winter_mode" value="${this._esc(this._config.winter_mode||"")}"></label>
      <h3>Darstellung</h3>
      <label>Akzentfarbe<input data-path="appearance.accent_color" value="${this._esc(this._config.appearance?.accent_color||"#E0386A")}"></label>
      <label>Eckenradius<input type="number" data-path="appearance.radius" value="${Number(this._config.appearance?.radius??24)}"></label>
      <h3>Boost & Verlauf</h3>
      <label>Boost-Timer<input data-path="controls.boost.timer" value="${this._esc(this._config.controls?.boost?.timer||"")}"></label>
      <label>Verlauf (Stunden)<input type="number" data-path="graph.hours" value="${Number(this._config.graph?.hours??24)}"></label>
      <label>Sichtbarkeit – Boolean (optional)<input data-path="visibility_entity" value="${this._esc(this._config.visibility_entity||"")}"></label>
    </div>`;
    this.querySelectorAll("input").forEach(input => input.addEventListener("change", () => {
      const path = input.dataset.path.split(".");
      let target = this._config;
      for (let i=0;i<path.length-1;i++) {
        const key = path[i];
        if (Array.isArray(target)) target = target[Number(key)];
        else target = target[key] ??= (path[i+1] && /^\d+$/.test(path[i+1]) ? [] : {});
      }
      const key = path[path.length-1];
      if (Array.isArray(target)) target[Number(key)] = input.value || undefined;
      else if (input.type === "number") target[key] = Number(input.value);
      else target[key] = input.value || undefined;
      this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:this._config},bubbles:true,composed:true}));
    }));
  }
  _esc(v) { return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
}

customElements.define("km-climate-card", KMClimateCard);
customElements.define("km-climate-card-editor", KMClimateCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "km-climate-card",
  name: "KM Climate Card",
  description: "Glasoptik-Klimakarte mit Ventilsteuerung, Boost, Profilen und Temperaturanzeige.",
  preview: true,
  documentationURL: "https://github.com/"
});

console.info(`%c KM CLIMATE CARD %c ${VERSION} `,"background:#e0386a;color:white;font-weight:bold;","background:#333;color:#fff");
