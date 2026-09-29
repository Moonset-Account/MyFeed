"use strict";

const $ = (sel) => document.querySelector(sel);

function showMsg(el, text, ok) {
  el.textContent = text;
  el.className = "msg " + (ok ? "ok" : "err");
}

async function api(path, options) {
  const resp = await fetch(path, options);
  let data = null;
  try { data = await resp.json(); } catch (e) { /* 非 JSON 响应 */ }
  if (!resp.ok) {
    const detail = data && data.detail ? data.detail : `请求失败 (${resp.status})`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data;
}

async function loadBatches() {
  const batches = await api("/api/batches");
  const tbody = $("#batch-table tbody");
  tbody.innerHTML = "";
  for (const b of batches) {
    const tr = document.createElement("tr");
    tr.innerHTML =
      `<td>#${b.id}</td><td></td><td></td><td>${b.harvest_date}</td>` +
      `<td>${b.weight_kg}</td><td>${b.packed_kg}</td><td>${b.remaining_kg}</td>`;
    tr.children[1].textContent = b.plot;
    tr.children[2].textContent = b.variety;
    const td = document.createElement("td");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "link";
    btn.textContent = "分装";
    btn.disabled = b.remaining_kg <= 0;
    btn.addEventListener("click", () => openBoxForm(b));
    td.appendChild(btn);
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
}

function openBoxForm(batch) {
  const form = $("#box-form");
  form.classList.remove("hidden");
  form.elements.batch_id.value = batch.id;
  $("#box-batch-id").textContent = `#${batch.id}（${batch.plot} / ${batch.variety}）`;
  $("#box-remaining").textContent = batch.remaining_kg;
  form.elements.box_no.focus();
}

$("#box-cancel").addEventListener("click", () => {
  $("#box-form").classList.add("hidden");
});

$("#batch-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const form = ev.target;
  const msg = $("#batch-msg");
  const body = {
    plot: form.elements.plot.value,
    variety: form.elements.variety.value,
    harvest_date: form.elements.harvest_date.value,
    weight_kg: Number(form.elements.weight_kg.value),
  };
  try {
    const created = await api("/api/batches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    showMsg(msg, `批次 #${created.id} 登记成功`, true);
    form.reset();
    await loadBatches();
  } catch (e) {
    showMsg(msg, e.message, false);
  }
});

$("#box-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const form = ev.target;
  const msg = $("#box-msg");
  const batchId = form.elements.batch_id.value;
  const body = {
    box_no: form.elements.box_no.value,
    weight_kg: Number(form.elements.weight_kg.value),
  };
  try {
    const created = await api(`/api/batches/${batchId}/boxes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    showMsg(msg, `箱号 ${created.box_no} 分装成功`, true);
    form.reset();
    form.classList.add("hidden");
    await loadBatches();
  } catch (e) {
    showMsg(msg, e.message, false);
  }
});

$("#trace-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const boxNo = ev.target.elements.box_no.value.trim();
  const result = $("#trace-result");
  try {
    const t = await api(`/api/boxes/${encodeURIComponent(boxNo)}`);
    const b = t.batch;
    result.innerHTML = "";
    const dl = document.createElement("dl");
    const pairs = [
      ["箱号", t.box_no],
      ["箱重 (kg)", t.box_weight_kg],
      ["来源批次", `#${b.id}`],
      ["地块", b.plot],
      ["品种", b.variety],
      ["采收日期", b.harvest_date],
      ["批次采收量 (kg)", b.weight_kg],
      ["批次已分装 (kg)", b.packed_kg],
      ["批次剩余库存 (kg)", t.remaining_kg],
    ];
    for (const [k, v] of pairs) {
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = v;
      dl.append(dt, dd);
    }
    result.appendChild(dl);
  } catch (e) {
    result.textContent = e.message;
  }
});

loadBatches().catch((e) => showMsg($("#batch-msg"), e.message, false));
