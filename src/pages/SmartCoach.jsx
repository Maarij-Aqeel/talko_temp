import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import './SmartCoach.css';

export default function SmartCoach() {
  const [currentMode, setCurrentMode] = useState('write'); // 'write' or 'speak'
  const [appState, setAppState] = useState('input'); // 'input', 'playback', 'loading', 'feedback', 'error'
  const [errorMessage, setErrorMessage] = useState('');
  
  // Text State
  const [textInput, setTextInput] = useState('');
  const MAX_TEXT_LENGTH = 2000;

  // Audio State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const MAX_DURATION_SEC = 180;

  // Feedback & Share State
  const [feedbackData, setFeedbackData] = useState(null);
  const [lastInputType, setLastInputType] = useState(null); // 'text' or 'audio'
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareImgSrc, setShareImgSrc] = useState(null);
  const shareCardRef = useRef(null);

  // Cleanup timer
  useEffect(() => {
    return () => clearInterval(timerIntervalRef.current);
  }, []);

  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // === AUDIO RECORDING ===
  const toggleRecording = async () => {
    if (isRecording) stopRecording();
    else await startRecording();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordingSeconds < 2) {
          setErrorMessage('Recording too short.');
          setAppState('error');
          return;
        }
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setAppState('playback');
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= MAX_DURATION_SEC - 1) { stopRecording(); return prev; }
          return prev + 1;
        });
      }, 1000);
    } catch {
      setErrorMessage('Microphone access is required.');
      setAppState('error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    clearInterval(timerIntervalRef.current);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('File is too large (max 10MB).');
      setAppState('error');
      return;
    }
    setAudioBlob(file);
    setAudioUrl(URL.createObjectURL(file));
    setAppState('playback');
  };

  // === SUBMISSION ===
  const handleSubmitWrite = async () => {
    const text = textInput.trim();
    if (text.length < 10) {
      setErrorMessage('Please write at least 10 characters.');
      setAppState('error');
      return;
    }
    await submitFeedback('text', { text });
  };

  const handleSubmitAudio = async () => {
    if (!audioBlob) return;
    const arrayBuffer = await audioBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }
    const base64 = btoa(binary);
    
    // Default to webm if mime type is missing
    const mimeType = audioBlob.type || 'audio/webm';
    await submitFeedback('audio', { audio: base64, mimeType });
  };

  const submitFeedback = async (type, payload) => {
    setLastInputType(type);
    setAppState('loading');

    try {
      // NOTE: Ensure your backend endpoint matches this!
      const res = await fetch('/api/smartcoach_feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...payload }),
      });

      if (!res.ok) throw new Error('Server error');
      const data = await res.json();
      setFeedbackData(data);
      setAppState('feedback');
    } catch (err) {
      setErrorMessage(err.message || 'Something went wrong.');
      setAppState('error');
    }
  };

  const resetAll = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setTextInput('');
    setFeedbackData(null);
    setAppState('input');
  };

  // === DIFF HIGHLIGHTING ===
  const escapeHTML = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  const highlightDiff = (original = '', fixed = '') => {
    const origWords = original.split(/\s+/);
    const fixWords = fixed.split(/\s+/);
    const m = origWords.length, n = fixWords.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (origWords[i - 1].toLowerCase() === fixWords[j - 1].toLowerCase()) dp[i][j] = dp[i - 1][j - 1] + 1;
        else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }

    const origInLCS = new Set(), fixInLCS = new Set();
    let i = m, j = n;
    while (i > 0 && j > 0) {
      if (origWords[i - 1].toLowerCase() === fixWords[j - 1].toLowerCase()) {
        origInLCS.add(i - 1); fixInLCS.add(j - 1); i--; j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) i--;
      else j--;
    }

    const origHTML = origWords.map((w, idx) => origInLCS.has(idx) ? escapeHTML(w) : `<span class="fix-hl">${escapeHTML(w)}</span>`).join(' ');
    const fixHTML = fixWords.map((w, idx) => fixInLCS.has(idx) ? escapeHTML(w) : `<span class="fix-hl">${escapeHTML(w)}</span>`).join(' ');
    return { origHTML, fixHTML };
  };

  const getScoreTier = (score) => {
    if (score >= 85) return 'score-great';
    if (score >= 70) return 'score-high';
    if (score >= 50) return 'score-mid';
    return 'score-low';
  };

  const scoreFields = lastInputType === 'audio' 
    ? [{k:'grammar', l:'Grammar'}, {k:'vocabulary', l:'Vocabulary'}, {k:'pronunciation', l:'Pronunciation'}, {k:'fluency', l:'Fluency'}]
    : [{k:'grammar', l:'Grammar'}, {k:'vocabulary', l:'Vocabulary'}, {k:'clarity', l:'Clarity'}, {k:'style', l:'Style'}];

  // === SHARE ===
  useEffect(() => {
    if (shareModalOpen && shareCardRef.current) {
      const el = shareCardRef.current;
      el.style.display = 'block';
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      
      html2canvas(el, { backgroundColor: '#ffffff', scale: 2 }).then(canvas => {
        setShareImgSrc(canvas.toDataURL('image/png'));
        el.style.display = 'none';
      });
    }
  }, [shareModalOpen]);


  return (
    <div className="smartcoach-container container">
      <header>
        <h1>✨ Smart English Coach</h1>
        <p className="subtitle">Write or speak — get instant AI feedback!</p>
      </header>

      {/* --- State 1: Input Mode --- */}
      {appState === 'input' && (
        <>
          <div className="input-tabs">
            <button onClick={() => setCurrentMode('write')} className={`tab-btn ${currentMode === 'write' ? 'active' : ''}`}>✍️ Write</button>
            <button onClick={() => setCurrentMode('speak')} className={`tab-btn ${currentMode === 'speak' ? 'active' : ''}`}>🎙️ Speak</button>
          </div>

          {currentMode === 'write' && (
            <section className="input-section">
              <div className="textarea-wrap">
                <textarea className="text-input" placeholder="Type your English text here..." value={textInput} onChange={e => setTextInput(e.target.value)} maxLength={MAX_TEXT_LENGTH} rows="6" />
                <span className="char-count">{textInput.length} / {MAX_TEXT_LENGTH}</span>
              </div>
              <button onClick={handleSubmitWrite} className="btn btn-submit">Get Feedback ✨</button>
            </section>
          )}

          {currentMode === 'speak' && (
            <section className="input-section">
              <div className="record-area">
                <button onClick={toggleRecording} className={`btn-record ${isRecording ? 'recording' : ''}`}>
                  <span className="record-icon"></span>
                  <span className="record-label">{isRecording ? 'Tap to Stop' : 'Tap to Record'}</span>
                </button>
                {isRecording && <div className="timer">{formatTime(recordingSeconds)}</div>}
              </div>
              <div className="divider"><span>or</span></div>
              <div className="upload-area">
                <label className="btn btn-upload" htmlFor="fileInput">📁 Upload Audio</label>
                <input type="file" id="fileInput" accept="audio/*" hidden onChange={handleFileUpload} />
              </div>
            </section>
          )}
        </>
      )}

      {/* --- State 2: Playback (Audio Only) --- */}
      {appState === 'playback' && audioUrl && (
        <section className="playback-section">
          <audio src={audioUrl} controls></audio>
          <div className="playback-actions">
            <button onClick={handleSubmitAudio} className="btn btn-submit">Get Feedback ✨</button>
            <button onClick={resetAll} className="btn btn-reset">🔄 Re-record</button>
          </div>
        </section>
      )}

      {/* --- State 3: Loading --- */}
      {appState === 'loading' && (
        <section className="loading-section" style={{textAlign:'center', padding:'40px 0'}}>
          <div className="spinner"></div>
          <p>{lastInputType === 'text' ? 'Reading your writing...' : 'Listening to your audio...'}</p>
        </section>
      )}

      {/* --- State 4: Error --- */}
      {appState === 'error' && (
        <section style={{textAlign:'center', padding:'40px 0'}}>
          <p style={{color:'red', marginBottom:'20px'}}>{errorMessage}</p>
          <button onClick={resetAll} className="btn btn-reset">Try Again</button>
        </section>
      )}

      {/* --- State 5: Feedback --- */}
      {appState === 'feedback' && feedbackData && (
        <section className="feedback-section">
          <div className="card score-card">
            <div className="score-card-top">
              <div className={`score-circle ${getScoreTier(feedbackData.scores?.overall || 0)}`}>
                <span className="score-number">{feedbackData.scores?.overall || 0}</span>
                <span className="score-denom">/100</span>
              </div>
              <p className="score-label">{feedbackData.scoreLabel}</p>
            </div>
            <div className="sub-scores">
              {scoreFields.map(field => (
                <div className="sub-score-row" key={field.key}>
                  <span className="sub-score-name">{field.label}</span>
                  <div className="sub-score-bar-wrap">
                    <div className={`sub-score-bar ${getScoreTier(feedbackData.scores?.[field.key] || 0)}`} style={{ width: `${feedbackData.scores?.[field.key] || 0}%` }}></div>
                  </div>
                  <span className="sub-score-value">{feedbackData.scores?.[field.key] || 0}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3>{lastInputType === 'text' ? '📝 What you wrote' : '📝 What we heard'}</h3>
            <p style={{fontStyle:'italic', color:'#666'}}>{feedbackData.transcript}</p>
          </div>

          {feedbackData.fixes?.map((fix, idx) => {
            if (!fix) return null;
            const diff = highlightDiff(fix.original, fix.fix);
            return (
              <div key={idx} className="card">
                <span className="card-badge badge-fix">Simple Fix</span>
                <h3>{fix.title}</h3>
                <div className="fix-stacked">
                  <div className="fix-stacked-row fix-stacked-before"><span className="fix-stacked-label">You {lastInputType==='text'?'wrote':'said'}:</span><p className="fix-stacked-text" dangerouslySetInnerHTML={{ __html: diff.origHTML }} /></div>
                  <div className="fix-stacked-row fix-stacked-after"><span className="fix-stacked-label">Try this:</span><p className="fix-stacked-text" dangerouslySetInnerHTML={{ __html: diff.fixHTML }} /></div>
                </div>
                <p className="tutor-note">{fix.note}</p>
              </div>
            );
          })}

          {feedbackData.upgrade && (() => {
            const diff = highlightDiff(feedbackData.upgrade.original, feedbackData.upgrade.fix);
            return (
              <div className="card">
                <span className="card-badge badge-upgrade">Native Upgrade 🚀</span>
                <h3>{feedbackData.upgrade.title}</h3>
                <div className="fix-stacked">
                  <div className="fix-stacked-row fix-stacked-before"><span className="fix-stacked-label">You {lastInputType==='text'?'wrote':'said'}:</span><p className="fix-stacked-text" dangerouslySetInnerHTML={{ __html: diff.origHTML }} /></div>
                  <div className="fix-stacked-row fix-stacked-after"><span className="fix-stacked-label">Natives say:</span><p className="fix-stacked-text" dangerouslySetInnerHTML={{ __html: diff.fixHTML }} /></div>
                </div>
                <p className="tutor-note">{feedbackData.upgrade.note}</p>
              </div>
            );
          })()}

          {feedbackData.bonus && (() => {
            const diff = highlightDiff(feedbackData.bonus.original, feedbackData.bonus.fix);
            return (
              <div className="card">
                <span className={`card-badge ${lastInputType==='audio'?'badge-pron':'badge-clarity'}`}>
                  {lastInputType==='audio' ? 'Pronunciation 🗣️' : 'Clarity ✏️'}
                </span>
                <h3>{feedbackData.bonus.title}</h3>
                <div className="fix-stacked">
                  <div className="fix-stacked-row fix-stacked-before"><span className="fix-stacked-label">You {lastInputType==='text'?'wrote':'said'}:</span><p className="fix-stacked-text" dangerouslySetInnerHTML={{ __html: diff.origHTML }} /></div>
                  <div className="fix-stacked-row fix-stacked-after"><span className="fix-stacked-label">{lastInputType==='audio'?'Say it like this:':'Try this instead:'}</span><p className="fix-stacked-text" dangerouslySetInnerHTML={{ __html: diff.fixHTML }} /></div>
                </div>
                <p className="tutor-note">{feedbackData.bonus.note}</p>
              </div>
            );
          })()}

          <button onClick={() => setShareModalOpen(true)} className="btn btn-share" style={{marginTop:'10px'}}>🌟 Share Progress</button>
          <button onClick={resetAll} className="btn btn-reset" style={{width:'100%'}}>🔄 Try Again</button>
        </section>
      )}

      {/* --- Share Modal --- */}
      {shareModalOpen && (
        <div className="modal-overlay" onClick={(e) => { if(e.target.className==='modal-overlay') setShareModalOpen(false) }}>
          <div className="modal">
            <button onClick={() => setShareModalOpen(false)} className="modal-close">&times;</button>
            <h2>Share Your Progress!</h2>
            <div style={{marginBottom:'16px'}}>
              {shareImgSrc ? <img src={shareImgSrc} style={{width:'100%', borderRadius:'8px'}} alt="Share" /> : <p>⏳ Generating...</p>}
            </div>
            {/* You can add download logic here if needed! */}
          </div>
        </div>
      )}

      {/* --- Hidden Share Card for html2canvas --- */}
      <div ref={shareCardRef} style={{ display: 'none', width: '400px', background: '#fff', borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg, #219ebc, #1a7a94)', padding: '20px', textAlign: 'center', color: '#fff' }}>
          <strong style={{ fontSize: '1.3rem' }}>✨ Smart English Coach</strong>
        </div>
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <div className={`score-circle ${getScoreTier(feedbackData?.scores?.overall || 0)}`} style={{margin:'0 auto', width:'80px', height:'80px', borderRadius:'50%', border:'4px solid #bae6fd', display:'flex', alignItems:'center', justifyContent:'center'}}>
            <span style={{ fontSize: '1.6rem', fontWeight: 800 }}>{feedbackData?.scores?.overall || 0}</span>
          </div>
        </div>
      </div>

    </div>
  );
}