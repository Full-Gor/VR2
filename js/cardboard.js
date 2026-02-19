/* ===== MODE CARDBOARD : STÉRÉO SPLIT-SCREEN + GYROSCOPE ===== */

AFRAME.registerComponent('cardboard-stereo', {
  init: function () {
    this.stereoActive = false;
    this.scene = this.el;
    this.renderer = this.el.renderer;
    this.effect = null;

    const btn = document.getElementById('vr-stereo-btn');
    const divider = document.getElementById('stereo-divider');

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
    btn.textContent = 'QUITTER VR';
    btn.classList.add('active');
    divider.style.display = 'block';

    // Créer le StereoEffect Three.js
    this.effect = new THREE.StereoEffect(this.renderer);
    this.effect.setSize(window.innerWidth, window.innerHeight);
    this.effect.setEyeSeparation(0.064); // 64mm = écart pupillaire moyen

    // Demander la permission gyroscope (nécessaire sur iOS 13+ et certains Android)
    this.requestGyroPermission();

    // IMPORTANT: Forcer la réactivation du gyroscope pour le mode VR cardboard
    // Le gyro-fallback peut l'avoir désactivé, mais en VR on en a besoin
    var camera = document.querySelector('a-camera');
    if (camera) {
      camera.setAttribute('look-controls', 'magicWindowTrackingEnabled', true);
    }

    // Vérifier après un court délai si le gyroscope fonctionne vraiment
    // Si non (HTTP sans HTTPS), prévenir l'utilisateur
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
          console.warn('VR Cardboard: gyroscope non detecte ! Utilisez HTTPS (port 9443) pour le gyroscope.');
          // Afficher un avertissement temporaire
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

    // Forcer le lock-screen en paysage
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }

    // Cacher le bouton en mode VR (triple-tap pour quitter)
    btn.style.display = 'none';
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

    // Écouter le resize
    this._onResize = () => {
      if (this.effect) {
        this.effect.setSize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', this._onResize);

    // Désactiver WebXR natif d'A-Frame
    this.el.renderer.xr.enabled = false;

    // Intercepter le rendu d'A-Frame : bloquer le rendu mono
    // Le rendu stéréo est fait dans tick() via StereoEffect
    this._originalRender = this.el.renderer.render.bind(this.el.renderer);
    this._skipNormalRender = true;
    const self = this;
    const origRender = this._originalRender;
    this.el.renderer.render = function (scene, camera) {
      // Laisser passer uniquement les appels du StereoEffect
      if (self._skipNormalRender && self._renderingFromStereo) {
        origRender(scene, camera);
      }
      // Sinon on bloque (le rendu mono d'A-Frame)
    };

    // Signaler l'entrée en mode VR
    this.el.emit('vr-mode-enter');

    // Recentrer le menu face à l'utilisateur à l'entrée en VR
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

    // Restaurer le render normal d'A-Frame
    this._skipNormalRender = false;
    this._renderingFromStereo = false;
    if (this._originalRender) {
      this.el.renderer.render = this._originalRender;
    }

    // Retirer le listener triple-tap
    if (this._onTripleTap) {
      document.removeEventListener('touchend', this._onTripleTap);
    }

    // Restaurer la taille du renderer
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    // Quitter le plein écran
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    // Libérer l'orientation
    if (screen.orientation && screen.orientation.unlock) {
      screen.orientation.unlock();
    }

    if (this._onResize) {
      window.removeEventListener('resize', this._onResize);
    }

    // Restaurer le gyro-fallback si le gyroscope ne marchait pas
    // (remettre magicWindowTrackingEnabled: false pour les contrôles tactiles)
    var gyroFallback = this.el.components['gyro-fallback'];
    if (gyroFallback && !gyroFallback.gyroWorking) {
      var camera = document.querySelector('a-camera');
      if (camera) {
        camera.setAttribute('look-controls', 'magicWindowTrackingEnabled', false);
      }
    }

    // Nettoyer le timeout de vérification gyro
    if (this._gyroCheckTimeout) {
      clearTimeout(this._gyroCheckTimeout);
    }

    // Retirer l'avertissement gyro si présent
    var warn = document.getElementById('vr-gyro-warning');
    if (warn) warn.parentNode.removeChild(warn);

    // Signaler la sortie du mode VR
    this.el.emit('vr-mode-exit');
  },

  // Le rendu stéréo se fait dans tick(), pas dans l'intercepteur de render
  // C'est cette approche qui fonctionne correctement avec A-Frame
  tick: function () {
    if (!this.stereoActive || !this.effect || !this._originalRender) return;

    const threeScene = this.el.object3D;
    const camera = this.el.camera;
    if (threeScene && camera) {
      // Sauvegarder la matrice de la caméra avant le rendu stéréo
      const savedMatrix = camera.matrixWorld.clone();
      const savedProjection = camera.projectionMatrix.clone();

      this._renderingFromStereo = true;
      this.effect.render(threeScene, camera);
      this._renderingFromStereo = false;

      // Restaurer les matrices originales pour le raycaster
      camera.matrixWorld.copy(savedMatrix);
      camera.projectionMatrix.copy(savedProjection);

      // Restaurer le viewport normal pour le raycaster A-Frame
      this.renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    }
  },

  requestGyroPermission: function () {
    // iOS 13+ requiert une permission explicite
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then(response => {
          if (response === 'granted') {
            console.log('Gyroscope: permission accordée');
            // Forcer la réactivation du suivi après obtention de la permission
            var camera = document.querySelector('a-camera');
            if (camera) {
              camera.setAttribute('look-controls', 'magicWindowTrackingEnabled', true);
            }
            // Mettre à jour le flag gyro-fallback
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
    const el = document.documentElement;
    const rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
    if (rfs) {
      rfs.call(el).catch(() => {});
    }
  }
});

/* ===== THREE.StereoEffect ===== */
// Implémentation standard du StereoEffect pour Three.js
// (pas inclus nativement dans le build A-Frame)

THREE.StereoEffect = function (renderer) {
  const _stereo = new THREE.StereoCamera();
  _stereo.aspect = 0.5;
  _stereo.eyeSep = 0.064;

  const _size = new THREE.Vector2();

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

    if (renderer.autoClear) renderer.clear();
    renderer.setScissorTest(true);

    // Œil gauche
    renderer.setScissor(0, 0, _size.width / 2, _size.height);
    renderer.setViewport(0, 0, _size.width / 2, _size.height);
    renderer.render(scene, _stereo.cameraL);

    // Œil droit
    renderer.setScissor(_size.width / 2, 0, _size.width / 2, _size.height);
    renderer.setViewport(_size.width / 2, 0, _size.width / 2, _size.height);
    renderer.render(scene, _stereo.cameraR);

    renderer.setScissorTest(false);
  };
};
