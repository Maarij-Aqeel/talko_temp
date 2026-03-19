import html2canvas from 'html2canvas';
import { inject, track } from '@vercel/analytics';

inject();

// === DOM Elements ===
const recordBtn = document.getElementById('recordBtn');
const recordLabel = recordBtn.querySelector('.record-label');
const timer = document.getElementById('timer');
const fileInput = document.getElementById('fileInput');
const fileName = document.getElementById('fileName');
const playbackSection = document.getElementById('playbackSection');
const audioPlayer = document.getElementById('audioPlayer');
const submitBtn = document.getElementById('submitBtn');
const loadingSection = document.getElementById('loadingSection');
const feedbackSection = document.getElementById('feedbackSection');
const errorSection = document.getElementById('errorSection');
const errorText = document.getElementById('errorText');
const openInBrowserBtn = document.getElementById('openInBrowserBtn');
const resetBtn = document.getElementById('resetBtn');
const errorResetBtn = document.getElementById('errorResetBtn');
const inputSection = document.querySelector('.input-section');
const reRecordBtn = document.getElementById('reRecordBtn');
const mobileCta = document.getElementById('mobileCta');
const mobileUploadBtn = document.getElementById('mobileUploadBtn');
const mobileFileName = document.getElementById('mobileFileName');

// === Environment Detection ===
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const isMicApiMissing = !navigator.mediaDevices?.getUserMedia;
const cameFromApp = new URLSearchParams(window.location.search).get('src') === 'app';

// === Mobile landing: skip record UI, show Play Now CTA ===
// Only show when on mobile AND not already opened via Play Now button
if (isMobile && !cameFromApp) {
  mobileCta.hidden = false;
  inputSection.style.display = 'none';

  // Forward the access key to the Play Now link so the middleware doesn't block it
  const currentKey = new URLSearchParams(window.location.search).get('key');
  if (currentKey) {
    const playLink = document.getElementById('playNowLink');
    const base = new URL(playLink.href);
    base.searchParams.set('key', currentKey);
    playLink.href = base.toString();
  }
}

// Wire mobile upload button to the hidden file input
mobileUploadBtn.addEventListener('click', () => fileInput.click());


// Set Save to Photos vs Download label based on platform
document.getElementById('downloadImgBtn').textContent = isMobile ? '📸 Save to Photos' : '⬇️ Download Image';
// === State ===
let mediaRecorder = null;
let audioChunks = [];
let audioBlob = null;
let isRecording = false;
let timerInterval = null;
let seconds = 0;
let lastFeedbackData = null;
let lastCanvas = null;

const MAX_DURATION_SEC = 180; // 3 minutes
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// === Recording ===
recordBtn.addEventListener('click', async () => {
  if (isRecording) {
    stopRecording();
  } else {
    await startRecording();
  }
});

async function startRecording() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      showMicError();
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (seconds < 2) {
        showError('Recording too short. Please speak for at least a few seconds.');
        return;
      }
      audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
      showPlayback(audioBlob);
    };

    mediaRecorder.start();
    isRecording = true;
    seconds = 0;
    recordBtn.classList.add('recording');
    recordLabel.textContent = 'Tap to Stop';
    timer.hidden = false;
    updateTimer();
    timerInterval = setInterval(() => {
      seconds++;
      updateTimer();
      if (seconds >= MAX_DURATION_SEC) stopRecording();
    }, 1000);
  } catch (err) {
    showMicError();
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  isRecording = false;
  clearInterval(timerInterval);
  recordBtn.classList.remove('recording');
  recordLabel.textContent = 'Tap to Record';
  timer.hidden = true;
}

function updateTimer() {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  timer.textContent = `${m}:${s.toString().padStart(2, '0')}`;
}

// === File Upload ===
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > MAX_FILE_SIZE) {
    showError('File is too large. Please upload an audio file under 10MB.');
    fileInput.value = '';
    return;
  }

  fileName.textContent = file.name;
  if (isMobile) mobileFileName.textContent = file.name;
  audioBlob = file;
  showPlayback(audioBlob);
});

// === Playback ===
function showPlayback(blob) {
  const url = URL.createObjectURL(blob);
  audioPlayer.src = url;
  playbackSection.hidden = false;
  inputSection.style.display = 'none';
  if (isMobile) mobileCta.hidden = true;
}

// === Submit ===
submitBtn.addEventListener('click', async () => {
  if (!audioBlob) return;
  track('submission_started');
  submitBtn.disabled = true;
  playbackSection.hidden = true;
  feedbackSection.hidden = true;
  errorSection.hidden = true;
  loadingSection.hidden = false;

  try {
    // Convert audio blob to base64 (chunked to handle large files)
    const arrayBuffer = await audioBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);

    // Resolve and normalize MIME type for Gemini
    const rawType = audioBlob.type
      || (audioBlob.name?.endsWith('.mp3') ? 'audio/mpeg'
        : audioBlob.name?.endsWith('.wav') ? 'audio/wav'
        : audioBlob.name?.endsWith('.m4a') ? 'audio/mp4'
        : audioBlob.name?.endsWith('.ogg') ? 'audio/ogg'
        : audioBlob.name?.endsWith('.flac') ? 'audio/flac'
        : 'audio/webm');
    const MIME_MAP = {
      'audio/x-m4a': 'audio/mp4',
      'audio/x-wav': 'audio/wav',
      'audio/wave': 'audio/wav',
      'audio/mp3': 'audio/mpeg',
    };
    const mimeType = MIME_MAP[rawType] || rawType;

    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio: base64, mimeType }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Server error (${res.status})`);
    }

    const data = await res.json();
    lastFeedbackData = data;
    track('feedback_received', { overall_score: data.scores?.overall });
    renderFeedback(data);
  } catch (err) {
    showError(err.message || 'Something went wrong. Please try again.');
  } finally {
    submitBtn.disabled = false;
    loadingSection.hidden = true;
  }
});

// === Render Feedback ===
function renderFeedback(data) {
  // Score
  const scores = data.scores || {};
  const overall = typeof scores.overall === 'number' ? scores.overall : null;
  const scoreCircle = document.getElementById('scoreCircle');
  const scoreNumber = document.getElementById('scoreNumber');
  const scoreLabelEl = document.getElementById('scoreLabel');
  if (overall !== null) {
    scoreNumber.textContent = overall;
    scoreLabelEl.textContent = data.scoreLabel || '';
    scoreCircle.className = 'score-circle ' + getScoreTier(overall);
  }
  renderSubScores(scores);

  // Transcript
  document.getElementById('transcriptText').textContent = data.transcript || 'No transcript available.';

  // Fix 1
  const fix1 = data.fixes?.[0];
  if (fix1) {
    document.getElementById('fix1Title').textContent = fix1.title;
    document.getElementById('fix1Fix').textContent = fix1.fix;
    document.getElementById('fix1Note').textContent = fix1.note;
  }

  // Fix 2
  const fix2 = data.fixes?.[1];
  if (fix2) {
    document.getElementById('fix2Title').textContent = fix2.title;
    document.getElementById('fix2Fix').textContent = fix2.fix;
    document.getElementById('fix2Note').textContent = fix2.note;
  }

  // Upgrade
  const upgrade = data.upgrade;
  if (upgrade) {
    document.getElementById('upgradeTitle').textContent = upgrade.title;
    document.getElementById('upgradeFix').textContent = upgrade.fix;
    document.getElementById('upgradeNote').textContent = upgrade.note;
  }

  // Pronunciation
  const pron = data.pronunciation;
  const pronCard = document.getElementById('pronCard');
  if (pron) {
    document.getElementById('pronTitle').textContent = pron.title;
    document.getElementById('pronFix').textContent = pron.fix;
    document.getElementById('pronNote').textContent = pron.note;
    pronCard.hidden = false;
  } else {
    pronCard.hidden = true;
  }

  feedbackSection.hidden = false;
}

const SUB_SCORE_FIELDS = [
  { key: 'grammar',      label: 'grammar' },
  { key: 'vocabulary',   label: 'vocabulary' },
  { key: 'pronunciation',label: 'pronunciation' },
  { key: 'fluency',      label: 'fluency' },
];

function renderSubScores(scores, prefix = '') {
  SUB_SCORE_FIELDS.forEach(({ key, label }) => {
    const val = typeof scores[key] === 'number' ? scores[key] : null;
    const capKey = key.charAt(0).toUpperCase() + key.slice(1);
    const barId  = prefix ? `sc${capKey}Bar`   : `${label}Bar`;
    const valId  = prefix ? `sc${capKey}Value` : `${label}Value`;
    const barEl  = document.getElementById(barId);
    const valEl  = document.getElementById(valId);
    if (barEl && val !== null) {
      barEl.style.width = `${val}%`;
      barEl.className = `sub-score-bar ${getScoreTier(val)}`;
    }
    if (valEl && val !== null) valEl.textContent = val;
  });
}

function getScoreTier(score) {
  if (score >= 85) return 'score-great';
  if (score >= 70) return 'score-high';
  if (score >= 50) return 'score-mid';
  return 'score-low';
}

// === Error ===
function showMicError() {
  if ((isMobile || isMicApiMissing) && !cameFromApp) {
    errorText.textContent = 'Microphone access is not available here. Open in your browser for the full recording experience.';
    openInBrowserBtn.hidden = false;
  } else {
    errorText.textContent = 'Microphone access is required. Please allow microphone access and try again.';
    openInBrowserBtn.hidden = true;
  }
  errorSection.hidden = false;
  loadingSection.hidden = true;
  feedbackSection.hidden = true;
}

function showError(message) {
  errorText.textContent = message;
  openInBrowserBtn.hidden = true;
  errorSection.hidden = false;
  loadingSection.hidden = true;
  feedbackSection.hidden = true;
}

// === Reset ===
function resetAll() {
  audioBlob = null;
  audioChunks = [];
  audioPlayer.src = '';
  fileName.textContent = '';
  fileInput.value = '';
  playbackSection.hidden = true;
  feedbackSection.hidden = true;
  errorSection.hidden = true;
  loadingSection.hidden = true;
  openInBrowserBtn.hidden = true;
  if (isMobile && !cameFromApp) {
    mobileCta.hidden = false;
    mobileFileName.textContent = '';
  } else {
    inputSection.style.display = '';
  }
}

resetBtn.addEventListener('click', resetAll);
errorResetBtn.addEventListener('click', resetAll);
reRecordBtn.addEventListener('click', resetAll);

// === Share Nudge ===
const nudgeCopyBtn = document.getElementById('nudgeCopyBtn');
const nudgeConfirm = document.getElementById('nudgeConfirm');

nudgeCopyBtn.addEventListener('click', async () => {
  if (!lastFeedbackData) return;
  nudgeCopyBtn.disabled = true;
  try {
    await navigator.clipboard.writeText(buildShareText(lastFeedbackData));
    track('share_text_copied');
    nudgeConfirm.textContent = '✅ Copied! Paste it in the comments 🎉';
  } catch {
    nudgeConfirm.textContent = '❌ Could not copy. Please try again.';
  } finally {
    nudgeCopyBtn.disabled = false;
    nudgeConfirm.hidden = false;
    setTimeout(() => { nudgeConfirm.hidden = true; }, 4000);
  }
});

// === Share Modal ===
const shareBtn = document.getElementById('shareBtn');
const shareModal = document.getElementById('shareModal');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const downloadAudioBtn = document.getElementById('downloadAudioBtn');
const copyImgBtn = document.getElementById('copyImgBtn');
const downloadImgBtn = document.getElementById('downloadImgBtn');
const sharePreviewImg = document.getElementById('sharePreviewImg');
const sharePreviewSpinner = document.getElementById('sharePreviewSpinner');
const shareConfirm = document.getElementById('shareConfirm');

shareBtn.addEventListener('click', async () => {
  if (!lastFeedbackData) return;
  // Reset modal state
  shareConfirm.hidden = true;
  sharePreviewImg.hidden = true;
  sharePreviewSpinner.hidden = false;
  sharePreviewSpinner.textContent = '⏳ Generating preview...';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  shareModal.hidden = false;
  // Generate preview
  try {
    populateShareCard(lastFeedbackData);
    lastCanvas = await generateShareImage();
    sharePreviewImg.src = lastCanvas.toDataURL('image/png');
    sharePreviewImg.hidden = false;
    sharePreviewSpinner.hidden = true;
  } catch {
    sharePreviewSpinner.textContent = '❌ Could not generate preview.';
  }
});

modalCloseBtn.addEventListener('click', () => {
  shareModal.hidden = true;
});

shareModal.addEventListener('click', (e) => {
  if (e.target === shareModal) shareModal.hidden = true;
});

// === Image action buttons ===

// Copy Text — copies a formatted text scorecard to clipboard (works everywhere)
copyImgBtn.addEventListener('click', async () => {
  if (!lastFeedbackData) return;
  copyImgBtn.disabled = true;
  try {
    await navigator.clipboard.writeText(buildShareText(lastFeedbackData));
    track('share_text_copied');
    shareConfirm.textContent = '✅ Copied! Paste it in the comments 🎉';
  } catch {
    shareConfirm.textContent = '❌ Could not copy. Please try again.';
  } finally {
    copyImgBtn.disabled = false;
    shareConfirm.hidden = false;
    setTimeout(() => { shareConfirm.hidden = true; }, 4000);
  }
});

// Save to Photos (mobile) / Download Image (desktop)
downloadImgBtn.addEventListener('click', async () => {
  if (!lastCanvas) return;
  downloadImgBtn.disabled = true;
  try {
    const blob = await new Promise(resolve => lastCanvas.toBlob(resolve, 'image/png'));
    const file = new File([blob], 'tuesday-talko-progress.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'My Tuesday Talko Progress' });
      track('share_image_downloaded');
      shareConfirm.textContent = '✅ Shared!';
    } else {
      // Desktop fallback: trigger file download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tuesday-talko-progress.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      track('share_image_downloaded');
      shareConfirm.textContent = '📥 Image saved!';
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      shareConfirm.textContent = '❌ Could not save. Please try again.';
    }
  } finally {
    downloadImgBtn.disabled = false;
    shareConfirm.hidden = false;
    setTimeout(() => { shareConfirm.hidden = true; }, 3000);
  }
});

// === Share text builder ===
function buildShareText(data) {
  const scores = data.scores || {};
  const overall = scores.overall ?? '--';
  const label = data.scoreLabel ? ` — ${data.scoreLabel}` : '';
  let text = `🎙️ Tuesday Talko: ${overall}/100${label}\n`;
  text += `Grammar: ${scores.grammar ?? '--'} | Vocabulary: ${scores.vocabulary ?? '--'} | Pronunciation: ${scores.pronunciation ?? '--'} | Fluency: ${scores.fluency ?? '--'}`;

  const section = (emoji, item) => {
    if (!item?.fix) return '';
    let s = `\n\n${emoji} ${item.title}`;
    s += `\n\u201c${item.fix}\u201d`;
    if (item.note) s += `\n${item.note}`;
    return s;
  };

  text += section('✏️ Fix 1 —', data.fixes?.[0]);
  text += section('✏️ Fix 2 —', data.fixes?.[1]);
  text += section('🚀 Upgrade —', data.upgrade);
  if (data.pronunciation?.fix) {
    text += `\n\n🗣️ Pronunciation — ${data.pronunciation.title}: ${data.pronunciation.fix}`;
  }
  text += `\n\nPractice English with WordBuddy.ai 🌟`;
  return text;
}

// === Share card population ===
function populateShareCard(data) {
  const scores = data.scores || {};
  const overall = typeof scores.overall === 'number' ? scores.overall : null;
  const scCircle = document.getElementById('scScoreCircle');
  document.getElementById('scScoreNumber').textContent = overall !== null ? overall : '--';
  document.getElementById('scScoreLabel').textContent = data.scoreLabel || '';
  if (overall !== null) scCircle.className = 'sc-score-circle ' + getScoreTier(overall);

  // Summary report
  document.getElementById('scFix1Title').textContent = data.fixes?.[0]?.title || '';
  document.getElementById('scFix1Fix').textContent  = data.fixes?.[0]?.fix   || '';
  document.getElementById('scFix2Title').textContent = data.fixes?.[1]?.title || '';
  document.getElementById('scFix2Fix').textContent  = data.fixes?.[1]?.fix   || '';
  document.getElementById('scUpgradeTitle').textContent = data.upgrade?.title || '';
  document.getElementById('scUpgradeFix').textContent  = data.upgrade?.fix   || '';
  const pronRow = document.getElementById('scPronRow');
  if (data.pronunciation) {
    document.getElementById('scPronTitle').textContent = data.pronunciation.title || '';
    document.getElementById('scPronFix').textContent  = data.pronunciation.fix   || '';
    pronRow.style.display = '';
  } else {
    pronRow.style.display = 'none';
  }

  // Render sub-score bars in share card
  SUB_SCORE_FIELDS.forEach(({ key }) => {
    const val = typeof scores[key] === 'number' ? scores[key] : null;
    const capKey = key.charAt(0).toUpperCase() + key.slice(1);
    const barEl = document.getElementById(`sc${capKey}Bar`);
    const valEl = document.getElementById(`sc${capKey}Value`);
    if (barEl && val !== null) {
      barEl.style.width = `${val}%`;
      barEl.className = `sc-sub-bar ${getScoreTier(val)}`;
    }
    if (valEl && val !== null) valEl.textContent = val;
  });
}

async function generateShareImage() {
  const shareCard = document.getElementById('shareCard');
  shareCard.style.position = 'fixed';
  shareCard.style.left = '-9999px';
  shareCard.style.top = '0';
  shareCard.style.display = 'block';

  try {
    const canvas = await html2canvas(shareCard, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
    });
    return canvas;
  } finally {
    shareCard.style.display = 'none';
    shareCard.style.position = '';
    shareCard.style.left = '';
    shareCard.style.top = '';
  }
}

downloadAudioBtn.addEventListener('click', async () => {
  if (!audioBlob) return;
  downloadAudioBtn.disabled = true;
  downloadAudioBtn.textContent = '⏳ Preparing...';

  try {
    // Mobile: use Web Share API (fixes iOS <a download> limitation)
    const ext = audioBlob.type.includes('mp4') || audioBlob.type.includes('m4a') ? 'm4a'
              : audioBlob.type.includes('mpeg') ? 'mp3'
              : audioBlob.type.includes('wav')  ? 'wav'
              : 'webm';
    const audioFile = new File([audioBlob], `tuesday-talko-recording.${ext}`, { type: audioBlob.type });
    if (navigator.canShare?.({ files: [audioFile] })) {
      await navigator.share({ files: [audioFile], title: 'My Tuesday Talko Recording' });
      track('share_audio_downloaded');
      return;
    }

    // Desktop: convert to MP3 then download
    downloadAudioBtn.textContent = '⏳ Converting to MP3...';
    try {
      const mp3Blob = await convertToMp3(audioBlob);
      const url = URL.createObjectURL(mp3Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tuesday-talko-recording.mp3';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      const url = URL.createObjectURL(audioBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tuesday-talko-recording.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  } catch (err) {
    if (err.name !== 'AbortError') console.error('Audio download error:', err);
  } finally {
    downloadAudioBtn.disabled = false;
    downloadAudioBtn.textContent = '🎵 Download Audio';
  }
});

async function convertToMp3(blob) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const kbps = 128;

  const mp3Encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, kbps);
  const blockSize = 1152;
  const mp3Data = [];

  if (numChannels === 1) {
    const samples = convertFloat32ToInt16(audioBuffer.getChannelData(0));
    for (let i = 0; i < samples.length; i += blockSize) {
      const chunk = samples.subarray(i, i + blockSize);
      const mp3buf = mp3Encoder.encodeBuffer(chunk);
      if (mp3buf.length > 0) mp3Data.push(mp3buf);
    }
  } else {
    const left = convertFloat32ToInt16(audioBuffer.getChannelData(0));
    const right = convertFloat32ToInt16(audioBuffer.getChannelData(1));
    for (let i = 0; i < left.length; i += blockSize) {
      const leftChunk = left.subarray(i, i + blockSize);
      const rightChunk = right.subarray(i, i + blockSize);
      const mp3buf = mp3Encoder.encodeBuffer(leftChunk, rightChunk);
      if (mp3buf.length > 0) mp3Data.push(mp3buf);
    }
  }

  const end = mp3Encoder.flush();
  if (end.length > 0) mp3Data.push(end);
  audioCtx.close();

  return new Blob(mp3Data, { type: 'audio/mpeg' });
}

function convertFloat32ToInt16(float32Array) {
  const int16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16;
}

