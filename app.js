// LocalStorage keys
const LS_KEY    = 'projetos_foco_v1';
const THEME_KEY = 'pf_theme';

// Helpers
function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  }catch{
    return [];
  }
}
function saveState(items){ localStorage.setItem(LS_KEY, JSON.stringify(items)); }

const uid = () => Math.random().toString(36).slice(2,9);
const $  = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));

function fmtDate(iso){
  if(!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
}

// Ordenação por coluna
const LANE_RANK = { max:0, mid:1, min:2, none:3 };

// CSS vars (respeita tema)
function cssVar(name){
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function laneColor(lane){
  if(lane === 'max')  return cssVar('--danger'); // vermelho
  if(lane === 'mid')  return cssVar('--warn');   // amarelo
  if(lane === 'min')  return cssVar('--ok');     // verde
  return cssVar('--neutral');                    // cinza (sem foco)
}

// THEME
function getSystemTheme(){
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applyTheme(theme){
  const html = document.documentElement;
  html.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);

  const btn = $('#btnTheme');
  if(btn){
    const isDark = theme === 'dark';
    btn.textContent = isDark ? '🌙' : '🌞';
    btn.title = isDark ? 'Tema escuro' : 'Tema claro';
    btn.setAttribute('aria-pressed', String(isDark));
  }
}

// STATE
let items = [];

window.addEventListener('DOMContentLoaded', () => {
  const lanes = $$('.lane-drop');
  const badges = {
    max:  $('[data-count="max"]'),
    mid:  $('[data-count="mid"]'),
    min:  $('[data-count="min"]'),
    none: $('[data-count="none"]'),
  };

  const dlg = $('#projectDialog');
  const form = $('#projectForm');
  const dialogTitle = $('#dialogTitle');
  const inpId = $('#projId');
  const inpTitle = $('#projTitle');
  const inpNotes = $('#projNotes');
  const inpLane = $('#projLane');
  const inpDue  = $('#projDue');

  const btnAdd = $('#btnAdd');
  const btnAddFab = $('#btnAddFab');
  const btnClear = $('#btnClear');
  const btnTheme = $('#btnTheme');
  const tpl = $('#cardTemplate');

  // Init Theme
  const savedTheme = localStorage.getItem(THEME_KEY);
  applyTheme(savedTheme || getSystemTheme());

  btnTheme.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || getSystemTheme();
    const next = cur === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });

  // Render
  function render(){
    lanes.forEach(l => l.innerHTML = '');

    const byLane = {max:[], mid:[], min:[], none:[]};
    items
      .slice()
      .sort((a,b) => {
        const lr = (LANE_RANK[a.lane]??99) - (LANE_RANK[b.lane]??99);
        if(lr !== 0) return lr;
        const ao = Number.isFinite(a.order) ? a.order : 0;
        const bo = Number.isFinite(b.order) ? b.order : 0;
        return ao - bo;
      })
      .forEach(it => { if(byLane[it.lane]) byLane[it.lane].push(it); });

    Object.entries(byLane).forEach(([lane, arr])=>{
      const container = document.querySelector(`.lane-drop[data-lane="${lane}"]`);
      arr.forEach(it => container.appendChild(renderCard(it)));
      badges[lane].textContent = arr.length;
    });
  }

  function renderCard(it){
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.id = it.id;

    const pill  = node.querySelector('[data-pill]');
    const title = node.querySelector('[data-title]');
    const notes = node.querySelector('[data-notes]');
    const due   = node.querySelector('[data-due]');
    const moveSelect = node.querySelector('.move-select');

    title.textContent = it.title;
    notes.textContent = it.notes || '';
    notes.style.display = it.notes ? 'block' : 'none';

    // COR AUTOMÁTICA PELO LANE
    const c = laneColor(it.lane);
    pill.style.backgroundColor = c;
    pill.style.borderColor = c;

    due.textContent = it.due ? ('Prazo: ' + fmtDate(it.due)) : '';

    node.querySelector('[data-edit]').addEventListener('click', () => openEdit(it.id));
    node.querySelector('[data-delete]').addEventListener('click', () => del(it.id));

    // Drag: desktop
    node.addEventListener('dragstart', onDragStart);
    node.addEventListener('dragend', onDragEnd);

    // Move rápido: mobile
    if(moveSelect){
      moveSelect.value = "";
      moveSelect.addEventListener('change', (e) => {
        const ln = e.target.value;
        if(!ln) return;
        moveToLane(it.id, ln);
        e.target.value = "";
      }, { passive: true });
    }

    return node;
  }

  // CRUD
  function add(data){
    const laneItems = items.filter(x => x.lane === data.lane);
    const maxOrder = laneItems.length ? Math.max(...laneItems.map(x=>Number.isFinite(x.order)?x.order:0)) : 0;
    items.push({
      id: uid(),
      title: String(data.title||'').trim(),
      notes: String(data.notes||'').trim(),
      lane: data.lane,
      order: maxOrder + 1,
      due: data.due || ''
    });
    saveState(items);
    render();
  }
  function update(id, data){
    const i = items.findIndex(x => x.id === id);
    if(i<0) return;
    items[i] = {
      ...items[i],
      ...data,
      title: String(data.title||'').trim(),
      notes: String(data.notes||'').trim()
    };
    saveState(items);
    render();
  }
  function del(id){
    items = items.filter(x => x.id !== id);
    saveState(items);
    render();
  }
  function moveToLane(id, newLane){
    const el = items.find(x => x.id === id);
    if(!el || !LANE_RANK.hasOwnProperty(newLane)) return;
    const laneItems = items.filter(x => x.lane === newLane);
    const maxOrder = laneItems.length ? Math.max(...laneItems.map(x=>Number.isFinite(x.order)?x.order:
