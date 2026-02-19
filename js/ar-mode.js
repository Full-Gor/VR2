/* ===== MODE AR VIDEO SEE-THROUGH ===== */
/* Dessine le flux camera directement dans le canvas WebGL comme fond */
/* En mode stereo : le quad camera est rendu dans chaque oeil */

(function () {
  var arActive = false;
  var cameraStream = null;
  var videoEl = null;
  var videoTexture = null;
  var bgScene = null;
  var bgCamera = null;
  var bgMesh = null;

  function createBgScene() {
    // Scene orthographique separee pour le fond camera
    bgScene = new THREE.Scene();
    bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Creer la texture video
    videoEl = document.getElementById('ar-camera-feed');
    videoTexture = new THREE.VideoTexture(videoEl);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.format = THREE.RGBAFormat;

    // Quad plein ecran
    var geo = new THREE.PlaneGeometry(2, 2);
    var mat = new THREE.MeshBasicMaterial({ map: videoTexture, depthTest: false, depthWrite: false });
    bgMesh = new THREE.Mesh(geo, mat);
    bgScene.add(bgMesh);
  }

  function startAR() {
    if (arActive) return;

    videoEl = document.getElementById('ar-camera-feed');
    if (!videoEl) return;

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    }).then(function (stream) {
      cameraStream = stream;
      videoEl.srcObject = stream;
      // On n'affiche PAS le <video> HTML, on l'utilise juste comme source de texture
      videoEl.style.display = 'none';
      videoEl.play().catch(function () {});

      // Attendre que la video ait des frames
      videoEl.addEventListener('playing', function onPlaying() {
        videoEl.removeEventListener('playing', onPlaying);
        createBgScene();
        if (typeof dlog === 'function') dlog('AR: texture camera prete', '#00ff00');
      });

      // Cacher le sky et le sol (on les remplace par le feed camera)
      var sky = document.querySelector('a-sky');
      if (sky) sky.setAttribute('visible', false);
      var floor = document.querySelector('a-scene > a-plane');
      if (floor) floor.setAttribute('visible', false);

      // Rendre le renderer transparent (le fond camera sera dessine avant la scene 3D)
      var scene = document.querySelector('a-scene');
      if (scene && scene.renderer) {
        scene.renderer.setClearColor(0x000000, 0);
        scene.renderer.setClearAlpha(0);
      }

      arActive = true;
      updateBtn();

      if (typeof dlog === 'function') dlog('AR mode active (WebGL)', '#00ff00');
    }).catch(function (err) {
      if (typeof dlog === 'function') dlog('AR camera error: ' + err.message, '#ff4444');
      alert('Camera non disponible: ' + err.message);
    });
  }

  function stopAR() {
    if (!arActive) return;

    videoEl = document.getElementById('ar-camera-feed');
    if (videoEl) {
      videoEl.style.display = 'none';
      videoEl.srcObject = null;
    }

    if (cameraStream) {
      cameraStream.getTracks().forEach(function (t) { t.stop(); });
      cameraStream = null;
    }

    // Nettoyer la scene de fond
    if (videoTexture) {
      videoTexture.dispose();
      videoTexture = null;
    }
    if (bgMesh && bgMesh.material) bgMesh.material.dispose();
    if (bgMesh && bgMesh.geometry) bgMesh.geometry.dispose();
    bgScene = null;
    bgCamera = null;
    bgMesh = null;

    // Restaurer le renderer opaque
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

  // Rendre le fond camera dans un viewport donne
  // Appele depuis cardboard.js pour chaque oeil en mode stereo
  function renderBackground(renderer, x, y, w, h) {
    if (!arActive || !bgScene || !bgCamera || !videoTexture) return;

    // Mettre a jour la texture video
    if (videoEl && videoEl.readyState >= videoEl.HAVE_CURRENT_DATA) {
      videoTexture.needsUpdate = true;
    }

    // Sauvegarder l'etat
    var savedAutoClear = renderer.autoClear;
    renderer.autoClear = false;

    // Rendre le fond camera dans le viewport specifie
    renderer.setViewport(x, y, w, h);
    renderer.setScissor(x, y, w, h);
    renderer.setScissorTest(true);
    renderer.render(bgScene, bgCamera);

    // Restaurer
    renderer.autoClear = savedAutoClear;
  }

  // Rendre le fond camera plein ecran (mode non-stereo)
  function renderBackgroundFullscreen(renderer) {
    if (!arActive || !bgScene || !bgCamera || !videoTexture) return;

    if (videoEl && videoEl.readyState >= videoEl.HAVE_CURRENT_DATA) {
      videoTexture.needsUpdate = true;
    }

    var savedAutoClear = renderer.autoClear;
    renderer.autoClear = false;

    var size = new THREE.Vector2();
    renderer.getSize(size);
    renderer.setViewport(0, 0, size.x, size.y);
    renderer.setScissorTest(false);
    renderer.render(bgScene, bgCamera);

    renderer.autoClear = savedAutoClear;
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
    renderBackground: renderBackground,
    renderBackgroundFullscreen: renderBackgroundFullscreen
  };
})();
