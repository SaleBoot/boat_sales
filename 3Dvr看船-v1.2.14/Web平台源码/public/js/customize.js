const API_BASE = '';
let uploadedFiles = [];

document.addEventListener('DOMContentLoaded', () => {
  setupUpload();
});

function setupUpload() {
  const zone = document.getElementById('uploadZone');
  const input = document.getElementById('fileInput');

  zone.addEventListener('click', () => input.click());

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('drag-over');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });

  input.addEventListener('change', (e) => {
    handleFiles(e.target.files);
  });
}

function handleFiles(fileList) {
  const validTypes = ['.pdf', '.dwg', '.dxf', '.png', '.jpg', '.jpeg'];
  Array.from(fileList).forEach(file => {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!validTypes.includes(ext)) {
      showToast(`不支持的文件格式：${file.name}`, 'error');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      showToast(`文件超过50MB：${file.name}`, 'error');
      return;
    }
    const exists = uploadedFiles.some(f => f.name === file.name && f.size === file.size);
    if (!exists) {
      uploadedFiles.push(file);
    }
  });
  renderFileList();
  updateSubmitBtn();
}

function renderFileList() {
  const list = document.getElementById('fileList');
  if (uploadedFiles.length === 0) {
    list.innerHTML = '';
    return;
  }
  list.innerHTML = uploadedFiles.map((file, i) => `
    <div class="file-item">
      <div class="file-info">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M5 3H11L15 7V17C15 17.5523 14.5523 18 14 18H5C4.44772 18 4 17.5523 4 17V4C4 3.44772 4.44772 3 5 3Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M11 3V7H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="file-meta">
          <span class="file-name">${file.name}</span>
          <span class="file-size">${formatSize(file.size)}</span>
        </div>
      </div>
      <button class="file-remove" onclick="removeFile(${i})">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  `).join('');
}

function removeFile(index) {
  uploadedFiles.splice(index, 1);
  renderFileList();
  updateSubmitBtn();
}

function updateSubmitBtn() {
  document.getElementById('submitBtn').disabled = uploadedFiles.length === 0;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function submitUpload() {
  const name = document.getElementById('contactName').value.trim();
  const phone = document.getElementById('contactPhone').value.trim();
  const remark = document.getElementById('remark').value.trim();

  if (!name) {
    showToast('请输入联系人姓名', 'error');
    return;
  }
  if (!phone) {
    showToast('请输入联系方式', 'error');
    return;
  }

  const formData = new FormData();
  uploadedFiles.forEach(file => {
    formData.append('files', file);
  });
  formData.append('contactName', name);
  formData.append('contactPhone', phone);
  formData.append('remark', remark);

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = '提交中...';

  try {
    const res = await fetch(`${API_BASE}/api/customize/upload`, {
      method: 'POST',
      body: formData
    });
    const json = await res.json();
    if (json.success) {
      showToast('图纸提交成功！我们将在1-3个工作日内与您联系', 'success');
      setTimeout(() => {
        uploadedFiles = [];
        renderFileList();
        document.getElementById('contactName').value = '';
        document.getElementById('contactPhone').value = '';
        document.getElementById('remark').value = '';
        document.getElementById('fileInput').value = '';
        updateSubmitBtn();
        btn.textContent = '提交图纸';
      }, 2000);
    } else {
      showToast(json.message || '提交失败', 'error');
      btn.disabled = false;
      btn.textContent = '提交图纸';
    }
  } catch (err) {
    showToast('提交失败，请检查服务是否启动', 'error');
    btn.disabled = false;
    btn.textContent = '提交图纸';
    console.error(err);
  }
}

function showToast(message, type = '') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastIn 0.3s reverse';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
