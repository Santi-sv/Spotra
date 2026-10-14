/* SPOTRA · clave pública de notificaciones y service worker
   (13/10/2026: antes estaba escrito dentro de index.html; se pasó a archivo para poder activar la protección CSP, que bloquea todo código escrito dentro del HTML) */
window.SPOTRA_VAPID_PUBLIC_KEY = 'BM-PX91SylFCb7P2pVWt8G5sKNK3jj94BXkrP-cN_YP764VD_-2sZrDl4YzCBN5OO4v4A4GW10H89oLk9GUqJ8M';
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('[SPOTRA] SW:', err));
  });
}
