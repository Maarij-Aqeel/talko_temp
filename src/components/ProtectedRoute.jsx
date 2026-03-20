import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../supabaseClient'; 

export default function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // getUser() physically asks the Supabase server if the token is valid,
      // preventing "ghost" sessions from browser cache from letting people in.
      const { data: { user }, error } = await supabase.auth.getUser();

      if (user) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
      setLoading(false);
    };

    checkAuth();

    // Listen for real-time changes (like logging out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setIsAuthenticated(false);
      } else if (session) {
        setIsAuthenticated(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px' }}>
        <h2>Verifying Access...</h2>
        <div className="spinner"></div>
      </div>
    );
  }

  // If the server says they aren't authenticated, kick them out
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}