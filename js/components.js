/* ===== COMPOSANTS A-FRAME DE BASE (SIMPLIFIE) ===== */

// Gyroscope fallback
AFRAME.registerComponent('gyro-fallback', {
  init: function () {
    this.gyroWorking = false;
    this._onOrientation = (e) => {
      if (e.alpha !== null && e.beta !== null && e.gamma !== null) {
        if (e.alpha !== 0 || e.beta !== 0 || e.gamma !== 0) {
          this.gyroWorking = true;
        }
      }
    };
    window.addEventListener('deviceorientation', this._onOrientation);

    setTimeout(() => {
      window.removeEventListener('deviceorientation', this._onOrientation);
      if (!this.gyroWorking) {
        var camera = document.querySelector('a-camera');
        if (camera) camera.setAttribute('look-controls', 'magicWindowTrackingEnabled', false);
      }
    }, 2000);
  }
});

// Gestionnaire de curseur (gaze VR / tactile)
AFRAME.registerComponent('cursor-manager', {
  init: function () {
    this.vrMode = false;
    this.setTouchMode();
    this.el.sceneEl.addEventListener('vr-mode-enter', () => this.setVRMode());
    this.el.sceneEl.addEventListener('vr-mode-exit', () => this.setTouchMode());
  },

  setVRMode: function () {
    this.vrMode = true;
    var cursor = document.getElementById('gaze-cursor');
    if (cursor) {
      cursor.setAttribute('cursor', { fuse: true, fuseTimeout: 1500, rayOrigin: 'entity' });
      cursor.setAttribute('visible', true);
    }
    var fuseRing = document.getElementById('fuse-progress');
    if (fuseRing) fuseRing.setAttribute('visible', true);
    var recenterBtn = document.getElementById('recenter-btn');
    if (recenterBtn) recenterBtn.setAttribute('visible', true);
  },

  setTouchMode: function () {
    this.vrMode = false;
    var cursor = document.getElementById('gaze-cursor');
    if (cursor) {
      cursor.setAttribute('cursor', { fuse: false, rayOrigin: 'mouse' });
      cursor.setAttribute('visible', false);
    }
    var fuseRing = document.getElementById('fuse-progress');
    if (fuseRing) fuseRing.setAttribute('visible', false);
    var recenterBtn = document.getElementById('recenter-btn');
    if (recenterBtn) recenterBtn.setAttribute('visible', false);
  }
});

// Feedback visuel du reticule
AFRAME.registerComponent('gaze-feedback', {
  init: function () {
    this.el.addEventListener('fusing', () => this.el.setAttribute('material', 'color', '#00ff00'));
    this.el.addEventListener('mouseleave', () => this.el.setAttribute('material', 'color', '#00ffff'));
    this.el.addEventListener('click', () => {
      this.el.setAttribute('material', 'color', '#ffffff');
      setTimeout(() => this.el.setAttribute('material', 'color', '#00ffff'), 200);
    });
  }
});

// Fuse progress ring
AFRAME.registerComponent('fuse-progress', {
  init: function () {
    var cursor = this.el.parentEl;
    this.fusing = false;

    cursor.addEventListener('fusing', () => {
      this.startTime = Date.now();
      this.fusing = true;
      var cursorComp = cursor.components && cursor.components.cursor;
      this.fuseTimeout = (cursorComp && cursorComp.data.fuseTimeout) || 1500;
    });
    cursor.addEventListener('mouseleave', () => {
      this.fusing = false;
      this.el.setAttribute('geometry', 'thetaLength', 0);
    });
    cursor.addEventListener('click', () => {
      this.fusing = false;
      this.el.setAttribute('geometry', 'thetaLength', 0);
    });
  },
  tick: function () {
    if (!this.fusing) return;
    var progress = Math.min((Date.now() - this.startTime) / this.fuseTimeout, 1);
    this.el.setAttribute('geometry', 'thetaLength', progress * 360);
  }
});

// Bouton de menu
AFRAME.registerComponent('menu-button', {
  schema: {
    label: { type: 'string' },
    icon: { type: 'string' },
    action: { type: 'string' }
  },
  init: function () {
    this.el.addEventListener('click', () => {
      this.el.sceneEl.emit('menu-action', { action: this.data.action });
    });
    this.el.addEventListener('mouseenter', () => this.el.setAttribute('material', 'color', '#2a2a4e'));
    this.el.addEventListener('mouseleave', () => this.el.setAttribute('material', 'color', '#1a1a2e'));
  }
});

// Fermeture de panneau
AFRAME.registerComponent('panel-close', {
  schema: { target: { type: 'string' } },
  init: function () {
    this.el.addEventListener('click', () => {
      var target = document.getElementById(this.data.target);
      if (target) {
        target.setAttribute('visible', 'false');
        target.setAttribute('position', '0 -9999 0');
        document.getElementById('main-menu').setAttribute('visible', 'true');
      }
    });
    this.el.addEventListener('mouseenter', () => this.el.setAttribute('material', 'color', '#ff3333'));
    this.el.addEventListener('mouseleave', () => this.el.setAttribute('material', 'color', '#cc0000'));
  }
});

// Recentrage auto : regarder en bas 3s puis remonter = recentre l'écran
AFRAME.registerComponent('auto-recenter', {
  init: function () {
    this.lookingDown = false;
    this.lookDownStart = 0;
    this.lookDownThreshold = -30; // degrés (regarder en bas)
    this.lookUpThreshold = -10;   // degrés (revenu face)
    this.holdDuration = 3000;     // 3 secondes
    this.readyToRecenter = false;
    this.camera = null;
    this.rig = null;
    this.indicator = null;
    this.createIndicator();
  },

  createIndicator: function () {
    // Indicateur visuel en bas du champ de vision
    this.indicator = document.createElement('a-entity');
    this.indicator.setAttribute('id', 'recenter-indicator');
    this.indicator.setAttribute('position', '0 -0.6 -1.2');
    this.indicator.setAttribute('visible', false);

    var bg = document.createElement('a-plane');
    bg.setAttribute('width', '0.5');
    bg.setAttribute('height', '0.12');
    bg.setAttribute('material', 'color: #000; opacity: 0.7; shader: flat');
    this.indicator.appendChild(bg);

    var txt = document.createElement('a-text');
    txt.setAttribute('id', 'recenter-ind-text');
    txt.setAttribute('value', 'RECENTRAGE...');
    txt.setAttribute('align', 'center');
    txt.setAttribute('color', '#ffff00');
    txt.setAttribute('width', '1.5');
    txt.setAttribute('position', '0 0 0.01');
    this.indicator.appendChild(txt);

    var bar = document.createElement('a-plane');
    bar.setAttribute('id', 'recenter-ind-bar');
    bar.setAttribute('width', '0');
    bar.setAttribute('height', '0.02');
    bar.setAttribute('position', '0 -0.07 0.01');
    bar.setAttribute('material', 'color: #00ff00; shader: flat');
    this.indicator.appendChild(bar);

    // Attacher a la camera
    var cam = document.querySelector('a-camera');
    if (cam) cam.appendChild(this.indicator);
  },

  tick: function () {
    var sceneEl = this.el.sceneEl;
    var cursorMgr = sceneEl && sceneEl.components['cursor-manager'];
    if (!cursorMgr || !cursorMgr.vrMode) {
      if (this.indicator) this.indicator.setAttribute('visible', false);
      this.lookingDown = false;
      this.readyToRecenter = false;
      return;
    }

    if (!this.camera) this.camera = document.querySelector('a-camera');
    if (!this.rig) this.rig = document.getElementById('camera-rig');
    if (!this.camera || !this.rig) return;

    var rotation = this.camera.getAttribute('rotation');
    var pitch = rotation.x; // negatif = regarder vers le bas

    if (pitch < this.lookDownThreshold) {
      // Regarde en bas
      if (!this.lookingDown) {
        this.lookingDown = true;
        this.lookDownStart = Date.now();
        this.readyToRecenter = false;
      }

      var elapsed = Date.now() - this.lookDownStart;
      var progress = Math.min(elapsed / this.holdDuration, 1);

      // Afficher l'indicateur avec progression
      if (this.indicator) {
        this.indicator.setAttribute('visible', true);
        var bar = this.indicator.querySelector('#recenter-ind-bar');
        var txt = this.indicator.querySelector('#recenter-ind-text');
        if (bar) bar.setAttribute('width', 0.45 * progress);
        if (txt) {
          var remaining = Math.ceil((this.holdDuration - elapsed) / 1000);
          if (remaining > 0) {
            txt.setAttribute('value', 'RECENTRAGE ' + remaining + 's');
            txt.setAttribute('color', '#ffff00');
          } else {
            txt.setAttribute('value', 'REMONTEZ LA TETE');
            txt.setAttribute('color', '#00ff00');
          }
        }
      }

      if (elapsed >= this.holdDuration) {
        this.readyToRecenter = true;
      }
    } else if (this.readyToRecenter && pitch > this.lookUpThreshold) {
      // A regarde en bas 3s et est remonte => recentrer
      this.doRecenter();
      this.lookingDown = false;
      this.readyToRecenter = false;
      if (this.indicator) this.indicator.setAttribute('visible', false);
    } else if (pitch > this.lookUpThreshold) {
      // Pas assez longtemps en bas, reset
      this.lookingDown = false;
      this.readyToRecenter = false;
      if (this.indicator) this.indicator.setAttribute('visible', false);
    }
  },

  doRecenter: function () {
    var rotation = this.camera.getAttribute('rotation');
    var currentRig = this.rig.getAttribute('rotation') || { x: 0, y: 0, z: 0 };
    this.rig.setAttribute('rotation', {
      x: currentRig.x,
      y: currentRig.y - rotation.y,
      z: currentRig.z
    });
    window._vrLog && window._vrLog('Auto-recenter OK');
  }
});

// Bouton recentrage VR
AFRAME.registerComponent('recenter-button', {
  init: function () {
    this.countdown = false;
    this.countdownStart = 0;
    this.countdownDuration = 3000;
    this.label = this.el.querySelector('#recenter-label');
    this.progressBar = this.el.querySelector('#recenter-progress');

    this.el.addEventListener('click', () => {
      if (!this.countdown) this.startCountdown();
    });
    this.el.addEventListener('mouseenter', () => {
      if (!this.countdown) this.el.querySelector('a-plane').setAttribute('material', 'color', '#2a2a4e');
    });
    this.el.addEventListener('mouseleave', () => {
      if (!this.countdown) this.el.querySelector('a-plane').setAttribute('material', 'color', '#1a1a2e');
    });
  },
  startCountdown: function () {
    this.countdown = true;
    this.countdownStart = Date.now();
    this.label.setAttribute('value', '3...');
    this.label.setAttribute('color', '#ffff00');
  },
  doRecenter: function () {
    var camera = document.querySelector('a-camera');
    var rig = document.getElementById('camera-rig');
    var rotation = camera.getAttribute('rotation');
    var currentRig = rig.getAttribute('rotation') || { x: 0, y: 0, z: 0 };
    rig.setAttribute('rotation', { x: currentRig.x, y: currentRig.y - rotation.y, z: currentRig.z });

    this.label.setAttribute('value', 'OK!');
    this.label.setAttribute('color', '#00ff00');
    setTimeout(() => {
      this.label.setAttribute('value', 'RECENTRER');
      this.label.setAttribute('color', '#00ffff');
      this.el.querySelector('a-plane').setAttribute('material', 'color', '#1a1a2e');
    }, 500);
  },
  tick: function () {
    if (!this.countdown) return;
    var elapsed = Date.now() - this.countdownStart;
    var remaining = Math.ceil((this.countdownDuration - elapsed) / 1000);
    this.progressBar.setAttribute('geometry', 'width', 0.18 * Math.min(elapsed / this.countdownDuration, 1));
    if (remaining > 0) this.label.setAttribute('value', remaining + '...');
    if (elapsed >= this.countdownDuration) {
      this.countdown = false;
      this.progressBar.setAttribute('geometry', 'width', 0);
      this.doRecenter();
    }
  }
});

// ===== GESTIONNAIRE DES VIDEOS AMBIENT =====
// Lance les 3 videos en muted au chargement de la page
AFRAME.registerComponent('ambient-manager', {
  init: function () {
    this.videos = [];
    this.videoIds = ['vid-tonnerre', 'vid-plage', 'vid-nebuleuse'];
    this.screenIds = ['screen-1', 'screen-2', 'screen-3'];

    var self = this;
    this.el.addEventListener('loaded', function () {
      setTimeout(function () { self.startAmbient(); }, 1000);
    });

    // Premier tap = lance les videos (politique autoplay mobile)
    this._firstTap = function () {
      self.startAmbient();
      document.removeEventListener('touchstart', self._firstTap);
      document.removeEventListener('click', self._firstTap);
    };
    document.addEventListener('touchstart', this._firstTap);
    document.addEventListener('click', this._firstTap);
  },

  startAmbient: function () {
    for (var i = 0; i < this.videoIds.length; i++) {
      var videoEl = document.getElementById(this.videoIds[i]);
      if (videoEl) {
        videoEl.muted = true;
        videoEl.volume = 0;
        videoEl.play().then(function () {
          window._vrLog && window._vrLog('Ambient video started');
        }).catch(function (err) {
          window._vrLog && window._vrLog('Ambient play err: ' + err.message);
        });
        this.videos.push(videoEl);
      }
    }
  },

  // Pause toutes les ambient (quand un film est lance)
  pauseAll: function () {
    for (var i = 0; i < this.videos.length; i++) {
      this.videos[i].pause();
    }
    for (var j = 0; j < this.screenIds.length; j++) {
      var screen = document.getElementById(this.screenIds[j]);
      if (screen) screen.setAttribute('visible', false);
    }
  },

  // Resume toutes les ambient (quand le film est ferme)
  resumeAll: function () {
    for (var i = 0; i < this.videos.length; i++) {
      this.videos[i].muted = true;
      this.videos[i].play().catch(function () {});
    }
    for (var j = 0; j < this.screenIds.length; j++) {
      var screen = document.getElementById(this.screenIds[j]);
      if (screen) screen.setAttribute('visible', true);
    }
  }
});

// ===== BOUTON FAB (ouvre le menu orbital HTML) =====
AFRAME.registerComponent('fab-button', {
  init: function () {
    this.el.addEventListener('click', function () {
      if (window.fabMenu) window.fabMenu.open();
    });
    this.el.addEventListener('mouseenter', function () {
      this.setAttribute('material', 'color', '#7c6cf7');
    });
    this.el.addEventListener('mouseleave', function () {
      this.setAttribute('material', 'color', '#6c5ce7');
    });
  }
});

// ===== BOUTON TOGGLE ECRAN =====
// Associe un bouton a un ecran + video pour le toggler ON/OFF
AFRAME.registerComponent('toggle-screen', {
  schema: {
    screen: { type: 'string' },
    video: { type: 'string' },
    label: { type: 'string' }
  },
  init: function () {
    this.active = true;
    var self = this;

    this.el.addEventListener('click', function () {
      self.active = !self.active;
      var screenEl = document.getElementById(self.data.screen);
      var videoEl = document.getElementById(self.data.video);

      if (self.active) {
        // Reactiver
        if (screenEl) screenEl.setAttribute('visible', true);
        if (videoEl) { videoEl.muted = true; videoEl.play().catch(function () {}); }
        self.el.setAttribute('material', 'color', '#00aa44');
      } else {
        // Desactiver
        if (screenEl) screenEl.setAttribute('visible', false);
        if (videoEl) videoEl.pause();
        self.el.setAttribute('material', 'color', '#aa0000');
      }
    });
  }
});
