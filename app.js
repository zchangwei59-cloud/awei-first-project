(function () {
  'use strict';
  const STORAGE_KEY = 'accidentRepairRecords_v1';
  const fieldIds = ['plateNumber', 'carModel', 'orderNumber', 'status', 'repairItems', 'partsReplacement', 'headlightRepair', 'alloyRepair', 'notes'];
  const $ = (id) => document.getElementById(id);
  const form = $('repairForm');
  let records = loadRecords();

  function loadRecords() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  }

  function saveRecords() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[char]));
  }

  function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 1800);
  }

  function statusClass(status) {
    if (status === '已完成') return 'done';
    if (status === '维修中') return 'repairing';
    return '';
  }

  function detail(label, value) {
    if (!value) return '';
    return `<div class="detail-row"><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`;
  }

  function render() {
    const query = $('searchInput').value.trim().toLowerCase();
    const filtered = records.filter((item) => [item.plateNumber, item.carModel, item.orderNumber]
      .some((value) => String(value || '').toLowerCase().includes(query)));
    $('totalCount').textContent = records.length;
    $('repairingCount').textContent = records.filter((item) => item.status !== '已完成').length;
    $('doneCount').textContent = records.filter((item) => item.status === '已完成').length;
    $('recordCount').textContent = `${filtered.length} 条`;
    $('emptyState').hidden = filtered.length > 0;
    $('emptyState').querySelector('h3').textContent = query ? '没有找到相关记录' : '暂无维修记录';
    $('emptyState').querySelector('p').textContent = query ? '请尝试其他车牌、车型或工单号' : '填写上方信息，建立第一条车辆维修记录';
    $('recordsList').innerHTML = filtered.map((item) => {
      const cls = statusClass(item.status);
      const date = new Date(item.updatedAt).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
      return `<article class="record-card ${cls === 'done' ? 'done' : ''}">
        <div class="card-top"><div><div class="plate">${escapeHtml(item.plateNumber)}</div><div class="model">${escapeHtml(item.carModel)}</div></div><span class="status ${cls}">${escapeHtml(item.status)}</span></div>
        <div class="order">工单号：${escapeHtml(item.orderNumber)}</div>
        <dl class="details">${detail('维修项目', item.repairItems)}${detail('配件更换', item.partsReplacement)}${detail('大灯外修', item.headlightRepair)}${detail('铝合金外修', item.alloyRepair)}${detail('备注', item.notes)}</dl>
        <div class="card-footer"><span class="updated">更新于 ${date}</span><div class="card-actions"><button class="edit-btn" data-action="edit" data-id="${item.id}">编辑</button><button class="delete-btn" data-action="delete" data-id="${item.id}">删除</button></div></div>
      </article>`;
    }).join('');
  }

  function resetForm() {
    form.reset();
    $('status').value = '维修中';
    $('recordId').value = '';
    $('formTitle').textContent = '登记维修车辆';
    $('submitText').textContent = '保存维修记录';
    $('cancelEdit').hidden = true;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = Object.fromEntries(fieldIds.map((id) => [id, $(id).value.trim()]));
    const id = $('recordId').value;
    if (id) {
      records = records.map((item) => item.id === id ? { ...item, ...data, updatedAt: new Date().toISOString() } : item);
      showToast('维修记录已更新');
    } else {
      records.unshift({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, ...data, updatedAt: new Date().toISOString() });
      showToast('维修记录已保存');
    }
    saveRecords(); resetForm(); render();
  });

  $('recordsList').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const item = records.find((record) => record.id === button.dataset.id);
    if (!item) return;
    if (button.dataset.action === 'delete') {
      if (!confirm(`确定删除 ${item.plateNumber} 的维修记录吗？`)) return;
      records = records.filter((record) => record.id !== item.id);
      saveRecords(); render(); showToast('记录已删除');
      return;
    }
    $('recordId').value = item.id;
    fieldIds.forEach((id) => { $(id).value = item[id] || ''; });
    $('formTitle').textContent = '编辑维修记录';
    $('submitText').textContent = '更新维修记录';
    $('cancelEdit').hidden = false;
    form.scrollIntoView({ behavior:'smooth', block:'start' });
  });

  $('cancelEdit').addEventListener('click', resetForm);
  $('searchInput').addEventListener('input', render);
  render();
})();
