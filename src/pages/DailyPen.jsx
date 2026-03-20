import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import './DailyPen.css'; // Import the dedicated CSS

// --- Fallback Data ---
const FALLBACK_PROMPTS = {
  reflect: [
    { prompt: 'What is something new you learned this week? How did it make you feel?', vocab: ['fascinating', 'discover', 'perspective', 'realize'] },
    { prompt: 'Describe a person who has influenced your life. What did they teach you?', vocab: ['inspire', 'grateful', 'wisdom', 'role model'] },
    { prompt: 'Think about a time you stepped out of your comfort zone. What happened and how did you feel?', vocab: ['courage', 'nervous', 'overcome', 'rewarding'] },
  ],
  world: [
    { prompt: 'Technology is changing how people communicate around the world. mostly positive or negative?', vocab: ['connection', 'interact', 'meaningful'], source: 'General' },
    { prompt: 'More people are working from home than ever before. Do you think this trend will continue?', vocab: ['remote', 'flexibility', 'isolation'], source: 'General' },
  ],
  random: [
    { prompt: 'If you could wake up tomorrow with one new skill, what would it be and why?', vocab: ['master', 'ambitious', 'transform', 'passion'] },
  ],
};

export default function DailyPen() {
  // --- UI State ---
  const [appState, setAppState] = useState('landing'); // landing, prompt, write, loading, feedback, error
  const [errorMessage, setErrorMessage] = useState('');

  // --- Prompt State ---
  const [promptsData, setPromptsData] = useState(null);
  const [currentCategory, setCurrentCategory] = useState('reflect');
  const [promptLoading, setPromptLoading] = useState(false);
  const [translations, setTranslations] = useState({});
  const [targetLang, setTargetLang] = useState('Chinese');

  // --- Write State ---
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [selectedVocab, setSelectedVocab] = useState([]);
  const [journalText, setJournalText] = useState('');
  const [writeSeconds, setWriteSeconds] = useState(0);
  const [showVocab, setShowVocab] = useState(true);
  
  // --- Lifeline State ---
  const [showLifeline, setShowLifeline] = useState(false);
  const [lifelineInput, setLifelineInput] = useState('');
  const [lifelineResults, setLifelineResults] = useState([]);
  const [lifelineLoading, setLifelineLoading] = useState(false);

  // --- Feedback State ---
  const [feedbackData, setFeedbackData] = useState(null);
  const [fcActiveTab, setFcActiveTab] = useState('clean');
  
  // --- Rewrite Challenge State ---
  const [showRewrite, setShowRewrite] = useState(false);
  const [rewriteInput, setRewriteInput] = useState('');
  const [rewriteFeedback, setRewriteFeedback] = useState(null);
  const [showRewriteHint, setShowRewriteHint] = useState(false);
  const [rewriteChecking, setRewriteChecking] = useState(false);

  // --- Share State ---
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareMode, setShareMode] = useState('score');
  const [shareImgSrc, setShareImgSrc] = useState(null);
  const [shareConfirmMsg, setShareConfirmMsg] = useState('');

  // --- Refs ---
  const timerIntervalRef = useRef(null);
  const shareCardRef = useRef(null);
  const shareCardFeedbackRef = useRef(null);

  // === EFFECTS ===
  // Load draft on mount
  useEffect(() => {
    try {
      const draft = localStorage.getItem('dailypen_draft');
      if (draft) setJournalText(draft);
    } catch { /* ignore */ }
  }, []);

  // Save draft on change
  useEffect(() => {
    if (appState === 'write') {
      try { localStorage.setItem('dailypen_draft', journalText); } catch { /* ignore */ }
    }
  }, [journalText, appState]);

  // Clean up timer
  useEffect(() => {
    return () => clearInterval(timerIntervalRef.current);
  }, []);

  // === HELPERS ===
  const wordCount = journalText.trim().split(/\s+/).filter(Boolean).length;
  
  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getScoreTier = (score) => {
    if (score >= 85) return 'score-great';
    if (score >= 70) return 'score-high';
    if (score >= 50) return 'score-mid';
    return 'score-low';
  };

  const escapeHTML = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const highlightDiff = (original = '', fixed = '') => {
    const origWords = original.split(/\s+/);
    const fixWords = fixed.split(/\s+/);
    const m = origWords.length, n = fixWords.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (origWords[i - 1].toLowerCase() === fixWords[j - 1].toLowerCase()) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    const origInLCS = new Set(), fixInLCS = new Set();
    let i = m, j = n;
    while (i > 0 && j > 0) {
      if (origWords[i - 1].toLowerCase() === fixWords[j - 1].toLowerCase()) {
        origInLCS.add(i - 1); fixInLCS.add(j - 1);
        i--; j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) i--;
      else j--;
    }

    const origHTML = origWords.map((w, idx) => origInLCS.has(idx) ? escapeHTML(w) : `<span class="fix-hl">${escapeHTML(w)}</span>`).join(' ');
    const fixHTML = fixWords.map((w, idx) => fixInLCS.has(idx) ? escapeHTML(w) : `<span class="fix-hl">${escapeHTML(w)}</span>`).join(' ');
    return { origHTML, fixHTML };
  };

  // === ACTIONS ===
  const fetchPrompts = async (refresh = false) => {
    setPromptLoading(true);
    try {
      const url = refresh ? '/api/prompt?refresh=1' : '/api/prompt';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setPromptsData(prev => refresh ? { ...prev, [currentCategory]: data[currentCategory] } : data);
    } catch {
      if (!promptsData) setPromptsData(FALLBACK_PROMPTS); // Use fallback if fresh load fails
    } finally {
      setPromptLoading(false);
    }
  };

  const handleStart = () => {
    setAppState('prompt');
    if (!promptsData) fetchPrompts();
  };

  const handleTranslatePrompt = async (idx, text) => {
    if (translations[idx]) {
      // Toggle off
      setTranslations(prev => { const next = {...prev}; delete next[idx]; return next; });
      return;
    }
    setTranslations(prev => ({ ...prev, [idx]: '⏳ Translating...' }));
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLang }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTranslations(prev => ({ ...prev, [idx]: data.translation }));
    } catch {
      setTranslations(prev => ({ ...prev, [idx]: 'Could not translate.' }));
    }
  };

  const startWriting = (promptText = null, vocab = []) => {
    setSelectedPrompt(promptText);
    setSelectedVocab(vocab);
    setAppState('write');
    setWriteSeconds(0);
    clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => setWriteSeconds(s => s + 1), 1000);
  };

  const handleLifelineSubmit = async () => {
    if (!lifelineInput.trim()) return;
    setLifelineLoading(true);
    try {
      const res = await fetch('/api/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nativeText: lifelineInput, nativeLang: targetLang }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLifelineResults([{ ...data, original: lifelineInput }, ...lifelineResults]);
      setLifelineInput('');
    } catch {
      alert('Could not translate. Please try again.');
    } finally {
      setLifelineLoading(false);
    }
  };

  const handleSubmitJournal = async () => {
    if (wordCount < 5) {
      setErrorMessage('Please write at least a few words to get feedback.');
      setAppState('error');
      return;
    }
    clearInterval(timerIntervalRef.current);
    setAppState('loading');
    try {
      const res = await fetch('/api/dailypen_feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: journalText, prompt: selectedPrompt || '' }),
      });
      if (!res.ok) throw new Error('Server error');
      const data = await res.json();
      setFeedbackData(data);
      localStorage.removeItem('dailypen_draft');
      setAppState('feedback');j
    } catch (err) {
      setErrorMessage(err.message || 'Something went wrong.');
      setAppState('error');
    }
  };

  const handleRewriteCheck = async () => {
    if (!rewriteInput.trim()) return;
    setRewriteChecking(true);
    try {
      const rc = feedbackData?.rewriteChallenge;
      const res = await fetch('/api/rewrite-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original: rc?.original, improved: rc?.improved, rewrite: rewriteInput }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRewriteFeedback(data);
    } catch {
      setRewriteFeedback({ rating: 'try_again', feedback: 'Could not check rewrite. Try again.' });
    } finally {
      setRewriteChecking(false);
    }
  };

  const generateShareImg = async () => {
    setShareImgSrc(null);
    const el = shareMode === 'feedback' ? shareCardFeedbackRef.current : shareCardRef.current;
    if (!el) return;
    el.style.display = 'block';
    try {
      const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
      setShareImgSrc(canvas.toDataURL('image/png'));
    } catch {
      setShareConfirmMsg('❌ Could not generate preview.');
    } finally {
      el.style.display = 'none';
    }
  };

  useEffect(() => {
    if (shareModalOpen) generateShareImg();
  }, [shareModalOpen, shareMode]);


  // === RENDERERS ===
  return (
    <div className="container dailypen-container">
      
      {/* --- Landing --- */}
      {appState === 'landing' && (
        <section className="step-section">
          <header className="landing-header">
            <h1>✏️ DailyPen</h1>
            <p className="subtitle">Write your way to better English — one journal entry at a time.</p>
          </header>
          <div className="landing-features">
            <div className="feature-item">💡 Get inspired with daily prompts</div>
            <div className="feature-item">🌍 Write about trending topics</div>
            <div className="feature-item">🤖 Get gentle AI feedback</div>
          </div>
          <button onClick={handleStart} className="btn btn-primary btn-large">Start Today's Journal ✨</button>
        </section>
      )}

      {/* --- Prompt Selection --- */}
      {appState === 'prompt' && (
        <section className="step-section">
          <div className="step-header">
            <button onClick={() => setAppState('landing')} className="btn-back">←</button>
            <h2>Choose a Prompt</h2>
          </div>
          
          <div className="prompt-tabs">
            {['reflect', 'world', 'random'].map(cat => (
              <button key={cat} onClick={() => setCurrentCategory(cat)} className={`prompt-tab ${currentCategory === cat ? 'active' : ''}`}>
                {cat === 'reflect' ? '💭 Reflect' : cat === 'world' ? '🌍 World' : '🎲 Random'}
              </button>
            ))}
          </div>

          {promptLoading ? (
            <div className="prompt-loading"><div className="spinner"></div><p>Loading today's prompts...</p></div>
          ) : (
            <div className="prompt-list">
              {(promptsData?.[currentCategory] || []).map((item, idx) => (
                <div key={idx} className="prompt-card" onClick={() => startWriting(item.prompt, item.vocab)}>
                  <p className="prompt-card-text">{item.prompt}</p>
                  {item.source && <span className="prompt-source">{item.source}</span>}
                  <div className="prompt-vocab-preview">
                    {item.vocab.map(v => <span key={v} className="vocab-chip">{v}</span>)}
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleTranslatePrompt(idx, item.prompt); }} className="prompt-translate-btn">🌐 Translate</button>
                  {translations[idx] && <div className="prompt-translation"><p className="prompt-translation-text">{translations[idx]}</p></div>}
                </div>
              ))}
            </div>
          )}

          <div className="prompt-lang-row">
            <label className="prompt-lang-label">🌐 Translate to:</label>
            <select value={targetLang} onChange={e => setTargetLang(e.target.value)} className="prompt-lang-select">
              <option value="Chinese">中文 Chinese</option>
              <option value="Spanish">Español Spanish</option>
              <option value="French">Français French</option>
              {/* Add more as needed */}
            </select>
          </div>

          <div className="prompt-actions">
            <button onClick={() => fetchPrompts(true)} className="btn btn-small btn-secondary">🔄 More prompts</button>
            <button onClick={() => startWriting(null, [])} className="btn btn-secondary">Or just free-write →</button>
          </div>
        </section>
      )}

      {/* --- Write Section --- */}
      {appState === 'write' && (
        <section className="step-section">
          <div className="step-header">
            <button onClick={() => setAppState('prompt')} className="btn-back">←</button>
            <h2>Write Your Journal</h2>
          </div>

          {selectedPrompt && (
            <div className="selected-prompt"><p>{selectedPrompt}</p></div>
          )}

          {selectedVocab.length > 0 && (
            <div className="vocab-panel">
              <div className="vocab-header">
                <span>📚 Try using these words</span>
                <button onClick={() => setShowVocab(!showVocab)} className="vocab-toggle">{showVocab ? '▼' : '▶'}</button>
              </div>
              {showVocab && (
                <div className="vocab-list">
                  {selectedVocab.map(v => <span key={v} className="vocab-chip vocab-chip-write">{v}</span>)}
                </div>
              )}
            </div>
          )}

          <div className="write-area">
            <textarea 
              className="journal-input" 
              placeholder="Start writing..." 
              value={journalText} 
              onChange={e => setJournalText(e.target.value)}
              rows="10"
            />
            <div className="write-meta">
              <span>{wordCount} words</span>
              <span>{formatTime(writeSeconds)}</span>
            </div>
          </div>

          <div className="lifeline-section">
            <button onClick={() => setShowLifeline(!showLifeline)} className="lifeline-toggle">🌐 Help me say this in English</button>
            {showLifeline && (
              <div className="lifeline-panel">
                <div className="lifeline-inputs">
                  <div className="lifeline-input-row">
                    <input type="text" className="native-input" placeholder="Type in your language..." value={lifelineInput} onChange={e => setLifelineInput(e.target.value)} />
                    <button onClick={handleLifelineSubmit} disabled={lifelineLoading} className="btn btn-small btn-primary">{lifelineLoading ? '...' : 'Help me'}</button>
                  </div>
                </div>
                <div className="lifeline-results">
                  {lifelineResults.map((res, i) => (
                    <div key={i} className="lifeline-card">
                      <p className="lifeline-native">"{res.original}"</p>
                      <p className="lifeline-english">{res.english}</p>
                      <p className="lifeline-explanation">{res.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button onClick={handleSubmitJournal} className="btn btn-primary btn-large">Get Feedback ✨</button>
        </section>
      )}

      {/* --- Loading & Error --- */}
      {appState === 'loading' && (
        <section className="step-section" style={{ textAlign: 'center', padding: '60px 0' }}>
          <div className="spinner"></div><p>Reading your journal and preparing feedback...</p>
        </section>
      )}

      {appState === 'error' && (
        <section className="step-section" style={{ textAlign: 'center' }}>
          <p className="error-text">{errorMessage}</p>
          <button onClick={() => setAppState('write')} className="btn btn-secondary">Back to Journal</button>
        </section>
      )}

      {/* --- Feedback Section --- */}
      {appState === 'feedback' && feedbackData && !showRewrite && (
        <section className="step-section">
          <div className="step-header"><h2>Your Feedback</h2></div>

          <div className="card welldone-card">
            <p>{feedbackData.wellDone || 'Great job writing today!'}</p>
          </div>

          <div className="card score-card">
            <div className="score-card-top">
              <div className={`score-circle ${getScoreTier(feedbackData.scores?.overall || 0)}`}>
                <span className="score-number">{feedbackData.scores?.overall || 0}</span>
                <span className="score-denom">/100</span>
              </div>
              <p className="score-label">{feedbackData.scoreLabel}</p>
            </div>
            <div className="sub-scores">
              {['grammar', 'vocabulary', 'coherence', 'expression'].map(key => (
                <div key={key} className="sub-score-row">
                  <span className="sub-score-name" style={{textTransform:'capitalize'}}>{key}</span>
                  <div className="sub-score-bar-wrap">
                    <div className={`sub-score-bar ${getScoreTier(feedbackData.scores?.[key] || 0)}`} style={{ width: `${feedbackData.scores?.[key] || 0}%` }}></div>
                  </div>
                  <span className="sub-score-value">{feedbackData.scores?.[key] || 0}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Render Fixes via dangerouslySetInnerHTML to support LCS highlighting */}
          {feedbackData.fixes?.map((fix, idx) => {
            if (!fix) return null;
            const diff = highlightDiff(fix.original, fix.fix);
            return (
              <div key={idx} className="card fix-card">
                <span className="card-badge badge-fix">Gentle Fix</span>
                <h3>{fix.title}</h3>
                <div className="fix-stacked">
                  <div className="fix-stacked-row fix-stacked-before"><span className="fix-stacked-label">You wrote:</span><p className="fix-stacked-text" dangerouslySetInnerHTML={{ __html: diff.origHTML }} /></div>
                  <div className="fix-stacked-row fix-stacked-after"><span className="fix-stacked-label">Try this:</span><p className="fix-stacked-text" dangerouslySetInnerHTML={{ __html: diff.fixHTML }} /></div>
                </div>
                <p className="tutor-note">{fix.note}</p>
              </div>
            );
          })}

          {feedbackData.upgrade && (() => {
            const diff = highlightDiff(feedbackData.upgrade.original, feedbackData.upgrade.fix);
            return (
              <div className="card upgrade-card">
                <span className="card-badge badge-upgrade">Native Upgrade 🚀</span>
                <h3>{feedbackData.upgrade.title}</h3>
                <div className="fix-stacked">
                  <div className="fix-stacked-row fix-stacked-before"><span className="fix-stacked-label">You wrote:</span><p className="fix-stacked-text" dangerouslySetInnerHTML={{ __html: diff.origHTML }} /></div>
                  <div className="fix-stacked-row fix-stacked-after"><span className="fix-stacked-label">Natives say:</span><p className="fix-stacked-text" dangerouslySetInnerHTML={{ __html: diff.fixHTML }} /></div>
                </div>
                <p className="tutor-note">{feedbackData.upgrade.note}</p>
              </div>
            );
          })()}

          {/* Full Corrected */}
          {feedbackData.fullCorrected && (
             <div className="card fullcorrected-card">
               <span className="card-badge badge-corrected">📄 Your Journal — Corrected</span>
               <div className="fc-tabs">
                 <button onClick={() => setFcActiveTab('clean')} className={`fc-tab ${fcActiveTab === 'clean' ? 'active' : ''}`}>✅ Clean</button>
                 <button onClick={() => setFcActiveTab('polished')} className={`fc-tab ${fcActiveTab === 'polished' ? 'active' : ''}`}>✨ Polished</button>
                 <button onClick={() => setFcActiveTab('native')} className={`fc-tab ${fcActiveTab === 'native' ? 'active' : ''}`}>🗣️ Native</button>
               </div>
               <div className="fc-content">{feedbackData.fullCorrected[fcActiveTab]}</div>
             </div>
          )}

          <div className="feedback-actions">
            {feedbackData.rewriteChallenge && <button onClick={() => setShowRewrite(true)} className="btn btn-accent">✍️ Try Rewrite Challenge</button>}
            <button onClick={() => setShareModalOpen(true)} className="btn btn-primary">🌟 Share Progress</button>
            <button onClick={() => { setJournalText(''); setAppState('prompt'); }} className="btn btn-secondary">✏️ Write Another</button>
          </div>
        </section>
      )}

      {/* --- Rewrite Challenge Section (Overlays Feedback) --- */}
      {showRewrite && feedbackData?.rewriteChallenge && (
         <section className="step-section">
           <button onClick={() => setShowRewrite(false)} className="btn btn-secondary" style={{marginBottom: '10px'}}>← Back to Feedback</button>
           <div className="card rewrite-card">
             <span className="card-badge badge-challenge">✍️ Rewrite Challenge</span>
             <p className="rewrite-prompt">Can you fix this sentence?</p>
             <div className="rewrite-original"><p>{feedbackData.rewriteChallenge.original}</p></div>
             <textarea className="rewrite-input" rows="3" value={rewriteInput} onChange={e => setRewriteInput(e.target.value)} placeholder="Rewrite it here..."></textarea>
             
             {showRewriteHint && (
               <div className="rewrite-hint">
                 <p><strong>Hint:</strong> {feedbackData.rewriteChallenge.hint}</p>
                 <p className="rewrite-answer">Suggested: <em>{feedbackData.rewriteChallenge.improved}</em></p>
               </div>
             )}

             {rewriteFeedback && (
               <div className={`rewrite-feedback rewrite-fb-${rewriteFeedback.rating}`}>
                 <p className="rewrite-fb-rating">{rewriteFeedback.rating === 'great' ? '🌟' : '👍'} {rewriteFeedback.feedback}</p>
                 {rewriteFeedback.tip && <p className="rewrite-fb-tip">💡 {rewriteFeedback.tip}</p>}
               </div>
             )}

             <div className="rewrite-actions">
               <button onClick={handleRewriteCheck} disabled={rewriteChecking} className="btn btn-small btn-primary">{rewriteChecking ? '⏳' : '✅ Check'}</button>
               <button onClick={() => setShowRewriteHint(true)} className="btn btn-small btn-secondary">Show Hint</button>
             </div>
           </div>
         </section>
      )}

      {/* --- Share Modal --- */}
      {shareModalOpen && (
        <div className="modal-overlay" onClick={(e) => { if(e.target.className==='modal-overlay') setShareModalOpen(false) }}>
          <div className="modal">
            <button onClick={() => setShareModalOpen(false)} className="modal-close">&times;</button>
            <h2>Share Your Progress!</h2>
            <div className="share-type-toggle">
              <button onClick={() => setShareMode('score')} className={`share-type-btn ${shareMode==='score'?'active':''}`}>📊 Score Only</button>
              <button onClick={() => setShareMode('feedback')} className={`share-type-btn ${shareMode==='feedback'?'active':''}`}>📝 Score + Feedback</button>
            </div>
            <div className="share-preview-wrap">
              {shareImgSrc ? <img src={shareImgSrc} className="share-preview-img" alt="Share" /> : <p className="share-preview-spinner">⏳ Generating preview...</p>}
            </div>
            {/* Action buttons omitted for brevity, you can add download logic here! */}
            {shareConfirmMsg && <p className="copy-confirm">{shareConfirmMsg}</p>}
          </div>
        </div>
      )}

      {/* --- Hidden Off-Screen Share Cards for html2canvas (Required for image generation) --- */}
      <div ref={shareCardRef} className="share-card" style={{ display: 'none', position: 'fixed', left: '-9999px', top: '0', width: '400px', padding: '24px', background: '#fff' }}>
        <div className="sc-header"><span className="sc-logo">✏️ DailyPen</span></div>
        <div className="sc-score-wrap">
          <div className={`sc-score-circle ${getScoreTier(feedbackData?.scores?.overall || 0)}`} style={{width:'64px', height:'64px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center'}}>
            <span style={{fontSize:'1.3rem', color:'#fff', fontWeight:800}}>{feedbackData?.scores?.overall || 0}</span>
          </div>
          <p style={{fontWeight:700}}>{feedbackData?.scoreLabel}</p>
        </div>
        <p style={{fontSize:'0.75rem', color:'#666'}}>Practice English with DailyPen</p>
      </div>

    </div>
  );
}