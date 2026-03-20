import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // Add this
import { supabase } from '../supabaseClient'; // Add this

export default function Tuesday_talko() {

  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.clear(); // Nuke the cache
    navigate('/login'); // Force the redirect safely
  };

  // --- UI State ---
  const [appState, setAppState] = useState('input'); // 'input', 'playback', 'loading', 'feedback', 'error'
  const [errorMessage, setErrorMessage] = useState('');
  
  // --- Recording State ---
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  
  // --- Audio & Feedback Data ---
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [feedbackData, setFeedbackData] = useState(null);

  // --- Refs for MediaRecorder ---
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);

  const MAX_DURATION_SEC = 180; // 3 minutes
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearInterval(timerIntervalRef.current);
  }, []);

  // Format timer
  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ==========================================
  // 1. RECORDING LOGIC
  // ==========================================
  const toggleRecording = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone access is not supported in this browser.');
      }

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
          showError('Recording too short. Please speak for at least a few seconds.');
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
          if (prev >= MAX_DURATION_SEC - 1) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err) {
      showError('Microphone access is required. Please allow microphone access and try again.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    clearInterval(timerIntervalRef.current);
  };

  // ==========================================
  // 2. FILE UPLOAD LOGIC
  // ==========================================
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      showError('File is too large. Please upload an audio file under 10MB.');
      e.target.value = '';
      return;
    }

    setAudioBlob(file);
    setAudioUrl(URL.createObjectURL(file));
    setAppState('playback');
  };

  // ==========================================
  // 3. API SUBMISSION LOGIC
  // ==========================================
  const handleSubmit = async () => {
    if (!audioBlob) return;
    setAppState('loading');

    try {
      // Convert audio blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);

      // Resolve MIME type
      const rawType = audioBlob.type 
        || (audioBlob.name?.endsWith('.mp3') ? 'audio/mpeg' 
        : audioBlob.name?.endsWith('.wav') ? 'audio/wav' 
        : 'audio/webm');
      
      const MIME_MAP = { 'audio/x-m4a': 'audio/mp4', 'audio/x-wav': 'audio/wav', 'audio/mp3': 'audio/mpeg' };
      const mimeType = MIME_MAP[rawType] || rawType;

      // Send to backend
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
      setFeedbackData(data);
      setAppState('feedback');

    } catch (err) {
      showError(err.message || 'Something went wrong while getting feedback.');
    }
  };

  // ==========================================
  // 4. UTILS
  // ==========================================
  const showError = (msg) => {
    setErrorMessage(msg);
    setAppState('error');
    stopRecording();
  };

  const resetAll = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setFeedbackData(null);
    setErrorMessage('');
    setIsRecording(false);
    setRecordingSeconds(0);
    setAppState('input');
  };

  const getScoreTier = (score) => {
    if (score >= 85) return 'score-great';
    if (score >= 70) return 'score-high';
    if (score >= 50) return 'score-mid';
    return 'score-low';
  };

  // ==========================================
  // RENDER UI
  // ==========================================
  return (
    <div className="talko-container">
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px' }}>
        <button 
          onClick={handleSignOut} 
          style={{ padding: '8px 16px', backgroundColor: '#ff4d4f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Sign Out
        </button>
      </div>
      {/* --- State 1: Record / Upload Section --- */}
      {appState === 'input' && (
        <section className="record-section">
          <div className="record-area">
            <button 
              className={`btn btn-record ${isRecording ? 'recording' : ''}`} 
              onClick={toggleRecording}
            >
              <span className="record-icon"></span>
              <span className="record-label">{isRecording ? 'Tap to Stop' : 'Tap to Record'}</span>
            </button>
            {isRecording && <div className="timer">{formatTime(recordingSeconds)}</div>}
          </div>

          <div className="divider"><span>or</span></div>

          <div className="upload-area">
            <label className="btn btn-upload" htmlFor="fileInput">
              📁 Upload Audio File
            </label>
            <input type="file" id="fileInput" accept="audio/*" hidden onChange={handleFileUpload} />
          </div>
        </section>
      )}

      {/* --- State 2: Audio Playback --- */}
      {appState === 'playback' && audioUrl && (
        <section className="playback-section">
          <audio src={audioUrl} controls style={{ width: '100%', marginBottom: '20px' }}></audio>
          <div className="playback-actions">
            <button onClick={handleSubmit} className="btn btn-submit">Get Feedback ✨</button>
            <button onClick={resetAll} className="btn btn-reset">🔄 Re-record</button>
          </div>
        </section>
      )}

      {/* --- State 3: Loading State --- */}
      {appState === 'loading' && (
        <section className="loading-section">
          <div className="spinner"></div>
          <p>Listening to your audio and preparing feedback...</p>
        </section>
      )}

      {/* --- State 4: Error State --- */}
      {appState === 'error' && (
        <section className="error-section">
          <p className="error-text">{errorMessage}</p>
          <button onClick={resetAll} className="btn btn-reset">Try Again</button>
        </section>
      )}

      {/* --- State 5: Feedback Display --- */}
      {appState === 'feedback' && feedbackData && (
        <section className="feedback-section">
          {/* Score Card */}
          <div className="card score-card">
            <div className="score-card-top">
              <div className={`score-circle ${getScoreTier(feedbackData.scores?.overall || 0)}`}>
                <span className="score-number">{feedbackData.scores?.overall || '--'}</span>
                <span className="score-denom">/100</span>
              </div>
              <p className="score-label">{feedbackData.scoreLabel}</p>
            </div>
            
            <div className="sub-scores">
              {['grammar', 'vocabulary', 'pronunciation', 'fluency'].map((metric) => (
                <div className="sub-score-row" key={metric}>
                  <span className="sub-score-name" style={{ textTransform: 'capitalize' }}>{metric}</span>
                  <div className="sub-score-bar-wrap">
                    <div 
                      className={`sub-score-bar ${getScoreTier(feedbackData.scores?.[metric] || 0)}`} 
                      style={{ width: `${feedbackData.scores?.[metric] || 0}%` }}
                    ></div>
                  </div>
                  <span className="sub-score-value">{feedbackData.scores?.[metric] || '--'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Transcript */}
          <div className="card transcript-card">
            <h3>📝 What we heard</h3>
            <p>{feedbackData.transcript}</p>
          </div>

          {/* Fixes */}
          {feedbackData.fixes?.map((fix, index) => (
            <div className="card fix-card" key={index}>
              <span className="card-badge badge-fix">Simple Fix</span>
              <h3>{fix.title}</h3>
              <div className="fix-content">
                <p className="fix-label">The Fix:</p>
                <p className="fix-text">{fix.fix}</p>
              </div>
              <p className="tutor-note">{fix.note}</p>
            </div>
          ))}

          {/* Native Upgrade */}
          {feedbackData.upgrade && (
            <div className="card upgrade-card">
              <span className="card-badge badge-upgrade">Native Upgrade 🚀</span>
              <h3>{feedbackData.upgrade.title}</h3>
              <div className="fix-content">
                <p className="fix-label">Native Upgrade:</p>
                <p className="fix-text">{feedbackData.upgrade.fix}</p>
              </div>
              <p className="tutor-note">{feedbackData.upgrade.note}</p>
            </div>
          )}

          {/* Pronunciation Fix */}
          {feedbackData.pronunciation && (
            <div className="card pron-card">
              <span className="card-badge badge-pron">Pronunciation 🗣️</span>
              <h3>{feedbackData.pronunciation.title}</h3>
              <div className="fix-content">
                <p className="fix-label">Say it like this:</p>
                <p className="fix-text">{feedbackData.pronunciation.fix}</p>
              </div>
              <p className="tutor-note">{feedbackData.pronunciation.note}</p>
            </div>
          )}

          <button onClick={resetAll} className="btn btn-reset" style={{ marginTop: '20px' }}>🎙️ Try Another Recording</button>
        </section>
      )}

    </div>
  );
}