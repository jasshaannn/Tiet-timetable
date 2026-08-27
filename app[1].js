// ---------- helpers ----------
const DAY_ORDER = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
const DAY_SHORT = {MONDAY:'MON',TUESDAY:'TUE',WEDNESDAY:'WED',THURSDAY:'THU',FRIDAY:'FRI',SATURDAY:'SAT'};

function classify(subject){
  if(!subject) return 'other';
  const s = subject.trim();
  if(/^[A-Z]{2,6}\d{2,4}[A-Z]$/.test(s)){
    const last = s[s.length-1];
    if(last==='L') return 'lecture';
    if(last==='P') return 'practical';
    if(last==='T') return 'tutorial';
  }
  if(/^LAB/i.test(s)) return 'practical';
  return 'other';
}

function fmtTime(t){
  // t like "08:00" -> "8:00 AM"
  let [h,m] = t.split(':').map(Number);
  const ap = h>=12 ? 'PM':'AM';
  let h12 = h%12; if(h12===0) h12=12;
  return `${h12}:${String(m).padStart(2,'0')} ${ap}`;
}
function timeToMinutes(t){ const [h,m]=t.split(':').map(Number); return h*60+m; }

const TYPE_LABEL = {lecture:'LECTURE', practical:'PRACTICAL', tutorial:'TUTORIAL', other:'SESSION'};

// ---------- state ----------
let DATA = null;
const els = {};

function $(id){ return document.getElementById(id); }

async function init(){
  DATA = window.TT_DATA;
  els.yearSelect = $('yearSelect');
  els.branchSelect = $('branchSelect');
  els.batchSelect = $('batchSelect');
  els.searchInput = $('searchInput');
  els.grid = $('grid');
  els.emptyState = $('emptyState');
  els.batchMeta = $('batchMeta');
  els.legend = $('legend');

  populateYears();
  els.yearSelect.addEventListener('change', ()=>{ populateBranches(); populateBatches(); render(); });
  els.branchSelect.addEventListener('change', ()=>{ populateBatches(); render(); });
  els.batchSelect.addEventListener('change', render);
  els.searchInput.addEventListener('input', onSearch);

  populateBranches();
  populateBatches();
  render();
}

function populateYears(){
  const years = Object.keys(DATA);
  // keep original file order
  els.yearSelect.innerHTML = years.map(y=>`<option value="${escapeAttr(y)}">${escapeHtml(y)}</option>`).join('');
}

function currentYearData(){
  return DATA[els.yearSelect.value] || {};
}

function populateBranches(){
  const yd = currentYearData();
  const branches = [...new Set(Object.values(yd).map(b=>b.branch))].sort();
  els.branchSelect.innerHTML = branches.map(b=>`<option value="${escapeAttr(b)}">${escapeHtml(titleCase(b))}</option>`).join('');
}

function populateBatches(){
  const yd = currentYearData();
  const branch = els.branchSelect.value;
  const codes = Object.keys(yd).filter(c=>yd[c].branch===branch).sort();
  els.batchSelect.innerHTML = codes.map(c=>`<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join('');
}

function onSearch(){
  const q = els.searchInput.value.trim().toUpperCase();
  if(!q){ return; }
  // search across all years/branches for a matching batch code
  for(const [year, batches] of Object.entries(DATA)){
    if(batches[q]){
      els.yearSelect.value = year;
      populateBranches();
      els.branchSelect.value = batches[q].branch;
      populateBatches();
      els.batchSelect.value = q;
      render();
      return;
    }
  }
}

function titleCase(s){
  return s.toLowerCase().replace(/\b\w/g, c=>c.toUpperCase());
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escapeAttr(s){ return escapeHtml(s); }

function render(){
  const yd = currentYearData();
  const code = els.batchSelect.value;
  const info = yd[code];
  els.grid.innerHTML = '';
  if(!info){
    els.emptyState.style.display = 'flex';
    els.batchMeta.textContent = '';
    return;
  }
  els.emptyState.style.display = 'none';
  els.batchMeta.innerHTML = `<span class="meta-batch">${escapeHtml(code)}</span><span class="meta-sep">&middot;</span><span class="meta-branch">${escapeHtml(titleCase(info.branch))}</span>`;

  const daysPresent = DAY_ORDER.filter(d=>info.days[d] && info.days[d].length);
  if(daysPresent.length===0){
    els.emptyState.style.display = 'flex';
    els.emptyState.querySelector('p').textContent = 'No sessions found for this batch.';
    return;
  }

  // union of times used, sorted
  const timeSet = new Set();
  daysPresent.forEach(d=> info.days[d].forEach(it=> timeSet.add(it.time)));
  const times = [...timeSet].sort((a,b)=>timeToMinutes(a)-timeToMinutes(b));

  // build lookup day->time->list
  const lookup = {};
  daysPresent.forEach(d=>{
    lookup[d] = {};
    info.days[d].forEach(it=>{
      (lookup[d][it.time] = lookup[d][it.time] || []).push(it);
    });
  });

  const table = document.createElement('div');
  table.className = 'timetable';
  table.style.setProperty('--num-days', daysPresent.length);

  // header row
  const headRow = document.createElement('div');
  headRow.className = 'row head-row';
  headRow.appendChild(makeCell('corner-cell',''));
  daysPresent.forEach(d=>{
    const c = document.createElement('div');
    c.className = 'day-head';
    c.textContent = DAY_SHORT[d];
    headRow.appendChild(c);
  });
  table.appendChild(headRow);

  times.forEach(t=>{
    const row = document.createElement('div');
    row.className = 'row';
    const timeCell = document.createElement('div');
    timeCell.className = 'time-cell';
    timeCell.innerHTML = `<span>${fmtTime(t)}</span>`;
    row.appendChild(timeCell);

    daysPresent.forEach(d=>{
      const cell = document.createElement('div');
      cell.className = 'day-cell';
      const items = (lookup[d] && lookup[d][t]) || [];
      items.forEach(it=>{
        cell.appendChild(makeCard(it));
      });
      row.appendChild(cell);
    });
    table.appendChild(row);
  });

  els.grid.appendChild(table);
}

function makeCell(cls, text){
  const c = document.createElement('div');
  c.className = cls;
  c.textContent = text;
  return c;
}

function makeCard(item){
  const type = classify(item.subject);
  const card = document.createElement('div');
  card.className = `card card--${type}`;
  const label = document.createElement('div');
  label.className = 'card-label';
  label.textContent = TYPE_LABEL[type];
  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = item.subject;
  card.appendChild(label);
  card.appendChild(title);
  if(item.room){
    const room = document.createElement('div');
    room.className = 'card-room';
    room.textContent = item.room;
    card.appendChild(room);
  }
  return card;
}

document.addEventListener('DOMContentLoaded', init);
