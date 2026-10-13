let currentFuel = 'diesel';
let currentFormat = 'square';
let currentFont = 'sport';
let currentCritair = 'none';
let cropperInstance = null;
let rawVehicleImageSrc = null;

const g = id => document.getElementById(id);
const v = id => g(id).value;
// Texte saisi ; à défaut, le texte d'exemple (placeholder) pour garder un aperçu lisible
const txt = id => v(id).trim() || g(id).placeholder || '';

const NF = new Intl.NumberFormat('fr-FR');
const NUM_ONLY = /^[\d\s.,]+(?:€|eur(?:os?)?)?$/i;
const DECIMAL_END = /[.,]\d{1,2}(?:\s*(?:€|eur(?:os?)?))?$/i;
// "33490", "33.490" ou "33 490 €" -> "33 490" (+ suffixe). Texte libre ("À partir de…") laissé tel quel.
function numField(id, suffix = '') {
  const raw = v(id).trim();
  if (!raw) return g(id).placeholder || '';
  if (!NUM_ONLY.test(raw) || DECIMAL_END.test(raw)) return raw;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return raw;
  return fmtNum(Number(digits)) + suffix;
}

function fmtNum(n) {
  return NF.format(n).replace(/[\u202f\u00a0]/g, '\u00a0');
}
// Premier montant d'un texte ("26 490 € TTC" -> 26490), centimes ignorés ; null si aucun chiffre
function amountOf(raw) {
  const m = (raw || '').match(/\d[\d\s\u00a0\u202f.,]*/);
  if (!m) return null;
  const digits = m[0].trim().replace(/[.,]\d{1,2}$/, '').replace(/\D/g, '');
  return digits ? Number(digits) : null;
}

// Texte multi-lignes sans innerHTML (pas d'injection)
function setMultiline(el, text) {
  el.textContent = '';
  text.split(/\r?\n/).forEach((line, i) => {
    if (i) el.appendChild(document.createElement('br'));
    el.appendChild(document.createTextNode(line));
  });
}

// Bascule l'état actif + aria-pressed sur un groupe de boutons
function setPressed(selector, isOn) {
  document.querySelectorAll(selector).forEach(n => {
    const on = isOn(n);
    n.classList.toggle('active', on);
    n.setAttribute('aria-pressed', on);
  });
}

const LOGO_MAX = 400;    // px, plus grande dimension
const PHOTO_MAX = 2000;  // px, plus grande dimension

const SV = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const PUMP = '<path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M3 21h13M7.5 8h4"/><path d="M15 9.5h2a2 2 0 0 1 2 2V16a1.5 1.5 0 0 0 3 0V9l-3-3"/>';
const DROP = '<path d="M12 3s6 6.3 6 11a6 6 0 0 1-12 0c0-4.7 6-11 6-11z"/>';
const FUEL_PATHS = {
  diesel: PUMP,
  essence: DROP,
  hybride: DROP + '<path d="M12.8 10 10.2 14h3.6l-.8 3.5"/>',
  electrique: '<path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0V7zM12 17v5"/>',
};
const FUELS = {
  diesel:{label:'Diesel',svg:SV(FUEL_PATHS.diesel)},
  essence:{label:'Essence',svg:SV(FUEL_PATHS.essence)},
  hybride:{label:'Hybride',svg:SV(FUEL_PATHS.hybride)},
  electrique:{label:'Électrique',svg:SV(FUEL_PATHS.electrique)},
};

// Palette Citroën : rouge Infra-Red, bleu Monte Carlo (concessions) et neutres
const PALETTE = [
  {name:'Rouge Infra-Red',  hex:'#ee3524'},
  {name:'Bleu Monte Carlo', hex:'#1b3f8b'},
  {name:'Bleu nuit',        hex:'#0f2a5c'},
  {name:'Bleu glacier',     hex:'#2f80b7'},
  {name:'Jaune 1919',       hex:'#c48a00'},
  {name:'Vert kaki',        hex:'#4f6b3f'},
];

function renderPalette() {
  document.querySelectorAll('.presets').forEach(p => {
    const id = p.querySelector('.preset').getAttribute('onclick').match(/setColor\('(\w+)'/)[1];
    p.innerHTML = PALETTE.map(c => `<button type="button" class="preset" title="${c.name}" aria-label="${c.name}" data-target="${id}" data-hex="${c.hex}" style="background:${c.hex}" onclick="setColor('${id}','${c.hex}')"></button>`).join('');
  });
}

function initFuelIcons() {
  document.querySelectorAll('.fuel-pill').forEach(p => { p.querySelector('svg').innerHTML = FUEL_PATHS[p.dataset.fuel]; });
}

function fitRibbon(text) {
  const el = document.getElementById('cBadgeInner');
  el.innerHTML = '';
  const s = document.createElement('span');
  s.style.whiteSpace = 'nowrap';
  s.textContent = text;
  el.appendChild(s);
  el.style.fontSize = '';
  const limit = ({square:150, portrait:150, story:140, landscape:125})[currentFormat] || 140;
  let size = parseFloat(getComputedStyle(el).fontSize);
  while (s.offsetWidth > limit && size > 11) { size -= 1; el.style.fontSize = size + 'px'; }
}

const FONTS = {
  sport:   { heading:"'Barlow Condensed',sans-serif", body:"'Barlow',sans-serif" },
  luxe:    { heading:"'Playfair Display',serif",      body:"'Playfair Display',serif" },
  modern:  { heading:"'Montserrat',sans-serif",       body:"'Montserrat',sans-serif" },
  compact: { heading:"'Oswald',sans-serif",           body:"'Oswald',sans-serif" },
};

const FORMATS = {
  square:    { label:'800 × 800 px', w:800, h:800, exportW:1080 },
  portrait:  { label:'640 × 800 px (Portrait 4:5)', w:640, h:800, exportW:1080 },
  story:      { label:'450 × 800 px (Story 9:16)', w:450, h:800, exportW:1080 },
  landscape: { label:'800 × 450 px (Paysage 16:9)', w:800, h:450, exportW:1920 },
};

const CRITAIR_COLORS = { none:'', E:'#1e9e4a','1':'#7b3f9e','2':'#e0b400','3':'#e67e22','4':'#8e2430','5':'#6b7580' };
const GARANTIE_COLORS = { 'Garantie 12 mois':'#1b3f8b','Garantie 24 mois':'#0f2a5c','Première main':'#ee3524','Entretien à jour':'#4f6b3f','Certifié constructeur':'#2f80b7' };
const SAMPLE_OPTIONS = ['Limiteur et régulateur','Ordinateur de bord','Kit mains libres Bluetooth','Caméra de recul'];

function toggleTheme() {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('acs_theme', t); } catch(e){}
}

function initAccordion() {
  const secs = document.querySelectorAll('.panel .sec');
  secs.forEach((s, i) => {
    if (i === secs.length - 1) return;
    s.querySelector('.sec-title').addEventListener('click', () => s.classList.toggle('closed'));
    s.classList.add('closed');
  });
}

function initA11y() {
  document.querySelectorAll('.critair-swatch').forEach(b => {
    b.setAttribute('aria-label', b.dataset.critair === 'none' ? "Crit'Air : aucune" : `Crit'Air ${b.dataset.critair}`);
  });
  ['logoZone', 'vehicleZone'].forEach(id => {
    g(id).addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); }
    });
  });
}

function init() {
  renderPalette();
  initFuelIcons();
  initAccordion();
  initA11y();
  loadLogo();
  loadSettings();
  SAMPLE_OPTIONS.forEach(o => addOption('', o));
  selectFuel(currentFuel, false);
  selectFormat(currentFormat, false);
  selectFont(currentFont, false);
  selectCritair(currentCritair, false);
  updateCard();
  initSortable();
  scaleCardToFit();
  initPlate();
}

const PERSIST_IDS = ['dealer','phone','address','cYear','cBadge','cStats','cOptions','cFooter','cFin'];
// Anciens textes factices qui ont pu être enregistrés comme vraies valeurs
const LEGACY_SAMPLES = ['Nom du garage', '03 XX XX XX XX', 'Adresse de la concessionnaire'];

function saveSettings() {
  const s = {};
  PERSIST_IDS.forEach(k => { const el = document.getElementById(k); if(el) s[k] = el.value; });
  s.fuel = currentFuel;
  s.font = currentFont;
  s.format = currentFormat;
  s.critair = currentCritair;
  s.darkCard = document.getElementById('darkCard').checked;
  s.showBadge = document.getElementById('showBadge').checked;
  try { localStorage.setItem('acs_settings_v2', JSON.stringify(s)); }
  catch(e) { showSaved(false, 'Réglages non sauvegardés : stockage du navigateur indisponible.'); }
}

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('acs_settings_v2') || 'null');
    if (!s) return;
    PERSIST_IDS.forEach(k => {
      const el = document.getElementById(k);
      if (!el || s[k] === undefined || LEGACY_SAMPLES.includes(s[k])) return;
      el.value = s[k];
    });
    if (s.fuel) currentFuel = s.fuel;
    if (s.font) currentFont = s.font;
    if (s.format) currentFormat = s.format;
    if (s.critair) currentCritair = s.critair;
    if (s.darkCard !== undefined) document.getElementById('darkCard').checked = s.darkCard;
    if (s.showBadge !== undefined) document.getElementById('showBadge').checked = s.showBadge;
    showSaved();
  } catch(e){}
}

function selectFormat(f, save=true) {
  currentFormat = f;
  setPressed('.format-pill', p => p.dataset.format === f);
  const card = document.getElementById('card');
  card.classList.remove('portrait','story','landscape'); if (f !== 'square') card.classList.add(f);
  fitRibbon(document.getElementById('badge').value);
  card.style.width = FORMATS[f].w + 'px';
  card.style.height = FORMATS[f].h + 'px';
  document.getElementById('previewFormatLabel').textContent = FORMATS[f].label;
  scaleCardToFit();
  if (save) saveSettings();
}

function selectFont(f, save=true) {
  currentFont = f;
  setPressed('.font-pill', p => p.dataset.font === f);
  const card = document.getElementById('card');
  card.style.setProperty('--card-heading-font', FONTS[f].heading);
  card.style.setProperty('--card-body-font', FONTS[f].body);
  if (save) saveSettings();
}

function selectFuel(f, save=true) {
  currentFuel = f;
  setPressed('.fuel-pill', p => p.dataset.fuel === f);
  document.getElementById('cFuelLabel').textContent = FUELS[f].label;
  document.getElementById('cFuelIco').innerHTML = FUELS[f].svg;
  if (save) saveSettings();
}

function selectCritair(c, save=true) {
  currentCritair = c;
  setPressed('.critair-swatch', b => b.dataset.critair === c);
  const badge = document.getElementById('cCritairBadge');
  if (c === 'none' || !c) {
    badge.style.display = 'none';
  } else {
    badge.style.display = 'flex';
    badge.style.background = CRITAIR_COLORS[c];
    badge.innerHTML = `<span class="ca-lbl">Crit'Air</span><span class="ca-num">${c}</span>`;
  }
  if (save) saveSettings();
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image illisible'));
    img.src = src;
  });
}
// Réduit l'image pour que sa plus grande dimension ne dépasse pas maxSize (les SVG restent intacts)
async function prepareImage(file, { maxSize, type }) {
  const src = await readFile(file);
  if (file.type === 'image/svg+xml') return src;
  const img = await loadImage(src);
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
  if (scale === 1) return src;
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  const ctx = c.getContext('2d');
  if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL(type, 0.9);
}

async function handleLogoFile(file) {
  if (!file) return;
  try {
    const src = await prepareImage(file, { maxSize: LOGO_MAX, type: file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png' });
    applyLogo(src);
    saveLogo(src);
  } catch (e) { alert("Impossible de lire ce fichier image."); console.error(e); }
}
async function handleVehicleFile(file) {
  if (!file) return;
  try {
    const src = await prepareImage(file, { maxSize: PHOTO_MAX, type: 'image/jpeg' });
    rawVehicleImageSrc = src;
    applyVehicleImage(src);
    resetPlate();
  } catch (e) { alert("Impossible de lire ce fichier image."); console.error(e); }
}

g('logoInput').addEventListener('change', e => { handleLogoFile(e.target.files[0]); e.target.value = ''; });

function applyLogo(src) {
  const img = document.getElementById('cLogoImg');
  img.src = src; img.style.display = 'block';
  document.getElementById('logoPreviewImg').src = src;
  document.getElementById('logoPreview').classList.add('on');
}

function saveLogo(src) {
  try { localStorage.setItem('acs_logo', src); showSaved(); }
  catch(e) {
    try { localStorage.removeItem('acs_logo'); } catch(_) {}
    showSaved(false, 'Logo affiché, mais non sauvegardé : stockage du navigateur plein ou indisponible.');
  }
}

function clearLogo() {
  document.getElementById('cLogoImg').style.display = 'none';
  document.getElementById('logoPreview').classList.remove('on');
  document.getElementById('logoInput').value = '';
  try { localStorage.removeItem('acs_logo'); } catch(e){}
}

function loadLogo() {
  try { const s = localStorage.getItem('acs_logo'); if(s) applyLogo(s); } catch(e){}
}

function showSaved(ok = true, msg = '') {
  const b = document.getElementById('savedBadge');
  b.classList.toggle('err', !ok);
  document.getElementById('savedText').textContent = ok ? 'Sauvegardé' : msg;
  b.classList.add('on');
  clearTimeout(showSaved.timer);
  showSaved.timer = setTimeout(() => b.classList.remove('on'), ok ? 3000 : 8000);
}

function setupDrop(zoneId, cb) {
  const z = document.getElementById(zoneId);
  z.addEventListener('dragover', e => { e.preventDefault(); z.style.borderColor='var(--accent)'; });
  z.addEventListener('dragleave', () => { z.style.borderColor=''; });
  z.addEventListener('drop', e => {
    e.preventDefault(); z.style.borderColor='';
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) cb(f);
  });
}
setupDrop('logoZone', handleLogoFile);
setupDrop('vehicleZone', handleVehicleFile);

g('vehicleInput').addEventListener('change', e => { handleVehicleFile(e.target.files[0]); e.target.value = ''; });

function applyVehicleImage(src) {
  document.getElementById('thumbImg').src = src;
  document.getElementById('vehicleThumb').style.display = 'block';
  document.getElementById('cardImg').src = src;
  document.getElementById('cardImg').style.display = 'block';
  document.getElementById('cImgPlaceholder').style.display = 'none';
  document.getElementById('cImgSection').classList.add('has-img');
}

function openCropModal() {
  if (!rawVehicleImageSrc) return;
  const modal = document.getElementById('cropModal');
  const img = document.getElementById('cropImg');
  modal.style.display = 'flex';
  img.src = rawVehicleImageSrc;
  if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
  setTimeout(() => {
    const ratios = { square:16/9, portrait:5/4, story:3/2, landscape:16/9 };
    cropperInstance = new Cropper(img, {
      aspectRatio: ratios[currentFormat] || 16/9,
      viewMode: 1,
      autoCropArea: 0.95,
      background: false,
    });
  }, 150);
}

function closeCropModal() {
  document.getElementById('cropModal').style.display = 'none';
  if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
}

function applyCrop() {
  if (!cropperInstance) return;
  const canvas = cropperInstance.getCroppedCanvas({ maxWidth:1600, maxHeight:1200 });
  const src = canvas.toDataURL('image/jpeg', 0.95);
  applyVehicleImage(src);
  closeCropModal();
}

function setRibbon(text, color) {
  g('badge').value = text;
  g('cBadge').value = color;
  g('showBadge').checked = true;
  updateCard(); saveSettings();
}

// sample : texte d'exemple affiché en grisé et utilisé dans l'aperçu tant que la ligne est vide
function addOption(val = '', sample = '') {
  const list = document.getElementById('optionsList');
  if (list.querySelectorAll('.option-row').length >= 4) return;
  const row = document.createElement('div');
  row.className = 'option-row';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = val;
  input.placeholder = sample || 'Ex: GPS intégré';
  if (sample) input.dataset.sample = sample;
  input.addEventListener('input', () => updateCard());
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'btn-del';
  del.setAttribute('aria-label', "Supprimer l'option");
  del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  del.addEventListener('click', () => { row.remove(); updateCard(); });
  row.append(input, del);
  list.appendChild(row);
  updateCard();
}

document.getElementById('garantieBadge').addEventListener('change', function() {
  document.getElementById('garantieCustomWrap').style.display = this.value === 'custom' ? 'block' : 'none';
  updateCard();
});

document.getElementById('showFin').addEventListener('change', function() {
  document.getElementById('finFields').style.display = this.checked ? 'block' : 'none';
  updateCard();
});

function setColor(id, val) { document.getElementById(id).value = val; updateCard(); saveSettings(); }

function updateCard() {
  g('cBrand').textContent   = txt('brand');
  g('cYearChip').textContent = txt('year');
  g('cYearChip').style.background = v('cYear');
  g('cPrice').textContent   = numField('price', '\u00a0€');
  g('cPower').textContent   = txt('power');
  g('cMileage').textContent = numField('mileage');
  setMultiline(g('cTx'), txt('transmission'));

  // Prix barré (à la place du libellé "Prix") + badge "Économisez …"
  const oldRaw = v('oldPrice').trim();
  const priceLbl = g('cPriceLbl');
  priceLbl.textContent = '';
  if (oldRaw) {
    const strike = document.createElement('s');
    strike.textContent = numField('oldPrice', '\u00a0€');
    priceLbl.appendChild(strike);
  } else {
    priceLbl.textContent = 'Prix';
  }
  const nNew = amountOf(v('price')), nOld = amountOf(oldRaw);
  const saving = (nNew != null && nOld != null) ? nOld - nNew : 0;
  const savingEl = g('cSavingBadge');
  if (g('showSaving').checked && saving > 0) {
    savingEl.textContent = `Économisez ${fmtNum(saving)}\u00a0€`;
    savingEl.style.display = 'block';
  } else {
    savingEl.style.display = 'none';
  }
  g('cTxWrap').style.background = v('cStats');
  g('cBadgeInner').style.background = v('cBadge');
  g('cBadgeWrap').style.display = g('showBadge').checked ? '' : 'none';
  fitRibbon(v('badge'));
  g('cDealer').textContent  = txt('dealer');
  g('cPhone').textContent   = txt('phone');
  g('cAddress').textContent = txt('address');
  g('cFooterBar').style.background = v('cFooter');

  const showFin = g('showFin').checked;
  g('cFinancement').style.display = showFin ? 'flex' : 'none';
  g('cFinAmount').textContent = txt('finAmount');
  g('cFinLegal').textContent  = txt('finLegal');
  g('cFinancement').style.background = v('cFin');

  const co2val = v('co2').trim();
  const co2Badge = g('cCo2Badge');
  if (co2val) {
    co2Badge.style.display = 'flex';
    g('cCo2Text').textContent = co2val + ' CO₂';
  } else {
    co2Badge.style.display = 'none';
  }

  const garantieSel = v('garantieBadge');
  const garantieEl = g('cGarantieBadge');
  let garantieText = '';
  if (garantieSel === 'custom') garantieText = v('garantieCustom');
  else if (garantieSel) garantieText = garantieSel;
  garantieEl.style.display = garantieText ? 'block' : 'none';
  garantieEl.textContent = garantieText;
  garantieEl.style.background = garantieSel === 'custom' ? v('garantieColor') : (GARANTIE_COLORS[garantieSel] || '#1b3f8b');

  g('card').classList.toggle('dark', g('darkCard').checked);

  const inputs = document.querySelectorAll('#optionsList .option-row input[type="text"]');
  const grid = g('cOptsGrid');
  grid.textContent = '';
  const c = v('cOptions');
  inputs.forEach(inp => {
    const text = inp.value.trim() || inp.dataset.sample || '';
    if (!text) return;
    const item = document.createElement('div');
    item.className = 'opt-item';
    const check = document.createElement('span');
    check.className = 'opt-check';
    check.style.background = c;
    check.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    const label = document.createElement('span');
    label.textContent = text;
    item.append(check, label);
    grid.appendChild(item);
  });
  document.querySelectorAll('.preset').forEach(p => p.classList.toggle('active', (g(p.dataset.target).value || '').toLowerCase() === p.dataset.hex));
  const addBtn = document.querySelector('.btn-add');
  if(addBtn) addBtn.style.display = inputs.length >= 4 ? 'none' : 'flex';
  syncPlateControls();
  layoutPlate();
}

function initSortable() {
  if(typeof Sortable === 'undefined') return;
  Sortable.create(document.getElementById('cardSortable'), {
    animation: 200,
    handle: '.sort-handle',
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    onEnd: () => updateCard(),
  });
}

// ===== Masquage de la plaque d'immatriculation =====
// Le rectangle est stocké en fractions de la photo SOURCE (pas de la carte) : il reste collé à la plaque
// quand le format change, qu'un bloc est ajouté/déplacé ou que l'image est recadrée par object-fit.
// Le flou/pixelisation est dessiné dans un <canvas> (backdrop-filter n'est pas exporté par html2canvas).
const PLATE_DEFAULT = { x: 0.40, y: 0.66, w: 0.20, h: 0.06 };
const plateRect = { ...PLATE_DEFAULT };
const plateMid = document.createElement('canvas');
const plateTiny = document.createElement('canvas');
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function resetPlate() { Object.assign(plateRect, PLATE_DEFAULT); layoutPlate(); }

function syncPlateControls() {
  const on = g('showPlate').checked;
  g('plateFields').style.display = on ? 'block' : 'none';
  g('plateColorRow').style.display = (on && v('plateStyle') === 'solid') ? 'flex' : 'none';
}

// Correspondance photo -> zone d'image affichée (object-fit: cover)
function coverGeometry() {
  const wrap = g('cImgSection'), img = g('cardImg');
  const W = wrap.clientWidth, H = wrap.clientHeight, nw = img.naturalWidth, nh = img.naturalHeight;
  if (!W || !H || !nw || !nh) return null;
  const s = Math.max(W / nw, H / nh);
  return { nw, nh, s, offX: (W - nw * s) / 2, offY: (H - nh * s) / 2 };
}

function layoutPlate() {
  const el = g('cPlate');
  const geo = (g('showPlate').checked && g('cImgSection').classList.contains('has-img')) ? coverGeometry() : null;
  if (!geo) { el.style.display = 'none'; return; }
  const left = geo.offX + plateRect.x * geo.nw * geo.s;
  const top = geo.offY + plateRect.y * geo.nh * geo.s;
  const w = plateRect.w * geo.nw * geo.s;
  const h = plateRect.h * geo.nh * geo.s;
  el.style.display = 'block';
  el.style.left = left + 'px'; el.style.top = top + 'px';
  el.style.width = w + 'px'; el.style.height = h + 'px';
  paintPlate(g('cardImg'), el, w, h);
}

function paintPlate(img, el, boxW, boxH) {
  const cv = g('cPlateCanvas');
  const style = v('plateStyle');
  if (style === 'solid') { cv.style.display = 'none'; el.style.background = v('plateColor'); return; }
  el.style.background = '';
  cv.style.display = 'block';
  const nw = img.naturalWidth, nh = img.naturalHeight;
  const sx = plateRect.x * nw, sy = plateRect.y * nh;
  const sw = Math.max(1, plateRect.w * nw), sh = Math.max(1, plateRect.h * nh);
  // Zone réduite à ~4 lignes de pixels : illisible quelle que soit la taille du rectangle
  const rows = 4, cols = Math.max(4, Math.round(rows * sw / sh));
  const midW = Math.max(cols, Math.min(Math.round(sw), cols * 6));
  const midH = Math.max(rows, Math.min(Math.round(sh), rows * 6));
  plateMid.width = midW; plateMid.height = midH;
  const m = plateMid.getContext('2d');
  m.imageSmoothingEnabled = true; m.imageSmoothingQuality = 'high';
  m.drawImage(img, sx, sy, sw, sh, 0, 0, midW, midH);
  plateTiny.width = cols; plateTiny.height = rows;
  const t = plateTiny.getContext('2d');
  t.imageSmoothingEnabled = true; t.imageSmoothingQuality = 'high';
  t.drawImage(plateMid, 0, 0, cols, rows);
  const outW = Math.max(2, Math.round(boxW * 2)), outH = Math.max(2, Math.round(boxH * 2));
  cv.width = outW; cv.height = outH;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = (style === 'blur');   // flou = agrandissement lissé ; pixels = agrandissement brut
  c.drawImage(plateTiny, 0, 0, outW, outH);
}

function initPlate() {
  const el = g('cPlate'), handle = g('cPlateHandle'), wrap = g('cImgSection'), img = g('cardImg');
  let mode = null, start = null;

  el.addEventListener('pointerdown', e => {
    const geo = coverGeometry(); if (!geo) return;
    const zoom = wrap.getBoundingClientRect().width / wrap.clientWidth || 1;   // aperçu réduit sur mobile
    mode = (e.target === handle) ? 'resize' : 'move';
    start = { x: e.clientX, y: e.clientY, p: { ...plateRect }, kx: geo.nw * geo.s * zoom, ky: geo.nh * geo.s * zoom };
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  el.addEventListener('pointermove', e => {
    if (!mode) return;
    const dx = (e.clientX - start.x) / start.kx, dy = (e.clientY - start.y) / start.ky;
    if (mode === 'move') {
      plateRect.x = clamp(start.p.x + dx, 0, 1 - plateRect.w);
      plateRect.y = clamp(start.p.y + dy, 0, 1 - plateRect.h);
    } else {
      plateRect.w = clamp(start.p.w + dx, 0.04, 1 - plateRect.x);
      plateRect.h = clamp(start.p.h + dy, 0.02, 1 - plateRect.y);
    }
    layoutPlate();
  });
  const end = () => { mode = null; };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);

  img.addEventListener('load', layoutPlate);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => layoutPlate()).observe(wrap);
}

function scaleCardToFit() {
  const fmt = FORMATS[currentFormat];
  const area = document.getElementById('previewArea');
  const isMobile = window.innerWidth <= 820;
  if (!isMobile) {
    document.getElementById('card').style.transform = '';
    document.getElementById('card').style.marginBottom = '';
    return;
  }
  const availW = area.clientWidth - 24;
  const availH = window.innerHeight * 0.65;
  const scale = Math.min(availW / fmt.w, availH / fmt.h, 1);
  const card = document.getElementById('card');
  card.style.transform = `scale(${scale})`;
  card.style.marginBottom = `-${fmt.h * (1 - scale)}px`;
}

window.addEventListener('resize', scaleCardToFit);

function togglePanel() {
  const panel = document.getElementById('panel');
  const backdrop = document.getElementById('panelBackdrop');
  panel.classList.toggle('open');
  backdrop.classList.toggle('on');
}

async function downloadCard() {
  const btn = document.getElementById('dlBtn');
  const orig = btn.innerHTML;
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;animation:spin 1s linear infinite"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity=".3"/><path d="M21 12a9 9 0 00-9-9"/></svg> Génération…`;
  btn.disabled = true;

  const card = document.getElementById('card');
  const savedTransform = card.style.transform;
  const savedMargin = card.style.marginBottom;
  card.style.transform = '';
  card.style.marginBottom = '';

  document.querySelectorAll('.sort-handle').forEach(h => h.style.display = 'none');
  card.classList.add('exporting');
  const svgs = card.querySelectorAll('svg');
  svgs.forEach(s => { s.style.color = getComputedStyle(s).color; });

  try {
    // Résolution cible : 1080×1080 (carré), 1080×1920 (story), 1920×1080 (paysage)
    const outW = FORMATS[currentFormat].exportW;
    const outH = Math.round(card.offsetHeight * outW / card.offsetWidth);
    let canvas = await html2canvas(card, {
      scale: outW / card.offsetWidth, useCORS: true, allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: card.offsetWidth,
      height: card.offsetHeight,
    });
    if (canvas.width !== outW || canvas.height !== outH) { // arrondis flottants du scale
      const fixed = document.createElement('canvas');
      fixed.width = outW; fixed.height = outH;
      fixed.getContext('2d').drawImage(canvas, 0, 0, outW, outH);
      canvas = fixed;
    }
    const a = document.createElement('a');
    const fmt = currentFormat !== 'square' ? `-${currentFormat}` : '';
    a.download = `annonce-vehicule${fmt}.jpg`;
    a.href = canvas.toDataURL('image/jpeg', 0.95);
    a.click();
  } catch(e) { alert('Erreur lors de la génération.'); console.error(e); }

  document.querySelectorAll('.sort-handle').forEach(h => h.style.display = '');
  card.classList.remove('exporting');
  card.querySelectorAll('svg').forEach(s => s.style.removeProperty('color'));
  card.style.transform = savedTransform;
  card.style.marginBottom = savedMargin;
  btn.disabled = false;
  btn.innerHTML = orig;
}

init();
if (document.fonts) document.fonts.ready.then(updateCard);