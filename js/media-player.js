/* ===== LECTEUR MEDIA VR - SIMPLIFIE ===== */
/* Un seul ecran, 4 boutons HTML : Play, Pause, Stop, Mute */

(function () {
  var debugDiv = document.createElement('div');
  debugDiv.id = 'vr-debug';
  debugDiv.style.cssText = 'position:fixed;bottom:0;left:0;right:0;height:100px;background:rgba(0,0,0,0.85);color:#0f0;font:11px monospace;overflow-y:auto;z-index:99999;padding:4px;pointer-events:none;';
  document.body.appendChild(debugDiv);
  var maxLines = 12;
  window._vrLog = function (msg) {
    var line = document.createElement('div');
    line.textContent = new Date().toLocaleTimeString() + ' ' + msg;
    debugDiv.appendChild(line);
    while (debugDiv.children.length > maxLines) debugDiv.removeChild(debugDiv.firstChild);
    debugDiv.scrollTop = debugDiv.scrollHeight;
    console.log('[VR] ' + msg);
  };
})();

AFRAME.registerComponent('media-player', {
  init: function () {
    this.videoEl = null;
    this.isPlaying = false;
    this.wallScreen = null;
    this._exitBtn = null;
    this._videoTexture = null;

    this.createWallScreen();
    this.createExitButton();
    this.setupHTMLControls();

    this.el.sceneEl.addEventListener('play-media', (e) => this.openMedia(e.detail));
    this.el.sceneEl.addEventListener('view-image', (e) => this.openImage(e.detail));
  },

  createWallScreen: function () {
    this.wallScreen = document.createElement('a-entity');
    this.wallScreen.setAttribute('id', 'media-wall-screen');
    this.wallScreen.setAttribute('position', '0 -9999 0');
    this.el.sceneEl.appendChild(this.wallScreen);

    var geo = new THREE.PlaneGeometry(16, 7.8);
    var mat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
    this._wallMesh = new THREE.Mesh(geo, mat);
    this.wallScreen.object3D.add(this._wallMesh);

    // Zone invisible pour detecter le regard sur l'ecran (raycaster)
    this._screenZone = document.createElement('a-plane');
    this._screenZone.setAttribute('class', 'screen-zone');
    this._screenZone.setAttribute('width', '16');
    this._screenZone.setAttribute('height', '7.8');
    this._screenZone.setAttribute('position', '0 0 0.01');
    this._screenZone.setAttribute('material', 'opacity: 0; transparent: true; shader: flat');
    this.wallScreen.appendChild(this._screenZone);

    // Cacher le reticule quand on regarde l'ecran
    var self = this;
    this._screenZone.addEventListener('mouseenter', function () {
      if (!self.isPlaying) return;
      var cursor = document.getElementById('gaze-cursor');
      var fuseRing = document.getElementById('fuse-progress');
      if (cursor) cursor.setAttribute('visible', false);
      if (fuseRing) fuseRing.setAttribute('visible', false);
    });
    this._screenZone.addEventListener('mouseleave', function () {
      if (!self.isPlaying) return;
      var sceneEl = self.el.sceneEl;
      var cursorMgr = sceneEl && sceneEl.components['cursor-manager'];
      if (cursorMgr && cursorMgr.vrMode) {
        var cursor = document.getElementById('gaze-cursor');
        var fuseRing = document.getElementById('fuse-progress');
        if (cursor) cursor.setAttribute('visible', true);
        if (fuseRing) fuseRing.setAttribute('visible', true);
      }
    });
  },

  createExitButton: function () {
    this._exitBtn = document.createElement('a-entity');
    this._exitBtn.setAttribute('id', 'media-exit-btn');
    this._exitBtn.setAttribute('class', 'media-exit');
    this._exitBtn.setAttribute('position', '0 -9999 0');
    this._exitBtn.setAttribute('geometry', 'primitive: plane; width: 1.2; height: 0.4');
    this._exitBtn.setAttribute('material', 'color: #cc0000; opacity: 0.6; shader: flat; side: double');

    var text = document.createElement('a-text');
    text.setAttribute('value', 'QUITTER');
    text.setAttribute('align', 'center');
    text.setAttribute('color', '#ffffff');
    text.setAttribute('width', '2.5');
    text.setAttribute('position', '0 0 0.01');
    this._exitBtn.appendChild(text);

    var self = this;
    this._exitBtn.addEventListener('click', function () {
      self.closeMedia();
    });
    this._exitBtn.addEventListener('mouseenter', function () {
      self._exitBtn.setAttribute('material', 'color', '#ff4444');
    });
    this._exitBtn.addEventListener('mouseleave', function () {
      self._exitBtn.setAttribute('material', 'color', '#cc0000');
    });

    this.el.sceneEl.appendChild(this._exitBtn);
  },

  setupHTMLControls: function () {
    var self = this;
    var controls = document.getElementById('film-controls');
    if (!controls) return;

    var playBtn = document.getElementById('btn-play');
    var pauseBtn = document.getElementById('btn-pause');
    var muteBtn = document.getElementById('btn-mute');
    var stopBtn = document.getElementById('btn-stop');

    playBtn.addEventListener('click', function () {
      if (!self.videoEl) return;
      self.videoEl.muted = false;
      self.videoEl.volume = 1.0;
      self.videoEl.play().then(function () {
        window._vrLog('Play OK, muted=' + self.videoEl.muted);
      }).catch(function (err) {
        window._vrLog('Play FAILED: ' + err.message);
        // Fallback : play muted
        self.videoEl.muted = true;
        self.videoEl.play().catch(function () {});
      });
    });

    pauseBtn.addEventListener('click', function () {
      if (!self.videoEl) return;
      self.videoEl.pause();
      window._vrLog('Pause');
    });

    muteBtn.addEventListener('click', function () {
      if (!self.videoEl) return;
      self.videoEl.muted = !self.videoEl.muted;
      self.videoEl.volume = 1.0;
      muteBtn.innerHTML = self.videoEl.muted ? '&#128264; Unmute' : '&#128263; Mute';
      window._vrLog('Mute=' + self.videoEl.muted);
    });

    stopBtn.addEventListener('click', function () {
      self.closeMedia();
    });
  },

  openMedia: function (detail) {
    window._vrLog('openMedia: ' + detail.path);

    // Pause les videos ambient
    var ambientMgr = this.el.sceneEl.components['ambient-manager'];
    if (ambientMgr) ambientMgr.pauseAll();

    // Cacher le menu et les boutons toggle
    document.getElementById('main-menu').setAttribute('visible', 'false');
    var toggleBtns = document.getElementById('toggle-buttons');
    if (toggleBtns) toggleBtns.setAttribute('visible', false);
    var fe = document.getElementById('file-explorer');
    if (fe) { fe.setAttribute('visible', 'false'); fe.setAttribute('position', '0 -9999 0'); }

    // Creer l'element video si besoin
    if (!this.videoEl) {
      this.videoEl = document.createElement('video');
      this.videoEl.setAttribute('crossorigin', 'anonymous');
      this.videoEl.setAttribute('playsinline', '');
      this.videoEl.setAttribute('webkit-playsinline', '');
      this.videoEl.preload = 'auto';
      document.body.appendChild(this.videoEl);
      window._vrLog('Video element created');
    }

    var mediaUrl = '/api/media?path=' + encodeURIComponent(detail.path);
    window._vrLog('URL: ' + mediaUrl);
    this.videoEl.src = mediaUrl;
    this.videoEl.volume = 1.0;
    this.videoEl.load();

    this.videoEl.onerror = function () {
      var e = this.error;
      window._vrLog('VIDEO ERROR: ' + (e ? e.code + ' - ' + e.message : 'unknown'));
    };
    this.videoEl.onloadedmetadata = function () {
      window._vrLog('Metadata: ' + this.videoWidth + 'x' + this.videoHeight + ' dur:' + Math.round(this.duration) + 's');
    };

    // Dispose previous texture
    if (this._videoTexture) {
      this._videoTexture.dispose();
      this._videoTexture = null;
    }
    if (this._wallMesh && this._wallMesh.material && this._wallMesh.material.map) {
      this._wallMesh.material.dispose();
      this._wallMesh.material = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
    }

    // Position wall screen
    this.wallScreen.object3D.position.set(0, 3.9, -7.9);
    this.wallScreen.object3D.rotation.set(0, 0, 0);
    if (this._exitBtn) {
      this._exitBtn.object3D.position.set(0, -0.2, -7.88);
      this._exitBtn.object3D.rotation.set(0, 0, 0);
    }

    var self = this;
    this.isPlaying = true;

    // Apply texture quand la video est prete
    var textureApplied = false;
    var tryApply = function (source) {
      if (textureApplied) return;
      textureApplied = true;
      window._vrLog(source + ' — applying texture');
      self.applyVideoToWall();
    };

    this.videoEl.addEventListener('playing', function onPlaying() {
      self.videoEl.removeEventListener('playing', onPlaying);
      tryApply('playing');
    });

    this.videoEl.addEventListener('canplay', function onCanplay() {
      self.videoEl.removeEventListener('canplay', onCanplay);
      setTimeout(function () {
        if (!textureApplied) tryApply('canplay-fallback');
      }, 500);
    });

    setTimeout(function () {
      if (!textureApplied && self.isPlaying) tryApply('timeout-fallback');
    }, 3000);

    // Demarrer MUTED (100% garanti sur mobile)
    // L'utilisateur cliquera sur PLAY pour avoir le son
    this.videoEl.muted = true;
    this.videoEl.play().then(function () {
      window._vrLog('play() muted OK — appuie sur Play pour le son');
    }).catch(function (err) {
      window._vrLog('play() muted FAILED: ' + err.message);
    });

    // Afficher la barre de controles
    var controls = document.getElementById('film-controls');
    if (controls) controls.style.display = 'flex';

    // Reset du bouton mute
    var muteBtn = document.getElementById('btn-mute');
    if (muteBtn) muteBtn.innerHTML = '&#128264; Unmute';

    // Setup cursor pour le bouton QUITTER en VR
    this._setupPlaybackCursor();
  },

  openImage: function (detail) {
    document.getElementById('main-menu').setAttribute('visible', 'false');
    var fe = document.getElementById('file-explorer');
    if (fe) { fe.setAttribute('visible', 'false'); fe.setAttribute('position', '0 -9999 0'); }

    var imageUrl = '/api/media?path=' + encodeURIComponent(detail.path);

    this.wallScreen.object3D.position.set(0, 3.9, -7.9);
    this.wallScreen.object3D.rotation.set(0, 0, 0);
    if (this._exitBtn) {
      this._exitBtn.object3D.position.set(0, -0.2, -7.88);
      this._exitBtn.object3D.rotation.set(0, 0, 0);
    }

    var self = this;
    var loader = new THREE.TextureLoader();
    loader.load(imageUrl, function (texture) {
      if (self._wallMesh) {
        self._wallMesh.material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
      }
    });

    this._setupPlaybackCursor();
    this.isPlaying = true;

    var controls = document.getElementById('film-controls');
    if (controls) controls.style.display = 'flex';
  },

  applyVideoToWall: function () {
    if (!this._wallMesh || !this.videoEl) return;

    if (this._videoTexture) {
      this._videoTexture.dispose();
      this._videoTexture = null;
    }
    if (this._wallMesh.material && this._wallMesh.material.map) {
      this._wallMesh.material.dispose();
    }

    var texture = new THREE.VideoTexture(this.videoEl);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;

    this._wallMesh.material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
      toneMapped: false
    });
    this._videoTexture = texture;

    window._vrLog('Texture applied OK');
  },

  closeMedia: function () {
    // Cacher les controles
    var controls = document.getElementById('film-controls');
    if (controls) controls.style.display = 'none';

    if (this.videoEl) {
      this.videoEl.pause();
      this.videoEl.currentTime = 0;
    }
    this.isPlaying = false;

    this._restoreCursor();

    if (this._exitBtn) this._exitBtn.object3D.position.set(0, -9999, 0);
    if (this.wallScreen) this.wallScreen.object3D.position.set(0, -9999, 0);

    // Resume les videos ambient
    var ambientMgr = this.el.sceneEl.components['ambient-manager'];
    if (ambientMgr) ambientMgr.resumeAll();

    // Reafficher le menu et les boutons toggle
    document.getElementById('main-menu').setAttribute('visible', 'true');
    var toggleBtns = document.getElementById('toggle-buttons');
    if (toggleBtns) toggleBtns.setAttribute('visible', true);
  },

  _setupPlaybackCursor: function () {
    var cursor = document.getElementById('gaze-cursor');
    if (cursor) {
      cursor.setAttribute('cursor', { fuse: true, fuseTimeout: 2000 });
      cursor.setAttribute('raycaster', 'objects', '.media-exit, .screen-zone');
      cursor.setAttribute('visible', true);
    }
    var fuseRing = document.getElementById('fuse-progress');
    if (fuseRing) fuseRing.setAttribute('visible', true);
  },

  _restoreCursor: function () {
    var cursor = document.getElementById('gaze-cursor');
    if (!cursor) return;
    cursor.setAttribute('raycaster', 'objects', '.clickable');

    var sceneEl = this.el.sceneEl;
    var cursorMgr = sceneEl && sceneEl.components['cursor-manager'];
    if (cursorMgr && cursorMgr.vrMode) {
      cursor.setAttribute('cursor', { fuse: true, fuseTimeout: 1500 });
      cursor.setAttribute('visible', true);
    } else {
      cursor.setAttribute('cursor', { fuse: false, rayOrigin: 'mouse' });
      cursor.setAttribute('visible', false);
    }
    var fuseRing = document.getElementById('fuse-progress');
    if (fuseRing) fuseRing.setAttribute('visible', cursorMgr && cursorMgr.vrMode);
  },

  tick: function () {
    if (this.isPlaying && this._videoTexture && this.videoEl && !this.videoEl.paused) {
      this._videoTexture.needsUpdate = true;
    }
  }
});
