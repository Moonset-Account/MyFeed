"use strict";

const $ = (sel) => document.querySelector(sel);

async function api(path, options = {}) {
  const resp = await fetch(path, options);
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(data.detail || `请求失败（${resp.status}）`);
    err.status = resp.status;
    err.data = data;
    throw err;
  }
  return data;
}

function jsonPost(path, body) {
  return api(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------- 汇总 ----------
async function refreshSummary() {
  const { summary } = await api("/api/products");
  $("#summary").textContent = summary.total === 0
    ? "尚未导入商品清单"
    : `共 ${summary.total} 项，已盘 ${summary.counted}，未盘 ${summary.uncounted}，差异 ${summary.diff_items} 项（净差异 ${summary.diff_qty}）`;
}

// ---------- 导入 ----------
async function importCsvText(text) {
  const result = await jsonPost("/api/products/import", { csv_text: text });
  alert(`导入成功：${result.imported} 个商品`);
  await refreshAll();
}

$("#csv-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    await importCsvText(await file.text());
  } catch (err) {
    alert(err.message);
  }
  e.target.value = "";
});

$("#btn-import-text").addEventListener("click", async () => {
  const text = $("#csv-text").value.trim();
  if (!text) return alert("请先粘贴 CSV 内容");
  try {
    await importCsvText(text);
    $("#csv-text").value = "";
  } catch (err) {
    alert(err.message);
  }
});

$("#btn-sample").addEventListener("click", async () => {
  const result = await api("/api/sample", { method: "POST" });
  alert(`已载入样例：${result.imported} 个商品`);
  await refreshAll();
});

$("#btn-reset").addEventListener("click", async () => {
  if (!confirm("确定清空当前盘点并重新开始吗？")) return;
  await api("/api/reset", { method: "POST" });
  await refreshAll();
});

// ---------- 录入实盘 ----------
let pendingCount = null;

async function submitCount(overwrite) {
  const sku = $("#scan-sku").value.trim();
  const qtyRaw = $("#scan-qty").value.trim();
  const feedback = $("#count-feedback");
  if (!sku || qtyRaw === "") {
    feedback.className = "feedback err";
    feedback.textContent = "请填写货号和实盘数量";
    return;
  }
  const qty = Number(qtyRaw);
  if (!Number.isInteger(qty) || qty < 0) {
    feedback.className = "feedback err";
    feedback.textContent = "实盘数量必须是不小于 0 的整数";
    return;
  }
  try {
    const { item } = await jsonPost("/api/count", { sku, qty, overwrite });
    feedback.className = "feedback ok";
    feedback.textContent = `已录入：${item.name}（${item.sku}）实盘 ${item.actual_qty}，差异 ${item.diff}`;
    $("#scan-sku").value = "";
    $("#scan-qty").value = "";
    $("#scan-sku").focus();
    await refreshAll();
  } catch (err) {
    if (err.status === 409 && err.data && err.data.conflict) {
      // 重复扫码：弹窗确认，绝不悄悄覆盖
      pendingCount = { sku, qty };
      $("#conflict-msg").textContent =
        `商品 ${err.data.sku} 已录入数量 ${err.data.existing_qty}，本次数量为 ${err.data.new_qty}。是否覆盖？`;
      $("#conflict-dialog").showModal();
    } else {
      feedback.className = "feedback err";
      feedback.textContent = err.message;
    }
  }
}

$("#btn-count").addEventListener("click", () => submitCount(false));
$("#scan-qty").addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitCount(false);
});
$("#scan-sku").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("#scan-qty").focus();
});

$("#conflict-ok").addEventListener("click", async () => {
  $("#conflict-dialog").close();
  if (!pendingCount) return;
  $("#scan-sku").value = pendingCount.sku;
  $("#scan-qty").value = String(pendingCount.qty);
  pendingCount = null;
  await submitCount(true);
});
$("#conflict-cancel").addEventListener("click", () => {
  $("#conflict-dialog").close();
  pendingCount = null;
  const feedback = $("#count-feedback");
  feedback.className = "feedback";
  feedback.textContent = "已保留原数量";
});

// ---------- 差异查看 ----------
let diffBy = "shelf";

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", async () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    diffBy = btn.dataset.by;
    await refreshDiffs();
  });
});

function diffClass(item) {
  if (!item.counted) return "uncounted";
  if (item.diff > 0) return "diff-pos";
  if (item.diff < 0) return "diff-neg";
  return "";
}

function itemRow(item) {
  const actual = item.counted ? item.actual_qty : "未盘";
  const diff = item.counted ? item.diff : "";
  return `<tr class="${diffClass(item)}">
    <td>${esc(item.sku)}</td><td>${esc(item.name)}</td>
    <td>${item.system_qty}</td><td>${actual}</td>
    <td class="diff">${diff}</td>
    <td><input class="reason-input" data-sku="${esc(item.sku)}" value="${esc(item.reason)}" placeholder="差异原因"></td>
  </tr>`;
}

async function refreshDiffs() {
  const { groups } = await api(`/api/diffs?by=${diffBy}`);
  const view = $("#diff-view");
  if (groups.length === 0) {
    view.innerHTML = "<p class='hint'>暂无数据，请先导入商品清单。</p>";
    return;
  }
  view.innerHTML = groups.map((g) => `
    <div class="group-title">${esc(g.group)}</div>
    <div class="group-meta">共 ${g.total} 项，已盘 ${g.counted}，账面 ${g.system_qty}，实盘 ${g.actual_qty}，净差异 ${g.diff_qty}（差异 ${g.diff_items} 项）</div>
    <table>
      <thead><tr><th>货号</th><th>名称</th><th>账面</th><th>实盘</th><th>差异</th><th>差异原因</th></tr></thead>
      <tbody>${g.items.map(itemRow).join("")}</tbody>
    </table>`).join("");
  bindReasonInputs(view);
}

function bindReasonInputs(root) {
  root.querySelectorAll(".reason-input").forEach((input) => {
    input.addEventListener("change", async () => {
      try {
        await jsonPost("/api/reason", { sku: input.dataset.sku, reason: input.value });
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

// ---------- 复盘表 ----------
async function refreshReview() {
  const { rows } = await api("/api/review");
  const view = $("#review-view");
  if (rows.length === 0) {
    view.innerHTML = "<p class='hint'>暂无差异项。盘点有差异的商品会列在这里，按差异绝对值从大到小排列。</p>";
    return;
  }
  view.innerHTML = `<table>
    <thead><tr><th>货号</th><th>名称</th><th>类别</th><th>货架</th><th>账面</th><th>实盘</th><th>差异</th><th>差异原因</th></tr></thead>
    <tbody>${rows.map((r) => `<tr class="${diffClass(r)}">
      <td>${esc(r.sku)}</td><td>${esc(r.name)}</td><td>${esc(r.category)}</td><td>${esc(r.shelf)}</td>
      <td>${r.system_qty}</td><td>${r.actual_qty}</td><td class="diff">${r.diff}</td>
      <td><input class="reason-input" data-sku="${esc(r.sku)}" value="${esc(r.reason)}" placeholder="差异原因"></td>
    </tr>`).join("")}</tbody>
  </table>`;
  bindReasonInputs(view);
}

$("#btn-refresh-review").addEventListener("click", refreshReview);

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

async function refreshAll() {
  await Promise.all([refreshSummary(), refreshDiffs(), refreshReview()]);
}

refreshAll();
