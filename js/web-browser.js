/* ===== NAVIGATEUR WEB VR ===== */

AFRAME.registerComponent('web-browser', {
  init: function () {
    this.currentUrl = '';
    this.browserType = 'brave';
    this.urlDisplay = this.el.querySelector('#url-display');
    this.viewport = this.el.querySelector('#browser-viewport');
    this.touchKeyboardInput = '';
    this.touchShift = false;

    // Rendre la barre d'URL cliquable pour ouvrir le clavier
    const urlBarPlane = this.el.querySelector('#url-bar-plane');
    if (urlBarPlane) {
      urlBarPlane.addEventListener('click', () => {
        this.openKeyboard();
      });
    }

    this.setupTouchKeyboard();
  },

  setupTouchKeyboard: function () {
    const kb = document.getElementById('touch-keyboard');
    if (!kb) return;

    kb.querySelectorAll('.kb-key').forEach(key => {
      key.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onTouchKey(key.dataset.key);
      });
      key.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onTouchKey(key.dataset.key);
      });
    });
  },

  onTouchKey: function (key) {
    const display = document.getElementById('touch-kb-display');

    switch (key) {
      case 'DEL':
        this.touchKeyboardInput = this.touchKeyboardInput.slice(0, -1);
        break;
      case 'ESPACE':
        this.touchKeyboardInput += ' ';
        break;
      case 'ENTER':
        this.submitTouchKeyboard();
        return;
      case 'MAJ':
        this.touchShift = !this.touchShift;
        return;
      case '://':
        this.touchKeyboardInput += '://';
        break;
      default:
        this.touchKeyboardInput += this.touchShift ? key.toUpperCase() : key;
        if (this.touchShift) this.touchShift = false;
    }

    if (display) {
      display.textContent = this.touchKeyboardInput + '|';
    }
  },

  submitTouchKeyboard: function () {
    if (!this.touchKeyboardInput.trim()) return;
    this.handleTextInput(this.touchKeyboardInput);
    this.touchKeyboardInput = '';
    const display = document.getElementById('touch-kb-display');
    if (display) display.textContent = '|';
    this.closeKeyboard();
  },

  openKeyboard: function () {
    const cursorManager = this.el.sceneEl.components['cursor-manager'];
    if (cursorManager && cursorManager.vrMode) {
      // En mode VR, utiliser le clavier 3D
      const keyboard = this.el.querySelector('#vr-keyboard');
      if (keyboard) keyboard.setAttribute('visible', 'true');
    } else {
      // En mode tactile, utiliser le clavier HTML
      const kb = document.getElementById('touch-keyboard');
      if (kb) {
        kb.style.display = 'block';
        this.touchKeyboardInput = '';
        const display = document.getElementById('touch-kb-display');
        if (display) display.textContent = '|';
      }
    }
  },

  closeKeyboard: function () {
    const kb = document.getElementById('touch-keyboard');
    if (kb) kb.style.display = 'none';
  },

  open: function (browserType) {
    this.browserType = browserType || 'brave';
    document.getElementById('main-menu').setAttribute('visible', 'false');
    // Cacher l'explorateur de fichiers s'il est visible
    var fileExplorer = document.getElementById('file-explorer');
    if (fileExplorer) {
      fileExplorer.setAttribute('visible', 'false');
      fileExplorer.setAttribute('position', '0 -9999 0');
    }
    this.el.setAttribute('position', '0 1.6 -3');
    this.el.setAttribute('visible', 'true');

    const color = this.browserType === 'brave' ? '#ff6600' : '#4285f4';
    const name = this.browserType === 'brave' ? 'Brave' : 'Chrome';
    this.urlDisplay.setAttribute('color', color);
    this.urlDisplay.setAttribute('value', name);

    // Afficher le message d'accueil
    this.renderMessage(
      name + ' - Navigateur VR\n\n' +
      'Touchez la barre URL ci-dessus\n' +
      'pour saisir une adresse ou\n' +
      'effectuer une recherche'
    );
  },

  navigate: function (url) {
    this.currentUrl = url;
    this.urlDisplay.setAttribute('value', url.length > 35 ? url.substring(0, 35) + '...' : url);

    // Afficher le chargement
    this.renderMessage('Chargement...\n\n' + url);
    this.loadPage(url);
  },

  loadPage: function (url) {
    fetch(`/api/proxy?url=${encodeURIComponent(url)}`)
      .then(r => {
        if (!r.ok) throw new Error('Proxy non disponible');
        return r.text();
      })
      .then(html => {
        this.renderToCanvas(html);
      })
      .catch(() => {
        this.renderMessage(
          'Navigation vers :\n' + url + '\n\n' +
          'Le proxy web n\'est pas disponible\n' +
          'sur ce serveur.\n\n' +
          'Lancez le serveur node localement\n' +
          'pour activer la navigation web.'
        );
      });
  },

  // Nettoyer le HTML et extraire le contenu structuré
  parseHtmlContent: function (html) {
    // Extraire le titre
    var titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    var pageTitle = titleMatch ? titleMatch[1].replace(/&[^;]+;/g, ' ').trim() : '';

    // Retirer les tags non-contenu
    var clean = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
      .replace(/<svg[\s\S]*?<\/svg>/gi, '')
      .replace(/<head[\s\S]*?<\/head>/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    var items = [];

    // Extraire les titres h1-h3
    var headingRegex = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
    var match;
    while ((match = headingRegex.exec(clean)) !== null) {
      var text = match[2].replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim();
      if (text.length > 1) {
        items.push({ type: 'h' + match[1], text: text });
      }
    }

    // Extraire les paragraphes
    var pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    while ((match = pRegex.exec(clean)) !== null) {
      var pText = match[1].replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim();
      if (pText.length > 3) {
        items.push({ type: 'p', text: pText });
      }
    }

    // Extraire les liens importants
    var aRegex = /<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((match = aRegex.exec(clean)) !== null) {
      var linkText = match[2].replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim();
      if (linkText.length > 3 && !match[1].startsWith('#') && !match[1].startsWith('javascript')) {
        items.push({ type: 'link', text: linkText, url: match[1] });
      }
    }

    // Extraire les éléments de liste
    var liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    while ((match = liRegex.exec(clean)) !== null) {
      var liText = match[1].replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim();
      if (liText.length > 2) {
        items.push({ type: 'li', text: liText });
      }
    }

    // Si pas assez de contenu structuré, fallback sur le texte brut
    if (items.length < 3) {
      var tempDiv = document.createElement('div');
      tempDiv.innerHTML = clean;
      var rawText = (tempDiv.textContent || tempDiv.innerText || '').trim();
      var lines = rawText.split(/\n/).map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 2; });
      lines.forEach(function(line) {
        items.push({ type: 'text', text: line });
      });
    }

    // Dédupliquer
    var seen = {};
    items = items.filter(function(item) {
      var key = item.text.substring(0, 50);
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });

    return { title: pageTitle, items: items };
  },

  renderToCanvas: function (html) {
    var canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    var ctx = canvas.getContext('2d');

    // Fond blanc
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 1280, 720);

    var content = this.parseHtmlContent(html);

    // Barre de titre avec couleur du navigateur
    var barColor = this.browserType === 'brave' ? '#ff6600' : '#4285f4';
    ctx.fillStyle = barColor;
    ctx.fillRect(0, 0, 1280, 45);

    // Titre de la page
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    var title = content.title || this.currentUrl;
    ctx.fillText(title.substring(0, 80), 15, 30);

    // URL en dessous
    ctx.fillStyle = '#eee';
    ctx.fillRect(0, 45, 1280, 25);
    ctx.fillStyle = '#666';
    ctx.font = '12px sans-serif';
    ctx.fillText(this.currentUrl.substring(0, 120), 15, 62);

    // Contenu
    var y = 90;
    var maxWidth = 1250;
    var lineHeight = 18;

    var items = content.items;
    for (var i = 0; i < items.length && y < 700; i++) {
      var item = items[i];
      var text = item.text;

      switch (item.type) {
        case 'h1':
          y += 8;
          ctx.fillStyle = '#1a1a1a';
          ctx.font = 'bold 22px sans-serif';
          this.drawWrappedText(ctx, text, 15, y, maxWidth, 26);
          y += Math.ceil(text.length / 70) * 26 + 10;
          break;

        case 'h2':
          y += 6;
          ctx.fillStyle = '#333';
          ctx.font = 'bold 18px sans-serif';
          this.drawWrappedText(ctx, text, 15, y, maxWidth, 22);
          y += Math.ceil(text.length / 80) * 22 + 8;
          break;

        case 'h3':
          y += 4;
          ctx.fillStyle = '#444';
          ctx.font = 'bold 16px sans-serif';
          this.drawWrappedText(ctx, text, 15, y, maxWidth, 20);
          y += Math.ceil(text.length / 85) * 20 + 6;
          break;

        case 'link':
          ctx.fillStyle = '#1a73e8';
          ctx.font = '14px sans-serif';
          ctx.fillText('> ' + text.substring(0, 100), 25, y);
          y += lineHeight + 2;
          break;

        case 'li':
          ctx.fillStyle = '#333';
          ctx.font = '14px sans-serif';
          ctx.fillText('  * ' + text.substring(0, 100), 15, y);
          y += lineHeight + 2;
          break;

        default: // p, text
          ctx.fillStyle = '#333';
          ctx.font = '14px sans-serif';
          this.drawWrappedText(ctx, text, 15, y, maxWidth, lineHeight);
          y += Math.ceil(text.length / 95) * lineHeight + 4;
          break;
      }
    }

    // Indicateur si contenu tronqué
    if (y >= 700 && items.length > i) {
      ctx.fillStyle = '#999';
      ctx.font = 'italic 12px sans-serif';
      ctx.fillText('... page tronquee (' + items.length + ' elements) ...', 15, 712);
    }

    var texture = new THREE.CanvasTexture(canvas);
    var mesh = this.viewport.getObject3D('mesh');
    if (mesh) mesh.material = new THREE.MeshBasicMaterial({ map: texture });
  },

  // Dessiner du texte avec retour à la ligne automatique
  drawWrappedText: function (ctx, text, x, y, maxWidth, lineHeight) {
    var words = text.split(' ');
    var line = '';
    var currentY = y;

    for (var n = 0; n < words.length; n++) {
      var testLine = line + words[n] + ' ';
      var metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), x, currentY);
  },

  renderMessage: function (msg) {
    var canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    var ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.fillStyle = '#00ffff';
    ctx.font = '24px monospace';
    ctx.textAlign = 'center';

    var lines = msg.split('\n');
    var startY = 360 - (lines.length * 16);
    lines.forEach(function(line, i) {
      ctx.fillText(line, 640, startY + i * 35);
    });

    var texture = new THREE.CanvasTexture(canvas);
    var mesh = this.viewport.getObject3D('mesh');
    if (mesh) mesh.material = new THREE.MeshBasicMaterial({ map: texture });
  },

  handleTextInput: function (text) {
    // Ajouter https:// par défaut si c'est un domaine
    if (!text.startsWith('http://') && !text.startsWith('https://')) {
      if (text.includes('.') && !text.includes(' ')) {
        // C'est probablement une URL (ex: google.com)
        text = 'https://' + text;
      } else {
        // C'est une recherche
        var searchUrl = this.browserType === 'brave'
          ? 'https://search.brave.com/search?q=' + encodeURIComponent(text)
          : 'https://www.google.com/search?q=' + encodeURIComponent(text);
        this.navigate(searchUrl);
        return;
      }
    }
    this.navigate(text);
  }
});
