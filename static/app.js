const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const state = {
  windows: [],
  schedules: [],
  selectedSlot: null,
  currentAppointment: null,
  editingSchedule: null,
  dashboardTimer: null,
};

const statusLabels = {
  booked: '已预约',
  called: '已叫号',
  late: '迟到',
  completed: '已完成',
  cancelled: '已取消',
  no_show: '爽约',
};

function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function timeLabel(value) {
  return String(value || '').slice(0, 5);
}

function setText(el, text) {
  el.textContent = text == null ? '' : String(text);
}

function showNotice(el, message, kind = 'ok') {
  el.textContent = message;
  el.className = kind === 'error' ? 'notice error' : kind === 'warn' ? 'notice warn' : 'notice';
}

function hideNotice(el) {
  el.className = 'notice hidden';
  el.textContent = '';
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    ...options,
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `请求失败（${response.status}）`);
  }
  return data;
}

function optionHTML(value, label, selected = false) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  option.selected = selected;
  return option;
}

function windowLabel(windowItem) {
  return `${windowItem.name} · ${windowItem.service_name} · ${windowItem.duration_minutes}分钟`;
}

function fillWindowSelect(select, windows, selectedId = '') {
  select.replaceChildren();
  select.append(new Option('请选择窗口', ''));
  windows.forEach((item) => select.append(optionHTML(item.id, windowLabel(item), String(item.id) === String(selectedId))));
}

function badge(status) {
  return `<span class="status ${status}">${statusLabels[status] || status}</span>`;
}

function switchTab(name) {
  $$('.tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === name));
  $$('.tab-panel').forEach((panel) => panel.classList.toggle('active', panel.id === name));
  if (name === 'resident') {
    loadActiveWindows().then(loadBookingAvailability).catch((error) => {
      showNotice($('#booking-result'), error.message, 'error');
    });
  }
  if (name === 'staff') loadStaffData();
  if (name === 'dashboard') loadDashboard();
}

function setupChrome() {
  $('#today-date').textContent = todayISO();
  $('#today-time').textContent = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  $$('.tab').forEach((button) => button.addEventListener('click', () => switchTab(button.dataset.tab)));
}

function setupDateDefaults() {
  const today = todayISO();
  ['#booking-date', '#reschedule-date', '#schedule-date', '#dashboard-date'].forEach((selector) => {
    $(selector).value = today;
    $(selector).min = today;
  });
}

async function loadActiveWindows() {
  state.windows = await api('/api/windows');
  fillWindowSelect($('#booking-window'), state.windows);
  fillWindowSelect($('#reschedule-window'), state.windows);
}

function renderSlots(slots) {
  const wrap = $('#slots-wrap');
  wrap.replaceChildren();
  if (!slots.length) {
    wrap.className = 'slots-grid empty';
    wrap.append('该开放时间内没有可生成的时段。');
    return;
  }
  wrap.className = 'slots-grid';
  slots.forEach((slot) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `slot ${slot.available ? 'available' : 'taken'}`;
    button.disabled = !slot.available;
    button.innerHTML = `<span class="slot-time">${slot.starts_at} - ${slot.ends_at}</span>
      <span class="slot-meta">${slot.available ? '可预约' : `已占用 ${slot.reference || ''}`}</span>`;
    if (slot.available) {
      button.addEventListener('click', () => {
        state.selectedSlot = slot;
        $$('.slot', wrap).forEach((item) => item.classList.remove('selected'));
        button.classList.add('selected');
      });
    }
    wrap.append(button);
  });
  state.selectedSlot = null;
}

async function loadBookingAvailability() {
  const windowId = $('#booking-window').value;
  const dateValue = $('#booking-date').value;
  const wrap = $('#slots-wrap');
  if (!windowId || !dateValue) {
    wrap.className = 'slots-grid empty';
    wrap.replaceChildren();
    wrap.append('请先选择窗口和日期。');
    return;
  }
  wrap.className = 'slots-grid empty';
  wrap.replaceChildren();
  wrap.append('正在读取空档...');
  try {
    const data = await api(`/api/availability?window_id=${windowId}&schedule_date=${dateValue}`);
    renderSlots(data.slots);
  } catch (error) {
    wrap.className = 'slots-grid empty';
    wrap.replaceChildren();
    wrap.append(error.message);
  }
}

function setupResidentEvents() {
  $('#booking-window').addEventListener('change', loadBookingAvailability);
  $('#booking-date').addEventListener('change', loadBookingAvailability);
  $('#booking-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const result = $('#booking-result');
    if (!state.selectedSlot) {
      showNotice(result, '请先选择一个绿色空档。', 'warn');
      return;
    }
    try {
      const appointment = await api('/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          window_id: Number($('#booking-window').value),
          schedule_date: $('#booking-date').value,
          starts_at: state.selectedSlot.starts_at,
          note: $('#booking-note').value.trim() || null,
        }),
      });
      showNotice(result, `预约成功。你的匿名编号是：${appointment.reference}\n请保存编号，改期或取消时需要输入。`);
      $('#booking-note').value = '';
      await loadBookingAvailability();
    } catch (error) {
      showNotice(result, error.message, 'error');
    }
  });

  $('#lookup-form').addEventListener('submit', (event) => {
    event.preventDefault();
    lookupCurrentAppointment();
  });
  $('#reschedule-window').addEventListener('change', loadRescheduleSlots);
  $('#reschedule-date').addEventListener('change', loadRescheduleSlots);
  $('#reschedule-btn').addEventListener('click', rescheduleCurrentAppointment);
  $('#cancel-booking-btn').addEventListener('click', cancelCurrentAppointment);
}

function renderCurrentAppointment(appointment) {
  state.currentAppointment = appointment;
  const detail = $('#appointment-detail');
  detail.className = 'detail-box';
  detail.replaceChildren();
  const title = document.createElement('strong');
  title.textContent = `编号 ${appointment.reference} · ${statusLabels[appointment.status]}`;
  const lines = [
    `${appointment.window_name}（${appointment.service_name}）`,
    `${appointment.schedule_date} ${timeLabel(appointment.starts_at)} - ${timeLabel(appointment.ends_at)}`,
    appointment.note ? `备注：${appointment.note}` : '无备注',
  ];
  detail.append(title);
  lines.forEach((line) => {
    const p = document.createElement('div');
    p.textContent = line;
    detail.append(p);
  });

  const canManage = appointment.status === 'booked';
  $('#manage-area').classList.toggle('hidden', !canManage);
  if (canManage) {
    fillWindowSelect($('#reschedule-window'), state.windows, appointment.window_id);
    $('#reschedule-date').value = appointment.schedule_date;
    loadRescheduleSlots();
  }
}

async function lookupCurrentAppointment() {
  const reference = $('#lookup-reference').value.trim().toUpperCase();
  const message = $('#resident-message');
  hideNotice(message);
  if (!/^[A-Z0-9]{6}$/.test(reference)) {
    showNotice(message, '请输入 6 位预约编号。', 'warn');
    return;
  }
  try {
    const appointment = await api(`/api/appointments/lookup/${encodeURIComponent(reference)}`);
    renderCurrentAppointment(appointment);
  } catch (error) {
    state.currentAppointment = null;
    $('#manage-area').classList.add('hidden');
    const detail = $('#appointment-detail');
    detail.className = 'detail-empty';
    detail.textContent = error.message;
  }
}

async function loadRescheduleSlots() {
  const select = $('#reschedule-slot');
  select.replaceChildren();
  const appointment = state.currentAppointment;
  const windowId = $('#reschedule-window').value;
  const dateValue = $('#reschedule-date').value;
  if (!appointment || !windowId || !dateValue) return;
  try {
    const data = await api(`/api/availability?window_id=${windowId}&schedule_date=${dateValue}`);
    const available = data.slots.filter((slot) => slot.available);
    available.forEach((slot) => {
      const selected = String(windowId) === String(appointment.window_id)
        && dateValue === appointment.schedule_date && slot.starts_at === appointment.starts_at;
      select.append(optionHTML(slot.starts_at, `${slot.starts_at} - ${slot.ends_at}`, selected));
    });
    if (!available.length) select.append(new Option('当天没有空档', ''));
  } catch (error) {
    select.append(new Option(error.message, ''));
  }
}

async function rescheduleCurrentAppointment() {
  const message = $('#resident-message');
  const startsAt = $('#reschedule-slot').value;
  if (!startsAt) {
    showNotice(message, '请选择一个可用空档。', 'warn');
    return;
  }
  try {
    const appointment = await api(`/api/appointments/lookup/${state.currentAppointment.reference}/reschedule`, {
      method: 'POST',
      body: JSON.stringify({
        window_id: Number($('#reschedule-window').value),
        schedule_date: $('#reschedule-date').value,
        starts_at,
      }),
    });
    showNotice(message, '改期成功。');
    renderCurrentAppointment(appointment);
  } catch (error) {
    showNotice(message, error.message, 'error');
    loadRescheduleSlots();
  }
}

async function cancelCurrentAppointment() {
  const message = $('#resident-message');
  if (!window.confirm('确认取消这个预约？取消后该空档会立即开放。')) return;
  try {
    const appointment = await api(`/api/appointments/lookup/${state.currentAppointment.reference}/cancel`, { method: 'POST' });
    showNotice(message, '预约已取消。');
    renderCurrentAppointment(appointment);
  } catch (error) {
    showNotice(message, error.message, 'error');
  }
}

async function loadStaffData() {
  try {
    const [windows, schedules] = await Promise.all([
      api('/api/windows?include_inactive=true'),
      api(`/api/schedules?include_inactive=true&schedule_date=${$('#schedule-date').value || todayISO()}`),
    ]);
    state.windows = windows;
    state.schedules = schedules;
    fillWindowSelect($('#schedule-window'), windows);
    renderWindows(windows);
    renderSchedules(schedules);
  } catch (error) {
    showNotice($('#window-message'), error.message, 'error');
  }
}

function renderWindows(windows) {
  const body = $('#windows-table');
  body.replaceChildren();
  windows.forEach((item) => {
    const tr = document.createElement('tr');
    const name = document.createElement('td');
    name.textContent = item.name;
    const service = document.createElement('td');
    service.textContent = item.service_name;
    const duration = document.createElement('td');
    duration.textContent = `${item.duration_minutes} 分钟`;
    const stateCell = document.createElement('td');
    stateCell.innerHTML = item.is_active
      ? '<span class="status booked">启用</span>'
      : '<span class="status cancelled">停用</span>';
    const actions = document.createElement('td');
    const toggle = document.createElement('button');
    toggle.className = 'small';
    toggle.textContent = item.is_active ? '停用' : '启用';
    toggle.addEventListener('click', () => toggleWindow(item));
    actions.append(toggle);
    tr.append(name, service, duration, stateCell, actions);
    body.append(tr);
  });
}

async function toggleWindow(item) {
  hideNotice($('#window-message'));
  try {
    await api(`/api/windows/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: !item.is_active }),
    });
    await Promise.all([loadStaffData(), loadActiveWindows()]);
  } catch (error) {
    showNotice($('#window-message'), error.message, 'error');
  }
}

function setupWindowForm() {
  $('#window-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = $('#window-message');
    try {
      await api('/api/windows', {
        method: 'POST',
        body: JSON.stringify({
          name: $('#window-name').value.trim(),
          service_name: $('#window-service').value.trim(),
          duration_minutes: Number($('#window-duration').value),
          is_active: $('#window-active').checked,
        }),
      });
      event.target.reset();
      $('#window-duration').value = 20;
      $('#window-active').checked = true;
      showNotice(message, '窗口已新增。');
      await Promise.all([loadStaffData(), loadActiveWindows()]);
    } catch (error) {
      showNotice(message, error.message, 'error');
    }
  });
}

function renderSchedules(schedules) {
  const body = $('#schedules-table');
  body.replaceChildren();
  if (!schedules.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.textContent = '所选日期暂无配置。';
    td.style.color = 'var(--muted)';
    tr.append(td);
    body.append(tr);
    return;
  }
  schedules.forEach((item) => {
    const tr = document.createElement('tr');
    const dateCell = document.createElement('td');
    dateCell.textContent = item.schedule_date;
    const windowCell = document.createElement('td');
    windowCell.textContent = `${item.window_name}\n${item.service_name}`;
    windowCell.style.whiteSpace = 'pre-line';
    const timeCell = document.createElement('td');
    timeCell.textContent = `${item.opens_at} - ${item.closes_at}`;
    const actions = document.createElement('td');
    const edit = document.createElement('button');
    edit.className = 'small';
    edit.textContent = '修改';
    edit.addEventListener('click', () => openScheduleEdit(item));
    const remove = document.createElement('button');
    remove.className = 'small danger';
    remove.textContent = '删除';
    remove.addEventListener('click', () => removeSchedule(item));
    actions.append(edit, remove);
    tr.append(dateCell, windowCell, timeCell, actions);
    body.append(tr);
  });
}

function setupScheduleForm() {
  $('#schedule-date').addEventListener('change', loadStaffData);
  $('#schedule-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = $('#schedule-message');
    try {
      await api('/api/schedules', {
        method: 'POST',
        body: JSON.stringify({
          window_id: Number($('#schedule-window').value),
          schedule_date: $('#schedule-date').value,
          opens_at: $('#schedule-open').value,
          closes_at: $('#schedule-close').value,
        }),
      });
      showNotice(message, '每日时段已保存。');
      await loadStaffData();
    } catch (error) {
      showNotice(message, error.message, 'error');
    }
  });
}

function openScheduleEdit(item) {
  state.editingSchedule = item;
  $('#edit-schedule-title').textContent = `${item.schedule_date} · ${item.window_name}`;
  $('#edit-open').value = item.opens_at;
  $('#edit-close').value = item.closes_at;
  $('#edit-schedule-dialog').showModal();
}

function setupScheduleEdit() {
  const dialog = $('#edit-schedule-dialog');
  $('#edit-schedule-form').addEventListener('submit', async (event) => {
    if (event.submitter && event.submitter.value === 'cancel') return;
    event.preventDefault();
    const item = state.editingSchedule;
    try {
      await api(`/api/schedules/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({ opens_at: $('#edit-open').value, closes_at: $('#edit-close').value }),
      });
      dialog.close();
      await loadStaffData();
      showNotice($('#schedule-message'), '开放时间已修改。');
    } catch (error) {
      showNotice($('#schedule-message'), error.message, 'error');
    }
  });
}

async function removeSchedule(item) {
  if (!window.confirm(`确认删除 ${item.schedule_date} ${item.window_name} 的开放时段？`)) return;
  try {
    await api(`/api/schedules/${item.id}`, { method: 'DELETE' });
    await loadStaffData();
  } catch (error) {
    showNotice($('#schedule-message'), error.message, 'error');
  }
}

function setupDashboardEvents() {
  $('#dashboard-refresh').addEventListener('click', loadDashboard);
  $('#dashboard-date').addEventListener('change', loadDashboard);
}

function setStatus(appointment, status) {
  return api(`/api/appointments/${appointment.id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}

function renderDashboard(data) {
  const active = data.queue.filter((item) => ['booked', 'called', 'late', 'completed'].includes(item.status));
  const counts = {
    booked: data.queue.filter((item) => item.status === 'booked').length,
    called: data.queue.filter((item) => item.status === 'called').length,
    late: data.queue.filter((item) => item.status === 'late').length,
    no_show: data.queue.filter((item) => item.status === 'no_show').length,
    completed: data.queue.filter((item) => item.status === 'completed').length,
  };
  $('#dashboard-summary').innerHTML = `
    <div class="metric"><span>有效预约</span><strong>${active.length}</strong></div>
    <div class="metric"><span>等待叫号</span><strong>${counts.booked}</strong></div>
    <div class="metric"><span>已叫号</span><strong>${counts.called}</strong></div>
    <div class="metric"><span>迟到 / 爽约</span><strong>${counts.late} / ${counts.no_show}</strong></div>
    <div class="metric"><span>已完成</span><strong>${counts.completed}</strong></div>
  `;

  const root = $('#dashboard-content');
  root.replaceChildren();
  if (!data.windows.length) {
    const empty = document.createElement('div');
    empty.className = 'detail-empty';
    empty.textContent = '当天还没有开放任何服务窗口。';
    root.append(empty);
    return;
  }

  const byWindow = new Map(data.windows.map((item) => [item.window_id, []]));
  data.queue.forEach((item) => {
    if (byWindow.has(item.window_id)) byWindow.get(item.window_id).push(item);
  });

  data.windows.forEach((windowData) => {
    const block = document.createElement('div');
    block.className = 'window-block';
    const h3 = document.createElement('h3');
    h3.append(`${windowData.window_name} · ${windowData.service_name}`);
    h3.insertAdjacentHTML('beforeend', ` ${badge('booked').replace('已预约', `${windowData.opens_at}-${windowData.closes_at}`)}`);
    block.append(h3);

    const gapTitle = document.createElement('p');
    const freeSlots = windowData.slots.filter((slot) => slot.available);
    gapTitle.textContent = freeSlots.length
      ? `空档（${windowData.duration_minutes} 分钟/人）：${freeSlots.map((slot) => slot.starts_at).join('、')}`
      : '当天固定空档均已占满。';
    gapTitle.style.color = 'var(--muted)';
    block.append(gapTitle);

    const list = document.createElement('div');
    list.className = 'queue-list';
    const items = byWindow.get(windowData.window_id) || [];
    if (!items.length) {
      const none = document.createElement('div');
      none.className = 'detail-empty';
      none.textContent = '暂无预约。';
      list.append(none);
    }
    items.forEach((appointment) => list.append(renderQueueItem(appointment)));
    block.append(list);
    root.append(block);
  });
}

function renderQueueItem(appointment) {
  const row = document.createElement('div');
  row.className = 'queue-item';
  const info = document.createElement('div');
  const main = document.createElement('strong');
  main.textContent = `${timeLabel(appointment.starts_at)} ${appointment.reference}`;
  const meta = document.createElement('div');
  meta.className = 'queue-meta';
  meta.textContent = `${timeLabel(appointment.starts_at)}-${timeLabel(appointment.ends_at)} · ${appointment.note || '无备注'}`;
  const statusWrap = document.createElement('div');
  statusWrap.style.marginTop = '0.35rem';
  statusWrap.insertAdjacentHTML('beforeend', badge(appointment.status));
  info.append(main, meta, statusWrap);

  const actions = document.createElement('div');
  actions.className = 'queue-actions';
  const addAction = (label, nextStatus, kind = '') => {
    const button = document.createElement('button');
    button.className = `small ${kind}`;
    button.textContent = label;
    button.addEventListener('click', async () => {
      try {
        await setStatus(appointment, nextStatus);
        await loadDashboard(false);
      } catch (error) {
        window.alert(error.message);
      }
    });
    actions.append(button);
  };

  if (appointment.status === 'booked') {
    addAction('叫号', 'called');
    addAction('迟到', 'late');
    addAction('爽约', 'no_show', 'danger');
  } else if (appointment.status === 'called') {
    addAction('完成', 'completed', 'primary');
    addAction('迟到', 'late');
    addAction('爽约', 'no_show', 'danger');
    addAction('恢复预约', 'booked');
  } else if (appointment.status === 'late') {
    addAction('完成', 'completed', 'primary');
    addAction('爽约', 'no_show', 'danger');
    addAction('恢复预约', 'booked');
  } else if (appointment.status === 'completed') {
    const done = document.createElement('span');
    done.className = 'status completed';
    done.textContent = '服务结束';
    actions.append(done);
  } else {
    const stopped = document.createElement('span');
    stopped.className = `status ${appointment.status}`;
    stopped.textContent = statusLabels[appointment.status];
    actions.append(stopped);
  }
  row.append(info, actions);
  return row;
}

async function loadDashboard(resetTimer = true) {
  const dateValue = $('#dashboard-date').value || todayISO();
  try {
    const data = await api(`/api/dashboard?schedule_date=${dateValue}`);
    renderDashboard(data);
    if (resetTimer) {
      clearInterval(state.dashboardTimer);
      state.dashboardTimer = setInterval(() => loadDashboard(false), 30000);
    }
  } catch (error) {
    $('#dashboard-content').innerHTML = '';
    const box = document.createElement('div');
    box.className = 'notice error';
    box.textContent = error.message;
    $('#dashboard-content').append(box);
  }
}

async function init() {
  setupChrome();
  setupDateDefaults();
  setupResidentEvents();
  setupWindowForm();
  setupScheduleForm();
  setupScheduleEdit();
  setupDashboardEvents();
  try {
    await loadActiveWindows();
    await loadBookingAvailability();
  } catch (error) {
    showNotice($('#booking-result'), error.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', init);
