/* ===== MODE AR VIDEO SEE-THROUGH ===== */
/* Active la camera du telephone en fond, rend la scene A-Frame transparente */

(function () {
  var arActive = false;
  var cameraStream = null;

  function startAR() {
    if (arActive) return;

    var videoEl = document.getElementById('ar-camera-feed');
    if (!videoEl) return;

    // Demander l'acces camera arriere
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    }).then(function (stream) {
      cameraStream = stream;
      videoEl.srcObject = stream;
      videoEl.style.display = 'block';
      videoEl.play().catch(function () {});

      // Rendre le canvas A-Frame transparent
      var canvas = document.querySelector('a-scene canvas');
      if (canvas) {
        canvas.style.background = 'transparent';
      }

      // Rendre le renderer transparent
      var scene = document.querySelector('a-scene');
      if (scene && scene.renderer) {
        scene.renderer.setClearColor(0x000000, 0);
        scene.renderer.setClearAlpha(0);
        // Forcer alpha sur le context WebGL
        var gl = scene.renderer.getContext();
        if (gl) {
          gl.clearColor(0, 0, 0, 0);
        }
      }

      // Cacher le sky et le sol
      var sky = document.querySelector('a-sky');
      if (sky) sky.setAttribute('visible', false);
      var floor = document.querySelector('a-scene > a-plane');
      if (floor) floor.setAttribute('visible', false);

      arActive = true;
      updateBtn();

      if (typeof dlog === 'function') dlog('AR mode active', '#00ff00');
    }).catch(function (err) {
      if (typeof dlog === 'function') dlog('AR camera error: ' + err.message, '#ff4444');
      alert('Camera non disponible: ' + err.message);
    });
  }

  function stopAR() {
    if (!arActive) return;

    var videoEl = document.getElementById('ar-camera-feed');
    if (videoEl) {
      videoEl.style.display = 'none';
      videoEl.srcObject = null;
    }

    if (cameraStream) {
      cameraStream.getTracks().forEach(function (t) { t.stop(); });
      cameraStream = null;
    }

    // Restaurer le canvas opaque
    var canvas = document.querySelector('a-scene canvas');
    if (canvas) {
      canvas.style.background = '';
    }

    // Restaurer le renderer
    var scene = document.querySelector('a-scene');
    if (scene && scene.renderer) {
      scene.renderer.setClearColor(0x000000, 1);
      scene.renderer.setClearAlpha(1);
    }

    // Remettre le sky et le sol
    var sky = document.querySelector('a-sky');
    if (sky) sky.setAttribute('visible', true);
    var floor = document.querySelector('a-scene > a-plane');
    if (floor) floor.setAttribute('visible', true);

    arActive = false;
    updateBtn();

    if (typeof dlog === 'function') dlog('AR mode desactive');
  }

  function toggleAR() {
    if (arActive) stopAR();
    else startAR();
  }

  function updateBtn() {
    var btn = document.getElementById('ar-btn');
    if (!btn) return;
    if (arActive) {
      btn.textContent = 'QUITTER AR';
      btn.classList.add('active');
    } else {
      btn.textContent = 'MODE AR';
      btn.classList.remove('active');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('ar-btn');
    if (btn) btn.addEventListener('click', toggleAR);
  });

  // API publique
  window.arMode = {
    start: startAR,
    stop: stopAR,
    toggle: toggleAR,
    isActive: function () { return arActive; }
  };
})();
