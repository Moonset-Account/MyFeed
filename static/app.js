const form = document.querySelector('#batchForm');
const boxRows = document.querySelector('#boxRows');
const addBoxButton = document.querySelector('#addBox');
const packedTotal = document.querySelector('#packedTotal');
const harvestTotal = document.querySelector('#harvestTotal');
const weightInput = document.querySelector('#weightKg');
const formMessage = document.querySelector('#formMessage');
const lookupForm = document.querySelector('#lookupForm');
const lookupCode = document.querySelector('#lookupCode');
const lookupMessage = document.querySelector('#lookupMessage');
const boxResult = document.querySelector('#boxResult');
const exportLookup = document.querySelector('#exportLookup');
const batchTable = document.querySelector('#batchTable');
const refreshBatches = document.querySelector('#refreshBatches');

function todayISO() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

document.querySelector('#harvestDate').value = todayISO();

function setMessage(element, text, type) {
  element.textContent = text;
  element.className = `message ${type}`;
}

function clearMessage(element) {
  element.textContent = '';
  element.className = 'message';
}

function parseKilograms(value) {
  if (value.trim() === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

function updatePackedTotal() {
  let total = 0;
  for (const input of boxRows.querySelectorAll('[data-weight]')) {
    total += parseKilograms(input.value) || 0;
  }
  const harvest = parseKilograms(weightInput.value) || 0;
  packedTotal.textContent = total.toFixed(3).replace(/\.?0+$/, '');
  harvestTotal.textContent = harvest ? harvest.toFixed(3).replace(/\.?0+$/, '') : '0';
  packedTotal.parentElement.classList.toggle('over', total > harvest);
}

function addBoxRow(code = '', weight = '') {
  const row = document.createElement('div');
  row.className = 'box-row';

  const codeLabel = document.createElement('label');
  codeLabel.textContent = '箱号';
  const codeInput = document.createElement('input');
  codeInput.type = 'text';
  codeInput.name = 'box_code';
  codeInput.maxLength = 64;
  codeInput.value = code;
  codeInput.placeholder = '例如 A-001';
  codeInput.required = true;
  codeLabel.appendChild(codeInput);

  const weightLabel = document.createElement('label');
  weightLabel.textContent = '单箱重量（kg）';
  const weightBox = document.createElement('input');
  weightBox.type = 'number';
  weightBox.name = 'box_weight';
  weightBox.min = '0.001';
  weightBox.step = '0.001';
  weightBox.value = weight;
  weightBox.required = true;
  weightBox.dataset.weight = 'true';
  weightBox.addEventListener('input', updatePackedTotal);
  weightLabel.appendChild(weightBox);

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'button remove';
  removeButton.textContent = '移除';
  removeButton.addEventListener('click', () => {
    row.remove();
    updatePackedTotal();
  });

  row.append(codeLabel, weightLabel, removeButton);
  boxRows.appendChild(row);
}

function readBoxes() {
  return Array.from(boxRows.querySelectorAll('.box-row')).map((row) => ({
    code: row.querySelector('[name="box_code"]').value.trim(),
    weight_kg: row.querySelector('[name="box_weight"]').value,
  }));
}

async function saveBatch(event) {
  event.preventDefault();
  clearMessage(formMessage);

  const boxes = readBoxes();
  const seen = new Set();
  for (const box of boxes) {
    if (!box.code || seen.has(box.code)) {
      setMessage(formMessage, '请先补全箱号，并确保同一批次内箱号不重复。', 'error');
      return;
    }
    seen.add(box.code);
  }

  const payload = {
    parcel: document.querySelector('#parcel').value.trim(),
    variety: document.querySelector('#variety').value.trim(),
    harvest_date: document.querySelector('#harvestDate').value,
    weight_kg: weightInput.value,
    boxes,
  };

  try {
    const response = await fetch('/api/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(extractError(data));
    }
    form.reset();
    boxRows.innerHTML = '';
    document.querySelector('#harvestDate').value = todayISO();
    addBoxRow();
    updatePackedTotal();
    await loadBatches();
    setMessage(formMessage, '批次已保存。', 'ok');
  } catch (error) {
    setMessage(formMessage, error.message, 'error');
  }
}

function extractError(data) {
  if (!data) return '请求失败，请稍后重试。';
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((item) => {
        const location = Array.isArray(item.loc) ? item.loc.filter((part) => part !== 'body').join('.') : '';
        return location ? `${location}：${item.msg}` : item.msg;
      })
      .join('；');
  }
  return '请求失败，请检查输入。';
}

function resultRow(label, value) {
  const term = document.createElement('dt');
  term.textContent = label;
  const detail = document.createElement('dd');
  detail.textContent = value;
  return [term, detail];
}

async function lookupBox(event) {
  event.preventDefault();
  clearMessage(lookupMessage);
  boxResult.hidden = true;
  boxResult.innerHTML = '';
  exportLookup.classList.add('hidden');

  const code = lookupCode.value.trim();
  try {
    const response = await fetch(`/api/boxes?code=${encodeURIComponent(code)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(extractError(data));

    const rows = [
      resultRow('箱号', data.code),
      resultRow('来源批次', `#${data.batch_id}`),
      resultRow('地块', data.parcel),
      resultRow('品种', data.variety),
      resultRow('采收日期', data.harvest_date),
      resultRow('本箱重量', `${data.weight_kg} kg`),
      resultRow('批次采收量', `${data.batch_weight_kg} kg`),
      resultRow('已分装', `${data.packed_weight_kg} kg`),
      resultRow('剩余库存', `${data.remaining_kg} kg`),
    ];
    boxResult.append(...rows.flat());
    boxResult.hidden = false;
    exportLookup.href = `/api/export.csv?box_code=${encodeURIComponent(data.code)}`;
    exportLookup.classList.remove('hidden');
  } catch (error) {
    setMessage(lookupMessage, error.message, 'error');
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

async function loadBatches() {
  try {
    const response = await fetch('/api/batches');
    if (!response.ok) throw new Error('批次列表加载失败');
    const batches = await response.json();
    if (batches.length === 0) {
      batchTable.innerHTML = '<tr><td colspan="8" class="muted">暂无数据</td></tr>';
      return;
    }

    batchTable.innerHTML = batches.map((batch) => {
      const tags = batch.boxes
        .map((box) => `<span class="tag">${escapeHtml(box.code)} · ${escapeHtml(box.weight_kg)}kg</span>`)
        .join('');
      return `
        <tr>
          <td>${batch.id}</td>
          <td>${escapeHtml(batch.parcel)}</td>
          <td>${escapeHtml(batch.variety)}</td>
          <td>${escapeHtml(batch.harvest_date)}</td>
          <td>${escapeHtml(batch.weight_kg)}</td>
          <td>${escapeHtml(batch.packed_weight_kg)}</td>
          <td><strong>${escapeHtml(batch.remaining_kg)}</strong></td>
          <td><div class="box-tags">${tags}</div></td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    batchTable.innerHTML = `<tr><td colspan="8" class="muted">${escapeHtml(error.message)}</td></tr>`;
  }
}

addBoxButton.addEventListener('click', () => addBoxRow());
weightInput.addEventListener('input', updatePackedTotal);
form.addEventListener('submit', saveBatch);
lookupForm.addEventListener('submit', lookupBox);
refreshBatches.addEventListener('click', loadBatches);

addBoxRow();
updatePackedTotal();
loadBatches();
