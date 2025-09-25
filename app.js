/* ========= Storage ========= */
const LS_KEY = 'projetos_foco_v1';

function loadState(){
  try{
    return JSON.parse(localStorage.getItem(LS_KEY)) ?? [];
  }catch{ return []; }
}
function saveState(items){
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}

/* ========= Helpers ========= */
const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));
const uid = () => Math.random().toString(36).slice(2,9);

function fmtDate(iso){
  if(!iso) return '';
  const d = new Date(iso + 'T00:00:00'); // normaliza
  return d.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', year:'numeric'});
}

/* ========= State ========= */
let items = loadState(); // {id, title, notes, color, lane, order, due}

/* ========= Elements ========= */
const lanes = $$('.lane-drop');
const board = $('#board');
const badgeMax = document.querySelector('[data-count="max"]');
const badgeMid = document.querySelector('[data-count="mid"]');
const badgeMin = document.querySelector('[data-count="min"]');

const dlg = $('#projectDialog');
const form = $('#projectForm');
const dialogTitle = $('#dialogTitle');
const inpId = $('#projId');
const inpTitle = $('#projTitle');
const inpNotes = $('#projNotes');
const inpLane = $('#projLane');
const inpDue  = $('#projDue');
const inpColor= $('#projColor');
const colorRow = $('#colorRow');

const btnAdd = $('#btnAdd');
const btnClear = $('#btnClear');
const btnTheme = $('#btnTheme');
const tpl = $('#cardTemplate');

/* ========= Theme ========= */
const THEME_KEY = 'pf_theme';
(function initTheme(){
  const saved = localStorage.getItem(THEME_KEY);
  if(saved === 'light') document.documentElement.style.setProperty('color-scheme','light');
  if(saved === 'dark')  document.documentElement.style.setProperty('color-scheme','dark');
})();
btnTheme.addEventListener('click', () => {
  const cur = getComputedStyle(document.documentElement).getPropertyValue('color-scheme').trim();
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.style.setProperty('color-scheme', next);
  localStorage.setItem(THEME_KEY, next);
});

/* ========= Render ========= */
function render(){
  // limpa colunas
  lanes.forEach(l => l.innerHTML = '');
  // ordena por lane e order
  const byLane = {max:[], mid:[], min:[]};
  items.sort((a,b)=> (a.lane===b.lane ? a.order-b.order : 0))
       .forEach(it => byLane[it.lane]?.push(it));

  Object.entries(byLane).forEach(([lane, arr])=>{
    const container = document.querySelector(`.lane-drop[data-lane="${lane}"]`);
    arr.forEach(it => container.appendChild(renderCard(it)));
  });

  // badges
  badgeMax.textContent = byLane.max.length;
  badgeMid.textContent = byLane.mid.length;
  badgeMin.textContent = byLane.min.length;
}

function renderCard(it){
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.dataset.id = it.id;

  const pill = node.querySelector('[data-pill]');
  const title = node.querySelector('[data-title]');
  const notes = node.querySelector('[data-notes]');
  const due   = node.querySelector('[data-due]');

  title.textContent = it.title;
  notes.textContent = it.notes || '';
  notes.style.display = it.notes ? 'block' : 'none';

  if(it.color){
    pill.style.background = it.color;
    pill.style.borderColor = it.color + '88';
  }else{
    pill.style.background = 'transparent';
    pill.style.borderColor = 'rgba(255,255,255,.15)';
  }

  if(it.due){
    due.textContent = 'Prazo: ' + fmtDate(it.due);
  }else{
    due.textContent = '';
  }

  // ações
  node.querySelector('[data-edit]').addEventListener('click', () => openEdit(it.id));
  node.querySelector('[data-delete]').addEventListener('click', () => del(it.id));

  // Drag & Drop
  node.addEventListener('dragstart', onDragStart);
  node.addEventListener('dragend', onDragEnd);

  return node;
}

/* ========= CRUD ========= */
function add(data){
  const laneItems = items.filter(x => x.lane === data.lane);
  const maxOrder = laneItems.length ? Math.max(...laneItems.map(x=>x.order)) : 0;
  items.push({
    id: uid(),
    title: data.title.trim(),
    notes: data.notes?.trim() || '',
    color: data.color || '',
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
  items[i] = {...items[i], ...data};
  saveState(items);
  render();
}
function del(id){
  items = items.filter(x => x.id !== id);
  saveState(items);
  render();
}

/* ========= Dialog ========= */
btnAdd.addEventListener('click', () => openCreate());
function openCreate(){
  dialogTitle.textContent = 'Novo projeto';
  form.reset();
  inpId.value = '';
  selectColorButton('');
  if (!('showModal' in dlg)) return; // fallback simples
  dlg.showModal();
  setTimeout(()=> inpTitle.focus(), 50);
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
  selectColorButton(it.color || '');
  dlg.showModal();
}

form.addEventListener('submit', (e)=>{
  e.preventDefault();
  const data = {
    title: inpTitle.value,
    notes: inpNotes.value,
    lane: inpLane.value,
    due: inpDue.value,
    color: inpColor.value
  };
  if(!data.title.trim()) return;
  const id = inpId.value;
  if(id) update(id, data); else add(data);
  dlg.close();
});

// cor
colorRow.addEventListener('click', (e)=>{
  const btn = e.target.closest('.color-pick');
  if(!btn) return;
  selectColorButton(btn.dataset.color || '');
});
function selectColorButton(color){
  inpColor.value = color;
  $$('.color-pick').forEach(b => b.classList.toggle('active', (b.dataset.color||'') === color));
}

/* ========= Drag & Drop ========= */
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
    e.preventDefault(); // necessário para permitir drop
    lane.classList.add('over');

    // Reordenação visual (inserção antes/depois conforme posição do mouse)
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
    // Atualiza order conforme posição atual na DOM
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

// encontra o elemento imediatamente após a posição do mouse
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

/* ========= Limpar ========= */
btnClear.addEventListener('click', ()=>{
  const ok = confirm('Isso vai apagar todos os projetos. Deseja continuar?');
  if(!ok) return;
  items = [];
  saveState(items);
  render();
});

/* ========= Keyboard quick add ========= */
document.addEventListener('keydown', (e)=>{
  if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n'){
    e.preventDefault();
    openCreate();
  }
});

/* ========= Init (seeding) ========= */
if(items.length === 0){
  items = [
    {id:uid(), title:'Estudar Power BI (prioridade!)', notes:'Medidas DAX e boas práticas.\nCriar dashboard exemplo.', color:'#7c3aed', lane:'max', order:1, due:''},
    {id:uid(), title:'SQL Server', notes:'Praticar JOINS e CTEs.\nMontar queries de manutenção.', color:'#2563eb', lane:'mid', order:1, due:''},
    {id:uid(), title:'Python', notes:'Automação de relatórios.\nExplorar pandas.', color:'#059669', lane:'mid', order:2, due:''},
    {id:uid(), title:'Projeto Capivara Game', notes:'Ajustar parallax e colisões.', color:'#ea580c', lane:'min', order:1, due:''}
  ];
  saveState(items);
}
render();
