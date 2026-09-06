import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Suppress benign cross-origin "Script error." (usually from YouTube ad-blockers)
// from triggering the big red Webpack Dev Server error overlay.
window.addEventListener('error', (e) => {
  if (e.message === 'Script error.') {
    e.stopImmediatePropagation();
  }
});

const queryClient = new QueryClient();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID || 'google-client-id-placeholder'}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);
