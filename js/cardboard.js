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

    // Créer le StereoEffect Three.js (version custom avec support AR)
    this.effect = new THREE.StereoEffectAR(this.renderer);
    this.effect.setSize(window.innerWidth, window.innerHeight);
    this.effect.setEyeSeparation(0.064);

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

    // Si AR actif, cacher sky/sol (le fond sera le flux camera rendu dans WebGL)
    if (this._arWasActive) {
      var sky = document.querySelector('a-sky');
      if (sky) sky.setAttribute('visible', false);
      var floor = document.querySelector('a-scene > a-plane');
      if (floor) floor.setAttribute('visible', false);
    }

    // Désactiver WebXR natif d'A-Frame
    this.el.renderer.xr.enabled = false;

    // Intercepter le rendu d'A-Frame : bloquer le rendu mono
    this._originalRender = this.el.renderer.render.bind(this.el.renderer);
    this._skipNormalRender = true;
    const self = this;
    const origRender = this._originalRender;
    this.el.renderer.render = function (scene, camera) {
      if (self._skipNormalRender && self._renderingFromStereo) {
        origRender(scene, camera);
      }
    };

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

    this.effect = null;
    btn.style.display = 'block';

    // Restaurer les boutons UI
    var arBtn = document.getElementById('ar-btn');
    if (arBtn) arBtn.style.display = 'block';
    var fabTrigger = document.getElementById('fab-trigger-btn');
    if (fabTrigger) fabTrigger.style.display = 'flex';

    // Restaurer le render normal d'A-Frame
    this._skipNormalRender = false;
    this._renderingFromStereo = false;
    if (this._originalRender) {
      this.el.renderer.render = this._originalRender;
    }

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
    if (!this.stereoActive || !this.effect || !this._originalRender) return;

    var threeScene = this.el.object3D;
    var camera = this.el.camera;
    if (!threeScene || !camera) return;

    // Sauvegarder la matrice de la caméra avant le rendu stéréo
    var savedMatrix = camera.matrixWorld.clone();
    var savedMatrixInverse = camera.matrixWorldInverse.clone();
    var savedProjection = camera.projectionMatrix.clone();
    var savedPosition = camera.position.clone();

    this._renderingFromStereo = true;

    // Le StereoEffectAR gere le rendu AR + scene 3D dans chaque oeil
    this.effect.render(threeScene, camera, !!(window.arMode && window.arMode.isActive()));

    this._renderingFromStereo = false;

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

/* ===== THREE.StereoEffectAR ===== */
// Version custom qui supporte le rendu du fond camera AR dans chaque oeil
// AVANT de rendre la scene 3D

THREE.StereoEffectAR = function (renderer) {
  var _stereo = new THREE.StereoCamera();
  _stereo.aspect = 0.5;
  _stereo.eyeSep = 0.064;

  var _size = new THREE.Vector2();

  this.setEyeSeparation = function (eyeSep) {
    _stereo.eyeSep = eyeSep;
  };

  this.setSize = function (width, height) {
    renderer.setSize(width, height);
  };

  this.render = function (scene, camera, arActive) {
    if (scene.matrixWorldAutoUpdate === true) scene.updateMatrixWorld();
    if (camera.parent === null && camera.matrixWorldAutoUpdate === true) camera.updateMatrixWorld();

    _stereo.update(camera);

    renderer.getSize(_size);

    // Clear une seule fois au debut
    if (renderer.autoClear) renderer.clear();

    // IMPORTANT : desactiver autoClear pour que renderer.render() ne re-efface pas
    // le fond AR qu'on vient de dessiner
    var savedAutoClear = renderer.autoClear;
    renderer.autoClear = false;

    renderer.setScissorTest(true);

    var halfW = _size.width / 2;

    // === OEIL GAUCHE ===
    renderer.setScissor(0, 0, halfW, _size.height);
    renderer.setViewport(0, 0, halfW, _size.height);

    // D'abord le fond camera AR (si actif)
    if (arActive && window.arMode && window.arMode.renderBackground) {
      window.arMode.renderBackground(renderer, 0, 0, halfW, _size.height);
    }

    // Puis la scene 3D par-dessus
    renderer.render(scene, _stereo.cameraL);

    // === OEIL DROIT ===
    renderer.setScissor(halfW, 0, halfW, _size.height);
    renderer.setViewport(halfW, 0, halfW, _size.height);

    // D'abord le fond camera AR
    if (arActive && window.arMode && window.arMode.renderBackground) {
      window.arMode.renderBackground(renderer, halfW, 0, halfW, _size.height);
    }

    // Puis la scene 3D
    renderer.render(scene, _stereo.cameraR);

    renderer.setScissorTest(false);

    // Restaurer autoClear
    renderer.autoClear = savedAutoClear;
  };
};
