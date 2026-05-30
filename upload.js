const dropArea = document.getElementById('drop-area');
const fileElem = document.getElementById('fileElem');
const fileLabel = document.getElementById('fileLabel');
const preview = document.getElementById('preview');
const adLink = document.getElementById('ad-link');
const generate = document.getElementById('generate');
const snippet = document.getElementById('snippet');
const copyBtn = document.getElementById('copy');

let currentDataUrl = '';

function preventDefaults(e){ e.preventDefault(); e.stopPropagation(); }
['dragenter','dragover','dragleave','drop'].forEach(evt => {
  dropArea.addEventListener(evt, preventDefaults, false)
});

['dragenter','dragover'].forEach(evt => {
  dropArea.addEventListener(evt, () => dropArea.classList.add('highlight'), false)
});
['dragleave','drop'].forEach(evt => {
  dropArea.addEventListener(evt, () => dropArea.classList.remove('highlight'), false)
});

dropArea.addEventListener('drop', handleDrop, false)
fileElem.addEventListener('change', handleFiles, false)
fileLabel.addEventListener('click', () => fileElem.click())

function handleDrop(e){
  const dt = e.dataTransfer;
  const files = dt.files;
  handleFiles({ target: { files } });
}

function handleFiles(e){
  const files = e.target.files;
  if(!files || !files[0]) return;
  const file = files[0];
  if(!file.type.startsWith('image/')){
    alert('Please upload an image file.');
    return;
  }
  const reader = new FileReader();
  reader.onload = ev => {
    currentDataUrl = ev.target.result;
    preview.innerHTML = `<img src="${currentDataUrl}" alt="ad-preview">`;
  };
  reader.readAsDataURL(file);
}

generate.addEventListener('click', () => {
  const url = adLink.value.trim();
  if(!currentDataUrl){ alert('Please upload an image first.'); return; }
  if(!url){ alert('Please enter a destination URL.'); return; }
  const html = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><img src="${currentDataUrl}" alt="Ad" style="max-width:100%;height:auto;border-radius:8px;border:0"></a>`;
  snippet.value = html;
});

copyBtn.addEventListener('click', async () => {
  if(!snippet.value) return;
  try{
    await navigator.clipboard.writeText(snippet.value);
    copyBtn.textContent = 'Copied!';
    setTimeout(()=> copyBtn.textContent = 'Copy to clipboard', 1500);
  }catch(e){
    alert('Unable to copy. Manually select and copy the snippet.');
  }
});

function escapeHtml(s){
  return s.replace(/&/g, '&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
