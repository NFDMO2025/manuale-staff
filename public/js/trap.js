(() => {
  const MEME_IMAGES = [
    'assets/zeb89/eh-volevi.png',
    'assets/zeb89/eh-volevi-2.png',
  ];
  const TRAP_ID = 'zeb-trap';
  let trapVisible = false;
  let devtoolsOpen = false;

  function memeTile(src, index) {
    return `
      <div class="zeb-meme" style="--rot:${index === 0 ? -2 : 2}deg">
        <img src="${src}?v=4" alt="Zeb89 — EH VOLEVI!" loading="lazy">
        <div class="zeb-meme-caption">EH VOLEVI!<br>MUZUNNA!</div>
      </div>`;
  }

  function buildTrap() {
    const grid = MEME_IMAGES.map((src, i) => memeTile(src, i)).join('');
    return `
      <div class="${TRAP_ID}-backdrop" id="${TRAP_ID}" role="dialog" aria-modal="true">
        <div class="${TRAP_ID}-noise"></div>
        <div class="${TRAP_ID}-content">
          <h1 class="${TRAP_ID}-title">EH VOLEVI! MUZUNNA!</h1>
          <p class="${TRAP_ID}-sub">Fratè, stai cercando di rubare ad un Torinese? Famosi per avere la Juventus?</p>
          <div class="${TRAP_ID}-grid">${grid}</div>
          <button type="button" class="${TRAP_ID}-close" id="zeb-trap-close">Ok ok, chiudi...</button>
        </div>
      </div>`;
  }

  function showTrap() {
    if (trapVisible) return;
    trapVisible = true;
    document.body.insertAdjacentHTML('beforeend', buildTrap());
    document.body.classList.add('zeb-trap-active');

    document.getElementById('zeb-trap-close')?.addEventListener('click', hideTrap);
    document.getElementById(TRAP_ID)?.addEventListener('click', (e) => {
      if (e.target.id === TRAP_ID) hideTrap();
    });
  }

  function hideTrap() {
    trapVisible = false;
    document.body.classList.remove('zeb-trap-active');
    document.getElementById(TRAP_ID)?.remove();
  }

  function isDevToolsShortcut(e) {
    if (e.key === 'F12') return true;
    if (e.key === 'PrintScreen') return true;
    if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C', 'K'].includes(e.key.toUpperCase())) return true;
    if (e.ctrlKey && e.key.toUpperCase() === 'U') return true;
    if (e.metaKey && e.altKey && e.key.toUpperCase() === 'I') return true;
    if (e.metaKey && e.altKey && e.key.toUpperCase() === 'C') return true;
    return false;
  }

  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showTrap();
  });

  document.addEventListener('keydown', (e) => {
    if (isDevToolsShortcut(e)) {
      e.preventDefault();
      showTrap();
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === 'PrintScreen') showTrap();
  });

  setInterval(() => {
    const gapW = window.outerWidth - window.innerWidth;
    const gapH = window.outerHeight - window.innerHeight;
    const open = gapW > 160 || gapH > 160;
    if (open && !devtoolsOpen) {
      devtoolsOpen = true;
      showTrap();
    } else if (!open) {
      devtoolsOpen = false;
    }
  }, 800);

  window.addEventListener('blur', () => {
    setTimeout(() => {
      const gapW = window.outerWidth - window.innerWidth;
      const gapH = window.outerHeight - window.innerHeight;
      if (gapW > 160 || gapH > 160) showTrap();
    }, 300);
  });

  window.addEventListener('beforeprint', () => {
    showTrap();
  });
})();
