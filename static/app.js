const state = {
  windows: [],
  day: "",
  dashboard: null,
  bookingSlots: [],
  myAppointments: [],
  bookingRequest: 0
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

function toast(message, kind = "success") {
  const el = $("#toast");
  el.textContent = message;
  el.className = `toast ${kind}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add("hidden"), 3200);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    throw new Error(data?.detail || "请求失败，请稍后再试");
  }
  return data;
}

function queryString(params) {
  return new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== "")).toString();
}

function switchTab(tabName) {
  $$(".tab").forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tabName));
  $$(".panel").forEach((panel) => panel.classList.toggle("active", panel.id === tabName));
  if (tabName === "staff") loadDashboard();
}

$$(".tab").forEach((btn) => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));

async function loadWindows() {
  state.windows = await api("/api/windows");
  renderWindowOptions();
  renderWindowList();
}

function renderWindowOptions() {
  const bookingSelect = $('select[name="window_id"]');
  bookingSelect.innerHTML = state.windows.length
    ? state.windows.map((w) => `<option value="${w.id}">${escapeHTML(w.name)} · ${escapeHTML(w.service_name)}</option>`).join("")
    : '<option value="">暂无可预约窗口，请先配置</option>';
  updateBookingSlots();
}

async function updateBookingSlots() {
  const dateInput = $('input[name="date"]', $("#booking-form"));
  const windowSelect = $('select[name="window_id"]', $("#booking-form"));
  const slotSelect = $('select[name="start_time"]', $("#booking-form"));
  const windowId = Number(windowSelect.value);
  const day = dateInput.value;
  const selectedWindow = state.windows.find((w) => w.id === windowId);
  if (!selectedWindow || !day) {
    state.bookingSlots = [];
    slotSelect.innerHTML = '<option value="">请先选择窗口和日期</option>';
    return;
  }
  const requestId = ++state.bookingRequest;
  const data = await api(`/api/staff/day?${queryString({ date: day })}`);
  if (requestId !== state.bookingRequest) return;
  const used = new Set(data.gaps.filter((gap) => gap.window_id === windowId).map((gap) => gap.start_time));
  state.bookingSlots = selectedWindow.slots.map((start_time) => ({
    start_time,
    available: used.has(start_time)
  }));
  const available = state.bookingSlots.filter((slot) => slot.available);
  slotSelect.innerHTML = available.length
    ? available.map((slot) => `<option value="${slot.start_time}">${slot.start_time}</option>`).join("")
    : '<option value="">该日此窗口暂无可预约空档</option>';
}

$("#booking-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const result = $("#booking-result");
  const formData = Object.fromEntries(new FormData(form).entries());
  try {
    const appointment = await api("/api/appointments", {
      method: "POST",
      body: JSON.stringify({
        window_id: Number(formData.window_id),
        resident_code: formData.resident_code,
        date: formData.date,
        start_time: formData.start_time
      })
    });
    result.innerHTML = `<span class="ok">预约成功，叫号号码为 <strong>${escapeHTML(appointment.queue_number)}</strong>，时间 ${escapeHTML(appointment.date)} ${escapeHTML(appointment.start_time)}。</span>`;
    form.reset();
    setInitialDates();
    await loadWindows();
    toast("预约已提交");
  } catch (error) {
    result.innerHTML = `<span class="error">${escapeHTML(error.message)}</span>`;
  }
});

$('input[name="date"]', $("#booking-form")).addEventListener("change", updateBookingSlots);
$('select[name="window_id"]', $("#booking-form")).addEventListener("change", updateBookingSlots);

$("#lookup-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const code = new FormData(form).get("resident_code");
  try {
    state.myAppointments = await api(`/api/appointments/mine?${queryString({ resident_code: code })}`);
    renderMyAppointments(code);
  } catch (error) {
    toast(error.message, "error");
  }
});

function renderMyAppointments(residentCode) {
  const root = $("#my-appointments");
  if (!state.myAppointments.length) {
    root.innerHTML = '<div class="empty">未查询到当前或未来的有效预约。</div>';
    return;
  }
  root.innerHTML = state.myAppointments.map((item) => `
    <div class="appointment-card" data-id="${item.id}">
      <h3>${escapeHTML(item.queue_number)} <span class="status-pill ${item.status}">${escapeHTML(item.status_label)}</span></h3>
      <div class="appointment-meta">
        ${escapeHTML(item.date)} ${escapeHTML(item.start_time)}-${escapeHTML(item.end_time)}<br>
        ${escapeHTML(item.window_name)} · ${escapeHTML(item.service_name)}
      </div>
      <div class="card-actions">
        <button class="small secondary js-reschedule" type="button">改期</button>
        <button class="small danger js-cancel" type="button">取消</button>
      </div>
      <div class="reschedule-editor hidden"></div>
    </div>
  `).join("");

  $$(".js-cancel", root).forEach((button) => button.addEventListener("click", async () => {
    const card = button.closest(".appointment-card");
    if (!confirm("确认取消这条预约吗？")) return;
    try {
      await api(`/api/appointments/${card.dataset.id}/cancel`, { method: "POST" });
      toast("预约已取消");
      state.myAppointments = await api(`/api/appointments/mine?${queryString({ resident_code: residentCode })}`);
      renderMyAppointments(residentCode);
    } catch (error) {
      toast(error.message, "error");
    }
  }));

  $$(".js-reschedule", root).forEach((button) => button.addEventListener("click", () => openReschedule(button.closest(".appointment-card"), residentCode)));
}

async function openReschedule(card, residentCode) {
  const editor = $(".reschedule-editor", card);
  const appointment = state.myAppointments.find((item) => String(item.id) === card.dataset.id);
  editor.classList.remove("hidden");
  editor.innerHTML = `
    <form class="form-stack reschedule-form">
      <label>新日期<input type="date" name="date" min="${todayISO()}" value="${escapeHTML(appointment.date)}" required></label>
      <label>新窗口<select name="window_id" required>${state.windows.map((w) => `<option value="${w.id}" ${w.id === appointment.window_id ? "selected" : ""}>${escapeHTML(w.name)}</option>`).join("")}</select></label>
      <label>新空档<select name="start_time" required></select></label>
      <div class="button-row"><button class="small primary" type="submit">保存改期</button><button class="small secondary js-close" type="button">关闭</button></div>
    </form>
  `;
  const form = $(".reschedule-form", editor);
  async function refreshSlots() {
    const data = await api(`/api/staff/day?${queryString({ date: form.date.value })}`);
    const currentWindow = Number(form.window_id.value);
    const windowInfo = state.windows.find((w) => w.id === currentWindow);
    const freeSlots = data.gaps.filter((gap) => gap.window_id === currentWindow).map((gap) => gap.start_time);
    form.start_time.innerHTML = freeSlots.map((slot) => `<option value="${slot}">${slot}</option>`).join("") || '<option value="">暂无可选空档</option>';
    form.querySelector("[type=submit]").disabled = !windowInfo || freeSlots.length === 0;
  }
  form.date.addEventListener("change", refreshSlots);
  form.window_id.addEventListener("change", refreshSlots);
  $(".js-close", editor).addEventListener("click", () => editor.classList.add("hidden"));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api(`/api/appointments/${appointment.id}/reschedule`, {
        method: "POST",
        body: JSON.stringify({ window_id: Number(form.window_id.value), date: form.date.value, start_time: form.start_time.value })
      });
      toast("改期成功");
      editor.classList.add("hidden");
      state.myAppointments = await api(`/api/appointments/mine?${queryString({ resident_code: residentCode })}`);
      renderMyAppointments(residentCode);
    } catch (error) {
      toast(error.message, "error");
    }
  });
  await refreshSlots();
}

async function loadDashboard() {
  if (!state.day) state.day = todayISO();
  $('input[name="date"]', $("#day-form")).value = state.day;
  state.dashboard = await api(`/api/staff/day?${queryString({ date: state.day })}`);
  renderDashboard();
}

$("#day-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  state.day = new FormData(event.currentTarget).get("date");
  await loadDashboard();
});

function renderDashboard() {
  const data = state.dashboard;
  $("#day-summary").innerHTML = `
    <div class="metric"><span>服务窗口</span><strong>${data.summary.window_count}</strong></div>
    <div class="metric"><span>叫号预约</span><strong>${data.summary.appointment_count}</strong></div>
    <div class="metric"><span>剩余空档</span><strong>${data.summary.available_slot_count}</strong></div>
    <div class="metric"><span>迟到 / 爽约</span><strong>${data.status_counts.late} / ${data.status_counts.no_show}</strong></div>
  `;

  $("#queue-body").innerHTML = data.queue.length ? data.queue.map((item) => `
    <tr data-id="${item.id}">
      <td><span class="queue-number">${escapeHTML(item.queue_number)}</span></td>
      <td>${escapeHTML(item.start_time)}-${escapeHTML(item.end_time)}</td>
      <td>${escapeHTML(item.window_name)}<br><span class="appointment-meta">${escapeHTML(item.service_name)}</span></td>
      <td><span class="status-pill ${item.status}">${escapeHTML(item.status_label)}</span></td>
      <td><div class="action-group">
        <button class="small js-status" data-status="attended" type="button">到场</button>
        <button class="small js-status" data-status="late" type="button">迟到</button>
        <button class="small danger js-status" data-status="no_show" type="button">爽约</button>
        ${item.status !== "booked" ? '<button class="small secondary js-status" data-status="booked" type="button">重置为已预约</button>' : ""}
      </div></td>
    </tr>
  `).join("") : '<tr><td colspan="5" class="empty">当天暂无预约。</td></tr>';

  $("#gaps").innerHTML = data.gaps.length ? data.gaps.map((gap) => `
    <div class="gap-item">
      <span class="gap-time">${escapeHTML(gap.start_time)}-${escapeHTML(gap.end_time)}</span>
      <span class="gap-meta">${escapeHTML(gap.window_name)}<br>${escapeHTML(gap.service_name)}</span>
    </div>
  `).join("") : '<div class="empty">当天没有剩余空档。</div>';

  $$("#queue-body .js-status").forEach((button) => button.addEventListener("click", async () => {
    const row = button.closest("tr");
    try {
      await api(`/api/staff/appointments/${row.dataset.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: button.dataset.status })
      });
      await loadDashboard();
      toast("状态已登记");
    } catch (error) {
      toast(error.message, "error");
    }
  }));
}

function resetWindowForm() {
  const form = $("#window-form");
  form.reset();
  form.window_id.value = "";
  form.duration_minutes.value = "20";
  form.open_time.value = "09:00";
  form.close_time.value = "12:00";
  form.is_active.value = "true";
  $("#window-form-title").textContent = "新增服务窗口";
  $("#cancel-edit").classList.add("hidden");
}

function renderWindowList() {
  const root = $("#window-list");
  if (!state.windows.length) {
    root.innerHTML = '<div class="empty">尚未配置窗口。新增后居民即可预约。</div>';
    return;
  }
  root.innerHTML = state.windows.map((item) => `
    <div class="window-item" data-id="${item.id}">
      <div>
        <h3>${escapeHTML(item.name)} <span class="badge ${item.is_active ? "" : "inactive"}">${item.is_active ? "启用中" : "已停用"}</span></h3>
        <div class="window-meta">
          ${escapeHTML(item.service_name)}<br>
          ${item.duration_minutes} 分钟/人 · ${item.open_time}-${item.close_time}<br>
          每日 ${item.slots.length} 个可预约时段
        </div>
      </div>
      <div class="card-actions">
        <button class="small secondary js-edit" type="button">编辑</button>
        <button class="small danger js-delete" type="button">删除</button>
      </div>
    </div>
  `).join("");

  $$(".js-edit", root).forEach((button) => button.addEventListener("click", () => {
    const item = state.windows.find((w) => w.id === Number(button.closest(".window-item").dataset.id));
    const form = $("#window-form");
    form.window_id.value = item.id;
    form.name.value = item.name;
    form.service_name.value = item.service_name;
    form.duration_minutes.value = item.duration_minutes;
    form.open_time.value = item.open_time;
    form.close_time.value = item.close_time;
    form.is_active.value = String(item.is_active);
    $("#window-form-title").textContent = "编辑服务窗口";
    $("#cancel-edit").classList.remove("hidden");
    window.scrollTo({ top: form.offsetTop - 100, behavior: "smooth" });
  }));

  $$(".js-delete", root).forEach((button) => button.addEventListener("click", async () => {
    const item = state.windows.find((w) => w.id === Number(button.closest(".window-item").dataset.id));
    if (!confirm(`确认删除「${item.name}」吗？已有预约记录时将自动改为停用并保留历史。`)) return;
    try {
      const result = await api(`/api/windows/${item.id}`, { method: "DELETE" });
      toast(result.deactivated ? "窗口已停用，历史预约保留" : "窗口已删除");
      resetWindowForm();
      await Promise.all([loadWindows(), loadDashboard()]);
    } catch (error) {
      toast(error.message, "error");
    }
  }));
}

$("#window-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form).entries());
  const body = {
    name: values.name,
    service_name: values.service_name,
    duration_minutes: Number(values.duration_minutes),
    open_time: values.open_time,
    close_time: values.close_time,
    is_active: values.is_active === "true"
  };
  const id = values.window_id;
  try {
    await api(id ? `/api/windows/${id}` : "/api/windows", {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(body)
    });
    toast("窗口配置已保存");
    resetWindowForm();
    await Promise.all([loadWindows(), loadDashboard()]);
  } catch (error) {
    toast(error.message, "error");
  }
});

$("#cancel-edit").addEventListener("click", resetWindowForm);

function setInitialDates() {
  const today = todayISO();
  $('input[name="date"]', $("#booking-form")).value = today;
  $('input[name="date"]', $("#booking-form")).min = today;
  $('input[name="date"]', $("#day-form")).value = today;
  $('input[name="date"]', $("#day-form")).min = "";
}

async function init() {
  setInitialDates();
  state.day = todayISO();
  try {
    await Promise.all([loadWindows(), loadDashboard()]);
  } catch (error) {
    toast(error.message, "error");
  }
}

init();
