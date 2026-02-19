/* ===== HAND TRACKING VIA CAMÉRA ===== */
/* Détection des mains et doigts via MediaPipe Hands / caméra du téléphone */

AFRAME.registerComponent('hand-tracking-manager', {
  init: function () {
    this.enabled = true;
    this.hands = { left: null, right: null };
    this.pinching = { left: false, right: false };
    this.videoEl = null;
    this.canvasEl = null;
    this.ctx = null;
    this.handModel = null;
    this.lastPinchTarget = null;

    // Indicateurs visuels
    this.leftIndicator = document.getElementById('hand-left');
    this.rightIndicator = document.getElementById('hand-right');
    this.pinchIndicator = document.getElementById('pinch-indicator');
    this.handContainer = document.getElementById('hand-indicator');

    // Charger MediaPipe Hands
    this.loadMediaPipe();

    // Écouter les settings
    this.el.addEventListener('setting-changed', (e) => {
      if (e.detail.key === 'handTracking') {
        this.enabled = !this.enabled;
        this.handContainer.setAttribute('visible', this.enabled);
        if (this.enabled) this.startCamera();
        else this.stopCamera();
      }
    });
  },

  loadMediaPipe: function () {
    // Charger les scripts MediaPipe
    const script1 = document.createElement('script');
    script1.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.min.js';
    script1.crossOrigin = 'anonymous';
    script1.onload = () => {
      const script2 = document.createElement('script');
      script2.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.min.js';
      script2.crossOrigin = 'anonymous';
      script2.onload = () => this.initHandDetection();
      document.head.appendChild(script2);
    };
    document.head.appendChild(script1);
  },

  initHandDetection: function () {
    if (typeof Hands === 'undefined') {
      console.warn('MediaPipe Hands non disponible');
      return;
    }

    // Créer éléments vidéo/canvas cachés
    this.videoEl = document.createElement('video');
    this.videoEl.setAttribute('playsinline', '');
    this.videoEl.style.display = 'none';
    document.body.appendChild(this.videoEl);

    this.canvasEl = document.createElement('canvas');
    this.canvasEl.width = 320;
    this.canvasEl.height = 240;
    this.canvasEl.style.display = 'none';
    document.body.appendChild(this.canvasEl);
    this.ctx = this.canvasEl.getContext('2d');

    // Initialiser MediaPipe Hands
    this.handModel = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
    });

    this.handModel.setOptions({
      maxNumHands: 2,
      modelComplexity: 0, // 0 = lite (rapide pour mobile)
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    this.handModel.onResults((results) => this.onHandResults(results));

    this.startCamera();
  },

  startCamera: function () {
    if (!this.videoEl || !this.handModel) return;

    // Vérifier que getUserMedia est disponible (nécessite HTTPS)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('Hand tracking: getUserMedia non disponible (HTTPS requis)');
      return;
    }

    if (typeof Camera !== 'undefined') {
      this.camera = new Camera(this.videoEl, {
        onFrame: async () => {
          if (this.enabled && this.handModel) {
            await this.handModel.send({ image: this.videoEl });
          }
        },
        width: 320,
        height: 240,
        facingMode: 'environment' // Caméra arrière (ou frontale pour PC)
      });
      this.camera.start();
      this.handContainer.setAttribute('visible', 'true');
      console.log('Hand tracking: caméra démarrée');
    }
  },

  stopCamera: function () {
    if (this.camera) {
      this.camera.stop();
    }
    this.handContainer.setAttribute('visible', 'false');
  },

  onHandResults: function (results) {
    if (!results.multiHandLandmarks || !this.enabled) return;

    const scene = this.el;
    const camera = scene.querySelector('a-camera');
    const cameraPos = camera.object3D.position;

    results.multiHandLandmarks.forEach((landmarks, index) => {
      const handedness = results.multiHandedness[index].label; // 'Left' ou 'Right'
      const isLeft = handedness === 'Left';

      // Point 8 = bout de l'index, Point 4 = bout du pouce
      const indexTip = landmarks[8];
      const thumbTip = landmarks[4];
      const wrist = landmarks[0];

      // Convertir coordonnées caméra → espace 3D VR
      // x: 0-1 → -2 à 2, y: 0-1 → 0 à 3, z: profondeur estimée
      const vrX = (indexTip.x - 0.5) * -4; // Inversé (miroir)
      const vrY = (1 - indexTip.y) * 3;
      const vrZ = -2 - (indexTip.z * 2);

      // Mettre à jour l'indicateur visuel de la main
      const indicator = isLeft ? this.leftIndicator : this.rightIndicator;
      indicator.setAttribute('visible', 'true');
      indicator.setAttribute('position', `${vrX} ${vrY} ${vrZ}`);

      // Détecter le pinch (pouce + index proches)
      const pinchDist = this.distance3D(indexTip, thumbTip);
      const isPinching = pinchDist < 0.05;
      const wasPinching = isLeft ? this.pinching.left : this.pinching.right;

      if (isLeft) this.pinching.left = isPinching;
      else this.pinching.right = isPinching;

      // Afficher indicateur de pinch
      if (isPinching) {
        this.pinchIndicator.setAttribute('visible', 'true');
        this.pinchIndicator.setAttribute('position', `${vrX} ${vrY} ${vrZ + 0.1}`);

        // Si on vient de commencer le pinch → clic
        if (!wasPinching) {
          this.simulateClick(vrX, vrY, vrZ);
        }
      }

      // Détecter le geste de scroll (main ouverte qui monte/descend)
      if (!isPinching && landmarks[12].y - landmarks[9].y > 0.05) {
        // Doigts repliés = pas de scroll
      }
    });

    // Cacher les mains non détectées
    if (results.multiHandLandmarks.length === 0) {
      this.leftIndicator.setAttribute('visible', 'false');
      this.rightIndicator.setAttribute('visible', 'false');
      this.pinchIndicator.setAttribute('visible', 'false');
    }
  },

  simulateClick: function (x, y, z) {
    // Lancer un rayon depuis la position de la main vers l'avant
    const raycaster = new THREE.Raycaster();
    const origin = new THREE.Vector3(x, y, z);
    const direction = new THREE.Vector3(0, 0, -1);
    raycaster.set(origin, direction);

    // Trouver les éléments clickables
    const clickables = document.querySelectorAll('.clickable');
    const objects3D = [];
    clickables.forEach(el => {
      const mesh = el.getObject3D('mesh');
      if (mesh) objects3D.push(mesh);
    });

    const intersects = raycaster.intersectObjects(objects3D, true);
    if (intersects.length > 0) {
      // Trouver l'entité A-Frame correspondante
      let obj = intersects[0].object;
      while (obj && !obj.el) obj = obj.parent;
      if (obj && obj.el) {
        obj.el.emit('click');
        // Feedback visuel
        this.pinchIndicator.setAttribute('material', 'color', '#ff0');
        setTimeout(() => {
          this.pinchIndicator.setAttribute('material', 'color', '#0ff');
        }, 200);
      }
    }
  },

  distance3D: function (a, b) {
    return Math.sqrt(
      Math.pow(a.x - b.x, 2) +
      Math.pow(a.y - b.y, 2) +
      Math.pow(a.z - b.z, 2)
    );
  },

  // Geste : pointer avec l'index (les autres doigts repliés)
  isPointing: function (landmarks) {
    const indexExtended = landmarks[8].y < landmarks[6].y;
    const middleFolded = landmarks[12].y > landmarks[10].y;
    const ringFolded = landmarks[16].y > landmarks[14].y;
    const pinkyFolded = landmarks[20].y > landmarks[18].y;
    return indexExtended && middleFolded && ringFolded && pinkyFolded;
  },

  // Geste : main ouverte (tous les doigts étendus)
  isOpenHand: function (landmarks) {
    const fingers = [
      landmarks[8].y < landmarks[6].y,   // Index
      landmarks[12].y < landmarks[10].y,  // Majeur
      landmarks[16].y < landmarks[14].y,  // Annulaire
      landmarks[20].y < landmarks[18].y   // Auriculaire
    ];
    return fingers.every(f => f);
  }
});
