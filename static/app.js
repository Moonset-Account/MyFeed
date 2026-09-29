const state = { rooms: [], cleaners: [], items: [], overview: {}, board: { tasks: [], finished: [], supplies: [] } };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: options.body ? { 'Content-Type': 'application/json' } : {},
    ...options,
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.detail || '请求失败');
  return data;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function toast(message, isError = false) {
  const node = $('#toast');
  node.textContent = message;
  node.className = isError ? 'toast error' : 'toast';
  node.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { node.hidden = true; }, 3200);
}

function statusClass(status) {
  if (['approved', 'passed'].includes(status)) return 'green';
  if (status === 'rejected') return 'red';
  if (['scheduled', 'waiting', 'assigned'].includes(status)) return 'amber';
  return 'blue';
}

function statusLabel(task) { return task.status_label; }
function roomStatus(room) { return room.status_label; }
const ACTION_LABELS = {
  created: '创建任务', checkout: '到退房时间', assigned: '分配人员', started: '开始清扫',
  completed: '提交复查', inspection_passed: '复查通过', inspection_rejected: '复查未通过',
  approved: '确认可入住', supply: '用品补充'
};
function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function setDefaultDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  $('#boardDate').value = local.toISOString().slice(0, 10);
  const pad = (n) => String(n).padStart(2, '0');
  const tomorrow = new Date(local);
  tomorrow.setDate(tomorrow.getDate() + 1);
  $('#checkoutAt').value = `${tomorrow.toISOString().slice(0, 10)}T11:00`;
}

async function loadAll() {
  const day = $('#boardDate').value;
  const [rooms, cleaners, items, overview, board] = await Promise.all([
    api('/api/rooms'), api('/api/cleaners'), api('/api/supply-items'),
    api('/api/overview'), api(`/api/board?day=${encodeURIComponent(day)}`)
  ]);
  Object.assign(state, { rooms, cleaners, items, overview, board });
  render();
}

function option(value, label, selected = '') {
  return `<option value="${esc(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${esc(label)}</option>`;
}

function render() {
  renderStats();
  renderSelects();
  renderTasks();
  renderRooms();
  renderCleaners();
  renderSupplies();
}

function renderStats() {
  const o = state.overview;
  const cards = [
    [o.rooms_total ?? 0, '全部房间'],
    [o.ready_rooms ?? 0, '空房可入住'],
    [o.waiting_count ?? 0, '待清扫/返工'],
    [o.overdue_count ?? 0, '已超时']
  ];
  $('#statsGrid').innerHTML = cards.map(([value, label]) => `<div class="stat-card"><strong>${value}</strong><span>${label}</span></div>`).join('');
}

function renderSelects() {
  const roomOptions = '<option value="">选择房间</option>' + state.rooms.map(r => option(r.id, `${r.name} · ${r.status_label}`)).join('');
  $('#taskRoom').innerHTML = roomOptions;
  $('#supplyRoom').innerHTML = '<option value="">不限房间/公共补充</option>' + state.rooms.map(r => option(r.id, r.name)).join('');
  $('#taskCleaner').innerHTML = '<option value="">到点后再分配</option>' + state.cleaners.filter(c => c.active).map(c => option(c.id, c.name)).join('');
  $('#supplyItem').innerHTML = '<option value="">选择用品</option>' + state.items.map(i => option(i.id, `${i.name}（${i.unit}）`)).join('');
}

function renderTasks() {
  const queue = $('#taskQueue');
  if (!state.board.tasks.length) {
    queue.innerHTML = '<div class="empty">当日没有待处理任务。退房时间到达后会自动进入队列。</div>';
  } else {
    queue.innerHTML = state.board.tasks.map(taskCard).join('');
  }
  const finished = $('#finishedList');
  if (!state.board.finished.length) {
    finished.innerHTML = '<div class="empty">今日还没有复查通过或可入住房间。</div>';
  } else {
    finished.innerHTML = state.board.finished.map(taskCard).join('');
  }
}

function taskActions(task) {
  const cleaners = state.cleaners.filter(c => c.active);
  const canAssign = ['waiting', 'assigned', 'rejected'].includes(task.status);
  const assign = canAssign ? `
    <select data-id="${task.id}" class="assign-select" aria-label="分配清扫人员">
      <option value="">分配人员</option>${cleaners.map(c => option(c.id, c.name, task.cleaner_id)).join('')}
    </select>` : '';
  const buttons = [];
  if (['waiting', 'assigned', 'rejected'].includes(task.status)) buttons.push(`<button data-action="start" data-id="${task.id}">开始清扫</button>`);
  if (task.status === 'in_progress') buttons.push(`<button data-action="complete" data-id="${task.id}">完成并复查</button>`);
  if (task.status === 'inspection') buttons.push(`<button data-action="inspect" data-id="${task.id}">填写复查</button>`);
  if (task.status === 'passed') buttons.push(`<button data-action="ready" data-id="${task.id}">标为空房</button>`);
  buttons.push(`<button class="secondary" data-action="history" data-room="${task.room_id}">房间历史</button>`);
  return `<div class="task-actions">${assign}${buttons.join('')}</div>`;
}

function taskCard(task) {
  const urgent = task.priority === 'overdue' || task.overdue_minutes > 0;
  const rework = task.status === 'rejected' || task.priority === 'overdue_recheck';
  return `<article class="task-card ${rework ? 'rework' : urgent ? 'urgent' : ''}">
    <div class="task-main">
      <div class="task-head">
        <span class="room-name">${esc(task.room_name)}</span>
        <span class="badge ${statusClass(task.status)}">${esc(statusLabel(task))}</span>
        <span class="badge ${rework ? 'red' : 'blue'}">${esc(task.priority_label || '')}</span>
      </div>
      <div class="meta">
        <span>退房：${esc(task.checkout_local)}</span>
        <span>人员：${esc(task.cleaner_name || '未分配')}</span>
        ${task.overdue_minutes ? `<span class="${task.status === 'rejected' ? '' : ''}">已超时 ${task.overdue_minutes} 分钟</span>` : ''}
      </div>
      ${task.inspection_note ? `<p class="muted">复查备注：${esc(task.inspection_note)}</p>` : ''}
    </div>
    ${taskActions(task)}
  </article>`;
}

function renderRooms() {
  const node = $('#roomList');
  if (!state.rooms.length) {
    node.innerHTML = '<div class="empty">先登记一个房间。</div>';
    return;
  }
  node.innerHTML = state.rooms.map(room => `
    <div class="room-item">
      <div class="room-top"><strong>${esc(room.name)}</strong><span class="badge ${statusClass(room.status)}">${esc(roomStatus(room))}</span></div>
      <div class="meta"><span>${esc(room.floor || '未设置区域')}</span>${room.latest_task ? `<span>最近退房 ${esc(room.latest_task.checkout_local)}</span>` : '<span>暂无清扫任务</span>'}</div>
      <div class="room-actions"><button class="ghost" data-action="history" data-room="${room.id}">查看历史</button></div>
    </div>`).join('');
}

function renderCleaners() {
  $('#cleanerList').innerHTML = state.cleaners.length
    ? state.cleaners.map(c => `<span class="chip">${esc(c.name)}${c.active ? '' : '（停用）'}</span>`).join('')
    : '<p class="muted">还没有清扫人员。</p>';
}

function renderSupplies() {
  $('#supplyDayHint').textContent = `${state.board.day} 的补充记录`;
  const node = $('#supplyList');
  const records = state.board.supplies || [];
  node.innerHTML = records.length ? records.map(record => `
    <div class="supply-record">
      <div><strong>${esc(record.supply_name)}</strong> × ${record.quantity}${esc(record.unit)} <span class="muted">${esc(record.room_name || '公共区域')}</span></div>
      <span class="muted">${esc(record.note || '')}</span>
    </div>`).join('') : '<div class="empty">当天暂无用品补充记录。</div>';
}

function openModal(title, html) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = html;
  $('#modalBackdrop').hidden = false;
}
function closeModal() { $('#modalBackdrop').hidden = true; }

async function showComplete(taskId) {
  const task = await api(`/api/tasks/${taskId}`);
  const html = `
    <p class="muted">勾选全部检查项后，任务会进入待复查。</p>
    <form id="completeForm" class="inspect-form">
      ${task.items.map(item => `
        <label class="check-item"><input type="checkbox" data-item="${item.id}" ${item.done ? 'checked' : ''}><span>${esc(item.label)}</span></label>`).join('')}
      <button type="submit">提交复查</button>
    </form>`;
  openModal(`${task.room_name} · 完成清扫`, html);
  $('#completeForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const boxes = $$('[data-item]', event.currentTarget);
    for (const box of boxes) {
      if (box.checked) await api(`/api/tasks/${taskId}/items/${box.dataset.item}`, { method: 'PATCH', body: JSON.stringify({ done: true }) });
      else await api(`/api/tasks/${taskId}/items/${box.dataset.item}`, { method: 'PATCH', body: JSON.stringify({ done: false }) });
    }
    await api(`/api/tasks/${taskId}/complete`, { method: 'POST', body: JSON.stringify({ actor: '清扫人员' }) });
    closeModal(); toast('已提交复查'); await loadAll();
  });
}

function showInspect(taskId) {
  openModal('房间复查', `
    <form id="inspectForm" class="inspect-form">
      <div class="segmented">
        <label><input type="radio" name="passed" value="true" checked>复查通过</label>
        <label><input type="radio" name="passed" value="false">未通过，返工整改</label>
      </div>
      <input name="inspector" maxlength="30" value="前台" placeholder="复查人">
      <textarea name="note" rows="4" maxlength="300" placeholder="复查说明；未通过时必须填写整改内容"></textarea>
      <button type="submit">提交复查结果</button>
    </form>`);
  $('#inspectForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api(`/api/tasks/${taskId}/inspect`, {
      method: 'POST',
      body: JSON.stringify({
        passed: form.get('passed') === 'true',
        inspector: form.get('inspector'),
        note: form.get('note')
      })
    });
    closeModal(); toast('复查结果已记录'); await loadAll();
  });
}

async function showHistory(roomId) {
  const data = await api(`/api/rooms/${roomId}/history`);
  const taskHtml = data.tasks.length ? data.tasks.map(task => `
    <div class="room-item">
      <div class="room-top"><strong>${esc(task.checkout_local)}</strong><span class="badge ${statusClass(task.status)}">${esc(task.status_label)}</span></div>
      <div class="meta"><span>${esc(task.cleaner_name || '未分配')}</span>${task.inspection_note ? `<span>${esc(task.inspection_note)}</span>` : ''}</div>
      <ul class="timeline">${task.events.slice(0, 5).map(e => `<li>${formatDateTime(e.created_at)} · ${esc(ACTION_LABELS[e.action] || e.action)} · ${esc(e.detail)}</li>`).join('')}</ul>
    </div>`).join('') : '<div class="empty">暂无历史任务。</div>';
  const supplyHtml = data.supplies.length ? data.supplies.map(s => `<li>${esc(s.local_date)} ${esc(s.supply_name)} × ${s.quantity}${esc(s.unit)}</li>`).join('') : '<li>暂无用品补充</li>';
  openModal(`${data.room.name} · 房间历史`, `<div>${taskHtml}</div><div class="history-section"><h2>用品历史</h2><ul class="timeline">${supplyHtml}</ul></div>`);
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const id = button.dataset.id;
  try {
    if (button.dataset.action === 'start') {
      await api(`/api/tasks/${id}/start`, { method: 'POST', body: JSON.stringify({ actor: '清扫人员' }) });
      toast('任务已开始');
    } else if (button.dataset.action === 'complete') {
      await showComplete(id); return;
    } else if (button.dataset.action === 'inspect') {
      showInspect(id); return;
    } else if (button.dataset.action === 'ready') {
      await api(`/api/tasks/${id}/ready`, { method: 'POST', body: JSON.stringify({ actor: '前台' }) });
      toast('房间已标记为空房可入住');
    } else if (button.dataset.action === 'history') {
      await showHistory(button.dataset.room); return;
    }
    await loadAll();
  } catch (error) { toast(error.message, true); }
});

document.addEventListener('change', async (event) => {
  if (!event.target.classList.contains('assign-select')) return;
  const cleanerId = event.target.value;
  if (!cleanerId) return;
  try {
    await api(`/api/tasks/${event.target.dataset.id}/assign`, {
      method: 'POST', body: JSON.stringify({ cleaner_id: Number(cleanerId) })
    });
    toast('清扫人员已分配'); await loadAll();
  } catch (error) { toast(error.message, true); event.target.value = ''; }
});

$('#roomForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const checklist = String(form.get('checklist') || '').split('\n').map(s => s.trim()).filter(Boolean);
  try {
    await api('/api/rooms', { method: 'POST', body: JSON.stringify({
      name: form.get('name'), floor: form.get('floor'), note: form.get('note'), checklist
    })});
    event.currentTarget.reset(); toast('房间已登记'); await loadAll();
  } catch (error) { toast(error.message, true); }
});

$('#cleanerForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    await api('/api/cleaners', { method: 'POST', body: JSON.stringify({ name: form.get('name') }) });
    event.currentTarget.reset(); toast('清扫人员已新增'); await loadAll();
  } catch (error) { toast(error.message, true); }
});

$('#taskForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const cleaner = form.get('cleaner_id');
  try {
    await api('/api/tasks', { method: 'POST', body: JSON.stringify({
      room_id: Number(form.get('room_id')),
      checkout_at: form.get('checkout_at'),
      cleaner_id: cleaner ? Number(cleaner) : null
    })});
    event.currentTarget.querySelector('select[name="room_id"]').value = '';
    toast('退房任务已登记'); await loadAll();
  } catch (error) { toast(error.message, true); }
});

$('#supplyForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const room = form.get('room_id');
  const item = form.get('supply_item_id');
  if (!item) return toast('请选择用品', true);
  try {
    await api('/api/supplies', { method: 'POST', body: JSON.stringify({
      room_id: room ? Number(room) : null,
      supply_item_id: Number(item),
      quantity: Number(form.get('quantity')),
      note: form.get('note')
    })});
    event.currentTarget.reset();
    event.currentTarget.querySelector('input[name="quantity"]').value = '1';
    toast('用品补充已记录'); await loadAll();
  } catch (error) { toast(error.message, true); }
});

$('#refreshBtn').addEventListener('click', () => loadAll().catch(error => toast(error.message, true)));
$('#boardDate').addEventListener('change', () => loadAll().catch(error => toast(error.message, true)));
$('#modalClose').addEventListener('click', closeModal);
$('#modalBackdrop').addEventListener('click', (event) => { if (event.target.id === 'modalBackdrop') closeModal(); });

setDefaultDate();
loadAll().catch(error => toast(error.message, true));
setInterval(() => loadAll().catch(() => {}), 60000);
