/* 盘点差异助手前端：原生 JavaScript，无构建步骤。 */
"use strict";

const state = {
  items: [],
  summary: { total: 0, counted: 0, remaining: 0, with_diff: 0, shelves: [], categories: [] },
  reasonCodes: [],
  pendingOverwrite: null, // {sku, qty}
  reasonTarget: null,     // sku
};

// ---------- 工具 ----------

async function api(path, options = {}) {
  const resp = await fetch(path, options);
  if (!resp.ok) {
    let detail = `请求失败（${resp.status}）`;
    try {
      const body = await resp.json();
      detail = typeof body.detail === "string" ? body.detail : (body.detail && body.detail.message) || detail;
      if (resp.status === 409 && body.detail && body.detail.sku) {
        const err = new Error(detail);
        err.conflict = body.detail;
        throw err;
      }
    } catch (e) {
      if (e.conflict) throw e;
    }
    throw new Error(detail);
  }
  return resp.json();
}

function toast(msg, isError = false) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast" + (isError ? " error" : "");
  setTimeout(() => el.classList.add("hidden"), 2600);
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function diffCell(diff) {
  if (diff === null || diff === undefined) return '<td class="pending">未盘</td>';
  if (diff > 0) return `<td class="diff-pos">+${diff}</td>`;
  if (diff < 0) return `<td class="diff-neg">${diff}</td>`;
  return '<td class="diff-zero">0</td>';
}

// ---------- 数据加载 ----------

async function refresh() {
  const data = await api("/api/items");
  state.items = data.items;
  state.summary = data.summary;
  state.reasonCodes = data.reason_codes;
  renderImport();
  renderCount();
  renderFilters();
  await renderDiff();
  await renderReview();
}

// ---------- ① 商品清单 ----------

function renderImport() {
  document.getElementById("items-count").textContent = state.summary.total ? `${state.summary.total} 种商品` : "";
  const tbody = document.querySelector("#items-table tbody");
  tbody.innerHTML = state.items.map(it => `
    <tr><td>${esc(it.sku)}</td><td>${esc(it.name)}</td><td>${esc(it.category)}</td>
        <td>${esc(it.shelf)}</td><td>${it.book_qty}</td></tr>`).join("");
}

async function importCsv() {
  const file = document.getElementById("csv-file").files[0];
  if (!file) { toast("请先选择 CSV 文件", true); return; }
  const form = new FormData();
  form.append("file", file);
  try {
    const res = await api("/api/import", { method: "POST", body: form });
    document.getElementById("import-status").textContent = `已导入 ${res.imported} 种商品，开始新一轮盘点。`;
    toast(`导入成功：${res.imported} 种商品`);
    await refresh();
  } catch (e) { toast(e.message, true); }
}

async function loadSample() {
  try {
    const res = await api("/api/sample", { method: "POST" });
    document.getElementById("import-status").textContent = `已载入样例：${res.imported} 种商品。`;
    toast(`已载入样例（${res.imported} 种商品）`);
    await refresh();
  } catch (e) { toast(e.message, true); }
}

async function resetAll() {
  if (!confirm("确定清空全部商品与盘点数据吗？")) return;
  await api("/api/reset", { method: "POST" });
  document.getElementById("import-status").textContent = "";
  toast("已清空");
  await refresh();
}

// ---------- ② 盘点录入 ----------

function renderCount() {
  const s = state.summary;
  const pct = s.total ? Math.round((s.counted / s.total) * 100) : 0;
  document.getElementById("progress-bar").style.width = pct + "%";
  document.getElementById("progress-text").textContent =
    s.total ? `已盘 ${s.counted} / ${s.total}（${pct}%），有差异 ${s.with_diff} 项` : "尚未导入商品清单";
  const tbody = document.querySelector("#count-table tbody");
  tbody.innerHTML = state.items.map(it => `
    <tr>
      <td>${esc(it.sku)}</td><td>${esc(it.name)}</td><td>${esc(it.shelf)}</td>
      <td>${it.book_qty}</td>
      <td>${it.actual_qty === null ? '<span class="pending">—</span>' : it.actual_qty}</td>
      ${diffCell(it.diff)}
      <td>${it.counted_at ? esc(it.counted_at.replace("T", " ").slice(0, 19)) : "—"}</td>
      <td>${it.actual_qty === null ? "" : `<button class="secondary" data-clear="${esc(it.sku)}">撤销</button>`}</td>
    </tr>`).join("");
  tbody.querySelectorAll("[data-clear]").forEach(btn =>
    btn.addEventListener("click", () => clearCount(btn.dataset.clear)));
}

async function submitCount(confirmOverwrite) {
  const sku = document.getElementById("scan-sku").value.trim();
  const qtyStr = document.getElementById("scan-qty").value.trim();
  if (!sku) { toast("请输入 SKU", true); return; }
  if (qtyStr === "" || Number(qtyStr) < 0 || !Number.isInteger(Number(qtyStr))) {
    toast("实盘数量必须是非负整数", true); return;
  }
  const qty = Number(qtyStr);
  try {
    await api("/api/count", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku, qty, confirm_overwrite: !!confirmOverwrite }),
    });
    hideOverwrite();
    document.getElementById("scan-sku").value = "";
    document.getElementById("scan-qty").value = "";
    document.getElementById("scan-sku").focus();
    toast(`已录入 ${sku}：实盘 ${qty}`);
    await refresh();
  } catch (e) {
    if (e.conflict) {
      state.pendingOverwrite = { sku: e.conflict.sku, qty: e.conflict.new_qty };
      document.getElementById("overwrite-text").textContent =
        `${e.conflict.name}（${e.conflict.sku}）已录入实盘 ${e.conflict.existing_qty}，` +
        `本次数量为 ${e.conflict.new_qty}。系统未覆盖原数据，确认后才会改写。`;
      document.getElementById("overwrite-box").classList.remove("hidden");
    } else {
      toast(e.message, true);
    }
  }
}

function hideOverwrite() {
  state.pendingOverwrite = null;
  document.getElementById("overwrite-box").classList.add("hidden");
}

async function clearCount(sku) {
  try {
    await api(`/api/count/${encodeURIComponent(sku)}`, { method: "DELETE" });
    toast(`已撤销 ${sku} 的录入`);
    await refresh();
  } catch (e) { toast(e.message, true); }
}

// ---------- ③ 差异查看 ----------

function renderFilters() {
  for (const [id, values] of [["filter-shelf", state.summary.shelves], ["filter-category", state.summary.categories]]) {
    const sel = document.getElementById(id);
    const cur = sel.value;
    sel.innerHTML = '<option value="">全部</option>' + values.map(v => `<option>${esc(v)}</option>`).join("");
    sel.value = values.includes(cur) ? cur : "";
  }
}

async function renderDiff() {
  const shelf = document.getElementById("filter-shelf").value;
  const category = document.getElementById("filter-category").value;
  const params = new URLSearchParams();
  if (shelf) params.set("shelf", shelf);
  if (category) params.set("category", category);
  const data = await api("/api/differences?" + params.toString());

  const groupRow = g => `
    <tr><td>${esc(g.name)}</td><td>${g.total}</td><td>${g.counted}</td>
        <td>${g.book_qty}</td><td>${g.actual_qty}</td>${diffCell(g.diff)}<td>${g.diff_items}</td></tr>`;
  document.querySelector("#shelf-table tbody").innerHTML = data.by_shelf.map(groupRow).join("");
  document.querySelector("#category-table tbody").innerHTML = data.by_category.map(groupRow).join("");

  const onlyDiff = document.getElementById("filter-only-diff").checked;
  const rows = data.items.filter(it => !onlyDiff || it.diff);
  document.querySelector("#diff-table tbody").innerHTML = rows.map(it => `
    <tr class="clickable" data-sku="${esc(it.sku)}">
      <td>${esc(it.sku)}</td><td>${esc(it.name)}</td><td>${esc(it.category)}</td><td>${esc(it.shelf)}</td>
      <td>${it.book_qty}</td>
      <td>${it.actual_qty === null ? '<span class="pending">未盘</span>' : it.actual_qty}</td>
      ${diffCell(it.diff)}
      <td>${it.reason ? esc(it.reason) : '<span class="pending">未登记</span>'}</td>
    </tr>`).join("");
  document.querySelectorAll("#diff-table [data-sku]").forEach(tr =>
    tr.addEventListener("click", () => openReasonDialog(tr.dataset.sku)));
}

function openReasonDialog(sku) {
  const item = state.items.find(it => it.sku === sku);
  if (!item) return;
  state.reasonTarget = sku;
  document.getElementById("reason-sku").textContent = `${item.name}（${sku}）`;
  document.getElementById("reason-select").innerHTML =
    '<option value="">（清除原因）</option>' +
    state.reasonCodes.map(c => `<option${c === item.reason ? " selected" : ""}>${esc(c)}</option>`).join("");
  document.getElementById("reason-note").value = item.reason_note || "";
  document.getElementById("reason-dialog").classList.remove("hidden");
  document.getElementById("reason-dialog").scrollIntoView({ behavior: "smooth" });
}

async function saveReason() {
  if (!state.reasonTarget) return;
  try {
    await api("/api/reason", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sku: state.reasonTarget,
        reason: document.getElementById("reason-select").value,
        note: document.getElementById("reason-note").value,
      }),
    });
    document.getElementById("reason-dialog").classList.add("hidden");
    state.reasonTarget = null;
    toast("差异原因已保存");
    await refresh();
  } catch (e) { toast(e.message, true); }
}

// ---------- ④ 复盘表 ----------

async function renderReview() {
  const data = await api("/api/review");
  document.getElementById("review-summary").textContent =
    `差异 ${data.rows.length} 项（合计 ${data.total_diff >= 0 ? "+" : ""}${data.total_diff}），` +
    `未登记原因 ${data.missing_reason} 项，未盘点 ${data.uncounted} 项。`;
  document.querySelector("#review-table tbody").innerHTML = data.rows.map(it => `
    <tr class="${it.reason ? "" : "missing-reason"}">
      <td>${esc(it.sku)}</td><td>${esc(it.name)}</td><td>${esc(it.category)}</td><td>${esc(it.shelf)}</td>
      <td>${it.book_qty}</td><td>${it.actual_qty}</td>${diffCell(it.diff)}
      <td>${it.reason ? esc(it.reason) : '<span class="pending">未登记</span>'}</td>
      <td>${esc(it.reason_note)}</td>
    </tr>`).join("");
}

// ---------- 事件绑定 ----------

document.querySelectorAll(".tab").forEach(btn =>
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
    document.getElementById("tab-" + btn.dataset.tab).classList.remove("hidden");
    if (btn.dataset.tab === "count") document.getElementById("scan-sku").focus();
  }));

document.getElementById("btn-import").addEventListener("click", importCsv);
document.getElementById("btn-sample").addEventListener("click", loadSample);
document.getElementById("btn-reset").addEventListener("click", resetAll);

document.getElementById("btn-count").addEventListener("click", () => submitCount(false));
document.getElementById("scan-qty").addEventListener("keydown", e => {
  if (e.key === "Enter") submitCount(false);
});
document.getElementById("scan-sku").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("scan-qty").focus();
});
document.getElementById("btn-overwrite-yes").addEventListener("click", () => submitCount(true));
document.getElementById("btn-overwrite-no").addEventListener("click", hideOverwrite);

document.getElementById("filter-shelf").addEventListener("change", renderDiff);
document.getElementById("filter-category").addEventListener("change", renderDiff);
document.getElementById("filter-only-diff").addEventListener("change", renderDiff);

document.getElementById("btn-reason-save").addEventListener("click", saveReason);
document.getElementById("btn-reason-cancel").addEventListener("click", () => {
  document.getElementById("reason-dialog").classList.add("hidden");
  state.reasonTarget = null;
});

refresh().catch(e => toast(e.message, true));
