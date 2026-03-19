import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../supabaseClient'; // Adjust path if necessary

export default function ProtectedRoute({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check if they are already logged in when they arrive
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // 2. Listen for changes (like when they click the Magic Link)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Show a quick loading state while Supabase checks their credentials
  if (loading) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px' }}>
        <h2>Verifying Access...</h2>
        <div className="spinner"></div>
      </div>
    );
  }

  // If Supabase says they aren't logged in, kick them to the login page
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // If they are logged in, let them see the protected tool!
  return children;
}