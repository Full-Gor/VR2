/* ===== MODE AR VIDEO SEE-THROUGH ===== */
/* Active la camera du telephone en fond, rend la scene A-Frame transparente */
/* Supporte le mode stereo : duplique le feed camera en 2 moities gauche/droite */

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

      // Si le mode stereo est deja actif, activer le split camera
      if (window.cardboardStereo && window.cardboardStereo.isActive()) {
        enterStereoAR();
      }

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

    // Sortir du mode stereo AR si actif
    exitStereoAR();

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

  // ===== MODE STEREO AR =====
  // Quand AR + VR stereo sont actifs ensemble :
  // - Le feed camera unique est cache
  // - 2 containers gauche/droite affichent chacun le meme flux camera
  // - Chaque container fait 50% de largeur, clippant le centre de la video

  function enterStereoAR() {
    var videoEl = document.getElementById('ar-camera-feed');
    if (!videoEl) return;

    // Cacher le feed camera plein ecran
    videoEl.style.display = 'none';

    // Creer le container stereo s'il n'existe pas
    var container = document.getElementById('ar-stereo-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'ar-stereo-container';
      container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;display:flex;pointer-events:none;';

      // Video oeil gauche
      var leftDiv = document.createElement('div');
      leftDiv.style.cssText = 'width:50%;height:100%;overflow:hidden;position:relative;';
      var leftVid = document.createElement('video');
      leftVid.id = 'ar-cam-left';
      leftVid.autoplay = true;
      leftVid.playsInline = true;
      leftVid.muted = true;
      leftVid.style.cssText = 'position:absolute;top:0;left:50%;transform:translateX(-50%);height:100%;min-width:100%;object-fit:cover;';
      leftDiv.appendChild(leftVid);

      // Video oeil droit
      var rightDiv = document.createElement('div');
      rightDiv.style.cssText = 'width:50%;height:100%;overflow:hidden;position:relative;';
      var rightVid = document.createElement('video');
      rightVid.id = 'ar-cam-right';
      rightVid.autoplay = true;
      rightVid.playsInline = true;
      rightVid.muted = true;
      rightVid.style.cssText = 'position:absolute;top:0;left:50%;transform:translateX(-50%);height:100%;min-width:100%;object-fit:cover;';
      rightDiv.appendChild(rightVid);

      container.appendChild(leftDiv);
      container.appendChild(rightDiv);
      document.body.appendChild(container);
    }

    container.style.display = 'flex';

    // Assigner le meme stream aux 2 videos
    if (cameraStream) {
      var leftVid = document.getElementById('ar-cam-left');
      var rightVid = document.getElementById('ar-cam-right');
      if (leftVid) {
        leftVid.srcObject = cameraStream;
        leftVid.play().catch(function () {});
      }
      if (rightVid) {
        rightVid.srcObject = cameraStream;
        rightVid.play().catch(function () {});
      }
    }

    if (typeof dlog === 'function') dlog('AR stereo mode ON', '#00ff00');
  }

  function exitStereoAR() {
    var container = document.getElementById('ar-stereo-container');
    if (container) {
      container.style.display = 'none';
      // Arreter les videos stereo
      var leftVid = document.getElementById('ar-cam-left');
      var rightVid = document.getElementById('ar-cam-right');
      if (leftVid) leftVid.srcObject = null;
      if (rightVid) rightVid.srcObject = null;
    }

    // Si AR est toujours actif, remettre le feed camera plein ecran
    if (arActive) {
      var videoEl = document.getElementById('ar-camera-feed');
      if (videoEl && cameraStream) {
        videoEl.srcObject = cameraStream;
        videoEl.style.display = 'block';
        videoEl.play().catch(function () {});
      }
    }
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
    isActive: function () { return arActive; },
    enterStereo: enterStereoAR,
    exitStereo: exitStereoAR
  };
})();
