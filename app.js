(function () {
  'use strict';
  const STORAGE_KEY = 'accidentRepairRecords_v1';
  const fieldIds = ['plateNumber', 'carModel', 'orderNumber', 'status', 'repairItems', 'partsReplacement', 'headlightRepair', 'alloyRepair', 'notes'];
  const $ = (id) => document.getElementById(id);
  const form = $('repairForm');
  let records = loadRecords();
  let sourceImage = null;
  let rotation = 0;
  let ocrValues = {};
  let activeOcrWorker = null;
  const OCR_TIMEOUT_MS = 90000;
  const OCR_ASSET_CACHE = 'awei-ocr-assets-v1';
  const OCR_ASSETS = {
    core: Array.from({ length: 6 }, (_, index) => `./vendor/tesseract/core/tesseract-core-lstm.wasm.js.part${String(index).padStart(2, '0')}`),
    chi_sim: Array.from({ length: 3 }, (_, index) => `./vendor/tesseract/lang/chi_sim.traineddata.gz.part${String(index).padStart(2, '0')}`),
    eng: Array.from({ length: 5 }, (_, index) => `./vendor/tesseract/lang/eng.traineddata.gz.part${String(index).padStart(2, '0')}`)
  };
  let ocrAssetsPromise = null;
  const TESSERACT_OPTIONS = {
    workerPath: './vendor/tesseract/worker.min.js',
    cachePath: 'awei-ocr-v1',
    cacheMethod: 'write',
    gzip: true
  };

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

  const ocrFieldLabels = { plateNumber:'车牌号', carModel:'车型', orderNumber:'工单号', repairItems:'维修项目', partsReplacement:'配件更换', notes:'备注' };
  const dialog = $('ocrDialog');
  const canvas = $('ocrCanvas');
  const cropBox = $('cropBox');

  function setOcrView(view) {
    $('imageEditor').hidden = view !== 'editor';
    $('ocrProgress').hidden = view !== 'progress';
    $('ocrResult').hidden = view !== 'result';
    $('ocrError').hidden = view !== 'error';
  }

  function updateOcrProgress(message) {
    const progress = Math.max(0, Math.min(100, Math.round((message.progress || 0) * 100)));
    const labels = {
      'loading tesseract core': '正在加载本地识别引擎',
      'initializing tesseract': '正在初始化识别引擎',
      'loading language traineddata': '正在下载中英文识别数据',
      'initializing api': '正在准备中英文识别',
      'recognizing text': '正在识别文字'
    };
    $('progressBar').style.width = `${progress}%`;
    $('progressLabel').textContent = `${labels[message.status] || '正在准备识别'} ${progress}%`;
  }

  async function fetchCachedAsset(path) {
    const cache = 'caches' in window ? await caches.open(OCR_ASSET_CACHE) : null;
    const cached = cache && await cache.match(path);
    if (cached) return cached.arrayBuffer();
    const response = await fetch(path);
    if (!response.ok) throw new Error(`资源下载失败 (${response.status})：${path}`);
    if (cache) await cache.put(path, response.clone());
    return response.arrayBuffer();
  }

  function joinBuffers(buffers) {
    const result = new Uint8Array(buffers.reduce((total, buffer) => total + buffer.byteLength, 0));
    let offset = 0;
    buffers.forEach((buffer) => { result.set(new Uint8Array(buffer), offset); offset += buffer.byteLength; });
    return result;
  }

  async function loadOcrAssets() {
    if (ocrAssetsPromise) return ocrAssetsPromise;
    ocrAssetsPromise = (async () => {
      const entries = Object.entries(OCR_ASSETS);
      const totalParts = entries.reduce((total, [, paths]) => total + paths.length, 0);
      let loadedParts = 0;
      const loaded = {};
      for (const [name, paths] of entries) {
        const buffers = [];
        for (const path of paths) {
          buffers.push(await fetchCachedAsset(path));
          loadedParts += 1;
          const progress = Math.round(loadedParts / totalParts * 100);
          $('progressBar').style.width = `${progress}%`;
          $('progressLabel').textContent = `正在下载本地识别文件 ${progress}%`;
        }
        loaded[name] = joinBuffers(buffers);
      }
      loaded.coreUrl = URL.createObjectURL(new Blob([loaded.core], { type: 'application/javascript' }));
      return loaded;
    })().catch((error) => { ocrAssetsPromise = null; throw error; });
    return ocrAssetsPromise;
  }

  function timeoutAfter(milliseconds) {
    return new Promise((_, reject) => setTimeout(() => {
      const error = new Error('OCR_TIMEOUT');
      error.code = 'OCR_TIMEOUT';
      reject(error);
    }, milliseconds));
  }

  function showOcrError(error) {
    const timedOut = error && (error.code === 'OCR_TIMEOUT' || error.message === 'OCR_TIMEOUT');
    $('ocrErrorMessage').textContent = timedOut
      ? '加载或识别超过 90 秒，可能是网络较慢。请检查网络后点击重试。'
      : '无法加载本地识别文件。请检查网络连接、刷新页面，或点击下方按钮重试。';
    setOcrView('error');
  }

  function openPicker(id) { $(id).click(); }
  $('cameraButton').addEventListener('click', () => openPicker('cameraInput'));
  $('albumButton').addEventListener('click', () => openPicker('albumInput'));
  ['cameraInput', 'albumInput'].forEach((id) => $(id).addEventListener('change', loadOcrImage));

  function loadOcrImage(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return showToast('请选择图片文件');
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(image.src); sourceImage = image; rotation = 0;
      dialog.hidden = false; document.body.style.overflow = 'hidden'; setOcrView('editor'); drawEditor();
    };
    image.onerror = () => showToast('图片读取失败，请重新选择');
    image.src = URL.createObjectURL(file);
  }

  function drawEditor() {
    const swapped = Math.abs(rotation % 180) === 90;
    const sourceWidth = swapped ? sourceImage.height : sourceImage.width;
    const sourceHeight = swapped ? sourceImage.width : sourceImage.height;
    const scale = Math.min(1200 / sourceWidth, 900 / sourceHeight, 1);
    canvas.width = Math.round(sourceWidth * scale); canvas.height = Math.round(sourceHeight * scale);
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(rotation * Math.PI / 180);
    ctx.drawImage(sourceImage, -sourceImage.width * scale / 2, -sourceImage.height * scale / 2, sourceImage.width * scale, sourceImage.height * scale);
    requestAnimationFrame(() => {
      cropBox.style.left = '6%'; cropBox.style.top = '6%'; cropBox.style.width = '88%'; cropBox.style.height = '88%';
    });
  }

  $('rotateLeft').addEventListener('click', () => { rotation = (rotation - 90) % 360; drawEditor(); });
  $('rotateRight').addEventListener('click', () => { rotation = (rotation + 90) % 360; drawEditor(); });
  let dragState;
  cropBox.addEventListener('pointerdown', (event) => {
    event.preventDefault(); cropBox.setPointerCapture(event.pointerId);
    dragState = { x:event.clientX, y:event.clientY, left:cropBox.offsetLeft, top:cropBox.offsetTop, width:cropBox.offsetWidth, height:cropBox.offsetHeight, resize:event.target.tagName === 'I' };
  });
  cropBox.addEventListener('pointermove', (event) => {
    if (!dragState) return;
    const parent = cropBox.parentElement, dx = event.clientX - dragState.x, dy = event.clientY - dragState.y;
    if (dragState.resize) {
      cropBox.style.width = `${Math.max(60, Math.min(parent.clientWidth - dragState.left, dragState.width + dx))}px`;
      cropBox.style.height = `${Math.max(60, Math.min(parent.clientHeight - dragState.top, dragState.height + dy))}px`;
    } else {
      cropBox.style.left = `${Math.max(0, Math.min(parent.clientWidth - dragState.width, dragState.left + dx))}px`;
      cropBox.style.top = `${Math.max(0, Math.min(parent.clientHeight - dragState.height, dragState.top + dy))}px`;
    }
  });
  cropBox.addEventListener('pointerup', () => { dragState = null; });

  function croppedCanvas() {
    const result = document.createElement('canvas');
    const sx = cropBox.offsetLeft / cropBox.parentElement.clientWidth * canvas.width;
    const sy = cropBox.offsetTop / cropBox.parentElement.clientHeight * canvas.height;
    const sw = cropBox.offsetWidth / cropBox.parentElement.clientWidth * canvas.width;
    const sh = cropBox.offsetHeight / cropBox.parentElement.clientHeight * canvas.height;
    result.width = Math.round(sw); result.height = Math.round(sh);
    result.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, result.width, result.height);
    return result;
  }

  function extractValue(text, labels) {
    const pattern = new RegExp(`(?:${labels.join('|')})[：:\\s]*([^\\n]{1,80})`, 'i');
    return (text.match(pattern) || [,''])[1].trim();
  }
  function parseOcrText(text) {
    const plate = text.match(/[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼][A-ZＡ-Ｚ][·•\s-]?[A-Z0-9Ａ-Ｚ０-９]{5,6}/i);
    return {
      plateNumber: plate ? plate[0].replace(/[•\s-]/g, '·').replace('··','·') : extractValue(text, ['车牌号','车牌']),
      carModel: extractValue(text, ['车辆型号','车型','品牌型号']), orderNumber: extractValue(text, ['工单号','维修单号','委托书号']),
      repairItems: extractValue(text, ['维修项目','维修内容','作业项目']), partsReplacement: extractValue(text, ['配件更换','更换配件','配件项目']), notes: extractValue(text, ['备注','客户要求'])
    };
  }

  async function runOcr() {
    if (!window.Tesseract) {
      showOcrError(new Error('Tesseract 主程序未加载'));
      return;
    }
    setOcrView('progress');
    $('progressBar').style.width = '0%';
    $('progressLabel').textContent = '正在加载本地识别组件 0%';
    try {
      const job = (async () => {
        const assets = await loadOcrAssets();
        activeOcrWorker = await Tesseract.createWorker([
          { code: 'chi_sim', data: assets.chi_sim },
          { code: 'eng', data: assets.eng }
        ], 1, { ...TESSERACT_OPTIONS, corePath: assets.coreUrl, logger: updateOcrProgress });
        return activeOcrWorker.recognize(croppedCanvas());
      })();
      const result = await Promise.race([job, timeoutAfter(OCR_TIMEOUT_MS)]);
      await activeOcrWorker.terminate(); activeOcrWorker = null;
      ocrValues = parseOcrText(result.data.text); $('rawOcrText').textContent = result.data.text || '未识别到文字';
      $('recognizedFields').innerHTML = Object.entries(ocrFieldLabels).map(([id, label]) => `<label>${label}<textarea data-ocr-field="${id}" rows="2">${escapeHtml(ocrValues[id])}</textarea></label>`).join('');
      setOcrView('result');
    } catch (error) {
      console.error(error);
      if (activeOcrWorker) { await activeOcrWorker.terminate().catch(() => {}); activeOcrWorker = null; }
      showOcrError(error);
    }
  }
  $('startOcr').addEventListener('click', runOcr);
  $('retryOcrError').addEventListener('click', runOcr);
  $('retryOcr').addEventListener('click', () => setOcrView('editor'));
  $('applyOcr').addEventListener('click', () => {
    document.querySelectorAll('[data-ocr-field]').forEach((input) => { if (input.value.trim()) $(input.dataset.ocrField).value = input.value.trim(); });
    closeDialog(); showToast('识别内容已填写，请核对后保存'); form.scrollIntoView({ behavior:'smooth', block:'start' });
  });
  function closeDialog() { dialog.hidden = true; document.body.style.overflow = ''; }
  dialog.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', closeDialog));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !dialog.hidden) closeDialog(); });
  render();
})();
