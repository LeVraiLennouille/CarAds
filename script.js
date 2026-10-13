let currentFuel = 'diesel';
let currentFormat = 'square';
let currentFont = 'sport';
let currentCritair = 'none';
let cropperInstance = null;
let rawVehicleImageSrc = null;

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
const COLOR_IDS = ['cYear','cBadge','cStats','cOptions','cFooter','cFin'];

function renderPalette() {
  document.querySelectorAll('.presets').forEach(p => {
    const id = p.querySelector('.preset').getAttribute('onclick').match(/setColor\('(\w+)'/)[1];
    p.innerHTML = PALETTE.map(c => `<div class="preset" title="${c.name}" data-target="${id}" data-hex="${c.hex}" style="background:${c.hex}" onclick="setColor('${id}','${c.hex}')"></div>`).join('');
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
  const limit = ({square:150, story:140, landscape:125})[currentFormat] || 140;
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
  square:    { label:'800 × 800 px', w:800, h:800 },
  story:      { label:'450 × 800 px (Story 9:16)', w:450, h:800 },
  landscape: { label:'800 × 450 px (Paysage 16:9)', w:800, h:450 },
};

const CRITAIR_COLORS = { none:'', E:'#1e9e4a','1':'#7b3f9e','2':'#e0b400','3':'#e67e22','4':'#8e2430','5':'#6b7580' };
const GARANTIE_COLORS = { 'Garantie 12 mois':'#1b3f8b','Garantie 24 mois':'#0f2a5c','Première main':'#ee3524','Entretien à jour':'#4f6b3f','Certifié constructeur':'#2f80b7' };
const DEFAULTS = ['Limiteur et régulateur','Ordinateur de bord','Kit mains libres Bluetooth','Caméra de recul'];

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

function init() {
  renderPalette();
  initFuelIcons();
  initAccordion();
  loadLogo();
  loadSettings();
  DEFAULTS.forEach(o => addOption(o));
  selectFuel(currentFuel, false);
  selectFormat(currentFormat, false);
  selectFont(currentFont, false);
  selectCritair(currentCritair, false);
  updateCard();
  initSortable();
  scaleCardToFit();
}

const PERSIST_IDS = ['dealer','phone','address','cYear','cBadge','cStats','cOptions','cFooter','cFin'];

function saveSettings() {
  const s = {};
  PERSIST_IDS.forEach(k => { const el = document.getElementById(k); if(el) s[k] = el.value; });
  s.pal = 5;
  s.fuel = currentFuel;
  s.font = currentFont;
  s.format = currentFormat;
  s.critair = currentCritair;
  s.darkCard = document.getElementById('darkCard').checked;
  s.showBadge = document.getElementById('showBadge').checked;
  try { localStorage.setItem('acs_settings_v2', JSON.stringify(s)); } catch(e){}
}

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('acs_settings_v2') || 'null');
    if (!s) return;
    PERSIST_IDS.forEach(k => { if (s.pal !== 5 && COLOR_IDS.includes(k)) return; const el = document.getElementById(k); if(el && s[k] !== undefined) el.value = s[k]; });
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
  document.querySelectorAll('.format-pill').forEach(p => p.classList.toggle('active', p.dataset.format === f));
  const card = document.getElementById('card');
  card.classList.remove('story','landscape'); if (f !== 'square') card.classList.add(f);
  fitRibbon(document.getElementById('badge').value);
  card.style.width = FORMATS[f].w + 'px';
  card.style.height = FORMATS[f].h + 'px';
  document.getElementById('previewFormatLabel').textContent = FORMATS[f].label;
  scaleCardToFit();
  if (save) saveSettings();
}

function selectFont(f, save=true) {
  currentFont = f;
  document.querySelectorAll('.font-pill').forEach(p => p.classList.toggle('active', p.dataset.font === f));
  const card = document.getElementById('card');
  card.style.setProperty('--card-heading-font', FONTS[f].heading);
  card.style.setProperty('--card-body-font', FONTS[f].body);
  if (save) saveSettings();
}

function selectFuel(f, save=true) {
  currentFuel = f;
  document.querySelectorAll('.fuel-pill').forEach(p => p.classList.toggle('active', p.dataset.fuel === f));
  document.getElementById('cFuelLabel').textContent = FUELS[f].label;
  document.getElementById('cFuelIco').innerHTML = FUELS[f].svg;
  if (save) saveSettings();
}

function selectCritair(c, save=true) {
  currentCritair = c;
  document.querySelectorAll('.critair-swatch').forEach(s => s.classList.toggle('active', s.dataset.critair === c));
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

document.getElementById('logoInput').addEventListener('change', function(e) {
  const file = e.target.files[0]; if(!file) return;
  const r = new FileReader();
  r.onload = ev => { applyLogo(ev.target.result); saveLogo(ev.target.result); };
  r.readAsDataURL(file);
});

function applyLogo(src) {
  const img = document.getElementById('cLogoImg');
  img.src = src; img.style.display = 'block';
  document.getElementById('logoPreviewImg').src = src;
  document.getElementById('logoPreview').classList.add('on');
}

function saveLogo(src) {
  try { localStorage.setItem('acs_logo', src); showSaved(); } catch(e){}
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

function showSaved() {
  const b = document.getElementById('savedBadge');
  b.classList.add('on');
  setTimeout(() => b.classList.remove('on'), 3000);
}

function setupDrop(zoneId, cb) {
  const z = document.getElementById(zoneId);
  z.addEventListener('dragover', e => { e.preventDefault(); z.style.borderColor='var(--accent)'; });
  z.addEventListener('dragleave', () => { z.style.borderColor=''; });
  z.addEventListener('drop', e => {
    e.preventDefault(); z.style.borderColor='';
    const f = e.dataTransfer.files[0];
    if(f && f.type.startsWith('image/')) { const r = new FileReader(); r.onload = ev => cb(ev.target.result); r.readAsDataURL(f); }
  });
}
setupDrop('logoZone', src => { applyLogo(src); saveLogo(src); });
setupDrop('vehicleZone', src => { rawVehicleImageSrc = src; applyVehicleImage(src); });

document.getElementById('vehicleInput').addEventListener('change', function(e) {
  const f = e.target.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = ev => { rawVehicleImageSrc = ev.target.result; applyVehicleImage(ev.target.result); };
  r.readAsDataURL(f);
});

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
    const ratios = { square:16/9, story:3/2, landscape:16/9 };
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

function addOption(val='') {
  const list = document.getElementById('optionsList');
  if (list.querySelectorAll('.option-row').length >= 4) return;
  const row = document.createElement('div');
  row.className = 'option-row';
  row.innerHTML = `<input type="text" placeholder="Ex: GPS intégré" value="${val}" oninput="updateCard()">
    <button class="btn-del" onclick="this.parentElement.remove();updateCard()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
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
const g = id => document.getElementById(id);
const v = id => g(id).value;

function updateCard() {
  g('cBrand').textContent   = v('brand');
  g('cYearChip').textContent = v('year');
  g('cYearChip').style.background = v('cYear');
  g('cPrice').textContent   = v('price');
  g('cPower').textContent   = v('power');
  g('cMileage').textContent = v('mileage');
  g('cTx').innerHTML        = v('transmission').replace(/\n/g,'<br>');
  g('cTxWrap').style.background = v('cStats');
  g('cBadgeInner').style.background = v('cBadge');
  g('cBadgeWrap').style.display = g('showBadge').checked ? '' : 'none';
  fitRibbon(v('badge'));
  g('cDealer').textContent  = v('dealer');
  g('cPhone').textContent   = v('phone');
  g('cAddress').textContent = v('address');
  g('cFooterBar').style.background = v('cFooter');

  const showFin = g('showFin').checked;
  g('cFinancement').style.display = showFin ? 'flex' : 'none';
  g('cFinAmount').textContent = v('finAmount');
  g('cFinLegal').textContent  = v('finLegal');
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
  grid.innerHTML = '';
  const c = v('cOptions');
  inputs.forEach(inp => {
    if(!inp.value.trim()) return;
    const item = document.createElement('div');
    item.className = 'opt-item';
    item.innerHTML = `<span class="opt-check" style="background:${c}"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span><span>${inp.value}</span>`;
    grid.appendChild(item);
  });
  document.querySelectorAll('.preset').forEach(p => p.classList.toggle('active', (g(p.dataset.target).value || '').toLowerCase() === p.dataset.hex));
  const addBtn = document.querySelector('.btn-add');
  if(addBtn) addBtn.style.display = inputs.length >= 4 ? 'none' : 'flex';
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

async function downloadCard(type='jpg') {
  const btn = type === 'jpg' ? document.getElementById('dlBtn') : document.getElementById('dlBtnPng');
  const orig = btn.innerHTML;
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;animation:spin 1s linear infinite"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity=".3"/><path d="M21 12a9 9 0 00-9-9"/></svg> Génération…`;
  btn.disabled = true;

  const card = document.getElementById('card');
  const savedTransform = card.style.transform;
  const savedMargin = card.style.marginBottom;
  card.style.transform = '';
  card.style.marginBottom = '';

  document.querySelectorAll('.sort-handle').forEach(h => h.style.display = 'none');
  const svgs = card.querySelectorAll('svg');
  svgs.forEach(s => { s.style.color = getComputedStyle(s).color; });

  try {
    const canvas = await html2canvas(card, {
      scale: 2, useCORS: true, allowTaint: true,
      backgroundColor: type === 'png' ? null : '#ffffff',
      logging: false,
      width: card.offsetWidth,
      height: card.offsetHeight,
    });
    const a = document.createElement('a');
    const ext = type === 'png' ? 'png' : 'jpg';
    const fmt = currentFormat !== 'square' ? `-${currentFormat}` : '';
    a.download = `annonce-vehicule${fmt}.${ext}`;
    a.href = type === 'png' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.95);
    a.click();
  } catch(e) { alert('Erreur lors de la génération.'); console.error(e); }

  document.querySelectorAll('.sort-handle').forEach(h => h.style.display = '');
  card.querySelectorAll('svg').forEach(s => s.style.removeProperty('color'));
  card.style.transform = savedTransform;
  card.style.marginBottom = savedMargin;
  btn.disabled = false;
  btn.innerHTML = orig;
}

init();
if (document.fonts) document.fonts.ready.then(updateCard);