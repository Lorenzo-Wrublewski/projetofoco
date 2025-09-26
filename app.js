// LocalStorage keys
const LS_KEY    = 'projetos_foco_v1';
const THEME_KEY = 'pf_theme';


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

let items = [];

window.addEventListener('DOMContentLoaded', () => {
  const lanes = $$('.lane-drop');
  const badgeMax  = document.querySelector('[data-count="max"]');
  const badgeMid  = document.querySelector('[data-count="mid"]');
  const badgeMin  = document.querySelector('[data-count="min"]');
  const badgeNone = document.querySelector('[data-count="none"]');

  const dlg = $('#projectDialog');
  const form = $('#projectForm');
  const dialogTitle = $('#dialogTitle');
  const inpId = $('#projId');
  const inpTitle = $('#projTitle');
  const inpNotes = $('#projNotes');
  const inpLane = $('#projLane');
  const inpDue  = $('#projDue');

  const btnAdd = $('#btnAdd');
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
    });

    badgeMax.textContent  = byLane.max.length;
    badgeMid.textContent  = byLane.mid.length;
    badgeMin.textContent  = byLane.min.length;
    badgeNone.textContent = byLane.none.length;
  }

  function renderCard(it){
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.id = it.id;

    const pill  = node.querySelector('[data-pill]');
    const title = node.querySelector('[data-title]');
    const notes = node.querySelector('[data-notes]');
    const due   = node.querySelector('[data-due]');

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

    node.addEventListener('dragstart', onDragStart);
    node.addEventListener('dragend', onDragEnd);

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

  // Dialog
  btnAdd.addEventListener('click', () => openCreate());

  function openCreate(){
    dialogTitle.textContent = 'Novo projeto';
    form.reset();
    inpId.value = '';
    if (!('showModal' in dlg)) return;
    dlg.showModal();
    setTimeout(()=> inpTitle.focus(), 0);
  }
  function openEdit(id){
    const it = items.find(x => x.id === id);
    if(!it) return;
    dialogTitle.textContent = 'Editar projeto';
    inpId.value = it.id;
    inpTitle.value = it.title;
    inpNotes.value = it.notes || '';
    inpLane.value = it.lane;
    inpDue.value = it.due || '';
    dlg.showModal();
  }
  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const data = {
      title: inpTitle.value,
      notes: inpNotes.value,
      lane:  inpLane.value,
      due:   inpDue.value
    };
    if(!String(data.title).trim()) return;
    const id = inpId.value;
    if(id) update(id, data); else add(data);
    dlg.close();
  });

  // Drag & drop
  let dragId = null;

  function onDragStart(e){
    const el = e.currentTarget;
    dragId = el.dataset.id;
    el.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragId);
  }
  function onDragEnd(e){
    e.currentTarget.classList.remove('dragging');
    dragId = null;
  }

  lanes.forEach(lane => {
    lane.addEventListener('dragover', (e) => {
      e.preventDefault();
      lane.classList.add('over');

      const afterEl = getDragAfterElement(lane, e.clientY);
      const dragging = document.querySelector('.card.dragging');
      if(!dragging) return;
      if(afterEl == null) lane.appendChild(dragging);
      else lane.insertBefore(dragging, afterEl);
    });

    lane.addEventListener('dragleave', () => {
      lane.classList.remove('over');
    });

    lane.addEventListener('drop', (e) => {
      e.preventDefault();
      lane.classList.remove('over');
      const id = e.dataTransfer.getData('text/plain') || dragId;
      if(!id) return;

      const newLane = lane.dataset.lane;
      const siblings = $$('.card', lane);

      siblings.forEach((el, idx) => {
        const cid = el.dataset.id;
        const it = items.find(x => x.id === cid);
        if(!it) return;
        it.lane = newLane;
        it.order = idx + 1;
      });
      saveState(items);
      render();
    });
  });

  function getDragAfterElement(container, y){
    const els = [...container.querySelectorAll('.card:not(.dragging)')];
    return els.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height/2;
      if(offset < 0 && offset > closest.offset){
        return { offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  // Limpar tudo
  btnClear.addEventListener('click', ()=>{
    const ok = confirm('Isso vai apagar todos os projetos. Deseja continuar?');
    if(!ok) return;
    items = [];
    saveState(items);
    render();
  });

  // Atalho novo projeto
  document.addEventListener('keydown', (e)=>{
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n'){
      e.preventDefault();
      openCreate();
    }
  });

  // Boot
  items = loadState();

  // Inicializa "order" para cartões antigos, se faltar
  ['max','mid','min','none'].forEach(lname => {
    const laneItems = items.filter(x => x.lane === lname);
    if(laneItems.some(x => !Number.isFinite(x.order))){
      laneItems
        .sort((a,b)=> (a.title||'').localeCompare(b.title||'')) // estável
        .forEach((it, idx) => { it.order = idx + 1; });
    }
  });

  saveState(items);
  render();
});


