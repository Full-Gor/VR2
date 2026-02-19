/* ===== EXPLORATEUR DE FICHIERS VR ===== */

AFRAME.registerComponent('file-explorer', {
  init: function () {
    this.currentPath = '/';
    this.fileListEl = this.el.querySelector('#file-list');
    this.pathDisplay = this.el.querySelector('#file-path-display');
    this.history = ['/'];
    this.scrollOffset = 0;
    this.currentFiles = [];
    this.allFiles = [];
    this.maxVisible = 8;
    this.filterMedia = false;

    // Écouter les events de navigation
    this.el.querySelector('#file-back-btn').addEventListener('click', () => this.goBack());
    this.el.querySelector('#file-close-btn').addEventListener('click', () => this.close());
  },

  open: function () {
    this.el.setAttribute('position', '0 1.6 -3');
    this.el.setAttribute('visible', 'true');
    document.getElementById('main-menu').setAttribute('visible', 'false');
    // Cacher le navigateur web s'il est visible
    var browser = document.getElementById('web-browser');
    if (browser) {
      browser.setAttribute('visible', 'false');
      browser.setAttribute('position', '0 -9999 0');
    }
    this.loadDirectory(this.currentPath);
  },

  close: function () {
    this.el.setAttribute('visible', 'false');
    this.el.setAttribute('position', '0 -9999 0');
    document.getElementById('main-menu').setAttribute('visible', 'true');
  },

  goBack: function () {
    if (this.history.length > 1) {
      this.history.pop();
      this.currentPath = this.history[this.history.length - 1];
      this.filterMedia = false;
      this.loadDirectory(this.currentPath);
    }
  },

  toggleMediaFilter: function () {
    this.filterMedia = !this.filterMedia;
    this.scrollOffset = 0;
    this.applyFilter();
  },

  applyFilter: function () {
    if (this.filterMedia) {
      this.currentFiles = this.allFiles.filter(function (f) {
        return f.type === 'directory' || f.type === 'video' || f.type === 'audio' ||
          /\.(mp4|mkv|avi|webm|mp3|wav|flac|ogg)$/i.test(f.name);
      });
    } else {
      this.currentFiles = this.allFiles.slice();
    }
    this.renderFiles(this.currentFiles);
  },

  loadDirectory: function (path) {
    this.currentPath = path;
    this.scrollOffset = 0;
    // A-Frame text ne supporte pas bien les accents, simplifier l'affichage
    var displayPath = path;
    try { displayPath = decodeURIComponent(path); } catch (e) {}
    this.pathDisplay.setAttribute('value', displayPath);

    // Appel au serveur local pour lister les fichiers
    fetch('/api/files?path=' + encodeURIComponent(path))
      .then(function (r) {
        if (!r.ok) throw new Error('API non disponible');
        var ct = r.headers.get('content-type') || '';
        if (!ct.includes('application/json')) throw new Error('Pas du JSON');
        return r.json();
      })
      .then(function (data) {
        this.allFiles = data.files || [];
        this.applyFilter();
      }.bind(this))
      .catch(function () {
        this.allFiles = this.getDemoFiles();
        this.applyFilter();
      }.bind(this));
  },

  getDemoFiles: function () {
    return [
      { name: 'Documents', type: 'directory' },
      { name: 'Videos', type: 'directory' },
      { name: 'Images', type: 'directory' },
      { name: 'Musique', type: 'directory' },
      { name: 'Telechargements', type: 'directory' }
    ];
  },

  scrollUp: function () {
    if (this.scrollOffset > 0) {
      this.scrollOffset -= this.maxVisible;
      if (this.scrollOffset < 0) this.scrollOffset = 0;
      this.renderFiles(this.currentFiles);
    }
  },

  scrollDown: function () {
    if (this.scrollOffset + this.maxVisible < this.currentFiles.length) {
      this.scrollOffset += this.maxVisible;
      this.renderFiles(this.currentFiles);
    }
  },

  renderFiles: function (files) {
    this.currentFiles = files;

    // Nettoyer la liste précédente
    while (this.fileListEl.firstChild) {
      this.fileListEl.removeChild(this.fileListEl.firstChild);
    }

    var itemHeight = 0.28;
    var visible = files.slice(this.scrollOffset, this.scrollOffset + this.maxVisible);
    var totalPages = Math.ceil(files.length / this.maxVisible) || 1;
    var currentPage = Math.floor(this.scrollOffset / this.maxVisible) + 1;
    var self = this;

    // === Barre d'outils en haut (filtre media + raccourci DL) ===
    var toolbarY = 0.15;

    // Bouton filtre MEDIA (vert si actif, gris sinon)
    var filterBtn = document.createElement('a-entity');
    filterBtn.setAttribute('class', 'clickable');
    filterBtn.setAttribute('position', '-0.8 ' + toolbarY + ' 0');
    filterBtn.setAttribute('geometry', 'primitive: plane; width: 1; height: 0.25');
    filterBtn.setAttribute('material', this.filterMedia
      ? 'color: #00aa44; opacity: 1; shader: flat'
      : 'color: #333; opacity: 0.9; shader: flat');
    var filterText = document.createElement('a-text');
    filterText.setAttribute('value', this.filterMedia ? 'MEDIA [ON]' : 'MEDIA');
    filterText.setAttribute('align', 'center');
    filterText.setAttribute('color', this.filterMedia ? '#fff' : '#aaa');
    filterText.setAttribute('width', '2');
    filterText.setAttribute('position', '0 0 0.01');
    filterBtn.appendChild(filterText);
    filterBtn.addEventListener('click', function () { self.toggleMediaFilter(); });
    filterBtn.addEventListener('mouseenter', function () {
      filterBtn.setAttribute('material', 'color', self.filterMedia ? '#00cc55' : '#555');
    });
    filterBtn.addEventListener('mouseleave', function () {
      filterBtn.setAttribute('material', 'color', self.filterMedia ? '#00aa44' : '#333');
    });
    this.fileListEl.appendChild(filterBtn);

    // Bouton raccourci Téléchargements (toujours visible, orange)
    var dlBtn = document.createElement('a-entity');
    dlBtn.setAttribute('class', 'clickable');
    dlBtn.setAttribute('position', '0.5 ' + toolbarY + ' 0');
    dlBtn.setAttribute('geometry', 'primitive: plane; width: 1.4; height: 0.25');
    dlBtn.setAttribute('material', 'color: #ff6600; opacity: 1; shader: flat');
    var dlText = document.createElement('a-text');
    dlText.setAttribute('value', 'TELECHARGEMENTS');
    dlText.setAttribute('align', 'center');
    dlText.setAttribute('color', '#fff');
    dlText.setAttribute('width', '1.8');
    dlText.setAttribute('position', '0 0 0.01');
    dlBtn.appendChild(dlText);
    dlBtn.addEventListener('click', function () {
      self.history.push('/T\u00e9l\u00e9chargements');
      self.loadDirectory('/T\u00e9l\u00e9chargements');
    });
    dlBtn.addEventListener('mouseenter', function () { dlBtn.setAttribute('material', 'color', '#ff8833'); });
    dlBtn.addEventListener('mouseleave', function () { dlBtn.setAttribute('material', 'color', '#ff6600'); });
    this.fileListEl.appendChild(dlBtn);

    // === Liste des fichiers ===
    var listStartY = -0.15;

    visible.forEach(function (file, i) {
      var item = document.createElement('a-entity');
      item.setAttribute('class', 'clickable');
      item.setAttribute('position', '0 ' + (listStartY - i * itemHeight) + ' 0');
      item.setAttribute('geometry', 'primitive: plane; width: 3.5; height: ' + (itemHeight - 0.03));
      item.setAttribute('material', 'color: #1a1a2e; opacity: 0.9');

      // Icône type
      var icon = file.type === 'directory' ? '[DIR]' : self.getFileIcon(file.name);
      var sizeText = file.size ? ' (' + file.size + ')' : '';

      // Tronquer les noms trop longs
      var displayName = file.name;
      if (displayName.length > 35) {
        displayName = displayName.substring(0, 32) + '...';
      }

      var text = document.createElement('a-text');
      text.setAttribute('value', icon + ' ' + displayName + sizeText);
      text.setAttribute('position', '-1.6 0 0.01');
      text.setAttribute('color', file.type === 'directory' ? '#00ffff' : '#cccccc');
      text.setAttribute('width', '2.5');
      item.appendChild(text);

      // Interactions
      item.addEventListener('mouseenter', function () {
        item.setAttribute('material', 'color', '#2a2a4e');
      });
      item.addEventListener('mouseleave', function () {
        item.setAttribute('material', 'color', '#1a1a2e');
      });
      item.addEventListener('click', function () {
        self.handleFileClick(file);
      });

      self.fileListEl.appendChild(item);
    });

    // === Navigation bas (flèches + page) ===
    var navY = listStartY - this.maxVisible * itemHeight - 0.05;

    // Bouton HAUT (gauche)
    var canUp = this.scrollOffset > 0;
    var upBtn = document.createElement('a-entity');
    upBtn.setAttribute('class', 'clickable');
    upBtn.setAttribute('position', '-0.9 ' + navY + ' 0');
    upBtn.setAttribute('geometry', 'primitive: plane; width: 0.8; height: 0.3');
    upBtn.setAttribute('material', canUp
      ? 'color: #0066cc; opacity: 1; shader: flat'
      : 'color: #222; opacity: 0.5; shader: flat');
    var upText = document.createElement('a-text');
    upText.setAttribute('value', '< PREC');
    upText.setAttribute('align', 'center');
    upText.setAttribute('color', canUp ? '#fff' : '#555');
    upText.setAttribute('width', '2');
    upText.setAttribute('position', '0 0 0.01');
    upBtn.appendChild(upText);
    if (canUp) {
      upBtn.addEventListener('click', function () { self.scrollUp(); });
      upBtn.addEventListener('mouseenter', function () { upBtn.setAttribute('material', 'color', '#0088ff'); });
      upBtn.addEventListener('mouseleave', function () { upBtn.setAttribute('material', 'color', '#0066cc'); });
    }
    this.fileListEl.appendChild(upBtn);

    // Compteur de page (centre)
    var pageText = document.createElement('a-text');
    pageText.setAttribute('value', currentPage + ' / ' + totalPages);
    pageText.setAttribute('position', '0 ' + navY + ' 0');
    pageText.setAttribute('align', 'center');
    pageText.setAttribute('color', '#00ffff');
    pageText.setAttribute('width', '2.5');
    this.fileListEl.appendChild(pageText);

    // Bouton BAS (droite)
    var hasMore = this.scrollOffset + this.maxVisible < files.length;
    var downBtn = document.createElement('a-entity');
    downBtn.setAttribute('class', 'clickable');
    downBtn.setAttribute('position', '0.9 ' + navY + ' 0');
    downBtn.setAttribute('geometry', 'primitive: plane; width: 0.8; height: 0.3');
    downBtn.setAttribute('material', hasMore
      ? 'color: #0066cc; opacity: 1; shader: flat'
      : 'color: #222; opacity: 0.5; shader: flat');
    var downText = document.createElement('a-text');
    downText.setAttribute('value', 'SUIV >');
    downText.setAttribute('align', 'center');
    downText.setAttribute('color', hasMore ? '#fff' : '#555');
    downText.setAttribute('width', '2');
    downText.setAttribute('position', '0 0 0.01');
    downBtn.appendChild(downText);
    if (hasMore) {
      downBtn.addEventListener('click', function () { self.scrollDown(); });
      downBtn.addEventListener('mouseenter', function () { downBtn.setAttribute('material', 'color', '#0088ff'); });
      downBtn.addEventListener('mouseleave', function () { downBtn.setAttribute('material', 'color', '#0066cc'); });
    }
    this.fileListEl.appendChild(downBtn);
  },

  handleFileClick: function (file) {
    if (file.type === 'directory') {
      var newPath = this.currentPath === '/'
        ? '/' + file.name
        : this.currentPath + '/' + file.name;
      this.history.push(newPath);
      this.loadDirectory(newPath);
    } else if (['video', 'audio'].includes(file.type) || this.isMedia(file.name)) {
      this.el.setAttribute('visible', 'false');
      this.el.sceneEl.emit('play-media', {
        path: this.currentPath + '/' + file.name,
        type: file.type
      });
    } else if (file.type === 'image' || this.isImage(file.name)) {
      this.el.setAttribute('visible', 'false');
      this.el.sceneEl.emit('view-image', {
        path: this.currentPath + '/' + file.name
      });
    }
  },

  getFileIcon: function (name) {
    var ext = name.split('.').pop().toLowerCase();
    var icons = {
      mp4: '[VID]', mkv: '[VID]', avi: '[VID]', webm: '[VID]',
      mp3: '[AUD]', wav: '[AUD]', flac: '[AUD]', ogg: '[AUD]',
      jpg: '[IMG]', jpeg: '[IMG]', png: '[IMG]', gif: '[IMG]', webp: '[IMG]',
      txt: '[TXT]', pdf: '[PDF]', doc: '[DOC]'
    };
    return icons[ext] || '[FIL]';
  },

  isMedia: function (name) {
    return /\.(mp4|mkv|avi|webm|mp3|wav|flac|ogg)$/i.test(name);
  },

  isImage: function (name) {
    return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(name);
  }
});

// Navigation dans les fichiers
AFRAME.registerComponent('file-nav', {
  schema: {
    action: { type: 'string' }
  },
  init: function () {
    // Les clicks sont gérés dans file-explorer
  }
});
