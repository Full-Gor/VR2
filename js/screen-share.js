/* ===== SCREEN SHARE VIEWER VR ===== */
/* Recoit le flux WebRTC du PC et l'affiche sur le mur-ecran */

AFRAME.registerComponent('screen-share-viewer', {
  init: function () {
    this.pc = null;
    this.polling = null;
    this.videoEl = null;
    this.wallScreen = null;
    this.active = false;
  },

  open: function () {
    this.active = true;

    // Creer le video element MAINTENANT (pendant le geste utilisateur) pour debloquer l'audio mobile
    if (!this.videoEl) {
      this.videoEl = document.createElement('video');
      this.videoEl.setAttribute('playsinline', '');
      this.videoEl.setAttribute('webkit-playsinline', '');
      this.videoEl.autoplay = true;
      this.videoEl.muted = false;
      this.videoEl.volume = 1.0;
      document.body.appendChild(this.videoEl);
    }
    // Debloquer l'audio context pendant le geste utilisateur
    if (window.AudioContext || window.webkitAudioContext) {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      var ctx = new AudioCtx();
      ctx.resume().then(function () { ctx.close(); });
    }

    // Cacher menu et autres panneaux (déplacer hors champ pour éviter blocage raycaster)
    document.getElementById('main-menu').setAttribute('visible', 'false');
    var fileExplorer = document.getElementById('file-explorer');
    if (fileExplorer) { fileExplorer.setAttribute('visible', 'false'); fileExplorer.setAttribute('position', '0 -9999 0'); }
    var webBrowser = document.getElementById('web-browser');
    if (webBrowser) { webBrowser.setAttribute('visible', 'false'); webBrowser.setAttribute('position', '0 -9999 0'); }
    var mediaPlayer = document.getElementById('media-player');
    if (mediaPlayer) { mediaPlayer.setAttribute('visible', 'false'); mediaPlayer.setAttribute('position', '0 -9999 0'); }

    // Pause les videos ambiantes
    var ambientEl = document.querySelector('[ambient-videos]');
    if (ambientEl && ambientEl.components['ambient-videos']) {
      ambientEl.components['ambient-videos'].pauseAll();
    }
    var ambientCenter = document.getElementById('ambient-video-0');
    if (ambientCenter) {
      ambientCenter._savedPosition = ambientCenter.getAttribute('position');
      ambientCenter.setAttribute('position', '0 -9999 0');
      ambientCenter.setAttribute('visible', false);
    }
    // Cacher aussi le media-wall-screen s'il existe
    var mediaWall = document.getElementById('media-wall-screen');
    if (mediaWall) {
      mediaWall.setAttribute('position', '0 -9999 0');
      mediaWall.setAttribute('visible', false);
    }

    // Creer le mur-ecran si pas encore fait
    if (!this.wallScreen) {
      this.wallScreen = document.createElement('a-plane');
      this.wallScreen.setAttribute('id', 'screen-share-wall');
      this.wallScreen.setAttribute('width', 16);
      this.wallScreen.setAttribute('height', 7.8);
      this.wallScreen.setAttribute('position', '0 3.9 -7.85');
      this.wallScreen.setAttribute('material', 'shader: flat; color: #111; side: double');
      this.el.sceneEl.appendChild(this.wallScreen);
    }
    this.wallScreen.setAttribute('visible', true);
    this.wallScreen.setAttribute('material', 'color', '#111');

    // Afficher message d'attente sur le mur
    this.showMessage('En attente du PC...\n\nOuvrez sur le PC :\n/screen-share.html\n\npuis cliquez Partager');

    // Afficher le panneau de controles screen-share
    this.el.setAttribute('visible', 'true');

    // Commencer le polling
    this.startPolling();
  },

  close: function () {
    this.active = false;

    if (this.polling) {
      clearInterval(this.polling);
      this.polling = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    if (this.videoEl) {
      this.videoEl.pause();
      this.videoEl.srcObject = null;
    }
    if (this.wallScreen) {
      this.wallScreen.setAttribute('visible', false);
      this.wallScreen.setAttribute('position', '0 -9999 0');
    }

    this.el.setAttribute('visible', 'false');

    // Reprendre les videos ambiantes
    var ambientEl = document.querySelector('[ambient-videos]');
    if (ambientEl && ambientEl.components['ambient-videos']) {
      ambientEl.components['ambient-videos'].resumeAll();
    }
    var ambientCenter = document.getElementById('ambient-video-0');
    if (ambientCenter) {
      if (ambientCenter._savedPosition) {
        ambientCenter.setAttribute('position', ambientCenter._savedPosition);
      } else {
        ambientCenter.setAttribute('position', '0 3.9 -8');
      }
      ambientCenter.setAttribute('visible', true);
    }
    // Laisser media-wall-screen hors scène (il sera repositionné par openMedia si besoin)
    // NE PAS le ramener ici pour éviter z-fighting avec ambient-video-0

    document.getElementById('main-menu').setAttribute('visible', 'true');
  },

  startPolling: function () {
    var self = this;
    this.polling = setInterval(function () {
      self.pollSignal();
    }, 500);
  },

  pollSignal: function () {
    var self = this;
    fetch('/api/signal?role=vr')
      .then(function (r) { return r.json(); })
      .then(function (messages) {
        for (var i = 0; i < messages.length; i++) {
          var msg = messages[i];
          if (msg.type === 'offer') {
            self.handleOffer(msg);
          } else if (msg.type === 'ice' && self.pc) {
            self.pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(function () {});
          } else if (msg.type === 'stop') {
            self.showMessage('Le PC a arrete\nle partage d\'ecran');
          }
        }
      })
      .catch(function () {});
  },

  handleOffer: function (msg) {
    var self = this;

    // Creer la connexion WebRTC
    if (this.pc) this.pc.close();

    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    // Envoyer les ICE candidates au PC
    this.pc.onicecandidate = function (e) {
      if (e.candidate) {
        fetch('/api/signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target: 'pc', type: 'ice', candidate: e.candidate })
        });
      }
    };

    // Recevoir le flux video/audio
    this.pc.ontrack = function (e) {
      // videoEl deja cree dans open() pendant le geste utilisateur
      if (!self.videoEl) {
        self.videoEl = document.createElement('video');
        self.videoEl.setAttribute('playsinline', '');
        self.videoEl.setAttribute('webkit-playsinline', '');
        self.videoEl.autoplay = true;
        document.body.appendChild(self.videoEl);
      }

      self.videoEl.srcObject = e.streams[0];
      self.videoEl.muted = false;
      self.videoEl.volume = 1.0;

      self.videoEl.play().then(function () {
        self.applyVideoToWall();
        // S'assurer que le son est bien actif
        self.videoEl.muted = false;
        self.videoEl.volume = 1.0;
      }).catch(function () {
        // Autoplay avec son bloque sur mobile : jouer muted d'abord
        self.videoEl.muted = true;
        self.videoEl.play().then(function () {
          self.applyVideoToWall();
          // Unmute des le prochain touch (gaze click ou touch ecran)
          var unmute = function () {
            self.videoEl.muted = false;
            self.videoEl.volume = 1.0;
            document.removeEventListener('touchstart', unmute);
            document.removeEventListener('click', unmute);
          };
          document.addEventListener('touchstart', unmute, { once: true });
          document.addEventListener('click', unmute, { once: true });
        }).catch(function () {});
      });
    };

    this.pc.onconnectionstatechange = function () {
      if (self.pc.connectionState === 'connected') {
        // Arreter le polling une fois connecte (garder pour ICE)
      } else if (self.pc.connectionState === 'disconnected' || self.pc.connectionState === 'failed') {
        self.showMessage('Connexion perdue\navec le PC');
      }
    };

    // Accepter l'offre et creer la reponse
    var offer = new RTCSessionDescription({ type: 'offer', sdp: msg.sdp });
    this.pc.setRemoteDescription(offer)
      .then(function () {
        return self.pc.createAnswer();
      })
      .then(function (answer) {
        return self.pc.setLocalDescription(answer).then(function () { return answer; });
      })
      .then(function (answer) {
        return fetch('/api/signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target: 'pc', type: 'answer', sdp: answer.sdp })
        });
      })
      .catch(function (e) {
        self.showMessage('Erreur de connexion\n' + e.message);
      });
  },

  applyVideoToWall: function () {
    if (!this.videoEl || !this.wallScreen) return;

    var texture = new THREE.VideoTexture(this.videoEl);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    var mesh = this.wallScreen.getObject3D('mesh');
    if (mesh) {
      mesh.material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide
      });
    }
  },

  showMessage: function (msg) {
    if (!this.wallScreen) return;

    var canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    var ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.fillStyle = '#00ffff';
    ctx.font = '28px monospace';
    ctx.textAlign = 'center';

    var lines = msg.split('\n');
    var startY = 360 - (lines.length * 20);
    lines.forEach(function (line, i) {
      ctx.fillText(line, 640, startY + i * 40);
    });

    var texture = new THREE.CanvasTexture(canvas);
    var mesh = this.wallScreen.getObject3D('mesh');
    if (mesh) {
      mesh.material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
    }
  }
});

// Controle screen-share (bouton deconnecter)
AFRAME.registerComponent('screen-share-control', {
  schema: {
    action: { type: 'string' }
  },
  init: function () {
    var self = this;
    this.el.addEventListener('click', function () {
      var viewer = document.querySelector('[screen-share-viewer]');
      if (!viewer || !viewer.components['screen-share-viewer']) return;

      if (self.data.action === 'disconnect') {
        viewer.components['screen-share-viewer'].close();
      }
    });

    this.el.addEventListener('mouseenter', function () {
      self.el.setAttribute('material', 'color', '#2a2a4e');
    });
    this.el.addEventListener('mouseleave', function () {
      self.el.setAttribute('material', 'color', '#1a1a2e');
    });
  }
});
