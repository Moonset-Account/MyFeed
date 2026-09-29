import { mount } from 'svelte';
import App from './App.svelte';
import './styles.css';

const app = mount(App, { target: document.getElementById('app')! });

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker is an offline enhancement; the local app remains usable.
    });
  });
}

export default app;
