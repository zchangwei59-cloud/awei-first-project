(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const canvas = $('documentCanvas');
  const context = canvas.getContext('2d');
  let originalImage = null;
  let cropStart = null;
  let cropRect = null;
  let cropMode = false;

  function normalizeLine(line) { return line.replace(/[：:]/g, ':').replace(/\s+/g, ' ').trim(); }
  function valueAfterLabel(text, labels) {
    const pattern = new RegExp(`(?:${labels.join('|')})\\s*[:：]?\\s*([^\\n]{2,60})`, 'i');
    const match = text.match(pattern);
    return match ? normalizeLine(match[1]).replace(/^[：:]|\s{2,}.*$/g, '').trim() : '';
  }
  function blockAfterLabel(text, labels) {
    const lines = text.split(/\n+/).map(normalizeLine).filter(Boolean);
    const index = lines.findIndex((line) => labels.some((label) => line.includes(label)));
    if (index < 0) return '';
    const inline = lines[index].replace(new RegExp(`^.*?(?:${labels.join('|')})\\s*:?\\s*`), '').trim();
    const values = inline ? [inline] : [];
    for (let i = index + 1; i < Math.min(lines.length, index + 5); i += 1) {
      if (/车牌|车型|工单|维修|配件|金额|日期|客户|备注/.test(lines[i])) break;
      values.push(lines[i]);
    }
    return values.join('、').slice(0, 500);
  }
  function parseRepairOrder(text) {
    const plateMatch = text.toUpperCase().match(/[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼][A-Z][·•\- ]?[A-Z0-9]{5,6}/);
    const normalizedPlate = plateMatch ? plateMatch[0].replace(/^(.)([A-Z])[·•\- ]?/, '$1$2·') : '';
    return {
      plateNumber: normalizedPlate || valueAfterLabel(text, ['车牌号码', '车牌号', '车牌']),
      carModel: valueAfterLabel(text, ['车辆型号', '车型', '品牌型号']),
      orderNumber: valueAfterLabel(text, ['维修工单号', '工单编号', '工单号', '委托书号']),
      repairItems: blockAfterLabel(text, ['维修项目', '修理项目', '作业项目']),
      partsReplacement: blockAfterLabel(text, ['配件更换项目', '更换配件', '配件项目', '材料项目'])
    };
  }
  window.RepairOrderOCR = { parseRepairOrder };

  function setCanvas(source, width, height) {
    const max = 2200;
    const scale = Math.min(1, max / Math.max(width, height));
    canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
  }
  function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const image = new Image();
    image.onload = () => {
      originalImage = image;
      setCanvas(image, image.naturalWidth, image.naturalHeight);
      $('ocrEditor').hidden = false; $('ocrNotice').hidden = true;
      URL.revokeObjectURL(image.src);
    };
    image.onerror = () => alert('无法读取这张图片，请重新选择。');
    image.src = URL.createObjectURL(file);
  }
  function rotate(clockwise) {
    if (!canvas.width) return;
    const copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
    copy.getContext('2d').drawImage(canvas, 0, 0);
    canvas.width = copy.height; canvas.height = copy.width;
    context.save(); context.translate(canvas.width / 2, canvas.height / 2); context.rotate((clockwise ? 1 : -1) * Math.PI / 2);
    context.drawImage(copy, -copy.width / 2, -copy.height / 2); context.restore();
  }
  function point(event) {
    const rect = canvas.getBoundingClientRect(); const touch = event.touches ? event.touches[0] : event;
    return { x:(touch.clientX - rect.left) * canvas.width / rect.width, y:(touch.clientY - rect.top) * canvas.height / rect.height };
  }
  function drawCropOverlay() {
    if (!cropRect) return;
    const saved = context.getImageData(0, 0, canvas.width, canvas.height);
    context.putImageData(saved, 0, 0); context.save(); context.fillStyle = 'rgba(0,0,0,.38)'; context.fillRect(0,0,canvas.width,canvas.height);
    context.clearRect(cropRect.x,cropRect.y,cropRect.w,cropRect.h); context.putImageData(saved,cropRect.x,cropRect.y,cropRect.x,cropRect.y,cropRect.w,cropRect.h); context.strokeStyle='#fff'; context.lineWidth=Math.max(3,canvas.width/300); context.strokeRect(cropRect.x,cropRect.y,cropRect.w,cropRect.h); context.restore();
  }
  function cropPointerDown(event) { if (!cropMode) return; event.preventDefault(); cropStart = point(event); }
  function cropPointerUp(event) {
    if (!cropMode || !cropStart) return; event.preventDefault(); const end = point(event);
    cropRect = { x:Math.max(0,Math.min(cropStart.x,end.x)), y:Math.max(0,Math.min(cropStart.y,end.y)), w:Math.abs(end.x-cropStart.x), h:Math.abs(end.y-cropStart.y) };
    cropStart = null;
    if (cropRect.w < 30 || cropRect.h < 30) return;
    const cropped = document.createElement('canvas'); cropped.width=cropRect.w; cropped.height=cropRect.h;
    cropped.getContext('2d').drawImage(canvas,cropRect.x,cropRect.y,cropRect.w,cropRect.h,0,0,cropRect.w,cropRect.h);
    setCanvas(cropped,cropped.width,cropped.height); cropMode=false; $('startCrop').classList.remove('active'); $('cropHint').hidden=true;
  }
  async function recognize() {
    if (!canvas.width) return;
    if (!window.Tesseract) { alert('OCR 组件加载失败，请检查网络后重试。图片尚未上传。'); return; }
    const button=$('recognizeButton'); button.disabled=true; button.textContent='正在识别…'; $('ocrProgress').hidden=false;
    try {
      const result = await window.Tesseract.recognize(canvas, 'chi_sim+eng', { logger(message) {
        const progress = Math.round((message.progress || 0) * 100); $('progressPercent').textContent=`${progress}%`; $('progressBar').style.width=`${progress}%`;
        const labels={ loading_tesseract_core:'加载识别引擎', initializing_tesseract:'初始化识别引擎', loading_language_traineddata:'加载中文语言包', initializing_api:'准备识别', recognizing_text:'正在识别文字' };
        $('progressText').textContent=labels[message.status] || '正在处理图片';
      }});
      const fields=parseRepairOrder(result.data.text);
      Object.entries(fields).forEach(([id,value]) => { if (value && $(id)) $(id).value=value; });
      $('ocrNotice').hidden=false; $('ocrNotice').scrollIntoView({behavior:'smooth',block:'nearest'});
    } catch (error) { console.error(error); alert('识别未完成，请检查网络或更换清晰照片后重试。'); }
    finally { button.disabled=false; button.textContent='重新识别工单'; }
  }
  ['cameraInput','galleryInput'].forEach((id)=>$(id).addEventListener('change',(event)=>{loadFile(event.target.files[0]);event.target.value='';}));
  $('rotateLeft').addEventListener('click',()=>rotate(false)); $('rotateRight').addEventListener('click',()=>rotate(true));
  $('resetImage').addEventListener('click',()=>{if(originalImage)setCanvas(originalImage,originalImage.naturalWidth,originalImage.naturalHeight);});
  $('startCrop').addEventListener('click',()=>{cropMode=!cropMode;$('startCrop').classList.toggle('active',cropMode);$('cropHint').hidden=!cropMode;});
  canvas.addEventListener('pointerdown',cropPointerDown); canvas.addEventListener('pointerup',cropPointerUp);
  $('recognizeButton').addEventListener('click',recognize);
})();
