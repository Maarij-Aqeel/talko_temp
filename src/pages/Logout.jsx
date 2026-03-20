import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../supabaseClient'; 

export default function Logout() {
  const [isLoggedOut, setIsLoggedOut] = useState(false);

  useEffect(() => {
    const performLogout = async () => {
      try {
        // 1. Tell the Supabase server to destroy the session
        await supabase.auth.signOut();
      } catch (error) {
        console.error("Logout error:", error);
      } finally {
        // 2. Bruteforce clear the browser's local storage just in case
        localStorage.clear();
        sessionStorage.clear();
        
        // 3. Trigger the redirect
        setIsLoggedOut(true);
      }
    };
    
    performLogout();
  }, []);

  if (!isLoggedOut) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px' }}>
        <h2>Logging out...</h2>
        <div className="spinner"></div>
      </div>
    );
  }

  return <Navigate to="/login" replace />;
}