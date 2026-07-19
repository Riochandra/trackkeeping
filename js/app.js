import { db, COLLECTION, NOTES_COLLECTION } from "./firebase-config.js";
import {
  collection, doc, setDoc, deleteDoc, onSnapshot,
  query, orderBy, documentId, where
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

/* ============================================================
   CONSTANTS
   ============================================================ */
const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
const DAYS_FULL = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
const SESI_COUNT = 9;

// Palette for optional per-session color labels ("aktivitas unik").
const SESI_COLORS = [
  "#3FA34D", // green
  "#4C8FC9", // blue
  "#7C5CFC", // purple
  "#D9679E", // pink
  "#E8A672", // orange
  "#D9534F", // red
  "#E8C547", // yellow
  "#6B7178", // gray
];

/* ============================================================
   STATE
   ============================================================ */
const state = {
  year: new Date().getFullYear(),
  month: new Date().getMonth(), // 0-indexed
  data: new Map(),              // dateStr -> record
  selectedDate: null,           // dateStr currently open in drawer
  unsub: null,
  notes: new Map(),             // noteId -> {date, text, createdAt}
  notesMinRows: 5,
};

const todayStr = fmtDate(new Date());

/* ============================================================
   UTIL
   ============================================================ */
function pad2(n) { return String(n).padStart(2, "0"); }
function fmtDate(d) { return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
function dateStrFor(year, month, day) { return `${year}-${pad2(month+1)}-${pad2(day)}`; }
function sumArr(arr) {
  if (!arr || !Array.isArray(arr)) return 0;
  return arr.reduce((a, b) => a + (Number(b) || 0), 0);
}
function sumSesi(rec) { return sumArr(rec?.sesi); }
function sumBrainrot(rec) { return sumArr(rec?.brainrot); }
function fmtHours(n) { return (Math.round(n * 100) / 100).toFixed(2); }

/* ---- AC log: 12-hour start/finish -> duration in hours ---- */
function timeToMinutes(hour12, minute, period) {
  let h = Number(hour12) % 12;
  if (period === "PM") h += 12;
  return h * 60 + Number(minute);
}
function acDurationHours(start, finish) {
  const startMin = timeToMinutes(start.h, start.m, start.p);
  const finishMin = timeToMinutes(finish.h, finish.m, finish.p);
  let diff = finishMin - startMin;
  if (diff < 0) diff += 24 * 60; // crosses midnight
  return diff / 60;
}

function showToast(msg, isError = false) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.style.color = isError ? "var(--c-red)" : "var(--text)";
  t.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.add("hidden"), 2200);
}

/* ============================================================
   FIRESTORE — subscribe to current month
   ============================================================ */
function subscribeMonth() {
  if (state.unsub) state.unsub();
  state.data.clear();
  setLoading(true);

  const y = state.year, m = state.month;
  const startId = dateStrFor(y, m, 1);
  const endId = dateStrFor(y, m, daysInMonth(y, m));

  const q = query(
    collection(db, COLLECTION),
    where(documentId(), ">=", startId),
    where(documentId(), "<=", endId),
    orderBy(documentId())
  );

  state.unsub = onSnapshot(q, (snap) => {
    state.data.clear();
    snap.forEach(d => state.data.set(d.id, d.data()));
    setLoading(false);
    renderGrid();
  }, (err) => {
    console.error(err);
    setLoading(false);
    showToast("Gagal memuat data — cek koneksi/config Firebase", true);
  });
}

function setLoading(on) {
  document.getElementById("loadingBar").classList.toggle("hidden", !on);
}

/* ============================================================
   RENDER — header / nav
   ============================================================ */
function renderHeader() {
  document.getElementById("monthText").textContent = MONTHS[state.month];
  document.getElementById("yearText").textContent = state.year;
}

/* ============================================================
   RENDER — grid (table + mobile cards) + ticker
   ============================================================ */
function renderGrid() {
  const body = document.getElementById("gridBody");
  const cardList = document.getElementById("cardList");
  const empty = document.getElementById("emptyState");
  body.innerHTML = "";
  cardList.innerHTML = "";

  const total = daysInMonth(state.year, state.month);
  let anyData = false;

  // ticker accumulators
  let sumTotal = 0, ifSuccess = 0, ifTracked = 0, insomniaCount = 0,
      noJogCount = 0, triYes = 0, triTracked = 0, acSum = 0;

  const frag = document.createDocumentFragment();
  const cardFrag = document.createDocumentFragment();

  for (let day = 1; day <= total; day++) {
    const dstr = dateStrFor(state.year, state.month, day);
    const rec = state.data.get(dstr);
    if (rec) anyData = true;

    const dayTotal = sumSesi(rec);
    sumTotal += dayTotal;

    if (rec?.intermittentFasting) {
      ifTracked++;
      if (rec.intermittentFasting.success) ifSuccess++;
    }
    if (rec?.insomnia && rec.insomnia.normal === false) insomniaCount++;
    if (rec?.jogging && rec.jogging.active === false) noJogCount++;
    if (rec?.trisandhya === true || rec?.trisandhya === false) {
      triTracked++;
      if (rec.trisandhya === true) triYes++;
    }
    if (rec?.acLog && !rec.acLog.unknown && rec.acLog.value) acSum += Number(rec.acLog.value) || 0;

    frag.appendChild(buildRow(dstr, day, rec, dayTotal));
    cardFrag.appendChild(buildCard(dstr, day, rec, dayTotal));
  }

  body.appendChild(frag);
  cardList.appendChild(cardFrag);
  empty.classList.toggle("hidden", anyData);

  document.getElementById("tkTotal").textContent = `${fmtHours(sumTotal)}j`;
  document.getElementById("tkIF").textContent = `${ifSuccess}/${ifTracked}`;
  document.getElementById("tkInsomnia").textContent = insomniaCount;
  document.getElementById("tkNoJog").textContent = noJogCount;
  document.getElementById("tkTri").textContent = `${triYes}/${triTracked}`;
  document.getElementById("tkAC").textContent = `${fmtHours(acSum)}j`;
}

function tagFor(kind, rec) {
  // returns {html, empty}
  if (kind === "brainrot") {
    const sum = sumBrainrot(rec);
    return sum > 0
      ? `<span class="mono">${fmtHours(sum)}</span>`
      : `<span class="cell-empty">–</span>`;
  }
  if (kind === "if") {
    const f = rec?.intermittentFasting;
    if (!f) return `<span class="cell-empty">–</span>`;
    if (f.success) return `<span class="cell-tag tag-purple">Berhasil${f.note ? " · " + esc(f.note) : ""}</span>`;
    return `<span class="cell-tag">${esc(f.note) || "Gagal"}</span>`;
  }
  if (kind === "insomnia") {
    const f = rec?.insomnia;
    if (!f) return `<span class="cell-empty">–</span>`;
    if (f.normal) return `<span class="cell-tag tag-green">Normal</span>`;
    return `<span class="cell-tag tag-orange">${esc(f.note) || "Insomnia"}</span>`;
  }
  if (kind === "jog") {
    const f = rec?.jogging;
    if (!f) return `<span class="cell-empty">–</span>`;
    if (f.active) return `<span class="cell-tag tag-green">Jogging</span>`;
    return `<span class="cell-tag tag-gray">${esc(f.note) || "Tidak"}</span>`;
  }
  if (kind === "tri") {
    if (rec?.trisandhya === true) return `<span class="dot dot-green"></span>`;
    if (rec?.trisandhya === false) return `<span class="dot dot-red"></span>`;
    return `<span class="cell-empty">–</span>`;
  }
  if (kind === "ac") {
    const f = rec?.acLog;
    if (!f) return `<span class="cell-empty">–</span>`;
    if (f.unknown) return `<span class="cell-tag tag-yellow">?</span>`;
    return `<span class="mono">${f.value ?? "–"}</span>`;
  }
}

function esc(s) {
  if (s === undefined || s === null) return "";
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function buildRow(dstr, day, rec, dayTotal) {
  const tr = document.createElement("tr");
  tr.dataset.date = dstr;
  if (dstr === todayStr) tr.classList.add("is-today");

  const sesiCells = Array.from({length: SESI_COUNT}, (_, i) => {
    const v = rec?.sesi?.[i];
    const color = rec?.sesiColors?.[i];
    const style = color ? ` style="box-shadow: inset 0 -3px 0 ${color};"` : "";
    return `<td${style}>${(v !== undefined && v !== null && v !== "") ? v : '<span class="cell-empty">–</span>'}</td>`;
  }).join("");

  tr.innerHTML = `
    <td class="col-tgl sticky-col">${day}</td>
    <td class="col-total sticky-col2">${dayTotal > 0 ? fmtHours(dayTotal) : '<span class="cell-empty">–</span>'}</td>
    ${sesiCells}
    <td class="col-wide">${tagFor("brainrot", rec)}</td>
    <td class="col-wide">${tagFor("if", rec)}</td>
    <td class="col-wide">${tagFor("insomnia", rec)}</td>
    <td class="col-wide">${tagFor("jog", rec)}</td>
    <td class="col-narrow">${tagFor("tri", rec)}</td>
    <td class="col-narrow">${tagFor("ac", rec)}</td>
  `;
  tr.addEventListener("click", () => openDrawer(dstr));
  return tr;
}

function buildCard(dstr, day, rec, dayTotal) {
  const div = document.createElement("div");
  div.className = "day-card" + (dstr === todayStr ? " is-today" : "");
  div.dataset.date = dstr;
  const dow = DAYS_FULL[new Date(state.year, state.month, day).getDay()];

  div.innerHTML = `
    <div class="day-card-head">
      <span class="day-card-date">${day} ${MONTHS_SHORT[state.month]} · ${dow}</span>
      <span class="day-card-total">${dayTotal > 0 ? fmtHours(dayTotal) + "j" : "–"}</span>
    </div>
    <div class="day-card-tags">
      ${sumBrainrot(rec) > 0 ? `<span class="cell-tag">BR ${fmtHours(sumBrainrot(rec))}</span>` : ""}
      ${tagIfExists("if", rec)}
      ${tagIfExists("insomnia", rec)}
      ${tagIfExists("jog", rec)}
      ${rec?.trisandhya === true ? `<span class="cell-tag tag-green">Trisandhya</span>` : ""}
      ${rec?.trisandhya === false ? `<span class="cell-tag tag-red">No Trisandhya</span>` : ""}
      ${rec?.acLog ? (rec.acLog.unknown ? `<span class="cell-tag tag-yellow">AC ?</span>` : `<span class="cell-tag">AC ${esc(rec.acLog.value)}</span>`) : ""}
    </div>
  `;
  div.addEventListener("click", () => openDrawer(dstr));
  return div;
}

function tagIfExists(kind, rec) {
  const html = tagFor(kind, rec);
  return html.includes("cell-empty") ? "" : html;
}

/* ============================================================
   NAVIGATION
   ============================================================ */
function changeMonth(delta) {
  let m = state.month + delta;
  let y = state.year;
  if (m < 0) { m = 11; y--; }
  if (m > 11) { m = 0; y++; }
  state.month = m;
  state.year = y;
  renderHeader();
  subscribeMonth();
}

function goToday() {
  const now = new Date();
  state.year = now.getFullYear();
  state.month = now.getMonth();
  renderHeader();
  subscribeMonth();
}

document.getElementById("prevMonth").addEventListener("click", () => changeMonth(-1));
document.getElementById("nextMonth").addEventListener("click", () => changeMonth(1));
document.getElementById("todayBtn").addEventListener("click", goToday);

/* ---- month/year picker popover ---- */
const popover = document.getElementById("pickerPopover");
const monthLabelBtn = document.getElementById("monthLabel");
let pickerYear = state.year;

function renderPicker() {
  document.getElementById("pickerYearLabel").textContent = pickerYear;
  const wrap = document.getElementById("pickerMonths");
  wrap.innerHTML = "";
  MONTHS_SHORT.forEach((m, i) => {
    const btn = document.createElement("button");
    btn.textContent = m;
    if (pickerYear === state.year && i === state.month) btn.classList.add("active");
    btn.addEventListener("click", () => {
      state.year = pickerYear;
      state.month = i;
      renderHeader();
      subscribeMonth();
      closePicker();
    });
    wrap.appendChild(btn);
  });
}

function openPicker() {
  pickerYear = state.year;
  renderPicker();
  popover.classList.remove("hidden");
  monthLabelBtn.setAttribute("aria-expanded", "true");
}
function closePicker() {
  popover.classList.add("hidden");
  monthLabelBtn.setAttribute("aria-expanded", "false");
}
monthLabelBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  popover.classList.contains("hidden") ? openPicker() : closePicker();
});
document.getElementById("pickerPrevYear").addEventListener("click", () => { pickerYear--; renderPicker(); });
document.getElementById("pickerNextYear").addEventListener("click", () => { pickerYear++; renderPicker(); });
document.addEventListener("click", (e) => {
  if (!popover.contains(e.target) && e.target !== monthLabelBtn) closePicker();
});

/* ============================================================
   THEME TOGGLE
   ============================================================ */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.getElementById("iconSun").style.display = theme === "dark" ? "block" : "none";
  document.getElementById("iconMoon").style.display = theme === "light" ? "block" : "none";
  localStorage.setItem("tk_theme", theme);
}
(function initTheme() {
  const saved = localStorage.getItem("tk_theme");
  const preferred = saved || (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  applyTheme(preferred);
})();
document.getElementById("themeToggle").addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
});

/* ============================================================
   DRAWER — day editor
   ============================================================ */
const drawer = document.getElementById("drawer");
const drawerOverlay = document.getElementById("drawerOverlay");
let drawerToggles = { if: null, insomnia: null, jog: null, tri: null };

let currentSesiColors = Array(SESI_COUNT).fill(null);

function buildSesiInputs() {
  const grid = document.getElementById("sesiGrid");
  grid.innerHTML = "";
  for (let i = 0; i < SESI_COUNT; i++) {
    const item = document.createElement("div");
    item.className = "sesi-item";
    item.innerHTML = `
      <label>S${i+1}</label>
      <button type="button" class="color-dot" data-idx="${i}" aria-label="Beri label warna sesi ${i+1}"></button>
      <input type="number" step="0.01" min="0" data-idx="${i}" placeholder="0.00" />
    `;
    grid.appendChild(item);
  }
  grid.querySelectorAll("input").forEach(inp => {
    inp.addEventListener("input", updateDrawerTotal);
  });
  grid.querySelectorAll(".color-dot").forEach(dot => {
    dot.addEventListener("click", (e) => {
      e.stopPropagation();
      openColorPopover(Number(dot.dataset.idx), dot);
    });
  });
}
buildSesiInputs();

/* ---- AC log time selects ---- */
function fillSelect(el, options) {
  el.innerHTML = options.map(o => `<option value="${o.value}">${o.label}</option>`).join("");
}
function buildACSelects() {
  const hourOpts = Array.from({length: 12}, (_, i) => { const h = i + 1; return { value: h, label: h }; });
  const minuteOpts = Array.from({length: 60}, (_, i) => { const m = pad2(i); return { value: m, label: m }; });
  const periodOpts = [{ value: "AM", label: "AM" }, { value: "PM", label: "PM" }];

  ["acStartHour", "acEndHour"].forEach(id => fillSelect(document.getElementById(id), hourOpts));
  ["acStartMinute", "acEndMinute"].forEach(id => fillSelect(document.getElementById(id), minuteOpts));
  ["acStartPeriod", "acEndPeriod"].forEach(id => fillSelect(document.getElementById(id), periodOpts));

  document.querySelectorAll("#acTimeGrid select").forEach(sel => sel.addEventListener("change", updateACHint));
}
buildACSelects();

function getACStart() {
  return {
    h: document.getElementById("acStartHour").value,
    m: document.getElementById("acStartMinute").value,
    p: document.getElementById("acStartPeriod").value,
  };
}
function getACFinish() {
  return {
    h: document.getElementById("acEndHour").value,
    m: document.getElementById("acEndMinute").value,
    p: document.getElementById("acEndPeriod").value,
  };
}
function setACSelects(prefix, t) {
  document.getElementById(`${prefix}Hour`).value = String(t.h);
  document.getElementById(`${prefix}Minute`).value = pad2(t.m);
  document.getElementById(`${prefix}Period`).value = t.p;
}
function updateACHint() {
  const unknown = document.getElementById("acUnknown").checked;
  const hint = document.getElementById("acHint");
  if (unknown) { hint.textContent = "Unknown"; return; }
  const hours = acDurationHours(getACStart(), getACFinish());
  hint.textContent = `${fmtHours(hours)} jam`;
}
function setACDisabled(disabled) {
  document.querySelectorAll("#acTimeGrid select").forEach(sel => sel.disabled = disabled);
}
document.getElementById("acUnknown").addEventListener("change", (e) => {
  setACDisabled(e.target.checked);
  updateACHint();
});

function applySesiColorDots() {
  document.querySelectorAll("#sesiGrid .color-dot").forEach((dot, i) => {
    const c = currentSesiColors[i];
    dot.style.setProperty("--dot-color", c || "transparent");
    dot.classList.toggle("has-color", !!c);
    const input = dot.parentElement.querySelector("input");
    input.style.setProperty("--dot-color", c || "");
  });
}

/* ---- color-label popover (shared by all sesi swatches) ---- */
const colorPopover = document.getElementById("colorPopover");
let colorPopoverIdx = null;

function openColorPopover(idx, anchorEl) {
  colorPopoverIdx = idx;
  colorPopover.innerHTML = "";

  const noneBtn = document.createElement("button");
  noneBtn.type = "button";
  noneBtn.className = "color-swatch swatch-none";
  noneBtn.setAttribute("aria-label", "Hapus label warna");
  noneBtn.addEventListener("click", () => { setSesiColor(idx, null); closeColorPopover(); });
  colorPopover.appendChild(noneBtn);

  SESI_COLORS.forEach(hex => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "color-swatch" + (currentSesiColors[idx] === hex ? " active" : "");
    btn.style.background = hex;
    btn.setAttribute("aria-label", `Label warna ${hex}`);
    btn.addEventListener("click", () => { setSesiColor(idx, hex); closeColorPopover(); });
    colorPopover.appendChild(btn);
  });

  const r = anchorEl.getBoundingClientRect();
  colorPopover.style.top = `${r.bottom + 6}px`;
  colorPopover.style.left = `${Math.min(r.left, window.innerWidth - 130)}px`;
  colorPopover.classList.remove("hidden");
}

function closeColorPopover() {
  colorPopover.classList.add("hidden");
  colorPopoverIdx = null;
}

function setSesiColor(idx, hex) {
  currentSesiColors[idx] = hex;
  applySesiColorDots();
}

document.addEventListener("click", (e) => {
  if (!colorPopover.contains(e.target) && !e.target.classList.contains("color-dot")) closeColorPopover();
});

function updateDrawerTotal() {
  const inputs = document.querySelectorAll("#sesiGrid input");
  let sum = 0;
  inputs.forEach(i => sum += Number(i.value) || 0);
  document.getElementById("drawerTotal").textContent = `Total: ${fmtHours(sum)} jam`;
}

/* ---- brainrot: dynamic session inputs (default 2, "+" to add, min 1) ---- */
const BRAINROT_MIN = 1;
const BRAINROT_DEFAULT = 2;

function buildBrainrotInputs(values) {
  const grid = document.getElementById("brainrotGrid");
  grid.innerHTML = "";
  const list = (values && values.length) ? values : Array(BRAINROT_DEFAULT).fill(null);
  list.forEach(v => addBrainrotItem(v));
  updateDrawerBrainrotTotal();
}

function addBrainrotItem(value = null) {
  const grid = document.getElementById("brainrotGrid");
  const item = document.createElement("div");
  item.className = "sesi-item";
  item.innerHTML = `
    <label>B${grid.children.length + 1}</label>
    <input type="number" step="0.01" min="0" placeholder="0.00" value="${value ?? ""}" />
    <button type="button" class="remove-btn" aria-label="Hapus sesi">×</button>
  `;
  const input = item.querySelector("input");
  input.addEventListener("input", updateDrawerBrainrotTotal);
  item.querySelector(".remove-btn").addEventListener("click", () => {
    if (grid.children.length <= BRAINROT_MIN) return;
    item.remove();
    relabelBrainrotItems();
    updateDrawerBrainrotTotal();
  });
  grid.appendChild(item);
}

function relabelBrainrotItems() {
  document.querySelectorAll("#brainrotGrid .sesi-item label").forEach((lbl, i) => {
    lbl.textContent = `B${i + 1}`;
  });
}

function updateDrawerBrainrotTotal() {
  const inputs = document.querySelectorAll("#brainrotGrid input");
  let sum = 0;
  inputs.forEach(i => sum += Number(i.value) || 0);
  document.getElementById("drawerBrainrotTotal").textContent = `Total: ${fmtHours(sum)} jam`;
}

document.getElementById("brainrotAddBtn").addEventListener("click", () => addBrainrotItem());

function setupToggle(name, defaultValue) {
  const row = document.querySelector(`.toggle-row[data-toggle="${name}"]`);
  const btns = row.querySelectorAll(".toggle-btn");
  drawerToggles[name] = defaultValue;
  btns.forEach(b => {
    b.classList.toggle("active", b.dataset.value === defaultValue);
    b.onclick = () => {
      drawerToggles[name] = b.dataset.value;
      btns.forEach(x => x.classList.toggle("active", x === b));
      onToggleChange(name);
    };
  });
}

function onToggleChange(name) {
  if (name === "if") {
    document.getElementById("ifNote").classList.toggle("hidden", drawerToggles.if !== "fail");
  }
  if (name === "insomnia") {
    document.getElementById("insomniaNote").classList.toggle("hidden", drawerToggles.insomnia !== "insomnia");
  }
  if (name === "jog") {
    document.getElementById("jogNote").classList.toggle("hidden", drawerToggles.jog !== "no");
  }
}

function openDrawer(dstr) {
  state.selectedDate = dstr;
  const rec = state.data.get(dstr) || {};
  const [y, m, d] = dstr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);

  document.getElementById("drawerDate").textContent = `${d} ${MONTHS[m-1]} ${y}`;
  document.getElementById("drawerDay").textContent = DAYS_FULL[dateObj.getDay()];

  // sesi
  const sesiInputs = document.querySelectorAll("#sesiGrid input");
  sesiInputs.forEach((inp, i) => { inp.value = rec.sesi?.[i] ?? ""; });
  updateDrawerTotal();
  currentSesiColors = Array.from({length: SESI_COUNT}, (_, i) => rec.sesiColors?.[i] ?? null);
  applySesiColorDots();

  // brainrot (dynamic sessions)
  buildBrainrotInputs(rec.brainrot);

  // IF
  setupToggle("if", rec.intermittentFasting == null ? "none" : (rec.intermittentFasting.success ? "success" : "fail"));
  document.getElementById("ifNote").value = rec.intermittentFasting?.note ?? "";
  onToggleChange("if");

  // insomnia
  setupToggle("insomnia", rec.insomnia == null ? "none" : (rec.insomnia.normal ? "normal" : "insomnia"));
  document.getElementById("insomniaNote").value = rec.insomnia?.note ?? "";
  onToggleChange("insomnia");

  // jog
  setupToggle("jog", rec.jogging == null ? "none" : (rec.jogging.active ? "yes" : "no"));
  document.getElementById("jogNote").value = rec.jogging?.note ?? "";
  onToggleChange("jog");

  // trisandhya
  setupToggle("tri", rec.trisandhya === true ? "yes" : (rec.trisandhya === false ? "no" : "none"));

  // AC
  const acRec = rec.acLog;
  setACSelects("acStart", acRec?.start || { h: 12, m: "00", p: "AM" });
  setACSelects("acEnd", acRec?.finish || { h: 12, m: "00", p: "AM" });
  document.getElementById("acUnknown").checked = !!acRec?.unknown;
  setACDisabled(!!acRec?.unknown);
  updateACHint();

  drawer.classList.remove("hidden");
  drawerOverlay.classList.remove("hidden");
  drawer.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  drawer.classList.add("hidden");
  drawerOverlay.classList.add("hidden");
  drawer.setAttribute("aria-hidden", "true");
  state.selectedDate = null;
  closeColorPopover();
}

document.getElementById("drawerClose").addEventListener("click", closeDrawer);
drawerOverlay.addEventListener("click", closeDrawer);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });

/* ---- save / delete ---- */
document.getElementById("drawerSave").addEventListener("click", async () => {
  if (!state.selectedDate) return;

  const sesi = Array.from(document.querySelectorAll("#sesiGrid input")).map(i => i.value === "" ? null : Number(i.value));
  const brainrot = Array.from(document.querySelectorAll("#brainrotGrid input")).map(i => i.value === "" ? null : Number(i.value));
  const acUnknown = document.getElementById("acUnknown").checked;
  const acStart = getACStart();
  const acFinish = getACFinish();

  const record = {
    sesi,
    sesiColors: currentSesiColors,
    brainrot,
    intermittentFasting: drawerToggles.if === "none" ? null : {
      success: drawerToggles.if === "success",
      note: drawerToggles.if === "fail" ? document.getElementById("ifNote").value.trim() : "",
    },
    insomnia: drawerToggles.insomnia === "none" ? null : {
      normal: drawerToggles.insomnia === "normal",
      note: drawerToggles.insomnia === "insomnia" ? document.getElementById("insomniaNote").value.trim() : "",
    },
    jogging: drawerToggles.jog === "none" ? null : {
      active: drawerToggles.jog === "yes",
      note: drawerToggles.jog === "no" ? document.getElementById("jogNote").value.trim() : "",
    },
    trisandhya: drawerToggles.tri === "none" ? null : (drawerToggles.tri === "yes"),
    acLog: {
      start: acStart,
      finish: acFinish,
      value: acUnknown ? null : Math.round(acDurationHours(acStart, acFinish) * 100) / 100,
      unknown: acUnknown,
    },
    updatedAt: new Date().toISOString(),
  };

  // Optimistic UI: the old code awaited setDoc() before giving ANY feedback,
  // so the whole 1-2s round trip (Jakarta <-> Firestore server) sat between
  // the click and the toast/drawer closing. Firestore already applies local
  // writes to its cache instantly and reconciles via onSnapshot in the
  // background — so update local state + UI right away, and only revert if
  // the write actually fails (offline, blocked by rules, etc).
  const dateId = state.selectedDate;
  const prevRec = state.data.get(dateId);

  state.data.set(dateId, record);
  renderGrid();
  showToast("Tersimpan");
  closeDrawer();

  try {
    await setDoc(doc(db, COLLECTION, dateId), record, { merge: false });
  } catch (err) {
    console.error(err);
    if (prevRec) state.data.set(dateId, prevRec); else state.data.delete(dateId);
    renderGrid();
    showToast("Gagal menyimpan — cek koneksi/config Firebase", true);
  }
});

document.getElementById("drawerDelete").addEventListener("click", async () => {
  if (!state.selectedDate) return;
  if (!confirm("Hapus semua data untuk tanggal ini?")) return;

  const dateId = state.selectedDate;
  const prevRec = state.data.get(dateId);

  state.data.delete(dateId);
  renderGrid();
  showToast("Data dihapus");
  closeDrawer();

  try {
    await deleteDoc(doc(db, COLLECTION, dateId));
  } catch (err) {
    console.error(err);
    if (prevRec) state.data.set(dateId, prevRec);
    renderGrid();
    showToast("Gagal menghapus", true);
  }
});

/* ============================================================
   EXTRA NOTES
   ============================================================ */
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function escAttr(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function subscribeNotes() {
  const q = query(collection(db, NOTES_COLLECTION), orderBy("createdAt"));
  onSnapshot(q, (snap) => {
    state.notes.clear();
    snap.forEach(d => state.notes.set(d.id, d.data()));
    renderNotes();
  }, (err) => {
    console.error(err);
    showToast("Gagal memuat notes — cek koneksi/config Firebase", true);
  });
}

function renderNotes() {
  const table = document.getElementById("notesTable");
  // Don't wipe rows while the person is actively typing in one of them —
  // a remote update mid-edit would otherwise discard unsaved input.
  if (table.contains(document.activeElement)) return;

  table.querySelectorAll(".notes-row:not(.notes-row-head)").forEach(r => r.remove());

  const saved = Array.from(state.notes.entries()); // [id, data][]
  const placeholderCount = Math.max(0, state.notesMinRows - saved.length);

  saved.forEach(([id, data]) => table.appendChild(buildNoteRow(id, data)));
  for (let i = 0; i < placeholderCount; i++) {
    table.appendChild(buildNoteRow(null, { date: "", text: "" }));
  }
}

function buildNoteRow(id, data) {
  const row = document.createElement("div");
  row.className = "notes-row";
  let rowId = id;
  const createdAt = data.createdAt || null;

  row.innerHTML = `
    <input type="date" class="notes-date" value="${escAttr(data.date || "")}" />
    <input type="text" class="notes-text" placeholder="Deskripsi singkat..." value="${escAttr(data.text || "")}" />
    <button type="button" class="remove-btn" aria-label="Hapus baris">×</button>
  `;

  const dateInput = row.querySelector(".notes-date");
  const textInput = row.querySelector(".notes-text");
  const removeBtn = row.querySelector(".remove-btn");

  const scheduleSave = debounce(async () => {
    const dateVal = dateInput.value || null;
    const textVal = textInput.value.trim();
    if (!dateVal && !textVal) return; // nothing worth saving yet
    try {
      if (!rowId) {
        const ref = doc(collection(db, NOTES_COLLECTION));
        rowId = ref.id;
        await setDoc(ref, { date: dateVal, text: textVal, createdAt: new Date().toISOString() });
      } else {
        await setDoc(doc(db, NOTES_COLLECTION, rowId),
          { date: dateVal, text: textVal, createdAt: createdAt || new Date().toISOString() },
          { merge: true });
      }
    } catch (err) {
      console.error(err);
      showToast("Gagal menyimpan catatan", true);
    }
  }, 700);

  dateInput.addEventListener("input", scheduleSave);
  textInput.addEventListener("input", scheduleSave);

  removeBtn.addEventListener("click", async () => {
    if (!rowId) { row.remove(); return; }
    try {
      await deleteDoc(doc(db, NOTES_COLLECTION, rowId));
    } catch (err) {
      console.error(err);
      showToast("Gagal menghapus catatan", true);
    }
  });

  return row;
}

document.getElementById("notesAddBtn").addEventListener("click", () => {
  state.notesMinRows++;
  renderNotes();
});

document.getElementById("notesTable").addEventListener("focusout", () => {
  setTimeout(() => {
    if (!document.getElementById("notesTable").contains(document.activeElement)) renderNotes();
  }, 50);
});

/* ============================================================
   INIT
   ============================================================ */
renderHeader();
subscribeMonth();
subscribeNotes();
