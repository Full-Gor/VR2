/* ===== CHAT PANEL NATIF A-FRAME ===== */
/* Interface de chat Claude intégrée dans l'environnement VR */
/* HTML overlay plein écran, toggle via bouton menu ou event */

(function () {
  var chatState = {
    token: null,
    userId: null,
    chats: [],
    currentChatId: null,
    messages: [],
    loading: false,
    visible: false
  };

  // ===== AUTH =====
  function getToken() {
    if (chatState.token) return Promise.resolve(chatState.token);
    // Vérifier localStorage
    var stored = localStorage.getItem('@auth_token');
    if (stored) {
      try { chatState.token = JSON.parse(stored); } catch (e) { chatState.token = stored; }
      return Promise.resolve(chatState.token);
    }
    // Auto-login
    return fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'admin', password: 'cloud1admin' })
    }).then(function (r) { return r.json(); }).then(function (data) {
      chatState.token = data.data.token;
      localStorage.setItem('@auth_token', JSON.stringify(chatState.token));
      return chatState.token;
    });
  }

  function apiFetch(url, opts) {
    return getToken().then(function (token) {
      opts = opts || {};
      opts.headers = opts.headers || {};
      opts.headers['Authorization'] = 'Bearer ' + token;
      if (opts.body && typeof opts.body === 'object') {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(opts.body);
      }
      return fetch(url, opts).then(function (r) { return r.json(); });
    });
  }

  // ===== API CALLS =====
  function loadChats() {
    return apiFetch('/api/chats').then(function (res) {
      chatState.chats = (res.data || []).filter(function (c) {
        return c.type === 'ai' || c.type === 'private';
      });
      return chatState.chats;
    });
  }

  function loadMessages(chatId) {
    chatState.currentChatId = chatId;
    return apiFetch('/api/chats/' + chatId + '/messages?limit=50').then(function (res) {
      chatState.messages = (res.data || []).reverse();
      return chatState.messages;
    });
  }

  function sendMessage(chatId, content) {
    return apiFetch('/api/chats/' + chatId + '/messages', {
      method: 'POST',
      body: { content: content, type: 'text' }
    });
  }

  function createChat(name) {
    return apiFetch('/api/chats', {
      method: 'POST',
      body: { name: name, type: 'ai', participants: [], metadata: {} }
    }).then(function (res) {
      return res.data;
    });
  }

  // ===== UI =====
  var container = null;

  function buildUI() {
    if (container) return;
    container = document.createElement('div');
    container.id = 'vr-chat-panel';
    container.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;z-index:9990;font-family:monospace;background:rgba(5,5,20,0.95);color:#fff;overflow:hidden;';

    container.innerHTML = [
      '<div id="vrc-header" style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#0a0a2a;border-bottom:1px solid #00ffff33;">',
      '  <span id="vrc-title" style="color:#00ffff;font-size:16px;font-weight:bold;">CHAT</span>',
      '  <div style="display:flex;gap:8px;">',
      '    <button id="vrc-new-btn" style="background:#1a1a3e;border:1px solid #00ffff55;color:#00ffff;padding:6px 12px;border-radius:4px;font-family:monospace;cursor:pointer;">+ Nouveau</button>',
      '    <button id="vrc-back-btn" style="display:none;background:#1a1a3e;border:1px solid #00ffff55;color:#00ffff;padding:6px 12px;border-radius:4px;font-family:monospace;cursor:pointer;">< Retour</button>',
      '    <button id="vrc-close-btn" style="background:#cc0000;border:1px solid #ff4444;color:#fff;padding:6px 12px;border-radius:4px;font-family:monospace;font-weight:bold;cursor:pointer;">X</button>',
      '  </div>',
      '</div>',
      '<div id="vrc-chat-list" style="overflow-y:auto;height:calc(100% - 44px);padding:8px;"></div>',
      '<div id="vrc-messages-view" style="display:none;height:calc(100% - 44px);flex-direction:column;">',
      '  <div id="vrc-messages" style="flex:1;overflow-y:auto;padding:8px 12px;"></div>',
      '  <div id="vrc-input-bar" style="padding:8px;background:#0a0a2a;border-top:1px solid #00ffff33;">',
      '    <div style="display:flex;gap:8px;margin-bottom:6px;">',
      '      <div id="vrc-display" style="flex:1;background:#000;border:1px solid #0f0;border-radius:6px;color:#0f0;padding:8px 12px;font-family:monospace;font-size:14px;min-height:36px;word-break:break-all;white-space:pre-wrap;">|</div>',
      '      <button id="vrc-mic-btn" style="background:#1a1a3e;border:2px solid #ff6600;color:#ff6600;padding:8px 14px;border-radius:6px;font-family:monospace;font-size:18px;cursor:pointer;min-width:48px;">&#127908;</button>',
      '      <button id="vrc-send-btn" style="background:#00ffff;color:#000;border:none;padding:8px 18px;border-radius:6px;font-family:monospace;font-weight:bold;cursor:pointer;font-size:14px;">Envoyer</button>',
      '    </div>',
      '    <div id="vrc-keyboard" style="padding:4px 0;">',
      '      <div style="display:flex;justify-content:center;gap:3px;margin-bottom:3px;">',
      '        <div class="vrc-key" data-key="1">1</div><div class="vrc-key" data-key="2">2</div><div class="vrc-key" data-key="3">3</div><div class="vrc-key" data-key="4">4</div><div class="vrc-key" data-key="5">5</div><div class="vrc-key" data-key="6">6</div><div class="vrc-key" data-key="7">7</div><div class="vrc-key" data-key="8">8</div><div class="vrc-key" data-key="9">9</div><div class="vrc-key" data-key="0">0</div>',
      '      </div>',
      '      <div style="display:flex;justify-content:center;gap:3px;margin-bottom:3px;">',
      '        <div class="vrc-key" data-key="a">a</div><div class="vrc-key" data-key="z">z</div><div class="vrc-key" data-key="e">e</div><div class="vrc-key" data-key="r">r</div><div class="vrc-key" data-key="t">t</div><div class="vrc-key" data-key="y">y</div><div class="vrc-key" data-key="u">u</div><div class="vrc-key" data-key="i">i</div><div class="vrc-key" data-key="o">o</div><div class="vrc-key" data-key="p">p</div>',
      '      </div>',
      '      <div style="display:flex;justify-content:center;gap:3px;margin-bottom:3px;">',
      '        <div class="vrc-key" data-key="q">q</div><div class="vrc-key" data-key="s">s</div><div class="vrc-key" data-key="d">d</div><div class="vrc-key" data-key="f">f</div><div class="vrc-key" data-key="g">g</div><div class="vrc-key" data-key="h">h</div><div class="vrc-key" data-key="j">j</div><div class="vrc-key" data-key="k">k</div><div class="vrc-key" data-key="l">l</div><div class="vrc-key" data-key="m">m</div>',
      '      </div>',
      '      <div style="display:flex;justify-content:center;gap:3px;margin-bottom:3px;">',
      '        <div class="vrc-key vrc-wide" data-key="MAJ" id="vrc-maj-btn">MAJ</div><div class="vrc-key" data-key="w">w</div><div class="vrc-key" data-key="x">x</div><div class="vrc-key" data-key="c">c</div><div class="vrc-key" data-key="v">v</div><div class="vrc-key" data-key="b">b</div><div class="vrc-key" data-key="n">n</div><div class="vrc-key" data-key="\u00e9">\u00e9</div><div class="vrc-key" data-key="\u00e8">\u00e8</div><div class="vrc-key vrc-danger" data-key="DEL">DEL</div>',
      '      </div>',
      '      <div style="display:flex;justify-content:center;gap:3px;margin-bottom:3px;">',
      '        <div class="vrc-key" data-key=",">,</div><div class="vrc-key" data-key=".">.</div><div class="vrc-key" data-key="!">!</div><div class="vrc-key" data-key="?">?</div><div class="vrc-key vrc-extra-wide" data-key="ESPACE">ESPACE</div><div class="vrc-key" data-key="\'">\\\'</div><div class="vrc-key" data-key="-">-</div><div class="vrc-key vrc-action vrc-wide" data-key="ENTER">OK</div>',
      '      </div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');

    document.body.appendChild(container);

    // Events
    document.getElementById('vrc-close-btn').addEventListener('click', hideChat);
    document.getElementById('vrc-back-btn').addEventListener('click', showChatList);
    document.getElementById('vrc-new-btn').addEventListener('click', newChat);
    document.getElementById('vrc-send-btn').addEventListener('click', onSend);

    // ===== CLAVIER TACTILE =====
    var chatInputText = '';
    var chatCapsLock = false;

    function updateDisplay() {
      var disp = document.getElementById('vrc-display');
      if (disp) disp.textContent = chatInputText + '|';
    }

    var keyboard = document.getElementById('vrc-keyboard');
    keyboard.addEventListener('touchstart', function (e) {
      e.preventDefault();
      var key = e.target.getAttribute('data-key');
      if (!key) return;
      e.target.style.background = '#00ffff';
      e.target.style.color = '#000';
      setTimeout(function () {
        e.target.style.background = '';
        e.target.style.color = '';
      }, 150);
      handleKey(key);
    }, { passive: false });
    keyboard.addEventListener('click', function (e) {
      var key = e.target.getAttribute('data-key');
      if (!key) return;
      handleKey(key);
    });

    function handleKey(key) {
      switch (key) {
        case 'DEL':
          chatInputText = chatInputText.slice(0, -1);
          break;
        case 'ESPACE':
          chatInputText += ' ';
          break;
        case 'ENTER':
          onSend();
          return;
        case 'MAJ':
          chatCapsLock = !chatCapsLock;
          var majBtn = document.getElementById('vrc-maj-btn');
          if (majBtn) {
            majBtn.style.background = chatCapsLock ? '#00ffff' : '';
            majBtn.style.color = chatCapsLock ? '#000' : '';
          }
          return;
        default:
          chatInputText += chatCapsLock ? key.toUpperCase() : key;
          if (chatCapsLock) {
            chatCapsLock = false;
            var majBtn2 = document.getElementById('vrc-maj-btn');
            if (majBtn2) { majBtn2.style.background = ''; majBtn2.style.color = ''; }
          }
      }
      updateDisplay();
    }

    // Exposer chatInputText pour onSend
    window._vrcGetText = function () { return chatInputText; };
    window._vrcClearText = function () { chatInputText = ''; updateDisplay(); };

    // ===== MICRO (Speech Recognition) =====
    var micBtn = document.getElementById('vrc-mic-btn');
    var recognition = null;
    var isListening = false;

    if (window.webkitSpeechRecognition || window.SpeechRecognition) {
      var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition = new SpeechRec();
      recognition.lang = 'fr-FR';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onresult = function (event) {
        var transcript = '';
        for (var i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        // Remplacer le texte en cours par la dictée
        chatInputText = transcript;
        updateDisplay();
      };

      recognition.onend = function () {
        isListening = false;
        micBtn.style.background = '#1a1a3e';
        micBtn.style.borderColor = '#ff6600';
        micBtn.style.color = '#ff6600';
      };

      recognition.onerror = function () {
        isListening = false;
        micBtn.style.background = '#1a1a3e';
        micBtn.style.borderColor = '#ff6600';
        micBtn.style.color = '#ff6600';
      };

      micBtn.addEventListener('click', function () {
        if (isListening) {
          recognition.stop();
        } else {
          isListening = true;
          micBtn.style.background = '#ff6600';
          micBtn.style.borderColor = '#ff6600';
          micBtn.style.color = '#fff';
          recognition.start();
        }
      });
    } else {
      micBtn.style.display = 'none';
    }
  }

  function showChat() {
    buildUI();
    chatState.visible = true;
    container.style.display = 'block';
    // Disable A-Frame canvas interactions
    var canvas = document.querySelector('a-scene canvas');
    if (canvas) canvas.style.pointerEvents = 'none';
    var vrBtn = document.getElementById('vr-stereo-btn');
    if (vrBtn) vrBtn.style.display = 'none';

    showChatList();
  }

  function hideChat() {
    chatState.visible = false;
    if (container) container.style.display = 'none';
    var canvas = document.querySelector('a-scene canvas');
    if (canvas) canvas.style.pointerEvents = '';
    var vrBtn = document.getElementById('vr-stereo-btn');
    if (vrBtn) vrBtn.style.display = 'block';
  }

  function showChatList() {
    document.getElementById('vrc-chat-list').style.display = 'block';
    document.getElementById('vrc-messages-view').style.display = 'none';
    document.getElementById('vrc-back-btn').style.display = 'none';
    document.getElementById('vrc-title').textContent = 'CHAT';

    var listEl = document.getElementById('vrc-chat-list');
    listEl.innerHTML = '<div style="text-align:center;padding:20px;color:#666;">Chargement...</div>';

    loadChats().then(function (chats) {
      if (!chats.length) {
        listEl.innerHTML = '<div style="text-align:center;padding:40px;color:#666;">Aucune conversation.<br>Appuyez sur "+ Nouveau" pour commencer.</div>';
        return;
      }
      listEl.innerHTML = '';
      chats.forEach(function (chat) {
        var item = document.createElement('div');
        item.style.cssText = 'padding:14px 16px;margin:4px 0;background:#111;border:1px solid #00ffff22;border-radius:8px;cursor:pointer;transition:background 0.2s;';
        var lastMsg = chat.lastMessage ? chat.lastMessage.content : '';
        if (lastMsg.length > 80) lastMsg = lastMsg.substring(0, 80) + '...';
        var time = chat.lastMessage ? new Date(chat.lastMessage.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
        item.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;">' +
          '<span style="color:#00ffff;font-weight:bold;font-size:14px;">' + escHtml(chat.name || 'Sans nom') + '</span>' +
          '<span style="color:#666;font-size:11px;">' + time + '</span>' +
          '</div>' +
          '<div style="color:#999;font-size:12px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escHtml(lastMsg) + '</div>';
        item.addEventListener('mouseenter', function () { item.style.background = '#1a1a3e'; });
        item.addEventListener('mouseleave', function () { item.style.background = '#111'; });
        item.addEventListener('click', function () { openConversation(chat.id, chat.name); });
        listEl.appendChild(item);
      });
    });
  }

  function openConversation(chatId, chatName) {
    document.getElementById('vrc-chat-list').style.display = 'none';
    document.getElementById('vrc-messages-view').style.display = 'flex';
    document.getElementById('vrc-back-btn').style.display = 'inline-block';
    document.getElementById('vrc-title').textContent = chatName || 'Chat';

    var msgEl = document.getElementById('vrc-messages');
    msgEl.innerHTML = '<div style="text-align:center;padding:20px;color:#666;">Chargement...</div>';

    loadMessages(chatId).then(function () {
      renderMessages();
    });
  }

  function renderMessages() {
    var msgEl = document.getElementById('vrc-messages');
    msgEl.innerHTML = '';

    chatState.messages.forEach(function (msg) {
      var isMe = msg.senderId !== 'bot' && msg.senderName !== 'Claude' && msg.senderId !== 'system';
      // Heuristic: if sender name contains 'claude' or 'bot', it's AI
      if (msg.senderName && msg.senderName.toLowerCase().indexOf('claude') !== -1) isMe = false;
      if (msg.senderId === 'bot') isMe = false;

      var bubble = document.createElement('div');
      bubble.style.cssText = 'max-width:80%;padding:10px 14px;margin:6px 0;border-radius:12px;word-wrap:break-word;white-space:pre-wrap;font-size:13px;line-height:1.4;' +
        (isMe
          ? 'background:#00ffff22;color:#fff;margin-left:auto;border-bottom-right-radius:4px;'
          : 'background:#1a1a3e;color:#ddd;margin-right:auto;border-bottom-left-radius:4px;');

      var content = msg.content || '';
      // Simple markdown: **bold**, `code`
      content = escHtml(content);
      content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      content = content.replace(/`([^`]+)`/g, '<code style="background:#00000066;padding:1px 4px;border-radius:3px;font-size:12px;">$1</code>');

      var time = new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      bubble.innerHTML = '<div>' + content + '</div>' +
        '<div style="text-align:right;font-size:10px;color:#666;margin-top:4px;">' + time + '</div>';
      msgEl.appendChild(bubble);
    });

    // Scroll to bottom
    msgEl.scrollTop = msgEl.scrollHeight;
  }

  function onSend() {
    var text = (window._vrcGetText ? window._vrcGetText() : '').trim();
    if (!text || chatState.loading) return;

    chatState.loading = true;
    if (window._vrcClearText) window._vrcClearText();

    // Add message to UI immediately
    var now = new Date();
    chatState.messages.push({ content: text, senderId: 'me', createdAt: now.toISOString() });
    renderMessages();

    // Add typing indicator
    var typingId = 'typing-' + Date.now();
    chatState.messages.push({ content: '...', senderId: 'bot', senderName: 'Claude', createdAt: now.toISOString(), _typingId: typingId });
    renderMessages();

    sendMessage(chatState.currentChatId, text).then(function () {
      // Poll for AI response
      pollForResponse(chatState.currentChatId, chatState.messages.length - 1);
    }).catch(function () {
      chatState.loading = false;
      // Remove typing indicator
      chatState.messages = chatState.messages.filter(function (m) { return m._typingId !== typingId; });
      renderMessages();
    });
  }

  function pollForResponse(chatId, msgCountBefore) {
    var attempts = 0;
    var maxAttempts = 120; // 120 * 2s = 4 minutes max

    function check() {
      if (chatId !== chatState.currentChatId) return; // User changed chat
      attempts++;

      apiFetch('/api/chats/' + chatId + '/messages?limit=5').then(function (res) {
        var msgs = (res.data || []).reverse();
        var lastMsg = msgs[msgs.length - 1];

        // Check if we got a new AI response
        if (lastMsg && (lastMsg.senderId === 'bot' || (lastMsg.senderName && lastMsg.senderName.toLowerCase().indexOf('claude') !== -1))) {
          // Check if this is newer than what we have
          var isNew = true;
          for (var i = chatState.messages.length - 1; i >= 0; i--) {
            if (chatState.messages[i].id === lastMsg.id) { isNew = false; break; }
          }
          if (isNew || attempts > 2) {
            // Remove typing indicator and reload
            chatState.messages = chatState.messages.filter(function (m) { return !m._typingId; });
            loadMessages(chatId).then(function () {
              renderMessages();
              chatState.loading = false;
            });
            return;
          }
        }

        if (attempts < maxAttempts) {
          setTimeout(check, 2000);
        } else {
          chatState.loading = false;
          chatState.messages = chatState.messages.filter(function (m) { return !m._typingId; });
          renderMessages();
        }
      }).catch(function () {
        chatState.loading = false;
      });
    }

    setTimeout(check, 3000); // Wait 3s before first poll (give bot time)
  }

  function newChat() {
    var name = 'Chat VR ' + new Date().toLocaleDateString('fr-FR');
    createChat(name).then(function (chat) {
      if (chat && chat.id) {
        openConversation(chat.id, chat.name || name);
      }
    });
  }

  function escHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ===== A-FRAME COMPONENT =====
  AFRAME.registerComponent('chat-panel', {
    init: function () {
      buildUI();

      // Listen for toggle event
      this.el.sceneEl.addEventListener('toggle-chat', function () {
        if (chatState.visible) {
          hideChat();
        } else {
          showChat();
        }
      });
    }
  });

  // Bouton CHAT dans le menu principal
  AFRAME.registerComponent('chat-button', {
    init: function () {
      this.el.addEventListener('click', function () {
        this.sceneEl.emit('toggle-chat');
      });
      this.el.addEventListener('mouseenter', function () {
        this.setAttribute('material', 'color', '#2a2a4e');
      });
      this.el.addEventListener('mouseleave', function () {
        this.setAttribute('material', 'color', '#1a1a2e');
      });
    }
  });
})();
