import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Home() {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    navigate('/login');
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', fontFamily: 'sans-serif' }}>
      
      {/* Dashboard Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div>
          <h1 style={{ color: '#219ebc', margin: 0 }}>Welcome to WordBuddy! 👋</h1>
          <p style={{ color: '#666', marginTop: '8px' }}>Choose a tool below to start practicing your English.</p>
        </div>
        <button 
          onClick={handleSignOut} 
          style={{ padding: '8px 16px', backgroundColor: '#ff4d4f', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Sign Out
        </button>
      </div>

      {/* Tools Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        
        {/* Tuesday Talko Card */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🎙️</div>
          <h2 style={{ marginBottom: '8px' }}>Tuesday Talko</h2>
          <p style={{ color: '#666', marginBottom: '24px', flexGrow: 1 }}>
            Practice your spoken English. Record yourself speaking and get instant AI feedback on your pronunciation, grammar, and fluency.
          </p>
          <Link to="/tuesday_talko" style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary" style={{ width: '100%' }}>Launch Talko</button>
          </Link>
        </div>

        {/* DailyPen Card */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✍️</div>
          <h2 style={{ marginBottom: '8px' }}>DailyPen</h2>
          <p style={{ color: '#666', marginBottom: '24px', flexGrow: 1 }}>
            Write your way to better English. Pick a daily journal prompt and get gentle AI corrections and native phrasing upgrades.
          </p>
          <Link to="/dailypen" style={{ textDecoration: 'none' }}>
            <button className="btn btn-accent" style={{ width: '100%' }}>Launch DailyPen</button>
          </Link>
        </div>

        {/* GuessLingo Card */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔮</div>
          <h2 style={{ marginBottom: '8px' }}>GuessLingo</h2>
          <p style={{ color: '#666', marginBottom: '24px', flexGrow: 1 }}>
            Test your English vocabulary & idiom knowledge. Play a daily minigame and get clues from a mysterious AI guide!
          </p>
          <Link to="/guesslingo" style={{ textDecoration: 'none' }}>
            <button className="btn btn-accent" style={{ width: '100%' }}>Launch GuessLingo</button>
          </Link>
        </div>

        {/* Smart English Coach Card */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✨</div>
          <h2 style={{ marginBottom: '8px' }}>Smart Coach</h2>
          <p style={{ color: '#666', marginBottom: '24px', flexGrow: 1 }}>
            Practice your English in any format. Write a text or speak into the microphone to get instant AI feedback and scores!
          </p>
           <Link to="/smart-coach" style={{ textDecoration: 'none' }}>
            <button className="btn btn-accent" style={{ width: '100%' }}>Launch SmartCoach</button>
          </Link>
        </div>

      </div>
    </div>
  );
}