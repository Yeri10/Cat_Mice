/* eslint-env browser */

(function bootstrapGpsNavigation() {
  const root = /** @type {any} */ (window);

  const VIRTUAL_TARGETS = {
    north_gate: { name: "北门", x: 0.5, y: 0.1 },
    east_storage: { name: "东仓库", x: 0.88, y: 0.36 },
    south_hall: { name: "南大厅", x: 0.5, y: 0.9 },
    west_corner: { name: "西角落", x: 0.14, y: 0.56 },
    center: { name: "中央点", x: 0.5, y: 0.5 }
  };

  function toNumber(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function bearingArrow(dx, dy) {
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (angle >= -22.5 && angle < 22.5) return "→";
    if (angle >= 22.5 && angle < 67.5) return "↘";
    if (angle >= 67.5 && angle < 112.5) return "↓";
    if (angle >= 112.5 && angle < 157.5) return "↙";
    if (angle >= 157.5 || angle < -157.5) return "←";
    if (angle >= -157.5 && angle < -112.5) return "↖";
    if (angle >= -112.5 && angle < -67.5) return "↑";
    return "↗";
  }

  function create(options = {}) {
    const getMode = options.getMode || (() => "virtual");
    const getMyId = options.getMyId || (() => null);
    const getPlayers = options.getPlayers || (() => ({}));
    const getRoomState = options.getRoomState || (() => null);
    const getSocket = options.getSocket || (() => null);
    const getApiKey = options.getApiKey || (() => "");

    const dom = options.dom || {};

    const state = {
      geo: null,
      geoError: "",
      mapError: "",
      watchId: null,
      map: null,
      meMarker: null,
      roomMarkers: new Map(),
      travelKm: 0,
      lastGeoEmitAt: 0,
      mapDisabled: false,
      ensuringMap: false,
      googleLoadPromise: null
    };

    function setOutput(text) {
      if (dom.output) dom.output.textContent = text;
    }

    function setMapError(text = "") {
      state.mapError = text;
      if (!dom.output) return;
      if (text) {
        dom.output.classList.add("map-error");
        dom.output.textContent = text;
      } else {
        dom.output.classList.remove("map-error");
      }
    }

    function isPlaceholderKey(apiKey) {
      if (!apiKey) return true;
      const k = String(apiKey).trim().toUpperCase();
      return k.includes("PASTE_YOUR") || k.includes("YOUR_GOOGLE_MAPS_API_KEY");
    }

    function setModeLabel() {
      if (!dom.modeLine) return;
      const mode = getMode();
      dom.modeLine.textContent = mode === "api" ? "GPS: Real Map Navigation" : "GPS: Virtual Map Navigation";
    }

    function setSectionVisibility() {
      const mode = getMode();
      if (dom.virtualControls) dom.virtualControls.classList.toggle("hidden", mode !== "virtual");
      if (dom.output) dom.output.classList.toggle("hidden", mode === "api" && !state.mapError);
      if (dom.map) dom.map.classList.toggle("hidden", mode !== "api");
      if (dom.panel) dom.panel.classList.toggle("hidden", mode !== "api");
      if (dom.realHud) dom.realHud.classList.toggle("hidden", mode !== "api");
    }

    function haversineKm(a, b) {
      const toRad = (x) => (x * Math.PI) / 180;
      const R = 6371;
      const dLat = toRad(b.lat - a.lat);
      const dLng = toRad(b.lng - a.lng);
      const q =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
      return 2 * R * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
    }

    function updateRealHud() {
      if (!dom.realHud) return;
      const speed = Number.isFinite(state.geo?.speed) ? Math.max(0, state.geo.speed) : 0;
      if (dom.rmSpeed) dom.rmSpeed.textContent = speed.toFixed(1);
      if (dom.rmDist) dom.rmDist.textContent = state.travelKm.toFixed(2);
      if (dom.rmStatus) {
        dom.rmStatus.textContent = state.geo
          ? `Online · ${Math.round(state.geo.lat * 1000) / 1000}, ${Math.round(state.geo.lng * 1000) / 1000}`
          : "Locating...";
      }
      if (dom.rmTimer) {
        const timerText = document.getElementById("timer")?.textContent || "--:--";
        dom.rmTimer.textContent = timerText;
      }
    }

    function startGeolocation() {
      if (!navigator.geolocation) {
        state.geoError = "浏览器不支持地理定位";
        return;
      }
      if (state.watchId !== null) return;

      state.watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const prev = state.geo;
          state.geo = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            speed: pos.coords.speed
          };
          if (prev && Number.isFinite(prev.lat) && Number.isFinite(prev.lng)) {
            const stepKm = haversineKm(prev, state.geo);
            if (stepKm < 0.2) state.travelKm += stepKm;
          }
          state.geoError = "";
          if (state.meMarker) {
            state.meMarker.setPosition(state.geo);
          }
          if (state.map && state.meMarker) {
            state.map.panTo(state.geo);
          }
          const now = Date.now();
          if (now - state.lastGeoEmitAt > 1200) {
            getSocket()?.emit("geo-pos", {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              heading: pos.coords.heading,
              speed: pos.coords.speed,
              acc: pos.coords.accuracy
            });
            state.lastGeoEmitAt = now;
          }
          updateRealHud();
        },
        (err) => {
          state.geoError = err?.message || "无法获取定位";
        },
        {
          enableHighAccuracy: true,
          maximumAge: 3000,
          timeout: 10000
        }
      );
    }

    function loadGoogleMaps(apiKey) {
      if (root.google?.maps) {
        return Promise.resolve(root.google.maps);
      }
      if (state.googleLoadPromise) {
        return state.googleLoadPromise;
      }

      state.googleLoadPromise = new Promise((resolve, reject) => {
        const callbackName = `googleMapsReady_${Date.now()}`;
        root.gm_authFailure = () => {
          state.mapDisabled = true;
          setMapError("Google Maps auth failed. Check API key restrictions (localhost/127.0.0.1 referrer).");
        };
        root[callbackName] = () => {
          delete root[callbackName];
          setMapError("");
          resolve(root.google.maps);
        };

        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async&callback=${callbackName}`;
        script.async = true;
        script.defer = true;
        script.onerror = () => {
          delete root[callbackName];
          reject(new Error("Google Maps SDK 加载失败"));
        };

        document.head.appendChild(script);
      });

      return state.googleLoadPromise;
    }

    async function ensureMapReady() {
      const apiKey = (getApiKey() || "").trim();
      if (isPlaceholderKey(apiKey)) {
        throw new Error("Google Maps API key is not configured on server");
      }

      const maps = await loadGoogleMaps(apiKey);

      if (!state.map) {
        state.map = new maps.Map(dom.map, {
          center: state.geo || { lat: 51.5074, lng: -0.1278 },
          zoom: 15,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false
        });
        state.meMarker = new maps.Marker({
          map: state.map,
          position: state.geo || { lat: 51.5074, lng: -0.1278 },
          title: "Your location"
        });
        updateRealHud();
      }

      return maps;
    }

    async function ensureApiMapView() {
      if (state.ensuringMap) return;
      if (state.mapDisabled) return;
      state.ensuringMap = true;
      try {
        await ensureMapReady();
        setMapError("");
      } catch (_err) {
        state.mapDisabled = true;
        setMapError("Real Map unavailable. Verify API key, Maps JavaScript API enablement, billing, and referrer.");
      } finally {
        state.ensuringMap = false;
        setSectionVisibility();
      }
    }

    function renderVirtualNavigation() {
      const players = getPlayers();
      const myId = getMyId();
      const me = myId ? players[myId] : null;
      if (!me) {
        setOutput("Virtual navigation is waiting for player position data...");
        return;
      }

      const selectedId = dom.virtualTarget?.value || "center";
      const target = VIRTUAL_TARGETS[selectedId] || VIRTUAL_TARGETS.center;

      const mx = toNumber(me.x, 0.5);
      const my = toNumber(me.y, 0.5);
      const dx = target.x - mx;
      const dy = target.y - my;
      const dist = Math.hypot(dx, dy);

      const approxMeters = Math.max(0, dist * 120);
      const direction = bearingArrow(dx, dy);

      setOutput(`目标: ${target.name} | 方向: ${direction} | 约 ${approxMeters.toFixed(1)} 米`);
    }

    function markerVisual(player, isMe) {
      const role = player?.role;
      if (isMe) return { emoji: "📍", bg: "#2563eb", text: "ME" };
      if (role === "cat") return { emoji: "🐱", bg: "#f08c52", text: "CAT" };
      if (role === "mouse") return { emoji: "🐭", bg: "#8fa8ff", text: "MOUSE" };
      return { emoji: "🙂", bg: "#9ca3af", text: "P" };
    }

    function markerIconSvg(visual, isMe) {
      const size = isMe ? 56 : 46;
      const emojiSize = isMe ? 24 : 20;
      return {
        url:
          `data:image/svg+xml;utf8,` +
          encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
              `<circle cx="${size / 2}" cy="${size / 2}" r="${(size / 2) - 2}" fill="${visual.bg}" stroke="#ffffff" stroke-width="4"/>` +
              `<text x="50%" y="54%" text-anchor="middle" font-size="${emojiSize}">${visual.emoji}</text>` +
            `</svg>`
          ),
        scaledSize: new root.google.maps.Size(size, size)
      };
    }

    function syncRoomMarkers() {
      if (!state.map || getMode() !== "api") return;

      const players = getPlayers() || {};
      const room = getRoomState();
      const roomSeats = room?.seats || [];
      const visibleIds = new Set();
      const seatIds = roomSeats.filter((s) => s && !s.empty && s.socketId).map((s) => s.socketId);
      const ids = seatIds.length > 0 ? seatIds : Object.keys(players);
      const myId = getMyId();

      for (const sid of ids) {
        const p = players[sid];
        const lat = p?.geo?.lat;
        const lng = p?.geo?.lng;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        visibleIds.add(sid);

        const existing = state.roomMarkers.get(sid);
        const visual = markerVisual(p, sid === myId);
        if (existing) {
          existing.setPosition({ lat, lng });
          existing.setIcon(markerIconSvg(visual, sid === myId));
          continue;
        }

        const marker = new root.google.maps.Marker({
          map: state.map,
          position: { lat, lng },
          title: p?.name || "Player",
          icon: markerIconSvg(visual, sid === myId),
          label: {
            text: p?.name || visual.text,
            color: "#1f2937",
            fontWeight: "700",
            fontSize: "12px"
          }
        });
        state.roomMarkers.set(sid, marker);
      }

      for (const [sid, marker] of state.roomMarkers.entries()) {
        if (!visibleIds.has(sid)) {
          marker.setMap(null);
          state.roomMarkers.delete(sid);
        }
      }
    }

    function refresh() {
      setModeLabel();
      setSectionVisibility();

      if (getMode() === "virtual") {
        renderVirtualNavigation();
      } else {
        ensureApiMapView();
        syncRoomMarkers();
        updateRealHud();
      }
    }

    function tick() {
      if (getMode() === "virtual") {
        renderVirtualNavigation();
      } else if (getMode() === "api" && !state.map) {
        ensureApiMapView();
      } else if (getMode() === "api") {
        syncRoomMarkers();
        updateRealHud();
      }
    }

    function bind() {
      if (dom.virtualTarget) {
        dom.virtualTarget.addEventListener("change", () => {
          if (getMode() === "virtual") renderVirtualNavigation();
        });
      }

    }

    bind();
    startGeolocation();
    refresh();

    return {
      refresh,
      tick
    };
  }

  root.appGpsNavigation = { create };
})();
