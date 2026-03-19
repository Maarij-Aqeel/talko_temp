import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../supabaseClient'; 

export default function Logout() {
  const [isLoggedOut, setIsLoggedOut] = useState(false);

  useEffect(() => {
    const performLogout = async () => {
      // 1. Wait for Supabase to fully destroy the session
      await supabase.auth.signOut();
      
      // 2. ONLY after it is destroyed, flip the state to trigger the redirect
      setIsLoggedOut(true);
    };
    
    performLogout();
  }, []);

  // Show a quick loading message while Supabase does its job
  if (!isLoggedOut) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px' }}>
        <h2>Logging out...</h2>
        <div className="spinner"></div>
      </div>
    );
  }

  // Once the state flips to true, redirect them safely to login
  return <Navigate to="/login" replace />;
}