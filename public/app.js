(function () {
  const socket = io();

  // Canvas & Context Setup
  const canvas = document.getElementById('pixel-canvas');
  const ctx = canvas.getContext('2d');
  const viewport = document.getElementById('viewport');
  const canvasContainer = document.getElementById('canvas-container');

  // UI Elements
  const palette = document.getElementById('color-palette');
  const swatches = document.querySelectorAll('.color-swatch');
  const cooldownBanner = document.getElementById('cooldown-banner');
  const cooldownTimerEl = document.getElementById('cooldown-timer');
  const infoBtn = document.getElementById('info-btn');
  const infoModal = document.getElementById('info-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  // Constants
  const GRID_SIZE = 100;
  const CELL_SIZE = 10; // Canvas resolution: 1000x1000
  const COOLDOWN_DURATION_MS = 5 * 60 * 1000;
  const CANVAS_BASE_SIZE = 600; // Displayed width/height of canvas element

  // Grid Data State
  const grid = new Array(GRID_SIZE * GRID_SIZE).fill('#FFFFFF');
  let selectedColor = '#FF0000'; // Default red

  // Zoom & Pan State
  let scale = 1.0;
  let panX = 0;
  let panY = 0;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let pointerDownPos = { x: 0, y: 0 };

  // Multi-touch Pinch & Pan State (Focal Point Tracking like Google Maps)
  let initialPinchDistance = null;
  let initialPinchScale = 1.0;
  let initialPinchPan = { x: 0, y: 0 };
  let initialCanvasFocal = { x: 0, y: 0 };

  // Cooldown State
  let cooldownTimerInterval = null;

  // Cookie helpers
  function setCookie(name, value, ms) {
    const date = new Date();
    date.setTime(date.getTime() + ms);
    document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/`;
  }

  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  }

  // Unique Device ID generation (Persistent per device/browser)
  function getOrCreateDeviceId() {
    let id = localStorage.getItem('pixel_device_id') || getCookie('pixel_device_id');
    if (!id) {
      id = 'dev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('pixel_device_id', id);
      setCookie('pixel_device_id', id, 365 * 24 * 60 * 60 * 1000);
    }
    return id;
  }

  const deviceId = getOrCreateDeviceId();

  // ----------------------------------------------------
  // 1. Initial Popup Modal Logic
  // ----------------------------------------------------
  function checkFirstVisitModal() {
    const dismissed = localStorage.getItem('pixel_modal_dismissed');
    if (!dismissed) {
      infoModal.classList.remove('hidden');
    }
  }

  modalCloseBtn.addEventListener('click', () => {
    infoModal.classList.add('hidden');
    localStorage.setItem('pixel_modal_dismissed', 'true');
  });

  infoBtn.addEventListener('click', () => {
    infoModal.classList.remove('hidden');
  });

  // ----------------------------------------------------
  // 2. Palette Color Selection
  // ----------------------------------------------------
  swatches.forEach(swatch => {
    swatch.addEventListener('click', (e) => {
      e.stopPropagation();
      swatches.forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      selectedColor = swatch.getAttribute('data-color');
    });
  });

  // ----------------------------------------------------
  // 3. Canvas Rendering & Viewport Boundary Clamping
  // ----------------------------------------------------
  function renderCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const color = grid[y * GRID_SIZE + x];
        ctx.fillStyle = color;
        ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }

  // Clamps pan coordinates so canvas grid NEVER gets dragged off screen
  function clampPan() {
    const rect = viewport.getBoundingClientRect();
    const scaledSize = CANVAS_BASE_SIZE * scale;

    const maxPanX = Math.max(0, (scaledSize - rect.width) / 2) + (rect.width * 0.35);
    const maxPanY = Math.max(0, (scaledSize - rect.height) / 2) + (rect.height * 0.35);

    panX = Math.min(Math.max(panX, -maxPanX), maxPanX);
    panY = Math.min(Math.max(panY, -maxPanY), maxPanY);
  }

  function updateTransform() {
    clampPan();
    canvasContainer.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${scale})`;
  }

  // ----------------------------------------------------
  // 4. Desktop Pan & Zoom Controls (Mouse & Touchpad)
  // ----------------------------------------------------
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const newScale = Math.min(Math.max(0.4, scale * zoomFactor), 15);

    // Zoom centered relative to mouse cursor
    const rect = viewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.width / 2;
    const mouseY = e.clientY - rect.height / 2;

    panX = mouseX - (mouseX - panX) * (newScale / scale);
    panY = mouseY - (mouseY - panY) * (newScale / scale);
    scale = newScale;

    updateTransform();
  }, { passive: false });

  // Mouse Dragging (Pan)
  viewport.addEventListener('mousedown', (e) => {
    if (e.target.closest('.toolbar-wrapper') || e.target.closest('#info-btn') || e.target.closest('.modal-overlay')) return;
    isDragging = true;
    dragStartX = e.clientX - panX;
    dragStartY = e.clientY - panY;
    pointerDownPos = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    viewport.classList.add('is-dragging');
    panX = e.clientX - dragStartX;
    panY = e.clientY - dragStartY;
    updateTransform();
  });

  window.addEventListener('mouseup', (e) => {
    viewport.classList.remove('is-dragging');
    if (!isDragging) return;
    isDragging = false;

    // Check if it was a click instead of a pan/drag
    const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
    if (dist < 6) {
      handleCanvasClick(e.clientX, e.clientY);
    }
  });

  // ----------------------------------------------------
  // 5. Mobile Touch Controls (True Focal Point Pinch Zoom like Google Maps)
  // ----------------------------------------------------
  function getTouchDistance(touches) {
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY
    );
  }

  function getTouchCenter(touches) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  }

  viewport.addEventListener('touchstart', (e) => {
    if (e.target.closest('.toolbar-wrapper') || e.target.closest('#info-btn') || e.target.closest('.modal-overlay')) return;

    if (e.touches.length === 1) {
      isDragging = true;
      dragStartX = e.touches[0].clientX - panX;
      dragStartY = e.touches[0].clientY - panY;
      pointerDownPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      isDragging = false;
      initialPinchDistance = getTouchDistance(e.touches);
      initialPinchScale = scale;
      initialPinchPan = { x: panX, y: panY };

      // Calculate initial touch focal midpoint relative to viewport center
      const rect = viewport.getBoundingClientRect();
      const center = getTouchCenter(e.touches);
      const focalX = center.x - rect.width / 2;
      const focalY = center.y - rect.height / 2;

      // Position of touch focal point relative to canvas center at initial scale
      initialCanvasFocal = {
        x: (focalX - panX) / scale,
        y: (focalY - panY) / scale
      };
    }
  }, { passive: false });

  viewport.addEventListener('touchmove', (e) => {
    if (e.target.closest('.toolbar-wrapper') || e.target.closest('#info-btn') || e.target.closest('.modal-overlay')) return;

    if (e.touches.length === 1 && isDragging) {
      panX = e.touches[0].clientX - dragStartX;
      panY = e.touches[0].clientY - dragStartY;
      updateTransform();
    } else if (e.touches.length === 2 && initialPinchDistance) {
      e.preventDefault();

      // 1. Calculate new scale ratio
      const currentDist = getTouchDistance(e.touches);
      const zoomRatio = currentDist / initialPinchDistance;
      const newScale = Math.min(Math.max(0.4, initialPinchScale * zoomRatio), 15);

      // 2. Calculate current touch focal midpoint relative to viewport center
      const rect = viewport.getBoundingClientRect();
      const currentCenter = getTouchCenter(e.touches);
      const currentFocalX = currentCenter.x - rect.width / 2;
      const currentFocalY = currentCenter.y - rect.height / 2;

      // 3. Anchor canvas focal point directly under current touch midpoint
      scale = newScale;
      panX = currentFocalX - initialCanvasFocal.x * scale;
      panY = currentFocalY - initialCanvasFocal.y * scale;

      updateTransform();
    }
  }, { passive: false });

  viewport.addEventListener('touchend', (e) => {
    if (e.touches.length === 0) {
      if (isDragging && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        const dist = Math.hypot(touch.clientX - pointerDownPos.x, touch.clientY - pointerDownPos.y);
        if (dist < 8) {
          handleCanvasClick(touch.clientX, touch.clientY);
        }
      }
      isDragging = false;
      initialPinchDistance = null;
    } else if (e.touches.length === 1) {
      // Transition smoothly back to 1-finger panning
      isDragging = true;
      dragStartX = e.touches[0].clientX - panX;
      dragStartY = e.touches[0].clientY - panY;
      initialPinchDistance = null;
    }
  });

  // ----------------------------------------------------
  // 6. Handle Pixel Placement Click
  // ----------------------------------------------------
  function handleCanvasClick(clientX, clientY) {
    if (palette.classList.contains('disabled')) return; // Cooldown active

    const rect = canvas.getBoundingClientRect();
    if (
      clientX < rect.left || clientX > rect.right ||
      clientY < rect.top || clientY > rect.bottom
    ) {
      return; // Click outside grid bounds
    }

    const relativeX = clientX - rect.left;
    const relativeY = clientY - rect.top;

    const gridX = Math.floor((relativeX / rect.width) * GRID_SIZE);
    const gridY = Math.floor((relativeY / rect.height) * GRID_SIZE);

    if (gridX >= 0 && gridX < GRID_SIZE && gridY >= 0 && gridY < GRID_SIZE) {
      socket.emit('place_pixel', { x: gridX, y: gridY, color: selectedColor, deviceId: deviceId });
    }
  }

  // ----------------------------------------------------
  // 7. Cooldown Manager (Timer & Cookie/LocalStorage Backup)
  // ----------------------------------------------------
  function startCooldownTimer(durationMs) {
    if (cooldownTimerInterval) clearInterval(cooldownTimerInterval);

    const endTime = Date.now() + durationMs;
    localStorage.setItem('pixel_cooldown_end', endTime.toString());
    setCookie('pixel_cooldown_end', endTime.toString(), durationMs);

    palette.classList.add('disabled');
    cooldownBanner.classList.remove('hidden');

    function update() {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      if (remaining <= 0) {
        clearInterval(cooldownTimerInterval);
        palette.classList.remove('disabled');
        cooldownBanner.classList.add('hidden');
        localStorage.removeItem('pixel_cooldown_end');
        document.cookie = 'pixel_cooldown_end=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      } else {
        const mins = String(Math.floor(remaining / 60)).padStart(2, '0');
        const secs = String(remaining % 60).padStart(2, '0');
        cooldownTimerEl.textContent = `${mins}:${secs}`;
      }
    }

    update();
    cooldownTimerInterval = setInterval(update, 1000);
  }

  function restoreCooldownIfActive() {
    const storedEnd = localStorage.getItem('pixel_cooldown_end') || getCookie('pixel_cooldown_end');
    if (storedEnd) {
      const remainingMs = parseInt(storedEnd, 10) - Date.now();
      if (remainingMs > 0) {
        startCooldownTimer(remainingMs);
      }
    }
  }

  // ----------------------------------------------------
  // 8. Socket.io Real-Time Synchronization
  // ----------------------------------------------------
  socket.on('init_grid', (fullGrid) => {
    fullGrid.forEach((color, idx) => grid[idx] = color);
    renderCanvas();
    restoreCooldownIfActive();
    socket.emit('check_cooldown', deviceId);
  });

  socket.on('pixel_updated', ({ x, y, color }) => {
    grid[y * GRID_SIZE + x] = color;
    renderCanvas();
  });

  socket.on('cooldown_status', ({ active, remainingMs }) => {
    if (active && remainingMs > 0) {
      startCooldownTimer(remainingMs);
    }
  });

  socket.on('cooldown_error', ({ remainingMs }) => {
    startCooldownTimer(remainingMs);
  });

  // Check first visit popup
  checkFirstVisitModal();
  updateTransform();

  window.addEventListener('resize', updateTransform);
})();
