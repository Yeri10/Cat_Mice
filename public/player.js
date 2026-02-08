/* eslint-env browser */

(function bootstrapPlayerController() {
  const root = /** @type {any} */ (window);

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  const WALL_SEGMENTS = [
    [0.12, 0.14, 0.12, 0.34],
    [0.34, 0.18, 0.34, 0.38],
    [0.56, 0.12, 0.56, 0.30],
    [0.78, 0.52, 0.78, 0.72],
    [0.90, 0.20, 0.90, 0.44],
    [0.04, 0.58, 0.24, 0.58],
    [0.30, 0.70, 0.50, 0.70],
    [0.58, 0.62, 0.74, 0.62],
    [0.16, 0.46, 0.28, 0.46]
  ];

  function collidesWithWalls(x, y) {
    const viewW = Math.max(1, window.innerWidth || 1);
    const viewH = Math.max(1, window.innerHeight || 1);
    const playerRpx = 26;
    const wallHalfPx = 11;
    const hitR = playerRpx + wallHalfPx;
    const rx = hitR / viewW;
    const ry = hitR / viewH;

    for (const [x1, y1, x2, y2] of WALL_SEGMENTS) {
      if (Math.abs(x1 - x2) < 1e-9) {
        const minY = Math.min(y1, y2) - ry;
        const maxY = Math.max(y1, y2) + ry;
        if (y >= minY && y <= maxY && Math.abs(x - x1) <= rx) return true;
      } else if (Math.abs(y1 - y2) < 1e-9) {
        const minX = Math.min(x1, x2) - rx;
        const maxX = Math.max(x1, x2) + rx;
        if (x >= minX && x <= maxX && Math.abs(y - y1) <= ry) return true;
      }
    }
    return false;
  }

  function resolveMoveWithWalls(fromX, fromY, toX, toY) {
    const tx = clamp01(toX);
    const ty = clamp01(toY);

    if (!collidesWithWalls(tx, ty)) {
      return { x: tx, y: ty };
    }

    const sx = clamp01(tx);
    const sy = clamp01(fromY);
    if (!collidesWithWalls(sx, sy)) {
      return { x: sx, y: sy };
    }

    const vx = clamp01(fromX);
    const vy = clamp01(ty);
    if (!collidesWithWalls(vx, vy)) {
      return { x: vx, y: vy };
    }

    return { x: clamp01(fromX), y: clamp01(fromY) };
  }

  function create(options = {}) {
    const getPlayers = options.getPlayers || (() => ({}));
    const getMyId = options.getMyId || (() => null);
    const state = {
      socket: null,
      enabled: false,
      moving: false,
      rafId: null,
      keys: new Set(),
      speedPerSecond: 0.22,
      lastTs: 0,
      emitEveryMs: 50,
      lastEmitAt: 0
    };

    function setSocket(socket) {
      state.socket = socket || null;
    }

    function keyToDir(evt) {
      const code = evt.code || "";
      const key = (evt.key || "").toLowerCase();
      const keyCode = Number(evt.keyCode || evt.which || 0);
      if (code === "ArrowUp" || code === "KeyW" || key === "arrowup" || key === "w" || keyCode === 38 || keyCode === 87) return "up";
      if (code === "ArrowDown" || code === "KeyS" || key === "arrowdown" || key === "s" || keyCode === 40 || keyCode === 83) return "down";
      if (code === "ArrowLeft" || code === "KeyA" || key === "arrowleft" || key === "a" || keyCode === 37 || keyCode === 65) return "left";
      if (code === "ArrowRight" || code === "KeyD" || key === "arrowright" || key === "d" || keyCode === 39 || keyCode === 68) return "right";
      return null;
    }

    function onKeyDown(e) {
      if (!state.enabled) return;
      const myId = getMyId();
      const allPlayers = getPlayers();
      if (myId && !allPlayers[myId]) {
        allPlayers[myId] = { id: myId, role: "observer", x: 0.5, y: 0.5, caught: false };
      }
      const me = myId ? allPlayers[myId] : null;
      if (me?.role === "mouse" && me?.caught === true) return;
      const dir = keyToDir(e);
      if (!dir) return;
      e.preventDefault();
      state.keys.add(dir);
      if (!state.moving) startLoop();
    }

    function onKeyUp(e) {
      const dir = keyToDir(e);
      if (!dir) return;
      e.preventDefault();
      state.keys.delete(dir);
      if (state.keys.size === 0) stopLoop();
    }

    function startLoop() {
      state.moving = true;
      state.lastTs = performance.now();
      state.rafId = requestAnimationFrame(tick);
    }

    function stopLoop() {
      state.moving = false;
      state.lastTs = 0;
      if (state.rafId !== null) {
        cancelAnimationFrame(state.rafId);
        state.rafId = null;
      }
    }

    function tick(ts) {
      if (!state.enabled || !state.moving) return;
      const myId = getMyId();
      const allPlayers = getPlayers();
      if (myId && !allPlayers[myId]) {
        allPlayers[myId] = {
          id: myId,
          role: "observer",
          x: 0.5,
          y: 0.5
        };
      }
      const me = myId ? allPlayers[myId] : null;
      if (!me) {
        state.rafId = requestAnimationFrame(tick);
        return;
      }
      if (me.role === "mouse" && me.caught === true) {
        state.keys.clear();
        stopLoop();
        return;
      }

      const dt = Math.min(0.05, (ts - (state.lastTs || ts)) / 1000);
      state.lastTs = ts;

      let dx = 0;
      let dy = 0;
      if (state.keys.has("left")) dx -= 1;
      if (state.keys.has("right")) dx += 1;
      if (state.keys.has("up")) dy -= 1;
      if (state.keys.has("down")) dy += 1;

      if (dx === 0 && dy === 0) {
        state.rafId = requestAnimationFrame(tick);
        return;
      }

      const len = Math.hypot(dx, dy) || 1;
      const vx = (dx / len) * state.speedPerSecond * dt;
      const vy = (dy / len) * state.speedPerSecond * dt;

      const px = Number(me.x) || 0;
      const py = Number(me.y) || 0;
      const next = resolveMoveWithWalls(px, py, px + vx, py + vy);
      me.x = next.x;
      me.y = next.y;

      const now = Date.now();
      if (state.socket?.connected && now - state.lastEmitAt >= state.emitEveryMs) {
        state.socket.emit("pos", { x: me.x, y: me.y });
        state.lastEmitAt = now;
      }

      state.rafId = requestAnimationFrame(tick);
    }

    function setEnabled(active) {
      state.enabled = Boolean(active);
      if (!state.enabled) {
        state.keys.clear();
        stopLoop();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", () => {
      state.keys.clear();
      stopLoop();
    });

    return {
      setSocket,
      setEnabled
    };
  }

  root.appPlayers = { create };
})();
