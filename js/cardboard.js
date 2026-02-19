/* ===== MODE CARDBOARD : STÉRÉO SPLIT-SCREEN + GYROSCOPE ===== */

AFRAME.registerComponent('cardboard-stereo', {
  init: function () {
    this.stereoActive = false;
    this.scene = this.el;
    this.renderer = this.el.renderer;
    this.effect = null;

    const btn = document.getElementById('vr-stereo-btn');
    const divider = document.getElementById('stereo-divider');
    const self = this;

    // API publique pour que ar-mode.js puisse verifier l'etat
    window.cardboardStereo = {
      isActive: function () { return self.stereoActive; }
    };

    btn.addEventListener('click', () => {
      if (this.stereoActive) {
        this.exitStereo(btn, divider);
      } else {
        this.enterStereo(btn, divider);
      }
    });
  },

  enterStereo: function (btn, divider) {
    this.stereoActive = true;
    this._arWasActive = !!(window.arMode && window.arMode.isActive());
    btn.textContent = 'QUITTER VR';
    btn.classList.add('active');
    divider.style.display = 'block';

    // Sauvegarder le vrai renderer.render AVANT de créer StereoEffect
    this._origRender = this.renderer.render.bind(this.renderer);

    // Créer le StereoEffect Three.js — lui passe le vrai render
    this.effect = new THREE.StereoEffect(this.renderer, this._origRender);
    this.effect.setSize(window.innerWidth, window.innerHeight);
    this.effect.setEyeSeparation(0.064);

    // BLOQUER le rendu mono d'A-Frame en remplaçant renderer.render par un no-op
    // Seul notre tick() fera le rendu via StereoEffect
    this.renderer.render = function () {};

    // Si AR actif, forcer la transparence du renderer pour voir la caméra derrière
    if (this._arWasActive) {
      // Dupliquer la vidéo AR en stéréo (2 moitiés côte à côte)
      var videoEl = document.getElementById('ar-camera-feed');
      if (videoEl) {
        videoEl.style.display = 'block';
        videoEl.style.width = '50%';
        videoEl.style.left = '0';
        // Créer un clone pour l'oeil droit
        var clone = videoEl.cloneNode(false);
        clone.id = 'ar-camera-feed-right';
        clone.srcObject = videoEl.srcObject;
        clone.style.left = '50%';
        clone.style.width = '50%';
        clone.play().catch(function(){});
        document.body.appendChild(clone);
      }
    }

    // Demander la permission gyroscope (nécessaire sur iOS 13+ et certains Android)
    this.requestGyroPermission();

    // Forcer le gyroscope
    var camera = document.querySelector('a-camera');
    if (camera) {
      camera.setAttribute('look-controls', 'magicWindowTrackingEnabled', true);
    }

    // Vérifier après un court délai si le gyroscope fonctionne
    this._gyroCheckTimeout = setTimeout(() => {
      this._vrGyroWorking = false;
      var checkHandler = (e) => {
        if (e.alpha !== null && e.beta !== null && e.gamma !== null) {
          if (e.alpha !== 0 || e.beta !== 0 || e.gamma !== 0) {
            this._vrGyroWorking = true;
          }
        }
      };
      window.addEventListener('deviceorientation', checkHandler);
      setTimeout(() => {
        window.removeEventListener('deviceorientation', checkHandler);
        if (!this._vrGyroWorking && this.stereoActive) {
          console.warn('VR Cardboard: gyroscope non detecte !');
          var warn = document.createElement('div');
          warn.id = 'vr-gyro-warning';
          warn.style.cssText = 'position:fixed;bottom:10%;left:50%;transform:translateX(-50%);background:rgba(255,100,0,0.9);color:#fff;padding:15px 25px;border-radius:10px;font:bold 16px sans-serif;z-index:100000;text-align:center;pointer-events:none;';
          warn.textContent = 'Gyroscope non detecte. Utilisez HTTPS (port 9443) pour le VR.';
          document.body.appendChild(warn);
          setTimeout(() => { if (warn.parentNode) warn.parentNode.removeChild(warn); }, 6000);
        }
      }, 1500);
    }, 500);

    // Demander le plein écran + orientation paysage
    this.requestFullscreen();

    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }

    // Cacher les boutons UI (triple-tap pour quitter)
    btn.style.display = 'none';
    var arBtn = document.getElementById('ar-btn');
    if (arBtn) arBtn.style.display = 'none';
    var fabTrigger = document.getElementById('fab-trigger-btn');
    if (fabTrigger) fabTrigger.style.display = 'none';

    this._tapCount = 0;
    this._tapTimer = null;
    this._onTripleTap = (e) => {
      this._tapCount++;
      if (this._tapTimer) clearTimeout(this._tapTimer);
      if (this._tapCount >= 3) {
        this._tapCount = 0;
        this.exitStereo(btn, divider);
        return;
      }
      this._tapTimer = setTimeout(() => { this._tapCount = 0; }, 600);
    };
    document.addEventListener('touchend', this._onTripleTap);

    this._onResize = () => {
      if (this.effect) {
        this.effect.setSize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', this._onResize);

    // Si AR actif, cacher sky/sol
    if (this._arWasActive) {
      var sky = document.querySelector('a-sky');
      if (sky) sky.setAttribute('visible', false);
      var floor = document.querySelector('a-scene > a-plane');
      if (floor) floor.setAttribute('visible', false);
    }

    // Désactiver WebXR natif d'A-Frame
    this.el.renderer.xr.enabled = false;

    this.el.emit('vr-mode-enter');

    // Recentrer
    setTimeout(() => {
      const recenterComp = document.getElementById('recenter-btn');
      if (recenterComp && recenterComp.components['recenter-button']) {
        recenterComp.components['recenter-button'].doRecenter();
      }
    }, 500);
  },

  exitStereo: function (btn, divider) {
    this.stereoActive = false;
    btn.textContent = 'MODE VR';
    btn.classList.remove('active');
    divider.style.display = 'none';

    // RESTAURER le vrai renderer.render
    if (this._origRender) {
      this.renderer.render = this._origRender;
      this._origRender = null;
    }

    this.effect = null;
    btn.style.display = 'block';

    // Supprimer le clone video AR droit
    var cloneVideo = document.getElementById('ar-camera-feed-right');
    if (cloneVideo) cloneVideo.parentNode.removeChild(cloneVideo);

    // Restaurer la video AR en plein ecran si elle etait active
    var videoEl = document.getElementById('ar-camera-feed');
    if (videoEl && this._arWasActive) {
      videoEl.style.width = '100%';
      videoEl.style.left = '0';
    }

    // Restaurer les boutons UI
    var arBtn = document.getElementById('ar-btn');
    if (arBtn) arBtn.style.display = 'block';
    var fabTrigger = document.getElementById('fab-trigger-btn');
    if (fabTrigger) fabTrigger.style.display = 'flex';

    if (this._onTripleTap) {
      document.removeEventListener('touchend', this._onTripleTap);
    }

    this.renderer.setSize(window.innerWidth, window.innerHeight);

    // Si AR etait actif avant le VR, restaurer l'etat AR
    if (this._arWasActive && window.arMode && window.arMode.isActive()) {
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.setClearAlpha(0);
      var sky = document.querySelector('a-sky');
      if (sky) sky.setAttribute('visible', false);
      var floor = document.querySelector('a-scene > a-plane');
      if (floor) floor.setAttribute('visible', false);
      if (arBtn) {
        arBtn.textContent = 'QUITTER AR';
        arBtn.classList.add('active');
      }
    } else {
      // Restaurer le renderer opaque si AR n'etait pas actif
      this.renderer.setClearColor(0x000000, 1);
      this.renderer.setClearAlpha(1);
    }

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    if (screen.orientation && screen.orientation.unlock) {
      screen.orientation.unlock();
    }

    if (this._onResize) {
      window.removeEventListener('resize', this._onResize);
    }

    var gyroFallback = this.el.components['gyro-fallback'];
    if (gyroFallback && !gyroFallback.gyroWorking) {
      var camera = document.querySelector('a-camera');
      if (camera) {
        camera.setAttribute('look-controls', 'magicWindowTrackingEnabled', false);
      }
    }

    if (this._gyroCheckTimeout) {
      clearTimeout(this._gyroCheckTimeout);
    }

    var warn = document.getElementById('vr-gyro-warning');
    if (warn) warn.parentNode.removeChild(warn);

    this._arWasActive = false;
    this.el.emit('vr-mode-exit');
  },

  tick: function () {
    if (!this.stereoActive || !this.effect) return;

    var threeScene = this.el.object3D;
    var camera = this.el.camera;
    if (!threeScene || !camera) return;

    // Sauvegarder la matrice de la caméra avant le rendu stéréo
    var savedMatrix = camera.matrixWorld.clone();
    var savedMatrixInverse = camera.matrixWorldInverse.clone();
    var savedProjection = camera.projectionMatrix.clone();
    var savedPosition = camera.position.clone();

    // Rendu stereo (utilise le vrai render en interne)
    this.effect.render(threeScene, camera);

    // Restaurer les matrices originales pour le raycaster
    camera.position.copy(savedPosition);
    camera.matrixWorld.copy(savedMatrix);
    camera.matrixWorldInverse.copy(savedMatrixInverse);
    camera.projectionMatrix.copy(savedProjection);

    // Restaurer le viewport normal pour le raycaster A-Frame
    this.renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    this.renderer.setScissorTest(false);
  },

  requestGyroPermission: function () {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then(response => {
          if (response === 'granted') {
            console.log('Gyroscope: permission accordée');
            var camera = document.querySelector('a-camera');
            if (camera) {
              camera.setAttribute('look-controls', 'magicWindowTrackingEnabled', true);
            }
            var gyroFallback = this.el.components['gyro-fallback'];
            if (gyroFallback) {
              gyroFallback.gyroWorking = true;
            }
          }
        })
        .catch(err => console.warn('Gyroscope permission:', err));
    }
  },

  requestFullscreen: function () {
    var el = document.documentElement;
    var rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
    if (rfs) {
      rfs.call(el).catch(() => {});
    }
  }
});

/* ===== THREE.StereoEffect ===== */
// Rendu stereo split-screen standard
// Accepte un 2e argument : le vrai renderer.render (pour bypasser le no-op)

THREE.StereoEffect = function (renderer, realRender) {
  var _stereo = new THREE.StereoCamera();
  _stereo.aspect = 0.5;
  _stereo.eyeSep = 0.064;

  var _size = new THREE.Vector2();
  var _realRender = realRender || renderer.render.bind(renderer);

  this.setEyeSeparation = function (eyeSep) {
    _stereo.eyeSep = eyeSep;
  };

  this.setSize = function (width, height) {
    renderer.setSize(width, height);
  };

  this.render = function (scene, camera) {
    if (scene.matrixWorldAutoUpdate === true) scene.updateMatrixWorld();
    if (camera.parent === null && camera.matrixWorldAutoUpdate === true) camera.updateMatrixWorld();

    _stereo.update(camera);

    renderer.getSize(_size);

    // Si AR actif, forcer transparence avant le clear
    var arOn = window.arMode && window.arMode.isActive();
    if (arOn) {
      renderer.setClearColor(0x000000, 0);
      renderer.setClearAlpha(0);
    }

    if (renderer.autoClear) renderer.clear();

    var savedAutoClear = renderer.autoClear;
    renderer.autoClear = false;

    renderer.setScissorTest(true);

    var halfW = _size.width / 2;

    // === OEIL GAUCHE ===
    renderer.setScissor(0, 0, halfW, _size.height);
    renderer.setViewport(0, 0, halfW, _size.height);
    _realRender(scene, _stereo.cameraL);

    // === OEIL DROIT ===
    renderer.setScissor(halfW, 0, halfW, _size.height);
    renderer.setViewport(halfW, 0, halfW, _size.height);
    _realRender(scene, _stereo.cameraR);

    renderer.setScissorTest(false);

    renderer.autoClear = savedAutoClear;
  };
};
