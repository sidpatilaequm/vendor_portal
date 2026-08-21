import React, { useEffect, useState } from 'react';
import axios from 'axios';

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth_token')}` });

/**
 * Embeds NexD Report Designer — a separate deployed app (its own Flask backend + React
 * frontend, reverse-proxied under /analytics/) — inside the admin panel instead of sending
 * the admin off to a new tab with its own login screen. This component fetches a short-lived
 * NexD token server-side (backend_java holds the real NexD admin credential, see
 * AnalyticsSsoController) and hands it to the iframe via a one-time URL param, which NexD's
 * own frontend consumes on load to skip straight past its login form.
 */
export default function AdminAnalytics() {
  const [src, setSrc] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get('/api/admin/analytics-sso-token', { headers: authHeaders() })
      .then(({ data }) => {
        setSrc(`https://nexdsupportal.in/analytics/?sso_token=${encodeURIComponent(data.token)}`);
      })
      .catch((e) => {
        setError(e.response?.data?.detail || 'Could not sign in to the Report Designer.');
      });
  }, []);

  if (error) {
    return <div className="p-4 text-danger small">{error}</div>;
  }
  if (!src) {
    return <div className="p-4 text-muted small">Loading Report Designer…</div>;
  }
  return (
    <iframe
      title="Report Designer"
      src={src}
      style={{ width: '100%', height: 'calc(100vh - 120px)', border: 'none', borderRadius: 8 }}
    />
  );
}
