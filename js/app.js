/* ===== APPLICATION PRINCIPALE (SIMPLIFIE) ===== */

document.addEventListener('DOMContentLoaded', () => {
  if (typeof dlog === 'function') dlog('DOMContentLoaded OK');
  var scene = document.querySelector('a-scene');

  if (!scene) {
    if (typeof dlog === 'function') dlog('ERREUR: a-scene introuvable!', '#ff4444');
    return;
  }

  var loadTimeout = setTimeout(function () {
    if (typeof dlog === 'function') dlog('TIMEOUT: Scene non chargee apres 10s!', '#ff8800');
  }, 10000);

  scene.addEventListener('loaded', () => {
    clearTimeout(loadTimeout);
    if (typeof dlog === 'function') dlog('Scene chargee OK!', '#00ff00');

    // Seule action : ouvrir l'explorateur de fichiers
    scene.addEventListener('menu-action', (e) => {
      if (e.detail.action === 'files') {
        var explorer = document.querySelector('[file-explorer]');
        if (explorer && explorer.components['file-explorer']) {
          explorer.components['file-explorer'].open();
        }
      }
    });
  });
});
