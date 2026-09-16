import { registerSW } from 'virtual:pwa-register';

// The Capacitor Android shell already ships the assets on-device and serves
// them from its own scheme, so the service worker is web-only.
const isCapacitor = typeof window !== 'undefined' && 'Capacitor' in window;

export function registerServiceWorker() {
  if (isCapacitor || !('serviceWorker' in navigator)) return;
  registerSW({ immediate: true });
}
