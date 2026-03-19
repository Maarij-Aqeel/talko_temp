import React from 'react';

export default function Home() {
  return (
    <div className="talko-container">
      {/* --- Record / Upload Section --- */}
      <section id="recordSection" className="record-section">
        <div className="record-area">
          <button id="recordBtn" className="btn btn-record" aria-label="Record audio">
            <span className="record-icon"></span>
            <span className="record-label">Tap to Record</span>
          </button>
          <div id="timer" className="timer" hidden>0:00</div>
        </div>

        <div className="divider"><span>or</span></div>

        <div className="upload-area">
          <label className="btn btn-upload" htmlFor="fileInput">
            📁 Upload Audio File
          </label>
          <input type="file" id="fileInput" accept="audio/*" hidden />
          <span id="fileName" className="file-name"></span>
        </div>
      </section>

      {/* --- Audio Playback --- */}
      <section id="playbackSection" className="playback-section" hidden>
        <audio id="audioPlayer" controls></audio>
        <div className="playback-actions">
          <button id="submitBtn" className="btn btn-submit">Get Feedback ✨</button>
          <button id="reRecordBtn" className="btn btn-reset">🔄 Re-record</button>
        </div>
      </section>

      {/* --- Loading State --- */}
      <section id="loadingSection" className="loading-section" hidden>
        <div className="spinner"></div>
        <p>Listening to your audio and preparing feedback...</p>
      </section>

      {/* --- Feedback Display --- */}
      <section id="feedbackSection" className="feedback-section" hidden>
        {/* Score Card */}
        <div id="scoreCard" className="card score-card">
          <div className="score-card-top">
            <div id="scoreCircle" className="score-circle">
              <span id="scoreNumber" className="score-number"></span>
              <span className="score-denom">/100</span>
            </div>
            <p id="scoreLabel" className="score-label"></p>
          </div>
          <div className="sub-scores">
            <div className="sub-score-row">
              <span className="sub-score-name">Grammar</span>
              <div className="sub-score-bar-wrap">
                <div id="grammarBar" className="sub-score-bar"></div>
              </div>
              <span id="grammarValue" className="sub-score-value"></span>
            </div>
            <div className="sub-score-row">
              <span className="sub-score-name">Vocabulary</span>
              <div className="sub-score-bar-wrap">
                <div id="vocabularyBar" className="sub-score-bar"></div>
              </div>
              <span id="vocabularyValue" className="sub-score-value"></span>
            </div>
            <div className="sub-score-row">
              <span className="sub-score-name">Pronunciation</span>
              <div className="sub-score-bar-wrap">
                <div id="pronunciationBar" className="sub-score-bar"></div>
              </div>
              <span id="pronunciationValue" className="sub-score-value"></span>
            </div>
            <div className="sub-score-row">
              <span className="sub-score-name">Fluency</span>
              <div className="sub-score-bar-wrap">
                <div id="fluencyBar" className="sub-score-bar"></div>
              </div>
              <span id="fluencyValue" className="sub-score-value"></span>
            </div>
          </div>
        </div>

        {/* Transcript */}
        <div id="transcriptCard" className="card transcript-card">
          <h3>📝 What we heard</h3>
          <p id="transcriptText"></p>
        </div>

        {/* Fixes */}
        <div id="fix1Card" className="card fix-card">
          <span className="card-badge badge-fix">Simple Fix</span>
          <h3 id="fix1Title"></h3>
          <div className="fix-content">
            <p className="fix-label">The Fix:</p>
            <p id="fix1Fix" className="fix-text"></p>
          </div>
          <p id="fix1Note" className="tutor-note"></p>
        </div>

        <div id="fix2Card" className="card fix-card">
          <span className="card-badge badge-fix">Simple Fix</span>
          <h3 id="fix2Title"></h3>
          <div className="fix-content">
            <p className="fix-label">The Fix:</p>
            <p id="fix2Fix" className="fix-text"></p>
          </div>
          <p id="fix2Note" className="tutor-note"></p>
        </div>

        {/* Native Upgrade */}
        <div id="upgradeCard" className="card upgrade-card">
          <span className="card-badge badge-upgrade">Native Upgrade 🚀</span>
          <h3 id="upgradeTitle"></h3>
          <div className="fix-content">
            <p className="fix-label">Native Upgrade:</p>
            <p id="upgradeFix" className="fix-text"></p>
          </div>
          <p id="upgradeNote" className="tutor-note"></p>
        </div>

        {/* Pronunciation Fix */}
        <div id="pronCard" className="card pron-card" hidden>
          <span className="card-badge badge-pron">Pronunciation 🗣️</span>
          <h3 id="pronTitle"></h3>
          <div className="fix-content">
            <p className="fix-label">Say it like this:</p>
            <p id="pronFix" className="fix-text"></p>
          </div>
          <p id="pronNote" className="tutor-note"></p>
        </div>

        {/* Share Nudge */}
        <div id="shareNudge" className="share-nudge">
          <p className="nudge-text">🏆 Post your score in the community! Members who share get more support and feedback.</p>
          <button id="nudgeCopyBtn" className="btn btn-nudge-copy">📋 Copy & Share</button>
          <p id="nudgeConfirm" className="nudge-confirm" hidden></p>
        </div>

        {/* Share + Try Again */}
        <button id="shareBtn" className="btn btn-share">🌟 Share Your Progress</button>
        <button id="resetBtn" className="btn btn-reset">🎙️ Try Another Recording</button>
      </section>

      {/* --- Share Modal --- */}
      <div id="shareModal" className="modal-overlay" hidden>
        <div className="modal">
          <button id="modalCloseBtn" className="modal-close" aria-label="Close">&times;</button>
          <h2>Share Your Progress!</h2>
          <p className="modal-subtitle">Post this in the community!</p>
          <div id="sharePreviewWrap" className="share-preview-wrap">
            <p id="sharePreviewSpinner" className="share-preview-spinner">⏳ Generating preview...</p>
            <img id="sharePreviewImg" className="share-preview-img" alt="Progress card" hidden />
          </div>
          <div className="share-img-actions">
            <button id="copyImgBtn" className="btn btn-modal-action">📋 Copy Text</button>
            <button id="downloadImgBtn" className="btn btn-modal-action btn-modal-primary">⬇️ Download</button>
          </div>
          <button id="downloadAudioBtn" className="btn btn-modal-action btn-modal-audio">🎵 Download Audio</button>
          <p id="shareConfirm" className="copy-confirm" hidden></p>
        </div>
      </div>

      {/* --- Share Card (off-screen) --- */}
      <div id="shareCard" className="share-card" aria-hidden="true">
        <div className="sc-header">
          <span className="sc-logo">🎙️ Tuesday Talko</span>
          <span className="sc-tagline">AI English Speaking Feedback</span>
        </div>
        <div className="sc-score-wrap">
          <div id="scScoreCircle" className="sc-score-circle">
            <span id="scScoreNumber" className="sc-score-number"></span>
            <span className="sc-score-denom">/100</span>
          </div>
          <p id="scScoreLabel" className="sc-score-label"></p>
        </div>
        <div className="sc-sub-scores">
          {/* Sub scores simplified for brevity, you can add them back following the same pattern */}
           <div className="sc-sub-row">
            <span className="sc-sub-name">Grammar</span>
            <div className="sc-sub-bar-wrap">
              <div id="scGrammarBar" className="sc-sub-bar"></div>
            </div>
            <span id="scGrammarValue" className="sc-sub-value"></span>
          </div>
          {/* Add Vocabulary, Pronunciation, Fluency here */}
        </div>
        <div className="sc-summary">
          <p className="sc-summary-title">My Feedback Summary</p>
          <div className="sc-summary-item">
            <span className="sc-item-badge sc-badge-fix">Fix 1</span>
            <div className="sc-item-body">
              <p id="scFix1Title" className="sc-item-title"></p>
              <p id="scFix1Fix" className="sc-item-fix"></p>
            </div>
          </div>
          <div className="sc-summary-item">
            <span className="sc-item-badge sc-badge-fix">Fix 2</span>
            <div className="sc-item-body">
              <p id="scFix2Title" className="sc-item-title"></p>
              <p id="scFix2Fix" className="sc-item-fix"></p>
            </div>
          </div>
          <div className="sc-summary-item">
            <span className="sc-item-badge sc-badge-upgrade">Upgrade 🚀</span>
            <div className="sc-item-body">
              <p id="scUpgradeTitle" className="sc-item-title"></p>
              <p id="scUpgradeFix" className="sc-item-fix sc-item-fix--upgrade"></p>
            </div>
          </div>
          <div id="scPronRow" className="sc-summary-item">
            <span className="sc-item-badge sc-badge-pron">Pronunciation 🗣️</span>
            <div className="sc-item-body">
              <p id="scPronTitle" className="sc-item-title"></p>
              <p id="scPronFix" className="sc-item-fix sc-item-fix--pron"></p>
            </div>
          </div>
        </div>
        <div className="sc-footer">
          Practice English with WordBuddy.ai
        </div>
      </div>

      {/* --- Error State --- */}
      <section id="errorSection" className="error-section" hidden>
        <p id="errorText" className="error-text"></p>
        <a id="openInBrowserBtn" className="btn btn-open-browser" href="https://talko-temp.vercel.app/" target="_blank" rel="noopener noreferrer" hidden>
          🎙️ Open in Browser
        </a>
        <button id="errorResetBtn" className="btn btn-reset">Try Again</button>
      </section>
    </div>
  );
}