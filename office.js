/**
 * Pixel Office renderer — visual style & assets adapted from
 * https://github.com/pixel-agents-hq/pixel-agents (MIT)
 * Character sprites based on JIK-A-4 Metro City pack.
 */
(() => {
  const TILE = 16;
  const CHAR_W = 16;
  const CHAR_H = 32;
  const CHAR_FRAMES = 7;
  const DIRS = { DOWN: 0, UP: 1, RIGHT: 2, LEFT: 3 }; // sheet rows: down, up, right
  const VOID = 255;
  const WALL = 0;

  const AGENTS_META = [
    { id: "ada", name: "Ada", role: "Director", color: "#5b8cff" },
    { id: "grace", name: "Grace", role: "Frontend", color: "#3dd68c" },
    { id: "linus", name: "Linus", role: "Backend", color: "#f0b429" },
    { id: "turing", name: "Turing", role: "Research", color: "#c084fc" },
    { id: "hopper", name: "Hopper", role: "QA", color: "#ef6b6b" },
    { id: "noether", name: "Noether", role: "Design", color: "#38bdf8" },
  ];

  const TASKS = [
    "пишет API-контракт",
    "полирует спрайты",
    "чинит e2e тест",
    "деплоит staging",
    "ревьюит PR",
    "обновляет docs",
  ];

  const LINES = [
    ["Ada", "Grace", "Сетка готова — берёшь inbox?"],
    ["Grace", "Ada", "Беру. Макет через пару тиков."],
    ["Linus", "Hopper", "Staging зелёный."],
    ["Hopper", "Linus", "Ловлю флаки на race."],
    ["Turing", "Ada", "Memory recall стабилен."],
    ["Ada", "Team", "Standup через 5 — blockers в канал."],
    ["Noether", "Grace", "Нужна иконка spectator."],
    ["Grace", "Noether", "Кину в PR вместе с layout."],
  ];

  // ── Colorize (Photoshop-style, from pixel-agents) ─────────────
  function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hp = ((h % 360) + 360) % 360 / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let r = 0, g = 0, b = 0;
    if (hp < 1) [r, g, b] = [c, x, 0];
    else if (hp < 2) [r, g, b] = [x, c, 0];
    else if (hp < 3) [r, g, b] = [0, c, x];
    else if (hp < 4) [r, g, b] = [0, x, c];
    else if (hp < 5) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    const m = l - c / 2;
    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255),
    ];
  }

  function colorizeImage(img, color) {
    if (!color) return img;
    const { h, s, b, c } = color;
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 2) continue;
      let lightness = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
      if (c) lightness = 0.5 + (lightness - 0.5) * ((100 + c) / 100);
      if (b) lightness += b / 200;
      lightness = Math.max(0, Math.min(1, lightness));
      const [nr, ng, nb] = hslToRgb(h, s / 100, lightness);
      d[i] = nr; d[i + 1] = ng; d[i + 2] = nb;
    }
    ctx.putImageData(data, 0, 0);
    return canvas;
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load " + src));
      img.src = src;
    });
  }

  // ── Office engine ─────────────────────────────────────────────
  class PixelOffice {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", { alpha: false });
      this.buffer = document.createElement("canvas");
      this.bctx = this.buffer.getContext("2d", { alpha: false });
      this.paused = false;
      this.selectedId = null;
      this.zoom = 3;
      this.listeners = { chat: [], select: [], tick: [] };
      this.lineIdx = 0;
      this.chatAcc = 0;
      this.pcFrame = 0;
      this.pcTimer = 0;
    }

    on(evt, fn) {
      (this.listeners[evt] || (this.listeners[evt] = [])).push(fn);
    }

    emit(evt, payload) {
      (this.listeners[evt] || []).forEach((fn) => fn(payload));
    }

    async init() {
      const [layout, catalog] = await Promise.all([
        fetch("assets/default-layout-1.json").then((r) => r.json()),
        fetch("assets/furniture-catalog.json").then((r) => r.json()),
      ]);
      this.layout = layout;
      this.catalog = catalog;
      this.cols = layout.cols;
      this.rows = layout.rows;
      this.tiles = layout.tiles;
      this.tileColors = layout.tileColors;

      // floors: FLOOR_n (1..9) → floor_(n-1).png
      this.floors = [];
      for (let i = 0; i < 9; i++) {
        this.floors[i] = await loadImage(`assets/floors/floor_${i}.png`);
      }

      // walls atlas 4×4 of 16×32
      this.wallAtlas = await loadImage("assets/walls/wall_0.png");

      // characters
      this.chars = [];
      for (let i = 0; i < 6; i++) {
        this.chars[i] = await loadImage(`assets/characters/char_${i}.png`);
      }

      // furniture images
      this.furnImgs = {};
      const needed = new Set();
      for (const item of layout.furniture) {
        needed.add(item.type.split(":")[0]);
      }
      // PC on frames for animation
      ["PC_FRONT_ON_1", "PC_FRONT_ON_2", "PC_FRONT_ON_3"].forEach((t) => needed.add(t));
      await Promise.all([...needed].map(async (type) => {
        const entry = catalog[type];
        if (!entry) return;
        this.furnImgs[type] = await loadImage(`assets/furniture/${entry.folder}/${entry.file}`);
      }));

      this.floorCache = new Map(); // key → colorized canvas
      this.wallCache = new Map();

      this.buildTileMap();
      this.buildFurnitureList();
      this.spawnAgents();
      this.resize();
      window.addEventListener("resize", () => this.resize());
      this.canvas.addEventListener("click", (e) => this.onClick(e));

      this.emit("chat", { who: "Ada", body: "Офис онлайн — layout из pixel-agents.", kind: "system" });
      this.last = performance.now();
      requestAnimationFrame((t) => this.loop(t));
    }

    buildTileMap() {
      this.map = [];
      for (let r = 0; r < this.rows; r++) {
        this.map[r] = [];
        for (let c = 0; c < this.cols; c++) {
          this.map[r][c] = this.tiles[r * this.cols + c];
        }
      }
    }

    getTileColor(c, r) {
      return this.tileColors[r * this.cols + c] || null;
    }

    getFloorSprite(tileType, color) {
      if (tileType < 1 || tileType > 9) return null;
      const key = `${tileType}:${color ? `${color.h},${color.s},${color.b},${color.c}` : "raw"}`;
      if (this.floorCache.has(key)) return this.floorCache.get(key);
      const base = this.floors[tileType - 1];
      const spr = colorizeImage(base, color ? { ...color } : null);
      this.floorCache.set(key, spr);
      return spr;
    }

    wallMask(c, r) {
      let mask = 0;
      if (r > 0 && this.map[r - 1][c] === WALL) mask |= 1;
      if (c < this.cols - 1 && this.map[r][c + 1] === WALL) mask |= 2;
      if (r < this.rows - 1 && this.map[r + 1][c] === WALL) mask |= 4;
      if (c > 0 && this.map[r][c - 1] === WALL) mask |= 8;
      return mask;
    }

    getWallSprite(mask, color) {
      const key = `${mask}:${color ? `${color.h},${color.s},${color.b},${color.c}` : "raw"}`;
      if (this.wallCache.has(key)) return this.wallCache.get(key);
      const piece = document.createElement("canvas");
      piece.width = 16;
      piece.height = 32;
      const pctx = piece.getContext("2d");
      const sx = (mask % 4) * 16;
      const sy = Math.floor(mask / 4) * 32;
      pctx.drawImage(this.wallAtlas, sx, sy, 16, 32, 0, 0, 16, 32);
      const spr = colorizeImage(piece, color ? { ...color, colorize: true } : { h: 214, s: 30, b: -100, c: -55 });
      this.wallCache.set(key, spr);
      return spr;
    }

    buildFurnitureList() {
      this.furniture = [];
      for (const item of this.layout.furniture) {
        const mirror = item.type.endsWith(":left");
        const type = item.type.split(":")[0];
        const entry = this.catalog[type];
        const img = this.furnImgs[type];
        if (!entry || !img) continue;
        const x = item.col * TILE;
        const y = item.row * TILE - (entry.h - entry.fh * TILE);
        const zY = (item.row + entry.fh) * TILE;
        this.furniture.push({
          uid: item.uid,
          type,
          col: item.col,
          row: item.row,
          img,
          entry,
          x,
          y,
          zY,
          mirror,
          isPC: type.startsWith("PC_"),
          isSeat: !!entry.seat || /CHAIR|BENCH|SOFA/.test(type),
        });
      }
    }

    spawnAgents() {
      // Prefer seat furniture; face toward nearby desks/tables
      const seats = this.furniture.filter((f) => f.isSeat);
      const deskLike = this.furniture.filter((f) => /DESK|TABLE|COFFEE_TABLE/.test(f.type));

      const pickFacing = (seat) => {
        let best = null;
        let bestDist = Infinity;
        for (const d of deskLike) {
          const dc = d.col + d.entry.fw / 2 - (seat.col + 0.5);
          const dr = d.row + d.entry.fh / 2 - (seat.row + 0.5);
          const dist = Math.hypot(dc, dr);
          if (dist < bestDist) {
            bestDist = dist;
            best = { dc, dr };
          }
        }
        if (!best) return DIRS.DOWN;
        if (Math.abs(best.dc) > Math.abs(best.dr)) {
          return best.dc > 0 ? DIRS.RIGHT : DIRS.LEFT;
        }
        return best.dr > 0 ? DIRS.DOWN : DIRS.UP;
      };

      this.agents = AGENTS_META.map((meta, i) => {
        const seat = seats[i % seats.length];
        const dir = pickFacing(seat);
        return {
          ...meta,
          palette: i % 6,
          col: seat.col,
          row: seat.row,
          x: seat.col * TILE + TILE / 2,
          y: seat.row * TILE + TILE / 2,
          homeCol: seat.col,
          homeRow: seat.row,
          dir,
          state: "type", // type | walk | read | idle
          frame: 0,
          frameT: 0,
          task: TASKS[i % TASKS.length],
          thought: "в работе…",
          bubble: null,
          bubbleT: 0,
          actionT: 2 + Math.random() * 3,
          path: null,
        };
      });
    }

    softOff(c) {
      c.imageSmoothingEnabled = false;
      c.webkitImageSmoothingEnabled = false;
      c.mozImageSmoothingEnabled = false;
      c.msImageSmoothingEnabled = false;
    }

    resize() {
      const wrap = this.canvas.parentElement;
      const dpr = window.devicePixelRatio || 1;
      const mapW = this.cols * TILE;
      const mapH = this.rows * TILE;
      // Integer zoom in CSS pixels first, then multiply by DPR for the buffer.
      // This keeps 1 game pixel = N×N solid device pixels (no fractional stretch).
      const cssZoom = Math.max(2, Math.floor(Math.min(
        wrap.clientWidth / mapW,
        wrap.clientHeight / mapH,
      )));
      this.cssZoom = cssZoom;
      this.dpr = dpr;
      this.zoom = Math.max(1, Math.round(cssZoom * dpr));
      this.buffer.width = mapW;
      this.buffer.height = mapH;
      const cssW = mapW * cssZoom;
      const cssH = mapH * cssZoom;
      this.canvas.width = Math.round(cssW * dpr);
      this.canvas.height = Math.round(cssH * dpr);
      this.canvas.style.width = cssW + "px";
      this.canvas.style.height = cssH + "px";
      this.softOff(this.ctx);
      this.softOff(this.bctx);
      this.layoutOverlays();
    }

    layoutOverlays() {
      if (!this.overlay) return;
      const rect = this.canvas.getBoundingClientRect();
      const wrap = this.canvas.parentElement.getBoundingClientRect();
      this.overlay.style.width = rect.width + "px";
      this.overlay.style.height = rect.height + "px";
      this.overlay.style.left = (rect.left - wrap.left) + "px";
      this.overlay.style.top = (rect.top - wrap.top) + "px";
    }

    setOverlayEl(el) {
      this.overlay = el;
      this.layoutOverlays();
    }

    updateOverlays() {
      if (!this.overlay) return;
      const z = this.cssZoom || 2;
      // world → overlay CSS px
      const toX = (wx) => wx * z;
      const toY = (wy) => wy * z;

      const existing = new Set();
      for (const a of this.agents) {
        existing.add(a.id);
        let nameEl = this.overlay.querySelector(`[data-name="${a.id}"]`);
        if (!nameEl) {
          nameEl = document.createElement("div");
          nameEl.className = "pix-name";
          nameEl.dataset.name = a.id;
          this.overlay.appendChild(nameEl);
        }
        nameEl.textContent = a.name;
        nameEl.style.color = a.color;
        nameEl.style.transform = `translate(-50%, 0) translate(${toX(a.x)}px, ${toY(a.y + 6)}px)`;

        let bub = this.overlay.querySelector(`[data-bubble="${a.id}"]`);
        if (a.bubble && a.bubbleT > 0) {
          if (!bub) {
            bub = document.createElement("div");
            bub.className = "pix-bubble";
            bub.dataset.bubble = a.id;
            this.overlay.appendChild(bub);
          }
          bub.textContent = a.bubble;
          bub.style.display = "block";
          bub.style.transform = `translate(-50%, -100%) translate(${toX(a.x)}px, ${toY(a.y - 28)}px)`;
        } else if (bub) {
          bub.style.display = "none";
        }
      }
      // cleanup removed
      this.overlay.querySelectorAll("[data-name],[data-bubble]").forEach((el) => {
        const id = el.dataset.name || el.dataset.bubble;
        if (!existing.has(id)) el.remove();
      });
    }

    setPaused(v) {
      this.paused = v;
    }

    selectAgent(id) {
      this.selectedId = id;
      const a = this.agents.find((x) => x.id === id) || null;
      this.emit("select", a);
    }

    getAgents() {
      return this.agents.map((a) => ({
        id: a.id,
        name: a.name,
        role: a.role,
        color: a.color,
        state: a.state,
        task: a.task,
        thought: a.thought,
      }));
    }

    assignBrief(text) {
      this.emit("chat", { who: "You", body: text, kind: "chat" });
      const workers = [...this.agents].sort(() => Math.random() - 0.5).slice(0, 3);
      workers.forEach((a, i) => {
        a.task = text;
        a.state = "type";
        a.thought = "разбираю бриф…";
        a.bubble = i === 0 ? "Беру!" : "Ок";
        a.bubbleT = 2.5;
        setTimeout(() => {
          this.emit("chat", {
            who: a.name,
            body: i === 0 ? `Принял: «${text}»` : `Помогаю с задачей`,
            kind: "output",
          });
        }, 400 + i * 450);
      });
    }

    workBurst() {
      this.agents.forEach((a) => {
        a.state = "type";
        a.task = TASKS[Math.floor(Math.random() * TASKS.length)];
        a.bubble = "⚡";
        a.bubbleT = 1.2;
        a.col = a.homeCol;
        a.row = a.homeRow;
        a.x = a.homeCol * TILE + TILE / 2;
        a.y = a.homeRow * TILE + TILE / 2;
      });
      this.emit("chat", { who: "Ada", body: "Work burst — все в фокусе.", kind: "output" });
    }

    standup() {
      // Gather near coffee table / lounge center
      const cx = 14, cy = 15;
      this.agents.forEach((a, i) => {
        const angle = (i / this.agents.length) * Math.PI * 2;
        a.homeCol = Math.round(cx + Math.cos(angle) * 2);
        a.homeRow = Math.round(cy + Math.sin(angle) * 1.5);
        a.state = "walk";
        a.bubble = "standup";
        a.bubbleT = 3;
        a.path = this.simplePath(a.col, a.row, a.homeCol, a.homeRow);
      });
      this.emit("chat", { who: "Ada", body: "Standup! Blockers в канал.", kind: "output" });
      clearTimeout(this._standupT);
      this._standupT = setTimeout(() => {
        this.agents.forEach((a, i) => {
          const seats = this.furniture.filter((f) => f.isSeat);
          const seat = seats[i % seats.length];
          a.homeCol = seat.col;
          a.homeRow = seat.row;
          a.path = this.simplePath(a.col, a.row, seat.col, seat.row);
          a.state = "walk";
        });
        this.emit("chat", { who: "Ada", body: "Разбежались. Пишите апдейты.", kind: "output" });
      }, 7000);
    }

    simplePath(c0, r0, c1, r1) {
      const path = [];
      let c = c0, r = r0;
      while (c !== c1 || r !== r1) {
        if (c < c1) c++;
        else if (c > c1) c--;
        else if (r < r1) r++;
        else if (r > r1) r--;
        // skip void/wall if possible
        if (this.map[r]?.[c] === VOID || this.map[r]?.[c] === WALL) {
          // try alternate
          if (r !== r1) r += r < r1 ? 1 : -1;
          else break;
        }
        path.push({ c, r });
        if (path.length > 40) break;
      }
      return path;
    }

    onClick(e) {
      const rect = this.canvas.getBoundingClientRect();
      const sx = (e.clientX - rect.left) / rect.width * this.buffer.width;
      const sy = (e.clientY - rect.top) / rect.height * this.buffer.height;
      const hit = [...this.agents].reverse().find((a) => {
        const ax = a.x, ay = a.y;
        return sx > ax - 8 && sx < ax + 8 && sy > ay - 28 && sy < ay + 4;
      });
      this.selectAgent(hit ? hit.id : null);
    }

    update(dt) {
      this.pcTimer += dt;
      if (this.pcTimer > 0.25) {
        this.pcTimer = 0;
        this.pcFrame = (this.pcFrame + 1) % 3;
      }

      this.chatAcc += dt;
      if (this.chatAcc > 3.2) {
        this.chatAcc = 0;
        const [from, to, text] = LINES[this.lineIdx % LINES.length];
        this.lineIdx++;
        this.emit("chat", {
          who: from,
          body: to === "Team" ? text : `@${to} ${text}`,
          kind: "chat",
        });
        const speaker = this.agents.find((a) => a.name === from);
        if (speaker) {
          speaker.bubble = text.slice(0, 26) + (text.length > 26 ? "…" : "");
          speaker.bubbleT = 3;
        }
        if (Math.random() > 0.5) {
          const a = this.agents[Math.floor(Math.random() * this.agents.length)];
          a.task = TASKS[Math.floor(Math.random() * TASKS.length)];
          a.state = Math.random() > 0.4 ? "type" : "read";
          this.emit("chat", { who: a.name, body: a.task, kind: "output" });
        }
      }

      for (const a of this.agents) {
        if (a.bubbleT > 0) a.bubbleT -= dt;
        else a.bubble = null;

        a.frameT += dt;
        const frameDur = a.state === "walk" ? 0.15 : 0.3;
        if (a.frameT >= frameDur) {
          a.frameT = 0;
          a.frame = (a.frame + 1) % 4;
        }

        if (a.path && a.path.length) {
          a.state = "walk";
          const next = a.path[0];
          const tx = next.c * TILE + TILE / 2;
          const ty = next.r * TILE + TILE / 2;
          const dx = tx - a.x;
          const dy = ty - a.y;
          const dist = Math.hypot(dx, dy);
          const speed = 40;
          if (dist < 1.5) {
            a.x = tx; a.y = ty;
            a.col = next.c; a.row = next.r;
            a.path.shift();
            if (!a.path.length) {
              a.state = "type";
              a.homeCol = a.col;
              a.homeRow = a.row;
            }
          } else {
            a.x += (dx / dist) * speed * dt;
            a.y += (dy / dist) * speed * dt;
            if (Math.abs(dx) > Math.abs(dy)) a.dir = dx > 0 ? DIRS.RIGHT : DIRS.LEFT;
            else a.dir = dy > 0 ? DIRS.DOWN : DIRS.UP;
          }
        } else {
          a.actionT -= dt;
          if (a.actionT <= 0) {
            if (Math.random() < 0.25) {
              // short wander then return
              const nc = Math.max(1, Math.min(this.cols - 2, a.homeCol + (Math.random() > 0.5 ? 1 : -1)));
              const nr = Math.max(1, Math.min(this.rows - 2, a.homeRow + (Math.random() > 0.5 ? 1 : -1)));
              if (this.map[nr]?.[nc] !== VOID && this.map[nr]?.[nc] !== WALL) {
                a.path = this.simplePath(a.col, a.row, nc, nr);
                setTimeout(() => {
                  if (!a.path || !a.path.length) {
                    a.path = this.simplePath(a.col, a.row, a.homeCol, a.homeRow);
                  }
                }, 1800);
              }
            } else {
              a.state = Math.random() > 0.35 ? "type" : "read";
            }
            a.actionT = 2.5 + Math.random() * 4;
          }
        }
      }

      this.emit("tick", {
        busy: this.agents.filter((a) => a.state === "type" || a.state === "read").length,
        agents: this.getAgents(),
      });
    }

    drawCharFrame(img, dir, frameIndex, dx, dy, flip) {
      // sheet rows: 0 down, 1 up, 2 right
      const sheetRow = dir === DIRS.LEFT ? 2 : dir;
      const sx = frameIndex * CHAR_W;
      const sy = sheetRow * CHAR_H;
      const ctx = this.bctx;
      this.softOff(ctx);
      const x = Math.round(dx);
      const y = Math.round(dy);
      if (flip) {
        ctx.save();
        ctx.translate(x + CHAR_W, y);
        ctx.scale(-1, 1);
        ctx.drawImage(img, sx, sy, CHAR_W, CHAR_H, 0, 0, CHAR_W, CHAR_H);
        ctx.restore();
      } else {
        ctx.drawImage(img, sx, sy, CHAR_W, CHAR_H, x, y, CHAR_W, CHAR_H);
      }
    }

    charFrameIndex(a) {
      // frames: 0-2 walk cycle uses 0,1,2,1 → we map frame% 
      if (a.state === "walk") {
        const cycle = [0, 1, 2, 1];
        return cycle[a.frame % 4];
      }
      if (a.state === "type") return 3 + (a.frame % 2); // 3,4
      if (a.state === "read") return 5 + (a.frame % 2); // 5,6
      return 1; // idle-ish
    }

    draw() {
      const ctx = this.bctx;
      this.softOff(ctx);
      ctx.fillStyle = "#0a0e14";
      ctx.fillRect(0, 0, this.buffer.width, this.buffer.height);

      // floors + walls
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const t = this.map[r][c];
          if (t === VOID) continue;
          const color = this.getTileColor(c, r);
          if (t === WALL) {
            const spr = this.getWallSprite(this.wallMask(c, r), color);
            this.softOff(ctx);
            ctx.drawImage(spr, c * TILE, r * TILE - 16);
          } else {
            const spr = this.getFloorSprite(t, color);
            if (spr) {
              this.softOff(ctx);
              ctx.drawImage(spr, c * TILE, r * TILE);
            }
          }
        }
      }

      // depth-sorted entities
      const drawables = [];

      for (const f of this.furniture) {
        drawables.push({
          zY: f.zY,
          draw: () => {
            let img = f.img;
            // animate PCs that face front
            if (f.type === "PC_FRONT_OFF" || f.type.startsWith("PC_FRONT_ON")) {
              const on = `PC_FRONT_ON_${this.pcFrame + 1}`;
              img = this.furnImgs[on] || f.img;
            }
            this.softOff(ctx);
            const fx = Math.round(f.x);
            const fy = Math.round(f.y);
            if (f.mirror) {
              ctx.save();
              ctx.translate(fx + f.entry.w, fy);
              ctx.scale(-1, 1);
              ctx.drawImage(img, 0, 0);
              ctx.restore();
            } else {
              ctx.drawImage(img, fx, fy);
            }
          },
        });
      }

      for (const a of this.agents) {
        drawables.push({
          zY: a.y + 8,
          draw: () => {
            const img = this.chars[a.palette];
            const flip = a.dir === DIRS.LEFT;
            const fi = this.charFrameIndex(a);
            // Snap agent to whole pixels while drawing so sprites stay crisp
            const ax = Math.round(a.x);
            const ay = Math.round(a.y);
            const dx = ax - CHAR_W / 2;
            const dy = ay - CHAR_H + 4;
            this.drawCharFrame(img, a.dir, fi, dx, dy, flip);

            if (this.selectedId === a.id) {
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(Math.round(dx) - 1, Math.round(dy) - 1, CHAR_W + 2, 1);
              ctx.fillRect(Math.round(dx) - 1, Math.round(dy) + CHAR_H, CHAR_W + 2, 1);
              ctx.fillRect(Math.round(dx) - 1, Math.round(dy) - 1, 1, CHAR_H + 2);
              ctx.fillRect(Math.round(dx) + CHAR_W, Math.round(dy) - 1, 1, CHAR_H + 2);
            }
          },
        });
      }

      drawables.sort((a, b) => a.zY - b.zY);
      for (const d of drawables) d.draw();

      // Nearest-neighbor upscale into the visible canvas
      this.softOff(this.ctx);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(
        this.buffer,
        0, 0, this.buffer.width, this.buffer.height,
        0, 0, this.canvas.width, this.canvas.height,
      );

      this.updateOverlays();
    }

    loop(now) {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (!this.paused) this.update(dt);
      this.draw();
      requestAnimationFrame((t) => this.loop(t));
    }
  }

  window.PixelOffice = PixelOffice;
})();
