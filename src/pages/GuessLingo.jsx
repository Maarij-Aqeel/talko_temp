import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import './GuessLingo.css';

const ITEMS_PER_SESSION = 5;

export default function GuessLingo() {
  // --- UI State ---
  const [appState, setAppState] = useState('landing'); // landing, challenge, loading, feedback, error
  const [errorMessage, setErrorMessage] = useState('');

  // --- Game State ---
  const [todaysItems, setTodaysItems] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [chatHistory, setChatHistory] = useState([]);
  const [attemptNumber, setAttemptNumber] = useState(0);
  const [wordResolved, setWordResolved] = useState(false);
  const [sessionResults, setSessionResults] = useState([]);
  const [score, setScore] = useState(0);

  // --- Input State ---
  const [userInput, setUserInput] = useState('');
  const [inputDisabled, setInputDisabled] = useState(false);
  const chatAreaRef = useRef(null);

  // --- Audio State ---
  const [isRecording, setIsRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recTimerIntervalRef = useRef(null);

  // --- Report & Share State ---
  const [lastReport, setLastReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [activeShareType, setActiveShareType] = useState('score');
  const [shareImgSrc, setShareImgSrc] = useState(null);
  const shareCardRef = useRef(null);
  const shareFeedbackCardRef = useRef(null);

  // Auto-scroll chat
  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // Clean up audio timer
  useEffect(() => {
    return () => clearInterval(recTimerIntervalRef.current);
  }, []);

  // === HELPERS ===
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

  const getScoreTier = (pct) => {
    if (pct >= 80) return 'score-great';
    if (pct >= 50) return 'score-high';
    if (pct >= 25) return 'score-mid';
    return 'score-low';
  };

  const getScoreLabel = (pct) => {
    if (pct >= 80) return 'Word Wizard! 🧙';
    if (pct >= 50) return 'Great Detective! 🔍';
    if (pct >= 25) return 'Getting There! 💪';
    return 'Keep Exploring! 🌱';
  };

  // === DATA LOADING ===
  const loadTodaysItems = async () => {
    try {
      const [scheduleRes, idiomsRes, vocabRes] = await Promise.all([
        fetch('/data/daily-schedule.json'),
        fetch('/data/idioms.json'),
        fetch('/data/vocabulary.json'),
      ]);
      const schedule = await scheduleRes.json();
      const idioms = await idiomsRes.json();
      const vocab = await vocabRes.json();

      const idiomMap = new Map(idioms.map(i => [i.phrase, i]));
      const vocabMap = new Map(vocab.map(v => [v.word, v]));

      const start = new Date(schedule.startDate + 'T00:00:00');
      const dayIndex = Math.floor((new Date() - start) / (1000 * 60 * 60 * 24));
      const safeIndex = dayIndex >= 0 ? dayIndex % schedule.days.length : 0;
      const todaySchedule = schedule.days[safeIndex];

      const items = todaySchedule.map(ref => ref.pool === 'idioms' ? idiomMap.get(ref.id) : vocabMap.get(ref.id)).filter(Boolean);
      setTodaysItems(items);
      return items;
    } catch (err) {
      throw new Error('Failed to load challenge data.');
    }
  };

  const handleStart = async () => {
    setAppState('loading');
    try {
      const items = await loadTodaysItems();
      setCurrentIndex(0);
      setScore(0);
      setSessionResults([]);
      setLastReport(null);
      startWord(items[0]);
    } catch (err) {
      setErrorMessage(err.message);
      setAppState('error');
    }
  };

  const startWord = (item) => {
    setChatHistory([]);
    setAttemptNumber(0);
    setWordResolved(false);
    setUserInput('');
    
    const displayWord = (item.type === 'idiom' || item.type === 'phrasal_verb') ? item.phrase : item.word;
    setChatHistory([{ role: 'ai', text: `🔮 What do you think "${displayWord}" means? Tell me in your own words!` }]);
    setAppState('challenge');
  };

  // === GAME ACTIONS ===
  const resolveWord = (result) => {
    setWordResolved(true);
    const item = todaysItems[currentIndex];
    
    if (result === 'first_try') setScore(s => s + 1);
    
    setSessionResults(prev => [...prev, {
      word: (item.type === 'idiom' || item.type === 'phrasal_verb') ? item.phrase : item.word,
      type: item.type,
      result,
      attempts: attemptNumber + 1,
      chatHistory: [...chatHistory]
    }]);
  };

  const submitGuess = async (audioBase64 = null, mimeType = null) => {
    if (wordResolved) return;
    const isAudio = !!audioBase64;
    const guessText = userInput.trim();
    if (!isAudio && !guessText) return;

    const item = todaysItems[currentIndex];
    const displayWord = (item.type === 'idiom' || item.type === 'phrasal_verb') ? item.phrase : item.word;

    // Optimistic UI update
    const newHistory = [...chatHistory, { role: 'user', text: isAudio ? '🎙️ (audio answer)' : guessText }];
    setChatHistory(newHistory);
    if (!isAudio) setUserInput('');
    
    setInputDisabled(true);
    setAttemptNumber(a => a + 1);

    try {
      const payload = {
        word: displayWord,
        itemType: item.type,
        explanation: item.explanation || '',
        exampleSentences: item.exampleSentences || [],
        userGuess: isAudio ? '' : guessText,
        history: newHistory,
        attemptNumber: attemptNumber + 1,
        inputType: isAudio ? 'audio' : 'text',
      };

      if (isAudio) {
        payload.audio = audioBase64;
        payload.mimeType = mimeType;
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error();
      const data = await res.json();

      let finalHistory = newHistory;
      if (data.transcript) {
        finalHistory = [...chatHistory, { role: 'user', text: `"${data.transcript}"` }];
      }
      finalHistory = [...finalHistory, { role: 'ai', text: data.message }];
      setChatHistory(finalHistory);

      if (data.correct) resolveWord(attemptNumber === 0 ? 'first_try' : 'with_hints');
      else if (data.revealed) resolveWord('revealed');
      
    } catch {
      setChatHistory(prev => [...prev, { role: 'ai', text: '⚠️ Something went wrong. Try again.' }]);
    } finally {
      setInputDisabled(false);
    }
  };

  const handleStuck = async () => {
    if (wordResolved) return;
    const item = todaysItems[currentIndex];
    const displayWord = (item.type === 'idiom' || item.type === 'phrasal_verb') ? item.phrase : item.word;

    const newHistory = [...chatHistory, { role: 'user', text: "I'm stuck! Give me a clue 🆘" }];
    setChatHistory(newHistory);
    setInputDisabled(true);
    setAttemptNumber(a => a + 1);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: displayWord, itemType: item.type, explanation: item.explanation || '',
          exampleSentences: item.exampleSentences || [], userGuess: '',
          history: newHistory, attemptNumber: attemptNumber + 1, inputType: 'stuck',
        }),
      });

      if (!res.ok) throw new Error();
      const data = await res.json();
      setChatHistory([...newHistory, { role: 'ai', text: data.message }]);
      if (data.revealed) resolveWord('revealed');
    } catch {
      setChatHistory([...newHistory, { role: 'ai', text: '⚠️ Something went wrong.' }]);
    } finally {
      setInputDisabled(false);
    }
  };

  const handleSkip = () => {
    resolveWord('skipped');
    setChatHistory(prev => [...prev, { role: 'ai', text: '⏭️ No problem! Let\'s move on.' }]);
  };

  const handleNextWord = () => {
    if (currentIndex < ITEMS_PER_SESSION - 1) {
      setCurrentIndex(c => c + 1);
      startWord(todaysItems[currentIndex + 1]);
    } else {
      setAppState('feedback');
    }
  };

  // === AUDIO RECORDING ===
  const startRecording = async () => {
    if (wordResolved || isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (recSeconds < 1) return;
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
        const base64 = btoa(binary);

        const rawType = blob.type || 'audio/webm';
        const MIME_MAP = { 'audio/x-m4a': 'audio/mp4', 'audio/x-wav': 'audio/wav', 'audio/mp3': 'audio/mpeg' };
        
        submitGuess(base64, MIME_MAP[rawType] || rawType);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecSeconds(0);
      recTimerIntervalRef.current = setInterval(() => {
        setRecSeconds(s => {
          if (s >= 30) { stopRecording(); return s; }
          return s + 1;
        });
      }, 1000);
    } catch {
      setChatHistory(prev => [...prev, { role: 'ai', text: '⚠️ Could not access microphone.' }]);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    clearInterval(recTimerIntervalRef.current);
  };

  // === REPORT ===
  const generateReport = async () => {
    setReportLoading(true);
    try {
      const payload = sessionResults.map(r => ({
        word: r.word, type: r.type, result: r.result, attempts: r.attempts,
        userInputs: r.chatHistory.filter(h => h.role === 'user').map(h => h.text),
      }));

      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: payload }),
      });

      if (!res.ok) throw new Error();
      const data = await res.json();
      setLastReport(data);
    } catch {
      alert('Failed to generate report. Please try again.');
    } finally {
      setReportLoading(false);
    }
  };

  // === SHARE ===
  const generateShareImg = async () => {
    setShareImgSrc(null);
    const el = activeShareType === 'feedback' && lastReport ? shareFeedbackCardRef.current : shareCardRef.current;
    if (!el) return;
    
    el.style.position = 'fixed'; el.style.left = '-9999px'; el.style.display = 'block';
    try {
      const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
      setShareImgSrc(canvas.toDataURL('image/png'));
    } finally {
      el.style.display = 'none'; el.style.position = ''; el.style.left = '';
    }
  };

  useEffect(() => {
    if (shareModalOpen) generateShareImg();
  }, [shareModalOpen, activeShareType]);

  // === RENDERERS ===
  const currentItem = todaysItems[currentIndex] || {};
  const badgeText = currentItem.type === 'idiom' ? '💬 Idiom' : currentItem.type === 'phrasal_verb' ? '🔗 Phrasal Verb' : `📝 Vocab ${currentItem.cefr ? `(${currentItem.cefr})` : ''}`;

  const firstTryCount = sessionResults.filter(r => r.result === 'first_try').length;
  const hintsCount = sessionResults.filter(r => r.result === 'with_hints').length;
  const revealedCount = sessionResults.filter(r => r.result === 'revealed').length;
  const sessionPct = sessionResults.length > 0 ? Math.round((firstTryCount / sessionResults.length) * 100) : 0;

  return (
    <div className="guesslingo-container container">
      
      {/* --- Landing --- */}
      {appState === 'landing' && (
        <section className="step-section">
          <header className="landing-header">
            <h1>🔮 GuessLingo</h1>
            <p className="subtitle">Can you guess the meaning? Play with AI!</p>
          </header>
          <div className="landing-features">
            <div className="feature-item">🧩 Daily word &amp; idiom challenges</div>
            <div className="feature-item">🤖 Get mysterious AI clues</div>
            <div className="feature-item">📊 Track your score &amp; share</div>
          </div>
          <button onClick={handleStart} className="btn btn-primary btn-large">Start Today's Challenge 🎮</button>
        </section>
      )}

      {/* --- Loading / Error --- */}
      {appState === 'loading' && <section className="step-section"><div className="spinner"></div><p>Thinking...</p></section>}
      {appState === 'error' && <section className="step-section"><p className="error-text">{errorMessage}</p><button onClick={() => setAppState('landing')} className="btn btn-secondary">Try Again</button></section>}

      {/* --- Challenge UI --- */}
      {appState === 'challenge' && (
        <section className="step-section">
          <div className="progress-bar-wrap">
            <div className="progress-info">
              <span className="progress-label">Word {currentIndex + 1} of {ITEMS_PER_SESSION}</span>
              <span className="progress-score">Score: {score}</span>
            </div>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${(currentIndex / ITEMS_PER_SESSION) * 100}%` }}></div></div>
          </div>

          <div className="word-display">
            <span className={`word-badge ${currentItem.type === 'vocabulary' ? 'badge-vocab' : 'badge-idiom'}`}>{badgeText}</span>
            <h2 className="current-word">{currentItem.phrase || currentItem.word}</h2>
            <p className="word-prompt">What does this mean? Explain in your own words.</p>
          </div>

          <div className="chat-area" ref={chatAreaRef}>
            {chatHistory.map((msg, i) => (
              <div key={i} className={`chat-bubble chat-${msg.role}`}>{msg.text}</div>
            ))}
          </div>

          {!wordResolved ? (
            <div className="input-area">
              {!isRecording ? (
                <>
                  <div className="input-row">
                    <input type="text" className="user-input" placeholder="Type your answer..." value={userInput} onChange={e => setUserInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitGuess()} disabled={inputDisabled} />
                    <button onClick={() => submitGuess()} className="btn btn-send" disabled={inputDisabled}>➤</button>
                  </div>
                  <div className="input-actions">
                    <button onClick={startRecording} className="btn btn-mic" disabled={inputDisabled}>🎙️</button>
                    {attemptNumber === 0 && <button onClick={handleStuck} className="btn btn-stuck" disabled={inputDisabled}>🆘 I'm Stuck</button>}
                    <button onClick={handleSkip} className="btn btn-skip" disabled={inputDisabled}>⏭ Skip</button>
                  </div>
                </>
              ) : (
                <div className="recording-indicator">
                  <span className="rec-dot"></span>
                  <span className="rec-timer">0:{recSeconds.toString().padStart(2, '0')}</span>
                  <button onClick={stopRecording} className="btn btn-stop-rec">⏹ Stop</button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={handleNextWord} className="btn btn-primary btn-next">{currentIndex < ITEMS_PER_SESSION - 1 ? 'Next Word →' : 'See Results 🎉'}</button>
          )}
        </section>
      )}

      {/* --- Feedback / Results --- */}
      {appState === 'feedback' && (
        <section className="step-section">
          <div className="step-header"><h2>🎉 Challenge Complete!</h2></div>
          
          <div className="card score-card">
            <div className="score-card-top">
              <div className={`score-circle ${getScoreTier(sessionPct)}`}>
                <span className="score-number">{firstTryCount}</span><span className="score-denom">/{ITEMS_PER_SESSION}</span>
              </div>
              <p className="score-label">{getScoreLabel(sessionPct)}</p>
            </div>
            <div className="sub-scores">
              <div className="sub-score-row"><span className="sub-score-name">First Try</span><div className="sub-score-bar-wrap"><div className={`sub-score-bar ${getScoreTier(sessionPct)}`} style={{width:`${(firstTryCount/ITEMS_PER_SESSION)*100}%`}}></div></div><span className="sub-score-value">{firstTryCount}</span></div>
              <div className="sub-score-row"><span className="sub-score-name">With Hints</span><div className="sub-score-bar-wrap"><div className="sub-score-bar score-mid" style={{width:`${(hintsCount/ITEMS_PER_SESSION)*100}%`}}></div></div><span className="sub-score-value">{hintsCount}</span></div>
              <div className="sub-score-row"><span className="sub-score-name">Revealed</span><div className="sub-score-bar-wrap"><div className="sub-score-bar score-low" style={{width:`${(revealedCount/ITEMS_PER_SESSION)*100}%`}}></div></div><span className="sub-score-value">{revealedCount}</span></div>
            </div>
          </div>

          <div className="word-results">
            {sessionResults.map((r, i) => (
              <div key={i} className="word-result-row">
                <span className="wr-icon">{r.result === 'first_try' ? '✅' : r.result === 'with_hints' ? '💡' : r.result === 'skipped' ? '⏭' : '📖'}</span>
                <span className="wr-word">{r.type === 'idiom' ? '💬' : r.type === 'phrasal_verb' ? '🔗' : '📝'} {r.word}</span>
                <span className={`wr-label wr-${r.result}`}>{r.result.replace('_', ' ')}</span>
              </div>
            ))}
          </div>

          {lastReport ? (
            <div className="card report-card">
              <span className="card-badge badge-report">📝 AI Feedback</span>
              {lastReport.fixes?.map((f, i) => {
                const diff = highlightDiff(f.original, f.fix);
                return (
                  <div key={i} className="report-fix-card">
                    <div className="rfc-badge rfc-fix">🔧 Simple Fix</div><p className="rfc-title">{f.title}</p>
                    <div className="fix-stacked">
                      <div className="fix-stacked-row fix-stacked-before"><span className="fix-stacked-label">You wrote:</span><p className="fix-stacked-text" dangerouslySetInnerHTML={{__html: diff.origHTML}}></p></div>
                      <div className="fix-stacked-row fix-stacked-after"><span className="fix-stacked-label">Try this:</span><p className="fix-stacked-text" dangerouslySetInnerHTML={{__html: diff.fixHTML}}></p></div>
                    </div>
                    <p className="rfc-note">{f.note}</p>
                  </div>
                );
              })}
              {lastReport.upgrade && (() => {
                const diff = highlightDiff(lastReport.upgrade.original, lastReport.upgrade.fix);
                return (
                  <div className="report-fix-card">
                    <div className="rfc-badge rfc-upgrade">⬆️ Level Up</div><p className="rfc-title">{lastReport.upgrade.title}</p>
                    <div className="fix-stacked">
                      <div className="fix-stacked-row fix-stacked-before"><span className="fix-stacked-label">You wrote:</span><p className="fix-stacked-text" dangerouslySetInnerHTML={{__html: diff.origHTML}}></p></div>
                      <div className="fix-stacked-row fix-stacked-after"><span className="fix-stacked-label">Natives say:</span><p className="fix-stacked-text" dangerouslySetInnerHTML={{__html: diff.fixHTML}}></p></div>
                    </div>
                    <p className="rfc-note">{lastReport.upgrade.note}</p>
                  </div>
                );
              })()}
            </div>
          ) : (
            <button onClick={generateReport} disabled={reportLoading} className="btn btn-secondary" style={{width:'100%', marginBottom:'16px'}}>
              {reportLoading ? '⏳ Generating...' : '📝 Get AI Feedback Report'}
            </button>
          )}

          <div className="feedback-actions">
            <button onClick={() => setShareModalOpen(true)} className="btn btn-primary">🌟 Share Progress</button>
            <button onClick={() => setAppState('landing')} className="btn btn-secondary">🔄 Play Again Tomorrow</button>
          </div>
        </section>
      )}

      {/* --- Share Modal --- */}
      {shareModalOpen && (
        <div className="modal-overlay" onClick={(e) => e.target.className==='modal-overlay' && setShareModalOpen(false)}>
          <div className="modal">
            <button onClick={() => setShareModalOpen(false)} className="modal-close">&times;</button>
            <h2>Share Your Progress!</h2>
            <div className="share-type-toggle">
              <button onClick={() => setActiveShareType('score')} className={`btn-share-tab ${activeShareType==='score'?'active':''}`}>📊 Score</button>
              <button onClick={() => setActiveShareType('feedback')} disabled={!lastReport} className={`btn-share-tab ${activeShareType==='feedback'?'active':''}`}>📝 Feedback</button>
            </div>
            <div className="share-preview-wrap">
              {shareImgSrc ? <img src={shareImgSrc} className="share-preview-img" alt="Share" /> : <p className="share-preview-spinner">⏳ Generating...</p>}
            </div>
          </div>
        </div>
      )}

      {/* --- Hidden Share Cards --- */}
      <div ref={shareCardRef} style={{ display: 'none', width: '400px', background: '#fff', borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)', padding: '20px', textAlign: 'center', color: '#fff' }}>
          <strong style={{ fontSize: '1.3rem' }}>🔮 GuessLingo</strong>
        </div>
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <div className={`sc-score-circle ${getScoreTier(sessionPct)}`} style={{display:'inline-flex', flexDirection:'column', alignItems:'center', justifyContent:'center', width:'80px', height:'80px', borderRadius:'50%', border:'4px solid #e5e7eb'}}>
            <span style={{ fontSize: '1.6rem', fontWeight: 700 }}>{firstTryCount}</span><span style={{fontSize:'0.7rem', color:'#666'}}>/{ITEMS_PER_SESSION}</span>
          </div>
          <p style={{ fontWeight: 600 }}>{getScoreLabel(sessionPct)}</p>
        </div>
      </div>
      
      <div ref={shareFeedbackCardRef} style={{ display: 'none', width: '400px', background: '#fff', borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)', padding: '20px', textAlign: 'center', color: '#fff' }}>
          <strong style={{ fontSize: '1.3rem' }}>🔮 GuessLingo Feedback</strong>
        </div>
        <div style={{ padding: '16px' }}>
          {lastReport?.fixes?.map((f, i) => (
             <div key={i} style={{background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:'10px', padding:'10px', marginBottom:'8px', fontSize:'0.75rem'}}>
               <strong>🔧 {f.title}</strong><br/>"{f.fix}"<br/><em style={{color:'#666'}}>{f.note}</em>
             </div>
          ))}
          {lastReport?.upgrade && (
             <div style={{background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:'10px', padding:'10px', marginBottom:'8px', fontSize:'0.75rem'}}>
               <strong>⬆️ {lastReport.upgrade.title}</strong><br/>"{lastReport.upgrade.fix}"<br/><em style={{color:'#666'}}>{lastReport.upgrade.note}</em>
             </div>
          )}
        </div>
      </div>

    </div>
  );
}