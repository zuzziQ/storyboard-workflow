import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Global fetch patch to send x-frontend-app header to StoryMee core API for analytics logging
const originalFetch = window.fetch;
window.fetch = async function (input, init) {
  const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : (input ? (input as Request).url : ''));
  const isTarget = url.includes('storymee') || url.includes('localhost') || url.includes('127.0.0.1');
  
  if (isTarget) {
    init = init || {};
    const headers = new Headers(init.headers);
    if (!headers.has('x-frontend-app')) {
      headers.set('x-frontend-app', 'flow-architect');
    }
    
    // Convert Headers object back to record or pass it directly if fetch options support it
    const plainHeaders: Record<string, string> = {};
    headers.forEach((value, key) => {
      plainHeaders[key] = value;
    });
    init.headers = plainHeaders;
  }
  
  return originalFetch.call(this, input, init);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
