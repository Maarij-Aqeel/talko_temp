import React, { useState } from "react";
import { supabase } from "../supabaseClient"; // Adjust path as needed

export default function Login() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      // 1. Call your Edge Function to check Heartbeat
      const { data, error: functionError } = await supabase.functions.invoke(
        "verify-heartbeat-user",
        {
          body: { email: email },
        },
      );

      if (functionError) throw functionError;

      // 2. Check the result from Heartbeat
      if (!data.isMember) {
        setMessage(
          "Access Denied: You must be a member of the WordBuddy community to log in.",
        );
        setLoading(false);
        return; // Stop the execution here!
      }

      // 3. If they are a member, trigger the Supabase Magic Link
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          // This redirects them back to your app after they click the link in their email
          emailRedirectTo: window.location.origin + "/",
        },
      });

      if (authError) throw authError;

      setMessage("Success! Check your email for the secure login link.");
    } catch (error) {
      setMessage(error.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-wrapper">
      <div className="card login-card">
        <div className="login-header">
          <img
            src="/logo.png"
            alt="WordBuddy Logo"
            style={{
              width: "80px",
              height: "80px",
              objectFit: "contain",
              marginBottom: "10px",
            }}
          />
          <h1>Welcome to WordBuddy</h1>
          <p>Sign in to your account with a Magic Link</p>
        </div>
        <form onSubmit={handleLogin} className="login-form">
          <div className="input-group">
            <input
              type="email"
              className="login-input"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-submit btn-login"
            disabled={loading}
          >
            {loading ? "Sending..." : "Send Magic Link"}
          </button>
        </form>
        {message && <p className="login-message">{message}</p>}
      </div>
    </div>
  );
}
