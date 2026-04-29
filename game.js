// ============================================================
// TORPEDO TIMMY 2 — WAL-RETTUNGSKOMMANDO
// Pixel-Retro side-scrolling shooter
// ============================================================

(() => {
'use strict';

// --- Canvas setup -------------------------------------------------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const VIEW_W = 1280;
const VIEW_H = 600;
canvas.width = VIEW_W;
canvas.height = VIEW_H;

// --- Asset loading ------------------------------------------------
const IMG = {};
const ASSET_FILES = {
  bg:          'assets/Hintergrund.png',
  wal:         'assets/Wal.png',
  merkel:      'assets/Schlachtkreuzer_MS_Merkel.png',
  traumschiff: 'assets/zdfTraumschiff.png',
  ahab:        'assets/KaptainAhab.png',
  japaner:     'assets/Japaner.png',
  terror:      'assets/TerroristenBoat.png',
  titanic:     'assets/titanic.png',
};

function loadAssets() {
  return Promise.all(Object.entries(ASSET_FILES).map(([k, src]) => new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => { IMG[k] = im; res(); };
    im.onerror = () => rej(new Error('Asset fehlt: ' + src));
    im.src = src;
  })));
}

// --- Constants ----------------------------------------------------
// Background native = 5483 x 1536. We scale uniformly so height fits VIEW_H.
const BG_NATIVE_W = 5483;
const BG_NATIVE_H = 1536;
const SCALE = VIEW_H / BG_NATIVE_H;     // ~0.39
const BG_W = BG_NATIVE_W * SCALE;       // ~2142
const BG_H = VIEW_H;
// Enemies get an additional shrink so the player has more room to maneuver.
const ENEMY_SCALE = 0.5;

// Rock hitboxes in BG-native pixels (approximate, identified visually)
// Format: [x1, y1, x2, y2]
const ROCKS_NATIVE = [
  [320,  100,  720,  440],   // upper-left big
  [2080, 120,  2500, 360],   // upper-mid
  [3740, 100,  4400, 460],   // upper-right big
  [5120, 100,  5483, 340],   // upper-far-right
  [1140, 680,  1600, 940],   // mid-bottom-left
  [2400, 900,  2800, 1160],  // mid-bottom-mid
  [0,    920,  360,  1240],  // bottom-left tiny
  [4980, 860,  5240, 1100],  // bottom-far-right tiny
];
// Convert to scaled coords (relative to a single tile origin at x=0)
const ROCKS = ROCKS_NATIVE.map(([x1,y1,x2,y2]) => ({
  x: x1 * SCALE, y: y1 * SCALE,
  w: (x2-x1) * SCALE, h: (y2-y1) * SCALE
}));

// --- Audio (tiny synth beeps) -------------------------------------
const AC = window.AudioContext || window.webkitAudioContext;
let actx = null;
function audio() { if (!actx) actx = new AC(); return actx; }
function beep(freq=440, dur=0.08, type='square', vol=0.06) {
  try {
    const a = audio();
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(a.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.stop(a.currentTime + dur);
  } catch(e) {}
}
const SFX = {
  shoot:   () => beep(880, 0.05, 'square', 0.04),
  hit:     () => beep(220, 0.06, 'square', 0.06),
  boom:    () => { beep(120, 0.15, 'sawtooth', 0.10); setTimeout(()=>beep(60,0.20,'sawtooth',0.10),60); },
  heart:   () => { beep(660, 0.08); setTimeout(()=>beep(990, 0.10),60); },
  death:   () => { beep(220,0.1,'sawtooth',0.1); setTimeout(()=>beep(110,0.15,'sawtooth',0.1),100); setTimeout(()=>beep(55,0.30,'sawtooth',0.12),250); },
  damage:  () => beep(180, 0.12, 'square', 0.08),
};

// --- Enemy type definitions ---------------------------------------
// nativeW / nativeH are the source PNG dimensions
const ENEMY_TYPES = {
  terror: {
    img: 'terror', nativeW: 375, nativeH: 203,
    hp: 2, baseSpeed: 4.5, weight: 30,
    name: 'TERROR-SCHLAUCHBOOT',
    hitInsetX: 0.10, hitInsetY: 0.30,
  },
  japaner: {
    img: 'japaner', nativeW: 511, nativeH: 296,
    hp: 3, baseSpeed: 3.5, weight: 22,
    name: 'JAPANISCHER WAL-FANG-TOURIST',
    hitInsetX: 0.05, hitInsetY: 0.15,
  },
  ahab: {
    img: 'ahab', nativeW: 639, nativeH: 470,
    hp: 5, baseSpeed: 3.0, weight: 18,
    name: 'KAPTAIN AHAB',
    hitInsetX: 0.12, hitInsetY: 0.10,
  },
  traumschiff: {
    img: 'traumschiff', nativeW: 904, nativeH: 347,
    hp: 7, baseSpeed: 2.5, weight: 14,
    name: 'ZDF DAS TRAUMSCHIFF',
    hitInsetX: 0.04, hitInsetY: 0.20,
  },
  titanic: {
    img: 'titanic', nativeW: 513, nativeH: 406,
    hp: 8, baseSpeed: 1.8, weight: 8,
    name: 'DIE TITANIC (LOL)',
    hitInsetX: 0.08, hitInsetY: 0.20,
  },
  merkel: {
    img: 'merkel', nativeW: 1716, nativeH: 463,
    hp: 14, baseSpeed: 2.0, weight: 4,
    name: 'SCHLACHTKREUZER MS MERKEL',
    hitInsetX: 0.04, hitInsetY: 0.15,
  },
};

// --- Game-over messages -------------------------------------------
const GAMEOVER_MSGS = {
  terror: {
    title: '💥 ALLAHU TIMMY! 💥',
    head: 'IS-KÄMPFER HABEN TIMMY GEKAPERT',
    body: 'Timmy wurde zum WAL-fahrer des Heiligen Krieges radikalisiert und kämpft jetzt für das Wal-iphat. Er trägt jetzt eine Sprengstoffweste an der Schwanzflosse und ein TikTok-Konto namens @JihadiTimmy420. Die Tagesschau berichtet einfühlsam von "kulturell bereicherten Meeressäugern" und sucht weiter nach den "tieferen Ursachen". Claudia Roth kündigt 50 Millionen Integrationsbudget an. Habeck weint vor laufender Kamera.',
  },
  japaner: {
    title: '🍣 BANZAI! TIMMY-SAN WIRD SUSHI! 🍣',
    head: 'JAPANISCHE "FORSCHUNGS"-WALFÄNGER FEIERN',
    body: 'Timmy wird wissenschaftlich filetiert (rein zu Forschungszwecken natürlich) und als "Wal-Sashimi Premium Grade A" für 89.000 Yen das Kilo am Tsukiji-Fischmarkt versteigert. Sein Speck wird zu Wal-Burgern bei Mos Burger, sein Tran zu Pokémon-Sammelfiguren-Plastik. Greenpeace twittert empört aus dem Homeoffice in Berlin-Mitte. Die ARD diskutiert in fünf Talkshows, ob Empörung jetzt Rassismus sei.',
  },
  ahab: {
    title: '⚓ MOBY DICK 2: AHAB STRIKES BACK ⚓',
    head: 'DER WAHNSINNIGE WALFÄNGER HAT ZUGESTOCHEN',
    body: 'Timmys Speck wird zu Lampenöl für Berliner Hipster-Cafés ("artisan handcrafted whale lamp oil, vegan-friendly"). Sein Skelett kommt ins Naturkundemuseum (Eintritt 12 EUR, freitags Frauen halber Preis), seine Knochen werden zu Wal-Korsetts für Drag-Queen-Brunch in Schöneberg. Ahabs Holzbein bekommt ein Premium-Upgrade aus echtem Timmy-Material. Herman Melville rotiert im Grab.',
  },
  traumschiff: {
    title: '📺 GUTEN ABEND, MEINE DAMEN UND HERREN 📺',
    head: 'DAS ZDF TRAUMSCHIFF HAT TIMMY AUFGEGABELT',
    body: 'Timmy ist jetzt Hauptdarsteller in 47 Folgen "Das Traumwal — Liebe in der Tiefsee". Florian Silbereisen verliebt sich in ihn, es kommt zur tränenreichen Hochzeit auf den Malediven, ausgestrahlt am 24.12. um 20:15 nach der heute-show. Timmy zahlt jetzt 18,36 EUR Rundfunkbeitrag pro Monat — rückwirkend ab 1985. Christian Sievers liest die Trauerrede vor. Sarah Connor singt das Abschiedslied.',
  },
  titanic: {
    title: '🚢 ICEBERG, RIGHT AHEAD! 🚢',
    head: 'TIMMY KOLLIDIERT MIT DER TITANIC',
    body: 'Genialer Move — mit dem EINEN Schiff zu kollidieren, das weltberühmt dafür ist zu sinken. Du gleitest jetzt Hand-in-Flosse mit Leonardo DiCaprio in die Tiefe. Im Hintergrund grölt Celine Dion. James Cameron dreht spontan eine Doku darüber, gewinnt 11 Oscars. My heart will go on — aber Timmys halt nicht. Kate Winslet behält die Tür für sich allein, weil typisch.',
  },
  merkel: {
    title: '🚨 PUTSCH AM PUTSCH! 🚨',
    head: 'DAS SCHLACHTSCHIFF MS MERKEL HAT GERAMMT',
    body: 'Timmy wird umgehend in die Schweiz ausgeflogen, dort als Zwangs-Klimabeauftragter installiert und muss bei Markus Lanz erklären, warum AUSGERECHNET ER das Klima zerstört. Sein Speck wird zu Bio-Veggie-Schnitzeln für Annalena, sein Tran befüllt Habecks erste Wärmepumpe. Timmy zahlt jetzt Solidaritätszuschlag PLUS CO2-Wal-Steuer. Die GEZ steht schon vor der Tür. Olaf Scholz kann sich an nichts erinnern.',
  },
  rock: {
    title: '🗿 GANZ. TOLL. GEMACHT. 🗿',
    head: 'TIMMY IST GEGEN EINEN FELSEN GEFAHREN',
    body: 'Einen FELSEN! Einen unbeweglichen Felsen, der sich seit 12.000 Jahren NICHT VON DER STELLE bewegt hat! Selbst die Steine in der Ostsee sind intelligenter als du. Timmy wird jetzt zum Mahnmal für deutsches Bildungs-Versagen ausgerufen. Die Reichsbürger weigern sich, ihn als rechtmäßigen Wal-König anzuerkennen. Selbst Habeck schämt sich fremd. Robert Geiss bietet einen Helikopter-Rückflug an, gegen Bezahlung versteht sich.',
  },
};

// --- Game state ---------------------------------------------------
let game = null;
function newGame() {
  return {
    state: 'menu',  // 'menu', 'playing', 'gameOver'
    player: {
      x: 80, y: VIEW_H/2 - 40,
      w: 264, h: 82,            // Wal scaled (676*S, 210*S)
      vx: 0, vy: 0,
      lives: 3,
      hitFlash: 0,              // frames of invulnerability after hit
      shootCooldown: 0,
    },
    bullets: [],
    enemies: [],
    particles: [],
    hearts: [],
    scrollOffset: 0,
    baseScrollSpeed: 2.5,
    spawnTimer: 90,
    heartTimer: 600,
    score: 0,
    distance: 0,
    kills: 0,
    frame: 0,
    gameOverReason: null,   // key into GAMEOVER_MSGS
    gameOverEnemyName: null,
    shake: 0,
  };
}

// --- Input --------------------------------------------------------
const keys = {};
window.addEventListener('keydown', e => {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
  keys[e.key.toLowerCase()] = true;
  if (e.key === ' ') keys[' '] = true;
});
window.addEventListener('keyup', e => {
  keys[e.key.toLowerCase()] = false;
  if (e.key === ' ') keys[' '] = false;
});

// --- Helpers ------------------------------------------------------
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

function pickEnemyType() {
  const total = Object.values(ENEMY_TYPES).reduce((s,t) => s + t.weight, 0);
  let r = Math.random() * total;
  for (const [k, t] of Object.entries(ENEMY_TYPES)) {
    if (r < t.weight) return k;
    r -= t.weight;
  }
  return 'terror';
}

function spawnEnemy() {
  const typeKey = pickEnemyType();
  const t = ENEMY_TYPES[typeKey];
  const w = t.nativeW * SCALE * ENEMY_SCALE;
  const h = t.nativeH * SCALE * ENEMY_SCALE;
  // Y position: somewhere in playable area
  const y = 30 + Math.random() * (VIEW_H - h - 60);
  game.enemies.push({
    type: typeKey,
    x: VIEW_W + 20,
    y: y,
    w: w, h: h,
    hp: t.hp,
    maxHp: t.hp,
    speed: t.baseSpeed + Math.random() * 0.8,
    bobPhase: Math.random() * Math.PI * 2,
    bobAmp: 4 + Math.random() * 4,
    baseY: y,
  });
}

function spawnHeart() {
  game.hearts.push({
    x: VIEW_W + 20,
    y: 60 + Math.random() * (VIEW_H - 120),
    w: 36, h: 36,
    speed: 2.5 + Math.random() * 1.5,
    bobPhase: 0,
  });
}

function explode(x, y, color, count=18) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 1 + Math.random() * 5;
    game.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 1,
      life: 30 + Math.random() * 30,
      maxLife: 60,
      color,
      size: 3 + Math.random() * 4,
      gravity: 0.12,
    });
  }
}

function smoke(x, y) {
  game.particles.push({
    x, y,
    vx: -0.5 - Math.random() * 1,
    vy: -0.3 - Math.random() * 0.5,
    life: 50,
    maxLife: 50,
    color: '#888',
    size: 4 + Math.random() * 4,
    gravity: -0.02,
  });
}

// --- Update -------------------------------------------------------
function update() {
  if (game.state !== 'playing') return;
  const p = game.player;
  game.frame++;

  // Difficulty scaling: scroll speed grows over time
  const t = game.frame / 60; // seconds
  const scrollSpeed = game.baseScrollSpeed + Math.min(3.5, t * 0.04);

  // ---- Player input ----
  const accel = 0.6;
  const friction = 0.85;
  const maxSpeed = 6;

  if (keys['arrowup'] || keys['w']) p.vy -= accel;
  if (keys['arrowdown'] || keys['s']) p.vy += accel;
  if (keys['arrowleft'] || keys['a']) p.vx -= accel;
  if (keys['arrowright'] || keys['d']) p.vx += accel;
  p.vx *= friction; p.vy *= friction;
  p.vx = Math.max(-maxSpeed, Math.min(maxSpeed, p.vx));
  p.vy = Math.max(-maxSpeed, Math.min(maxSpeed, p.vy));
  p.x += p.vx; p.y += p.vy;
  p.x = Math.max(0, Math.min(VIEW_W * 0.45, p.x));
  p.y = Math.max(0, Math.min(VIEW_H - p.h, p.y));

  // Shoot
  if (p.shootCooldown > 0) p.shootCooldown--;
  if (keys[' '] && p.shootCooldown === 0) {
    // Bullets come from the front of the whale (right side of sprite)
    const bx = p.x + p.w - 20;
    const by = p.y + p.h * 0.42;
    game.bullets.push({ x: bx, y: by, vx: 14, w: 22, h: 6, life: 120 });
    SFX.shoot();
    p.shootCooldown = 9;
  }

  if (p.hitFlash > 0) p.hitFlash--;

  // ---- Scroll world ----
  game.scrollOffset += scrollSpeed;
  game.distance += scrollSpeed;
  game.score += 0.05; // gradual

  // ---- Bullets ----
  for (let i = game.bullets.length - 1; i >= 0; i--) {
    const b = game.bullets[i];
    b.x += b.vx;
    b.life--;
    if (b.x > VIEW_W + 20 || b.life <= 0) game.bullets.splice(i, 1);
  }

  // ---- Spawn enemies ----
  game.spawnTimer--;
  if (game.spawnTimer <= 0) {
    spawnEnemy();
    // Spawn rate gets faster
    const minGap = Math.max(35, 95 - t * 0.6);
    game.spawnTimer = minGap + Math.random() * 40;
  }

  // ---- Spawn hearts ----
  game.heartTimer--;
  if (game.heartTimer <= 0) {
    spawnHeart();
    game.heartTimer = 700 + Math.random() * 500;
  }

  // ---- Enemies ----
  for (let i = game.enemies.length - 1; i >= 0; i--) {
    const e = game.enemies[i];
    e.bobPhase += 0.05;
    e.x -= e.speed + scrollSpeed * 0.5;
    e.y = e.baseY + Math.sin(e.bobPhase) * e.bobAmp;
    if (e.x + e.w < -20) { game.enemies.splice(i, 1); continue; }

    // Bullet collision
    for (let j = game.bullets.length - 1; j >= 0; j--) {
      const b = game.bullets[j];
      const t = ENEMY_TYPES[e.type];
      const hb = enemyHitbox(e);
      if (rectsOverlap(b, hb)) {
        game.bullets.splice(j, 1);
        e.hp--;
        SFX.hit();
        explode(b.x, b.y, '#ffcc33', 5);
        if (e.hp <= 0) {
          // Dead
          explode(e.x + e.w/2, e.y + e.h/2, '#ff5522', 30);
          explode(e.x + e.w/2, e.y + e.h/2, '#ffaa22', 20);
          game.score += 100;
          game.kills++;
          SFX.boom();
          game.shake = 8;
          game.enemies.splice(i, 1);
          break;
        }
      }
    }
  }

  // ---- Hearts ----
  for (let i = game.hearts.length - 1; i >= 0; i--) {
    const h = game.hearts[i];
    h.bobPhase += 0.1;
    h.x -= h.speed + scrollSpeed * 0.3;
    if (h.x + h.w < -20) { game.hearts.splice(i, 1); continue; }
    const hb = { x: h.x + 4, y: h.y + Math.sin(h.bobPhase)*5, w: h.w-8, h: h.h-8 };
    if (rectsOverlap(playerHitbox(), hb)) {
      if (p.lives < 5) p.lives++;
      game.score += 50;
      SFX.heart();
      explode(h.x + h.w/2, h.y + h.h/2, '#ff6699', 14);
      game.hearts.splice(i, 1);
    }
  }

  // ---- Player vs enemy ----
  if (p.hitFlash === 0) {
    const ph = playerHitbox();
    for (const e of game.enemies) {
      if (rectsOverlap(ph, enemyHitbox(e))) {
        damagePlayer(e.type);
        break;
      }
    }
  }

  // ---- Player vs rocks ----
  if (p.hitFlash === 0) {
    const ph = playerHitbox();
    // Check rocks in two visible tile copies
    const tileX0 = -((game.scrollOffset) % BG_W);
    const tileX1 = tileX0 + BG_W;
    const offsets = [tileX0, tileX1];
    for (const ox of offsets) {
      for (const r of ROCKS) {
        const rb = { x: r.x + ox, y: r.y, w: r.w, h: r.h };
        if (rb.x + rb.w < 0 || rb.x > VIEW_W) continue;
        if (rectsOverlap(ph, rb)) {
          damagePlayer('rock');
          return;
        }
      }
    }
  }

  // ---- Particles ----
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const pt = game.particles[i];
    pt.x += pt.vx; pt.y += pt.vy;
    pt.vy += pt.gravity || 0;
    pt.life--;
    if (pt.life <= 0) game.particles.splice(i, 1);
  }

  if (game.shake > 0) game.shake--;
}

function playerHitbox() {
  const p = game.player;
  // Whale sprite has boat on left, whale body on right.
  // The actual whale body is roughly the right ~70% of the sprite.
  // We use a tighter box centered on the whale's mass.
  return {
    x: p.x + p.w * 0.20,
    y: p.y + p.h * 0.20,
    w: p.w * 0.70,
    h: p.h * 0.65,
  };
}

function enemyHitbox(e) {
  const t = ENEMY_TYPES[e.type];
  return {
    x: e.x + e.w * t.hitInsetX,
    y: e.y + e.h * t.hitInsetY,
    w: e.w * (1 - 2*t.hitInsetX),
    h: e.h * (1 - 2*t.hitInsetY),
  };
}

function damagePlayer(reason) {
  const p = game.player;
  p.lives--;
  p.hitFlash = 90;
  game.shake = 12;
  SFX.damage();
  // small puff
  explode(p.x + p.w/2, p.y + p.h/2, '#ff3333', 16);
  if (p.lives <= 0) {
    gameOver(reason);
  }
}

function gameOver(reason) {
  game.state = 'gameOver';
  game.gameOverReason = reason;
  SFX.death();
  const msg = GAMEOVER_MSGS[reason] || GAMEOVER_MSGS.rock;
  const el = document.getElementById('gameover');
  document.getElementById('go-title').textContent = msg.title;
  document.getElementById('go-head').textContent = msg.head;
  document.getElementById('go-body').textContent = msg.body;
  document.getElementById('go-stats').textContent =
    `📊 Distanz: ${Math.floor(game.distance/30)} m  ·  Punkte: ${Math.floor(game.score)}  ·  Kills: ${game.kills}`;
  el.classList.add('visible');
}

// --- Render -------------------------------------------------------
function render() {
  // Camera shake
  let sx = 0, sy = 0;
  if (game && game.shake > 0) {
    sx = (Math.random()-0.5) * game.shake;
    sy = (Math.random()-0.5) * game.shake;
  }
  ctx.save();
  ctx.translate(sx, sy);

  // Background — tiled
  if (game) {
    const offset = game.scrollOffset % BG_W;
    const tx0 = -offset;
    const tx1 = tx0 + BG_W;
    ctx.drawImage(IMG.bg, tx0, 0, BG_W, BG_H);
    ctx.drawImage(IMG.bg, tx1, 0, BG_W, BG_H);

    // Hearts (behind player)
    for (const h of game.hearts) {
      drawHeart(h.x + h.w/2, h.y + h.h/2 + Math.sin(h.bobPhase)*5, 18);
    }

    // Enemies (horizontally mirrored — they face the player on the left)
    for (const e of game.enemies) {
      const t = ENEMY_TYPES[e.type];
      ctx.save();
      ctx.translate(e.x + e.w, e.y);
      ctx.scale(-1, 1);
      ctx.drawImage(IMG[t.img], 0, 0, e.w, e.h);
      ctx.restore();
      // HP bar
      drawHpBar(e.x, e.y - 10, e.w, e.hp, e.maxHp);
    }

    // Bullets — green torpedoes
    for (const b of game.bullets) {
      ctx.fillStyle = '#aaff44';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x + b.w - 4, b.y + 1, 3, b.h - 2);
      ctx.fillStyle = '#225522';
      ctx.fillRect(b.x, b.y + 1, 3, b.h - 2);
      // motion line
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(b.x - 8, b.y + b.h/2 - 1, 8, 2);
    }

    // Player whale (with hit flash)
    const p = game.player;
    if (p.hitFlash === 0 || Math.floor(p.hitFlash / 4) % 2 === 0) {
      ctx.drawImage(IMG.wal, p.x, p.y, p.w, p.h);
    }

    // Particles
    for (const pt of game.particles) {
      const a = Math.max(0, pt.life / pt.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size/2, pt.y - pt.size/2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  // HUD
  if (game && game.state === 'playing') drawHud();
}

function drawHpBar(x, y, w, hp, maxHp) {
  ctx.fillStyle = '#000';
  ctx.fillRect(x, y, w, 6);
  const ratio = Math.max(0, hp / maxHp);
  ctx.fillStyle = ratio > 0.5 ? '#33dd33' : ratio > 0.25 ? '#ffcc22' : '#dd3322';
  ctx.fillRect(x + 1, y + 1, (w - 2) * ratio, 4);
}

function drawHeart(cx, cy, size) {
  // Pixel-art heart shape
  const px = size / 6;
  ctx.fillStyle = '#ff3355';
  // simple heart from rectangles
  const cells = [
    [-2,-2],[-1,-2],[1,-2],[2,-2],
    [-3,-1],[-2,-1],[-1,-1],[0,-1],[1,-1],[2,-1],[3,-1],
    [-3,0],[-2,0],[-1,0],[0,0],[1,0],[2,0],[3,0],
    [-2,1],[-1,1],[0,1],[1,1],[2,1],
    [-1,2],[0,2],[1,2],
    [0,3],
  ];
  for (const [dx,dy] of cells) {
    ctx.fillRect(cx + dx*px - px/2, cy + dy*px - px/2, px, px);
  }
  // highlight
  ctx.fillStyle = '#ff99aa';
  ctx.fillRect(cx - 2*px - px/2, cy - 2*px - px/2, px, px);
  ctx.fillRect(cx - px - px/2, cy - 2*px - px/2, px, px);
  // outline
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
}

function drawHud() {
  // Score box
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(10, 10, 280, 70);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, 280, 70);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px "Courier New", monospace';
  ctx.fillText(`📊 PUNKTE: ${String(Math.floor(game.score)).padStart(6,'0')}`, 20, 32);
  ctx.fillText(`🏊 DISTANZ: ${Math.floor(game.distance/30)} m`, 20, 54);
  ctx.fillText(`💀 KILLS: ${game.kills}`, 20, 74);

  // Lives - hearts top-right
  for (let i = 0; i < 5; i++) {
    if (i < game.player.lives) {
      drawHeart(VIEW_W - 30 - i*38, 32, 22);
    } else {
      // empty slot
      ctx.globalAlpha = 0.25;
      drawHeart(VIEW_W - 30 - i*38, 32, 22);
      ctx.globalAlpha = 1;
    }
  }

  // Controls hint (first few seconds)
  if (game.frame < 240) {
    const a = Math.max(0, 1 - (game.frame - 180) / 60);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(VIEW_W/2 - 220, VIEW_H - 70, 440, 50);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⬆️⬇️⬅️➡️ STEUERN  ·  LEERTASTE = TORPEDO', VIEW_W/2, VIEW_H - 47);
    ctx.fillText('SAMMLE HERZEN ❤  ·  WEICHE FELSEN AUS', VIEW_W/2, VIEW_H - 28);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
}

// --- Main loop ----------------------------------------------------
function loop() {
  update();
  render();
  requestAnimationFrame(loop);
}

// --- Buttons ------------------------------------------------------
function startGame() {
  game = newGame();
  game.state = 'playing';
  document.getElementById('menu').classList.remove('visible');
  document.getElementById('gameover').classList.remove('visible');
  // Resume audio context on user gesture
  if (actx && actx.state === 'suspended') actx.resume();
  if (!actx) audio();
  canvas.focus();
}
window.startGame = startGame;

// --- Boot ---------------------------------------------------------
loadAssets().then(() => {
  game = newGame(); // menu state
  document.getElementById('menu').classList.add('visible');
  document.getElementById('loading').style.display = 'none';
  loop();
}).catch(err => {
  document.getElementById('loading').textContent = 'FEHLER beim Laden: ' + err;
});

})();
