/* ===== MENU FAB ORBITAL (style ChatApp2) ===== */

(function () {
  var ORBIT_RADIUS = 110;
  var ITEM_SIZE = 52;
  var CENTER_SIZE = 60;
  var fabOpen = false;
  var orbitAngle = 0;
  var momentum = 0;
  var animFrame = null;
  var expandedSub = null;

  // Items du FAB (memes que ChatApp2 sidebar droite)
  var items = [
    { id: 'pinterest', icon: '📌', label: 'Pinterest', color: '#E60023', url: 'https://www.pinterest.com' },
    { id: 'github', icon: '🐙', label: 'GitHub', color: '#a855f7', url: 'https://github.com/Full-Gor' },
    {
      id: 'ia', icon: '🤖', label: 'IA', color: '#8b5cf6', url: null,
      subItems: [
        { id: 'chatgpt', icon: '💬', label: 'ChatGPT', color: '#10a37f', url: 'https://chat.openai.com' },
        { id: 'grok', icon: '⚡', label: 'Grok', color: '#fff', url: 'https://grok.x.ai' },
        { id: 'claude', icon: '🧠', label: 'Claude AI', color: '#d97706', url: 'https://claude.ai' },
        { id: 'claudecode', icon: '💻', label: 'Claude Code', color: '#b45309', url: 'https://claude.ai/code' },
      ]
    },
    { id: 'gmail', icon: '📧', label: 'Gmail', color: '#EA4335', url: 'https://mail.google.com' },
    { id: 'vercel', icon: '▲', label: 'Vercel', color: '#fff', url: 'https://vercel.com' },
    { id: 'nexusbuild', icon: '📦', label: 'NexusBuild', color: '#ef4444', url: '/nexusbuild' },
    { id: 'cloud1', icon: '☁️', label: 'Cloud1', color: '#3b82f6', url: '/' },
    { id: 'settings', icon: '⚙️', label: 'Options', color: '#9ca3af', url: null },
  ];

  // Creer le DOM du FAB overlay
  function createFabOverlay() {
    var overlay = document.createElement('div');
    overlay.id = 'fab-overlay';
    overlay.innerHTML = `
      <div id="fab-backdrop"></div>
      <div id="fab-scene">
        <div id="fab-items-ring"></div>
        <button id="fab-center-btn">⭐</button>
      </div>
      <div id="fab-hint">Appuyez pour ouvrir</div>
      <button id="fab-close-btn">✕</button>
      <div id="fab-submenu" style="display:none;"></div>
    `;
    document.body.appendChild(overlay);

    // Events
    document.getElementById('fab-backdrop').addEventListener('click', closeFab);
    document.getElementById('fab-close-btn').addEventListener('click', closeFab);
    document.getElementById('fab-center-btn').addEventListener('click', function () {
      if (fabOpen) closeFab(); else openFabItems();
    });

    // Drag rotation sur la scene
    var scene = document.getElementById('fab-scene');
    var dragging = false, startAngle = 0, startOrbit = 0, lastAngle = 0, lastTime = 0;

    function getAngle(x, y) {
      var rect = scene.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      return Math.atan2(y - cy, x - cx);
    }

    scene.addEventListener('pointerdown', function (e) {
      dragging = true;
      startAngle = getAngle(e.clientX, e.clientY);
      startOrbit = orbitAngle;
      lastAngle = startAngle;
      lastTime = Date.now();
      momentum = 0;
    });
    window.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var a = getAngle(e.clientX, e.clientY);
      var diff = (a - startAngle) * (180 / Math.PI);
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      orbitAngle = startOrbit + diff;

      var now = Date.now();
      var dt = now - lastTime;
      if (dt > 0 && dt < 100) {
        var da = a - lastAngle;
        if (da > Math.PI) da -= 2 * Math.PI;
        if (da < -Math.PI) da += 2 * Math.PI;
        momentum = momentum * 0.6 + (da * (180 / Math.PI) / Math.max(dt, 16) * 16) * 0.4;
        momentum = Math.max(-8, Math.min(8, momentum));
      }
      lastAngle = a;
      lastTime = now;
      renderItems();
    });
    window.addEventListener('pointerup', function () { dragging = false; });

    // Momentum loop
    function momentumLoop() {
      if (Math.abs(momentum) > 0.1) {
        momentum *= 0.95;
        orbitAngle += momentum;
        renderItems();
      }
      animFrame = requestAnimationFrame(momentumLoop);
    }
    animFrame = requestAnimationFrame(momentumLoop);

    overlay.style.display = 'none';
  }

  function getItemPos(index, total) {
    var startA = -Math.PI / 2;
    var step = (2 * Math.PI) / total;
    var orbRad = (orbitAngle * Math.PI) / 180;
    var a = startA + index * step + orbRad;
    return { x: Math.cos(a) * ORBIT_RADIUS, y: Math.sin(a) * ORBIT_RADIUS };
  }

  function renderItems() {
    var ring = document.getElementById('fab-items-ring');
    if (!ring) return;
    ring.innerHTML = '';

    items.forEach(function (item, i) {
      var pos = getItemPos(i, items.length);
      var el = document.createElement('div');
      el.className = 'fab-item';
      el.style.transform = 'translate(' + pos.x + 'px, ' + pos.y + 'px)';
      el.innerHTML = `
        <button class="fab-item-btn" style="background:${item.color};" data-id="${item.id}">
          <span class="fab-item-icon">${item.icon}</span>
        </button>
        <span class="fab-item-label">${item.label}</span>
      `;
      el.querySelector('.fab-item-btn').addEventListener('click', function (e) {
        e.stopPropagation();
        handleItemClick(item);
      });
      ring.appendChild(el);
    });
  }

  function handleItemClick(item) {
    if (item.subItems && item.subItems.length > 0) {
      toggleSubmenu(item);
    } else if (item.url) {
      window.open(item.url, '_blank');
    }
  }

  function toggleSubmenu(item) {
    var submenu = document.getElementById('fab-submenu');
    if (expandedSub === item.id) {
      submenu.style.display = 'none';
      expandedSub = null;
      return;
    }
    expandedSub = item.id;
    submenu.innerHTML = '';
    item.subItems.forEach(function (sub) {
      var btn = document.createElement('button');
      btn.className = 'fab-sub-btn';
      btn.style.borderLeftColor = sub.color;
      btn.innerHTML = '<span class="fab-sub-icon">' + sub.icon + '</span><span style="color:' + sub.color + '">' + sub.label + '</span>';
      btn.addEventListener('click', function () {
        if (sub.url) window.open(sub.url, '_blank');
      });
      submenu.appendChild(btn);
    });
    submenu.style.display = 'flex';
  }

  function openFabItems() {
    fabOpen = true;
    expandedSub = null;
    document.getElementById('fab-submenu').style.display = 'none';
    var center = document.getElementById('fab-center-btn');
    center.textContent = '✕';
    center.classList.add('active');
    document.getElementById('fab-hint').textContent = 'Glissez pour tourner';
    renderItems();
    // Animer l'apparition
    var ring = document.getElementById('fab-items-ring');
    ring.style.transform = 'scale(0)';
    ring.style.opacity = '0';
    requestAnimationFrame(function () {
      ring.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s';
      ring.style.transform = 'scale(1)';
      ring.style.opacity = '1';
    });
  }

  function closeFab() {
    fabOpen = false;
    expandedSub = null;
    document.getElementById('fab-submenu').style.display = 'none';
    var center = document.getElementById('fab-center-btn');
    center.textContent = '⭐';
    center.classList.remove('active');
    document.getElementById('fab-hint').textContent = 'Appuyez pour ouvrir';
    var ring = document.getElementById('fab-items-ring');
    ring.style.transition = 'transform 0.2s, opacity 0.15s';
    ring.style.transform = 'scale(0)';
    ring.style.opacity = '0';
    setTimeout(function () {
      document.getElementById('fab-overlay').style.display = 'none';
    }, 200);
  }

  // API publique
  window.fabMenu = {
    open: function () {
      var overlay = document.getElementById('fab-overlay');
      if (!overlay) createFabOverlay();
      overlay = document.getElementById('fab-overlay');
      overlay.style.display = 'flex';
      // Auto-open items
      setTimeout(function () { openFabItems(); }, 100);
    },
    close: closeFab,
    isOpen: function () { return fabOpen; }
  };

  // Creer le DOM au chargement
  document.addEventListener('DOMContentLoaded', function () {
    createFabOverlay();
  });
})();
