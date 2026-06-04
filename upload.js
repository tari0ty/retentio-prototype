import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const dropArea = document.getElementById('drop-area');
const fileElem = document.getElementById('fileElem');
const fileLabel = document.getElementById('fileLabel');
const preview = document.getElementById('preview');
const adLink = document.getElementById('ad-link');
const generate = document.getElementById('generate');
const snippet = document.getElementById('snippet');
const copyBtn = document.getElementById('copy');
const adEnabled = document.getElementById('ad-enabled');
const adVideoUrl = document.getElementById('ad-video-url');
const adVideoFile = document.getElementById('ad-video-file');
const pickVideoBtn = document.getElementById('pick-video');
const adContact = document.getElementById('ad-contact');
const saveAdSettings = document.getElementById('save-ad-settings');
const adSettingsStatus = document.getElementById('ad-settings-status');

const MAX_AD_VIDEO_STORAGE_BYTES = 1024 * 1024; // keep browser-stored ads small for production

let currentDataUrl = '';
let currentVideoDataUrl = '';

function getSupabaseConfig(){
  return window.RETENTIOOO_CONFIG || null;
}

function getSupabaseClient(){
  const config = getSupabaseConfig();
  if (!config || !config.supabaseUrl || !config.supabaseAnonKey) return null;
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false },
  });
}

async function ensureAdBucket(supabase) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;
  if (buckets.some((bucket) => bucket.name === 'ads')) return;

  const { error: createError } = await supabase.storage.createBucket('ads', { public: true });
  if (createError) throw createError;
}

async function uploadAdVideoToSupabase(file) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured. Add config.js before uploading to production storage.');
  }

  await ensureAdBucket(supabase);

  const safeName = file.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '');
  const path = `ads/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from('ads').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'video/mp4',
  });

  if (error) throw error;

  const { data } = supabase.storage.from('ads').getPublicUrl(path);
  return data?.publicUrl || '';
}

function isSafeAdVideoUrl(value){
  return typeof value === 'string' && value.trim().length > 0 && !value.trim().startsWith('data:') && !value.trim().startsWith('blob:');
}

function loadSavedAdSettings(){
  const enabled = localStorage.getItem('manualAdEnabled');
  const video = localStorage.getItem('manualAdVideoUrl');
  const contact = localStorage.getItem('manualAdContact');
  if(enabled !== null) adEnabled.checked = enabled === 'true';
  if(video) adVideoUrl.value = isSafeAdVideoUrl(video) ? video : './ads/Ad.mp4';
  if(contact) adContact.value = contact;
}

function saveAdSettingsToStorage(){
  const incomingVideoUrl = adVideoUrl.value.trim();
  const safeVideoUrl = isSafeAdVideoUrl(incomingVideoUrl) ? incomingVideoUrl : './ads/Ad.mp4';

  localStorage.setItem('manualAdEnabled', String(adEnabled.checked));
  localStorage.setItem('manualAdVideoUrl', safeVideoUrl);
  localStorage.setItem('manualAdContact', adContact.value.trim() || '2348135232889');

  if (!isSafeAdVideoUrl(incomingVideoUrl)) {
    adSettingsStatus.textContent = 'Using the default ad video because browser-stored file URLs are not reliable for production. Enter a public video URL instead.';
  } else {
    adSettingsStatus.textContent = 'Ad settings saved.';
  }
}

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
pickVideoBtn.addEventListener('click', () => adVideoFile.click());
adVideoFile.addEventListener('change', handleVideoFile, false);
saveAdSettings.addEventListener('click', saveAdSettingsToStorage);
loadSavedAdSettings();

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

async function handleVideoFile(e){
  const files = e.target.files;
  if(!files || !files[0]) return;
  const file = files[0];
  if(!file.type.startsWith('video/')){
    alert('Please upload a video file.');
    return;
  }

  adSettingsStatus.textContent = 'Uploading ad video to Supabase Storage...';

  try {
    const publicUrl = await uploadAdVideoToSupabase(file);
    currentVideoDataUrl = publicUrl;
    adVideoUrl.value = publicUrl;
    adSettingsStatus.textContent = 'Video uploaded to production storage. Save the settings to use it on the live hub.';
  } catch (error) {
    console.error('Ad video upload failed:', error);
    currentVideoDataUrl = '';
    adVideoUrl.value = './ads/Ad.mp4';
    adSettingsStatus.textContent = error?.message || 'Unable to upload to Supabase Storage. Check your Supabase bucket and config.';
  }
}

function escapeHtml(s){
  return s.replace(/&/g, '&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
