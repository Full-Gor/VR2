/* ===== CLAVIER VIRTUEL VR ===== */

AFRAME.registerComponent('vr-keyboard', {
  init: function () {
    this.inputText = '';
    this.targetComponent = null;
    this.isShift = false;

    this.buildKeyboard();
  },

  buildKeyboard: function () {
    const rows = [
      ['1','2','3','4','5','6','7','8','9','0'],
      ['a','z','e','r','t','y','u','i','o','p'],
      ['q','s','d','f','g','h','j','k','l','m'],
      ['MAJ','w','x','c','v','b','n',',','.','DEL'],
      ['ESPACE','@','/','://','ENTER']
    ];

    const keyWidth = 0.28;
    const keyHeight = 0.25;
    const startY = 0.6;

    rows.forEach((row, rowIndex) => {
      const rowWidth = row.length * keyWidth;
      const startX = -rowWidth / 2;

      row.forEach((key, colIndex) => {
        const keyEl = document.createElement('a-entity');
        keyEl.setAttribute('class', 'clickable');

        let width = keyWidth - 0.02;
        let label = key;
        let posX = startX + colIndex * keyWidth + keyWidth / 2;

        // Touches spéciales plus larges
        if (key === 'ESPACE') {
          width = keyWidth * 2;
          label = '___';
          posX = startX + colIndex * keyWidth + keyWidth;
        } else if (key === 'ENTER') {
          width = keyWidth * 1.5;
          label = 'OK';
        }

        keyEl.setAttribute('position', `${posX} ${startY - rowIndex * keyHeight} 0`);
        keyEl.setAttribute('geometry', `primitive: plane; width: ${width}; height: ${keyHeight - 0.02}`);
        keyEl.setAttribute('material', 'color: #1a1a3e; opacity: 0.9');

        const text = document.createElement('a-text');
        text.setAttribute('value', label);
        text.setAttribute('align', 'center');
        text.setAttribute('color', key === 'ENTER' ? '#00ff00' : '#00ffff');
        text.setAttribute('width', '1.8');
        text.setAttribute('position', '0 0 0.01');
        keyEl.appendChild(text);

        // Interactions
        keyEl.addEventListener('mouseenter', () => {
          keyEl.setAttribute('material', 'color', '#3a3a6e');
        });
        keyEl.addEventListener('mouseleave', () => {
          keyEl.setAttribute('material', 'color', '#1a1a3e');
        });
        keyEl.addEventListener('click', () => {
          this.onKeyPress(key);
          // Flash feedback
          keyEl.setAttribute('material', 'color', '#00ffff');
          setTimeout(() => keyEl.setAttribute('material', 'color', '#1a1a3e'), 150);
        });

        this.el.appendChild(keyEl);
      });
    });

    // Affichage du texte saisi
    const display = document.createElement('a-entity');
    display.setAttribute('id', 'keyboard-display');
    display.setAttribute('position', `0 ${startY + 0.3} 0`);
    display.setAttribute('geometry', 'primitive: plane; width: 3; height: 0.3');
    display.setAttribute('material', 'color: #000; opacity: 0.9');

    const displayText = document.createElement('a-text');
    displayText.setAttribute('id', 'keyboard-text');
    displayText.setAttribute('value', '|');
    displayText.setAttribute('position', '-1.4 0 0.01');
    displayText.setAttribute('color', '#0f0');
    displayText.setAttribute('width', '2');
    display.appendChild(displayText);

    this.el.appendChild(display);
  },

  onKeyPress: function (key) {
    switch (key) {
      case 'DEL':
        this.inputText = this.inputText.slice(0, -1);
        break;
      case 'ESPACE':
        this.inputText += ' ';
        break;
      case 'ENTER':
        this.submit();
        return;
      case 'MAJ':
        this.isShift = !this.isShift;
        return;
      case '://':
        this.inputText += '://';
        break;
      default:
        this.inputText += this.isShift ? key.toUpperCase() : key;
        if (this.isShift) this.isShift = false;
    }

    // Mettre à jour l'affichage
    const displayText = this.el.querySelector('#keyboard-text');
    if (displayText) {
      displayText.setAttribute('value', this.inputText + '|');
    }
  },

  submit: function () {
    if (!this.inputText.trim()) return;

    // Envoyer au navigateur web
    const browser = document.querySelector('[web-browser]');
    if (browser && browser.components['web-browser']) {
      browser.components['web-browser'].handleTextInput(this.inputText);
    }

    this.inputText = '';
    const displayText = this.el.querySelector('#keyboard-text');
    if (displayText) displayText.setAttribute('value', '|');
  },

  clear: function () {
    this.inputText = '';
    const displayText = this.el.querySelector('#keyboard-text');
    if (displayText) displayText.setAttribute('value', '|');
  }
});
