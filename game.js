(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const params = new URLSearchParams(location.search);
  const quickMode = params.has("quick");
  const highQuality = params.has("hq");
  const targetFrameMs = highQuality ? 1000 / 60 : 1000 / 24;

  function fx(value) {
    return highQuality ? value : Math.min(7, value * 0.34);
  }

  const hud = {
    survival: document.getElementById("survival"),
    depth: document.getElementById("depth"),
    healthText: document.getElementById("healthText"),
    shieldText: document.getElementById("shieldText"),
    hitReadout: document.getElementById("hitReadout"),
    debuffReadout: document.getElementById("debuffReadout"),
    zoneName: document.getElementById("zoneName"),
    meterFill: document.getElementById("meterFill"),
    feel: document.getElementById("feel"),
    mistakes: document.getElementById("mistakes"),
    eventChip: document.getElementById("eventChip"),
    resultPanel: document.getElementById("resultPanel"),
    failReason: document.getElementById("failReason"),
    finalTime: document.getElementById("finalTime"),
    finalDepth: document.getElementById("finalDepth"),
    finalShield: document.getElementById("finalShield"),
    restartHint: document.getElementById("restartHint"),
    pilotCard: document.querySelector(".pilot-card"),
    gesturePad: document.getElementById("gesturePad"),
    gestureThumb: document.getElementById("gestureThumb"),
    gestureLine: document.getElementById("gestureLine"),
    commandLine: document.getElementById("commandLine"),
    comboLabel: document.getElementById("comboLabel"),
    keys: [...document.querySelectorAll("[data-key]")],
  };

  const TAU = Math.PI * 2;
  let W = 0;
  let H = 0;
  let DPR = 1;
  let lastFrame = performance.now();
  let lastDraw = 0;
  let stars = [];

  const keys = {
    left: false,
    right: false,
    up: false,
    down: false,
    boost: false,
    brake: false,
  };

  const keyboard = { ...keys };
  const touch = {
    active: false,
    x0: 0,
    y0: 0,
    x: 0,
    y: 0,
    last: -999,
  };

  const game = {
    round: 0,
    state: "running",
    seed: 1,
    time: 0,
    cameraY: 0,
    nextSpawnY: 0,
    zone: "drift",
    zoneUntil: 0,
    pressure: 0,
    failAt: 300,
    finaleAt: 280,
    finaleStarted: false,
    crash: null,
    restartAt: 0,
    mistakes: 0,
    health: 100,
    maxHealth: 100,
    shield: 35,
    maxShield: 100,
    essenceGuardTimer: 0,
    slowTimer: 0,
    bleedTimer: 0,
    bleedTick: 1,
    stunTimer: 0,
    pullTimer: 0,
    fractureTimer: 0,
    damageCooldown: 0,
    lastHitText: "状态稳定",
    lastHitTimer: 0,
    lastRewardText: "无增益",
    depth: 0,
    lastRescueAt: -999,
    lastEventAt: 0,
    eventText: "尾流平顺",
    controlNoise: 0,
    inputEnergy: 0,
    danger: 0,
    controlX: 0,
    controlY: 0,
    commandText: "轻推控线",
    rewardCombo: 0,
    rewardTimer: 0,
    rewardPulse: 0,
    nextDramaAt: 0,
    shock: 0,
  };

  const jelly = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    r: 18,
    glow: 1,
    energy: 1,
    spin: 0,
  };

  const hazards = [];
  const collectibles = [];
  const particles = [];
  const trails = [];
  const currents = [];
  const rings = [];
  const floaters = [];

  const zones = [
    { key: "drift", label: "梦海漂流" },
    { key: "narrow", label: "窄道微操" },
    { key: "blackhole", label: "黑洞乱流" },
    { key: "electric", label: "电弧穿梭" },
    { key: "gate", label: "贝门夹缝" },
    { key: "minefield", label: "雷泡乱飘" },
    { key: "hunt", label: "捕食者追击" },
    { key: "rush", label: "横流急闪" },
    { key: "reward", label: "星尘奖励" },
    { key: "unstable", label: "手感发飘" },
  ];

  const failReasons = {
    blackhole: "被黑洞吸走",
    shatter: "撞碎水晶刺",
    electric: "电流过载",
    energy: "能量耗尽",
    current: "被水流卷走",
  };

  const damageRules = {
    blackhole: { label: "牵引", amount: 20, hue: 286, debuff: "pull", seconds: 2.5, consequence: "牵引2.5s" },
    crystal: { label: "割裂", amount: 18, hue: 324, debuff: "bleed", seconds: 4, consequence: "流血4s" },
    gate: { label: "夹击", amount: 18, hue: 48, debuff: "fracture", seconds: 5, consequence: "裂甲5s" },
    electric: { label: "电击", amount: 16, hue: 304, debuff: "stun", seconds: 1.6, consequence: "麻痹1.6s" },
    mine: { label: "电击", amount: 14, hue: 304, debuff: "stun", seconds: 1.2, consequence: "麻痹1.2s" },
    predator: { label: "追咬", amount: 15, hue: 24, debuff: "slow", seconds: 1.4, consequence: "减速1.4s" },
    comet: { label: "冲击", amount: 16, hue: 18, debuff: "slow", seconds: 1.8, consequence: "减速1.8s" },
    wall: { label: "擦伤", amount: 4, hue: 188, consequence: "无负面" },
    bubble: { label: "减速", amount: 0, hue: 196, debuff: "slow", seconds: 2.2, consequence: "减速2.2s" },
    energy: { label: "断能", amount: 12, hue: 196, debuff: "slow", seconds: 2, consequence: "减速2s" },
  };

  const rewardRules = {
    heal: { label: "回血", hue: 336 },
    shield: { label: "护甲", hue: 188 },
    cleanse: { label: "净化", hue: 52 },
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pick(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function hash(n) {
    return (Math.sin(n * 127.1 + game.seed * 311.7) * 43758.5453123) % 1;
  }

  function noise1(x) {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f);
    return lerp(Math.abs(hash(i)), Math.abs(hash(i + 1)), u);
  }

  function dist(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return Math.hypot(dx, dy);
  }

  function formatTime(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const m = String(Math.floor(total / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, highQuality ? 2 : 1);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    makeStars();
    jelly.x = jelly.x || W * 0.5;
    jelly.y = jelly.y || H * 0.58;
  }

  function makeStars() {
    const density = highQuality ? 4600 : 7600;
    stars = Array.from({ length: Math.round(clamp((W * H) / density, 42, highQuality ? 180 : 90)) }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      p: rand(0.12, 0.8),
      r: rand(0.4, 1.7),
      h: rand(165, 315),
    }));
  }

  function resetRound() {
    game.round += 1;
    game.state = "running";
    game.seed = Math.random() * 10000 + game.round * 17;
    game.time = 0;
    game.cameraY = 0;
    game.nextSpawnY = H * 0.45;
    game.zone = "drift";
    game.zoneUntil = 4.5;
    game.pressure = 0;
    game.failAt = quickMode ? rand(24, 38) : rand(95, 180);
    game.finaleAt = game.failAt - rand(10, 18);
    game.finaleStarted = false;
    game.crash = null;
    game.restartAt = 0;
    game.mistakes = Math.max(0, game.round - 1);
    game.health = game.maxHealth;
    game.shield = 35;
    game.essenceGuardTimer = 0;
    game.slowTimer = 0;
    game.bleedTimer = 0;
    game.bleedTick = 1;
    game.stunTimer = 0;
    game.pullTimer = 0;
    game.fractureTimer = 0;
    game.damageCooldown = 0;
    game.lastHitText = "状态稳定";
    game.lastHitTimer = 0;
    game.lastRewardText = "无增益";
    game.depth = 0;
    game.lastRescueAt = -999;
    game.lastEventAt = -999;
    game.eventText = "尾流平顺";
    game.controlNoise = rand(0, 10);
    game.inputEnergy = 0;
    game.danger = 0;
    game.controlX = 0;
    game.controlY = 0;
    game.commandText = "轻推控线";
    game.rewardCombo = 0;
    game.rewardTimer = 0;
    game.rewardPulse = 0;
    game.nextDramaAt = rand(7.5, 10.5);
    game.shock = 0;

    jelly.x = W * 0.5;
    jelly.y = H * 0.58;
    jelly.vx = rand(-8, 8);
    jelly.vy = rand(-6, 6);
    jelly.r = clamp(W * 0.045, 16, 24);
    jelly.glow = 1;
    jelly.energy = 1;
    jelly.spin = 0;

    hazards.length = 0;
    collectibles.length = 0;
    particles.length = 0;
    trails.length = 0;
    currents.length = 0;
    rings.length = 0;
    floaters.length = 0;
    hud.resultPanel.classList.remove("show");

    const prewarm = highQuality ? 10 : 7;
    for (let i = 0; i < prewarm; i += 1) {
      spawnCluster(game.nextSpawnY + i * 92);
    }
    game.nextSpawnY += prewarm * 92;
  }

  function caveAt(worldY) {
    const n = noise1(worldY * 0.00125 + 11);
    const n2 = noise1(worldY * 0.0021 + 39);
    const weave = Math.sin(worldY * 0.0042 + game.seed) * 0.5 + Math.sin(worldY * 0.0016) * 0.5;
    const narrowPulse = game.zone === "narrow" ? 0.11 : 0;
    const finale = game.time > game.finaleAt ? 0.08 : 0;
    const center = W * 0.5 + (n - 0.5) * W * 0.36 + weave * W * 0.09;
    const baseWidth = W * (0.78 - game.pressure * 0.22 - narrowPulse - finale);
    const width = clamp(baseWidth + (n2 - 0.5) * W * 0.15, W * 0.45, W * 0.92);
    const left = clamp(center - width * 0.5, 10, W - 90);
    const right = clamp(center + width * 0.5, left + W * 0.42, W - 10);
    return { left, right, center: (left + right) * 0.5, width: right - left };
  }

  function currentAt(x, y, worldY) {
    const phase = game.time * 1.35 + game.seed;
    const n = noise1((x + worldY * 0.18) * 0.006 + phase * 0.08);
    const swirl = Math.sin(worldY * 0.009 + phase) + Math.cos(x * 0.018 - phase * 1.3);
    const strength = 26 + game.pressure * 58 + (game.zone === "unstable" ? 34 : 0) + (game.zone === "rush" ? 32 : 0);
    return {
      x: (n - 0.5) * strength + swirl * strength * 0.28,
      y: Math.sin(x * 0.011 + phase) * strength * 0.22,
    };
  }

  function chooseZone() {
    const p = game.pressure;
    const bag = ["reward", "reward", "drift", "rush"];
    if (p > 0.05) bag.push("narrow", "blackhole", "gate");
    if (p > 0.16) bag.push("electric", "minefield", "rush");
    if (p > 0.28) bag.push("hunt");
    if (p > 0.36) bag.push("blackhole", "electric", "narrow", "unstable", "gate", "minefield", "hunt");
    if (game.time > game.finaleAt) bag.push("unstable", "blackhole", "electric", "gate", "minefield", "hunt");
    game.zone = pick(bag);
    game.zoneUntil = game.time + rand(4.2, 7.2) - p * 1.6;
    const zone = zones.find((item) => item.key === game.zone);
    game.eventText = zone ? zone.label : "梦海漂流";
  }

  function chooseRewardKind() {
    const roll = Math.random();
    if (game.health < 55 && roll < 0.52) return "heal";
    if (hasDebuff() && roll < 0.62) return "cleanse";
    if (game.shield < 28 && roll < 0.7) return "shield";
    if (roll < 0.34) return "shield";
    if (roll < 0.68) return "heal";
    return "cleanse";
  }

  function activePursuerCount() {
    return hazards.filter((h) => (h.type === "predator" || h.seeker) && h.chaseState !== "spent").length;
  }

  function hasDebuff() {
    return game.slowTimer > 0 || game.bleedTimer > 0 || game.stunTimer > 0 || game.pullTimer > 0 || game.fractureTimer > 0;
  }

  function clearDebuffs() {
    game.slowTimer = 0;
    game.bleedTimer = 0;
    game.bleedTick = 1;
    game.stunTimer = 0;
    game.pullTimer = 0;
    game.fractureTimer = 0;
  }

  function debuffSummary() {
    const items = [];
    if (game.slowTimer > 0) items.push(`减速${Math.ceil(game.slowTimer)}s`);
    if (game.bleedTimer > 0) items.push(`流血${Math.ceil(game.bleedTimer)}s`);
    if (game.stunTimer > 0) items.push(`麻痹${Math.ceil(game.stunTimer)}s`);
    if (game.pullTimer > 0) items.push(`牵引${Math.ceil(game.pullTimer)}s`);
    if (game.fractureTimer > 0) items.push(`裂甲${Math.ceil(game.fractureTimer)}s`);
    if (game.essenceGuardTimer > 0) items.push(`净化免疫${Math.ceil(game.essenceGuardTimer)}s`);
    return items.length ? `负面：${items.join(" ")}` : "负面：无";
  }

  function applyDebuff(rule) {
    if (!rule.debuff || game.essenceGuardTimer > 0) return;
    if (rule.debuff === "slow") game.slowTimer = Math.max(game.slowTimer, rule.seconds);
    if (rule.debuff === "bleed") {
      game.bleedTimer = Math.max(game.bleedTimer, rule.seconds);
      game.bleedTick = Math.min(game.bleedTick, 1);
    }
    if (rule.debuff === "stun") game.stunTimer = Math.max(game.stunTimer, rule.seconds);
    if (rule.debuff === "pull") game.pullTimer = Math.max(game.pullTimer, rule.seconds);
    if (rule.debuff === "fracture") game.fractureTimer = Math.max(game.fractureTimer, rule.seconds);
  }

  function spawnCluster(worldY) {
    const c = caveAt(worldY);
    const p = game.pressure;
    const zone = game.zone;
    const openingDrift = worldY < H * 0.72;
    const safeLeft = c.left + 34;
    const safeRight = c.right - 34;
    const count = openingDrift || zone === "reward" ? Math.round(rand(2, highQuality ? 4 : 3)) : Math.round(rand(1, highQuality ? 2.4 : 2) + p * 0.45);

    if (Math.random() < 0.44 || zone === "rush") {
      currents.push({
        y: worldY + rand(-40, 50),
        x: rand(safeLeft, safeRight),
        w: rand(95, 210),
        life: rand(5, 11),
        hue: rand(170, 290),
      });
    }

    for (let i = 0; i < count; i += 1) {
      const lane = (i + 1) / (count + 1);
      const wave = Math.sin(i * 1.7 + game.seed + worldY * 0.02) * 0.18;
      const ribbon = Math.sin(i * 0.92 + worldY * 0.012 + game.seed) * 38;
      const kind = chooseRewardKind();
      const reward = rewardRules[kind];
      collectibles.push({
        x: lerp(safeLeft, safeRight, clamp(lane + wave, 0.08, 0.92)),
        y: worldY + ribbon + rand(-18, 18),
        r: rand(5.4, 9.2),
        hue: reward.hue,
        kind,
        value: Math.random() < 0.18 ? 2 : 1,
        taken: false,
      });
    }
    while (collectibles.length > (highQuality ? 90 : 48)) collectibles.shift();

    if (openingDrift) return;

    const hazardChance = clamp(0.18 + p * 0.28, 0.18, 0.46);
    const hazardCap = p > 0.76 && Math.random() < 0.38 ? 2 : 1;
    const pursuerCap = highQuality ? 3 : 2;
    let spawned = 0;
    const trySpawn = (condition, spawn) => {
      if (spawned >= hazardCap || !condition) return;
      spawn();
      spawned += 1;
    };

    if (zone === "blackhole") trySpawn(true, () => spawnBlackhole(worldY, c));
    else if (zone === "electric") trySpawn(true, () => spawnElectric(worldY + rand(-40, 70), c));
    else if (zone === "narrow") trySpawn(true, () => spawnCrystals(worldY + rand(-50, 80), c));
    else if (zone === "gate") trySpawn(true, () => spawnGate(worldY + rand(-30, 70), c));
    else if (zone === "minefield") trySpawn(true, () => spawnMine(worldY + rand(-50, 80), c, { seeker: p > 0.34 && activePursuerCount() < pursuerCap && Math.random() < 0.34 }));
    else if (zone === "hunt") trySpawn(activePursuerCount() < pursuerCap, () => spawnPredator(worldY + rand(-50, 60), c));
    else if (zone === "rush") trySpawn(true, () => spawnComet(worldY + rand(-60, 80), c));
    else if (zone === "unstable") trySpawn(true, () => spawnBubble(worldY + rand(-40, 80), c));

    trySpawn(Math.random() < hazardChance * 0.55, () => spawnBlackhole(worldY, c));
    trySpawn(Math.random() < hazardChance * 0.46, () => spawnElectric(worldY + rand(-40, 70), c));
    trySpawn(Math.random() < hazardChance * 0.5, () => spawnCrystals(worldY + rand(-50, 80), c));
    trySpawn(Math.random() < hazardChance * 0.22, () => spawnGate(worldY + rand(-30, 70), c));
    trySpawn(Math.random() < hazardChance * 0.28, () => spawnMine(worldY + rand(-50, 80), c, { seeker: p > 0.32 && activePursuerCount() < pursuerCap && Math.random() < 0.22 }));
    trySpawn(p > 0.3 && activePursuerCount() < pursuerCap && Math.random() < hazardChance * 0.18, () => spawnPredator(worldY + rand(-50, 60), c));
    trySpawn(Math.random() < hazardChance * 0.22, () => spawnComet(worldY + rand(-60, 80), c));
    trySpawn(Math.random() < hazardChance * 0.28, () => spawnBubble(worldY + rand(-40, 80), c));
    const maxHazards = highQuality ? 64 : 34;
    if (hazards.length > maxHazards) hazards.splice(0, hazards.length - maxHazards);
    if (currents.length > (highQuality ? 28 : 14)) currents.splice(0, currents.length - (highQuality ? 28 : 14));
  }

  function spawnBlackhole(worldY, c) {
    const nearCenter = Math.random() < game.pressure * 0.45;
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = nearCenter
      ? c.center + side * rand(22, c.width * 0.24)
      : (side < 0 ? c.left : c.right) + side * rand(-58, -24);
    hazards.push({
      type: "blackhole",
      x: clamp(x, c.left + 34, c.right - 34),
      y: worldY,
      r: rand(18, 30) + game.pressure * 14,
      pull: rand(120, 190) + game.pressure * 130,
      phase: rand(0, TAU),
      near: false,
    });
  }

  function spawnElectric(worldY, c) {
    const gapW = clamp(c.width * rand(0.25, 0.36) - game.pressure * 22, 82, c.width * 0.46);
    hazards.push({
      type: "electric",
      y: worldY,
      gapX: clamp(c.center + rand(-c.width * 0.22, c.width * 0.22), c.left + gapW * 0.55, c.right - gapW * 0.55),
      gapW,
      phase: rand(0, TAU),
      near: false,
    });
  }

  function spawnCrystals(worldY, c) {
    const amount = Math.random() < 0.45 ? 2 : 1;
    for (let i = 0; i < amount; i += 1) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const fromWall = rand(12, 42 + game.pressure * 28);
      hazards.push({
        type: "crystal",
        x: side < 0 ? c.left + fromWall : c.right - fromWall,
        y: worldY + i * rand(36, 64),
        r: rand(18, 34) + game.pressure * 8,
        side,
        phase: rand(0, TAU),
        near: false,
      });
    }
  }

  function spawnBubble(worldY, c) {
    hazards.push({
      type: "bubble",
      x: rand(c.left + 42, c.right - 42),
      y: worldY,
      r: rand(28, 48),
      phase: rand(0, TAU),
      near: false,
    });
  }

  function spawnGate(worldY, c) {
    const gapW = clamp(c.width * rand(0.26, 0.38) - game.pressure * 28, 76, c.width * 0.48);
    hazards.push({
      type: "gate",
      y: worldY,
      gapX: clamp(c.center + rand(-c.width * 0.25, c.width * 0.25), c.left + gapW * 0.62, c.right - gapW * 0.62),
      gapW,
      phase: rand(0, TAU),
      near: false,
    });
  }

  function spawnMine(worldY, c, options = {}) {
    const amount = options.seeker ? 1 : Math.random() < 0.45 + game.pressure * 0.25 ? 2 : 1;
    for (let i = 0; i < amount; i += 1) {
      const x = rand(c.left + 50, c.right - 50);
      const y = worldY + i * rand(42, 72);
      hazards.push({
        type: "mine",
        x,
        y,
        originX: x,
        originY: y,
        r: rand(15, 24) + game.pressure * 7,
        phase: rand(0, TAU),
        drift: rand(-22, 22),
        vx: 0,
        vy: 0,
        seeker: Boolean(options.seeker),
        chaseState: "idle",
        chaseT: rand(1.6, 2.25),
        trigger: rand(150, 205),
        range: rand(150, 220),
        near: false,
      });
    }
  }

  function spawnPredator(worldY, c) {
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft ? c.left - 42 : c.right + 42;
    const y = worldY + rand(-24, 48);
    const dir = fromLeft ? 1 : -1;
    hazards.push({
      type: "predator",
      x,
      y,
      originX: x,
      originY: y,
      vx: dir * rand(82, 120),
      vy: rand(-10, 10),
      r: rand(15, 20),
      side: dir,
      hue: 24,
      phase: rand(0, TAU),
      chaseState: "chasing",
      chaseT: rand(1.7, 2.45),
      range: rand(190, 270),
      near: false,
    });
  }

  function spawnComet(worldY, c) {
    const fromLeft = Math.random() < 0.5;
    hazards.push({
      type: "comet",
      x: fromLeft ? c.left - 50 : c.right + 50,
      y: worldY,
      vx: (fromLeft ? 1 : -1) * rand(90, 145 + game.pressure * 80),
      vy: rand(-12, 20),
      r: rand(12, 18),
      hue: pick([18, 322, 196]),
      phase: rand(0, TAU),
      near: false,
    });
  }

  function spawnDramaHazard() {
    const worldY = game.cameraY + jelly.y + H * rand(0.34, 0.52);
    const c = caveAt(worldY);
    const type = pick(["gate", "mine", "comet", "blackhole", "electric"]);
    game.eventText = pick(["来了来了", "这波要手快", "连续救一下", "别被带偏"]);
    game.shock = Math.max(game.shock, 0.7);
    if (type === "gate") spawnGate(worldY, c);
    if (type === "mine") spawnMine(worldY, c);
    if (type === "comet") spawnComet(worldY, c);
    if (type === "blackhole") spawnBlackhole(worldY, c);
    if (type === "electric") spawnElectric(worldY, c);
    for (let i = 0; i < 2; i += 1) {
      const kind = i === 0 ? chooseRewardKind() : "cleanse";
      collectibles.push({
        x: lerp(c.left + 42, c.right - 42, (i + 1) / 3),
        y: worldY + 96 + Math.sin(i * 0.9) * 28,
        r: rand(6, 10),
        hue: rewardRules[kind].hue,
        kind,
        value: 2,
        taken: false,
      });
    }
  }

  function startFinale() {
    if (game.crash || game.finaleStarted || hazards.some((h) => h.finale)) return;
    game.finaleStarted = true;
    const reason = pick(["blackhole", "shatter", "electric", "energy", "current"]);
    game.eventText = "稳住，水流乱了";
    if (reason === "blackhole") {
      hazards.push({
        type: "blackhole",
        x: clamp(jelly.x + rand(-70, 70), 70, W - 70),
        y: game.cameraY + jelly.y - rand(80, 135),
        r: 42,
        pull: 420,
        phase: rand(0, TAU),
        near: false,
        finale: true,
        reason,
      });
    } else if (reason === "electric") {
      const c = caveAt(game.cameraY + jelly.y - 100);
      hazards.push({
        type: "electric",
        y: game.cameraY + jelly.y - 115,
        gapX: jelly.x + rand(-20, 20),
        gapW: 72,
        phase: 0,
        near: false,
        finale: true,
        reason,
      });
    } else if (reason === "shatter") {
      const c = caveAt(game.cameraY + jelly.y - 90);
      hazards.push({
        type: "crystal",
        x: clamp(jelly.x + rand(-60, 60), c.left + 40, c.right - 40),
        y: game.cameraY + jelly.y - 105,
        r: 42,
        side: Math.random() < 0.5 ? -1 : 1,
        phase: rand(0, TAU),
        near: false,
        finale: true,
        reason,
      });
    } else {
      applyDamage(reason === "current" ? "comet" : "energy", jelly.x + rand(-40, 40), jelly.y - 60, "后期乱流");
    }
  }

  function readManualInput() {
    const manual = {
      left: false,
      right: false,
      up: false,
      down: false,
      boost: false,
      brake: false,
    };
    const touchLive = touch.active || game.time - touch.last < 0.18;
    if (touchLive) {
      const dx = touch.x - touch.x0;
      const dy = touch.y - touch.y0;
      manual.left = dx < -18;
      manual.right = dx > 18;
      manual.up = dy < -18;
      manual.down = dy > 18;
      manual.boost = Math.hypot(dx, dy) > 68;
      manual.brake = Math.hypot(dx, dy) < 20 && touch.active;
    }
    for (const key of Object.keys(keyboard)) {
      manual[key] = manual[key] || keyboard[key];
    }
    return manual;
  }

  function inputVector(input) {
    return {
      x: (input.right ? 1 : 0) - (input.left ? 1 : 0),
      y: (input.down ? 1 : 0) - (input.up ? 1 : 0),
    };
  }

  function setTelemetry(input, x, y, danger, command) {
    const boostKick = input.boost ? 0.28 : 0;
    game.controlX = lerp(game.controlX, clamp(x, -1, 1), 0.32 + boostKick);
    game.controlY = lerp(game.controlY, clamp(y, -1, 1), 0.32 + boostKick);
    game.danger = lerp(game.danger, clamp(danger, 0, 1), 0.18);
    game.commandText = command;
  }

  function clearInputTelemetry(command = "重启中") {
    for (const key of Object.keys(keys)) keys[key] = false;
    game.controlX = lerp(game.controlX, 0, 0.5);
    game.controlY = lerp(game.controlY, 0, 0.5);
    game.danger = 0;
    game.commandText = command;
  }

  function commandFor(input, danger, nearest, chasingReward) {
    if (input.boost && input.brake) return "短喷急刹";
    if (game.stunTimer > 0) return "麻痹迟钝";
    if (game.pullTimer > 0) return "牵引拉扯";
    if (input.boost && danger > 0.56) return "短喷救回";
    if (input.brake && nearest < 34) return "擦边稳住";
    if (danger > 0.7) return "疯狂微调";
    if (chasingReward) return "追星尘线";
    if (input.left && input.up) return "左上拉开";
    if (input.right && input.up) return "右上拉开";
    if (input.left && input.down) return "左下绕开";
    if (input.right && input.down) return "右下绕开";
    if (input.left) return "左滑控线";
    if (input.right) return "右滑控线";
    if (input.up) return "上浮找缝";
    if (input.down) return "下潜避开";
    return "轻推控线";
  }

  function autopilotInput(dt) {
    const manual = readManualInput();
    const hasManual = Object.values(manual).some(Boolean);
    if (hasManual) {
      const v = inputVector(manual);
      setTelemetry(manual, v.x, v.y, 0.35, "真人接管");
      return manual;
    }

    const lookY = game.cameraY + jelly.y + 90;
    const cave = caveAt(lookY);
    const centerWobble = Math.sin(game.time * 2.6 + game.controlNoise) * (14 + game.pressure * 30);
    let targetX = cave.center + centerWobble;
    let targetY = H * (0.56 + Math.sin(game.time * 1.7) * 0.045);
    let danger = 0;
    let nearest = 9999;

    for (const h of hazards) {
      const sy = h.y - game.cameraY;
      if (sy < -80 || sy > H + 130) continue;
      if (h.type === "blackhole") {
        const d = dist(jelly.x, jelly.y, h.x, sy);
        nearest = Math.min(nearest, d - h.r);
        if (d < h.pull * 1.25) {
          const push = clamp((h.pull * 1.25 - d) / h.pull, 0, 1);
          targetX += ((jelly.x - h.x) / Math.max(1, d)) * push * 180;
          targetY += ((jelly.y - sy) / Math.max(1, d)) * push * 115;
          danger = Math.max(danger, push);
        }
      }
      if (h.type === "crystal") {
        const d = dist(jelly.x, jelly.y, h.x, sy);
        nearest = Math.min(nearest, d - h.r);
        if (d < 125) {
          const push = clamp((125 - d) / 110, 0, 1);
          targetX += ((jelly.x - h.x) / Math.max(1, d)) * push * 140;
          targetY += ((jelly.y - sy) / Math.max(1, d)) * push * 90;
          danger = Math.max(danger, push * 0.85);
        }
      }
      if (h.type === "electric") {
        const gapCenter = h.gapX + Math.sin(game.time * 1.7 + h.phase) * 10;
        const dy = sy - jelly.y;
        if (dy > -80 && dy < 190) {
          targetX = lerp(targetX, gapCenter, 0.62);
          danger = Math.max(danger, clamp((160 - Math.abs(dy)) / 160, 0, 0.8));
          nearest = Math.min(nearest, Math.abs(dy));
        }
      }
      if (h.type === "gate") {
        const gate = gateMetrics(h);
        const dy = sy - jelly.y;
        if (dy > -95 && dy < 210) {
          targetX = lerp(targetX, gate.gapCenter, 0.72);
          danger = Math.max(danger, clamp((180 - Math.abs(dy)) / 180, 0, 0.86) * gate.closed);
          nearest = Math.min(nearest, Math.abs(dy));
        }
      }
      if (h.type === "mine" || h.type === "comet" || h.type === "predator") {
        const look = h.type === "comet" ? clamp((sy - jelly.y) / 180, -0.5, 0.9) : h.chaseState === "chasing" ? 0.42 : 0.18;
        const hx = h.x + (h.vx || 0) * look;
        const hy = sy + (h.vy || 0) * look;
        const activeChase = h.type === "predator" || h.chaseState === "chasing";
        const d = dist(jelly.x, jelly.y, hx, hy);
        nearest = Math.min(nearest, d - h.r);
        const alert = activeChase ? 190 : 150;
        if (d < alert) {
          const push = clamp((alert - d) / (activeChase ? 150 : 130), 0, 1);
          targetX += ((jelly.x - hx) / Math.max(1, d)) * push * (activeChase ? 220 : 170);
          targetY += ((jelly.y - hy) / Math.max(1, d)) * push * (activeChase ? 140 : 110);
          danger = Math.max(danger, push * (activeChase ? 1 : 0.9));
        }
      }
      if (h.type === "bubble") {
        const d = dist(jelly.x, jelly.y, h.x, sy);
        if (d < h.r + 90) {
          const push = clamp((h.r + 90 - d) / 100, 0, 1);
          targetX += ((jelly.x - h.x) / Math.max(1, d)) * push * 70;
          danger = Math.max(danger, push * 0.3);
        }
      }
    }

    let rewardTarget = null;
    let rewardScore = 99999;
    for (const item of collectibles) {
      const sy = item.y - game.cameraY;
      if (item.taken || sy < jelly.y - 60 || sy > jelly.y + 240) continue;
      const c = caveAt(item.y);
      if (item.x > c.left + 38 && item.x < c.right - 38) {
        const score = Math.abs(item.x - jelly.x) * 0.9 + Math.abs(sy - jelly.y) * 0.35 - item.value * 18;
        if (score < rewardScore) {
          rewardScore = score;
          rewardTarget = { x: item.x, y: sy };
        }
      }
    }
    const chasingReward = Boolean(rewardTarget && danger < 0.58);
    if (chasingReward) {
      targetX = lerp(targetX, rewardTarget.x, 0.48);
      targetY = lerp(targetY, rewardTarget.y, 0.22);
    }

    if (game.time > game.finaleAt) {
      const panic = clamp((game.time - game.finaleAt) / Math.max(1, game.failAt - game.finaleAt), 0, 1);
      targetX += Math.sin(game.time * 15.5) * panic * 54;
      targetY += Math.cos(game.time * 13.8) * panic * 38;
      danger = Math.max(danger, panic * 0.9);
    }

    const dx = targetX - jelly.x;
    const dy = targetY - jelly.y;
    const dead = 5 + danger * 7;
    const next = {
      left: dx < -dead,
      right: dx > dead,
      up: dy < -dead,
      down: dy > dead,
      boost: (danger > 0.42 && Math.sin(game.time * 18) > -0.62) || (chasingReward && Math.abs(dx) < 32 && Math.sin(game.time * 7) > 0.45),
      brake: (Math.abs(jelly.vx) + Math.abs(jelly.vy) > 128 && danger > 0.2) || nearest < 36,
    };

    if (game.stunTimer > 0) {
      next.boost = false;
      if (Math.sin(game.time * 9) > 0.2) {
        next.left = false;
        next.right = false;
      }
    }
    if (game.pullTimer > 0) next.boost = false;

    setTelemetry(next, dx / 86, dy / 72, danger, commandFor(next, danger, nearest, chasingReward));
    return next;
  }

  function update(dt) {
    if (game.state === "crashed") {
      updateCrash(dt);
      return;
    }

    game.time += dt;
    game.rewardTimer = Math.max(0, game.rewardTimer - dt);
    if (game.rewardTimer <= 0) game.rewardCombo = 0;
    game.rewardPulse = Math.max(0, game.rewardPulse - dt * 2.8);
    game.essenceGuardTimer = Math.max(0, game.essenceGuardTimer - dt);
    game.slowTimer = Math.max(0, game.slowTimer - dt);
    game.bleedTimer = Math.max(0, game.bleedTimer - dt);
    game.stunTimer = Math.max(0, game.stunTimer - dt);
    game.pullTimer = Math.max(0, game.pullTimer - dt);
    game.fractureTimer = Math.max(0, game.fractureTimer - dt);
    if (game.bleedTimer > 0) {
      game.bleedTick -= dt;
      if (game.bleedTick <= 0) {
        game.bleedTick = 1;
        game.health = Math.max(0, game.health - 3);
        game.lastHitText = "流血 -3";
        game.lastHitTimer = 1;
        floatText(jelly.x, jelly.y - 22, "-3 流血", damageRules.crystal.hue);
        if (game.health <= 0 && !game.crash) beginCrash("shatter", jelly.x, jelly.y);
      }
    } else {
      game.bleedTick = 1;
    }
    game.damageCooldown = Math.max(0, game.damageCooldown - dt);
    game.lastHitTimer = Math.max(0, game.lastHitTimer - dt);
    if (game.lastHitTimer <= 0) game.lastHitText = game.essenceGuardTimer > 0 ? "净化免疫中" : "状态稳定";
    game.shock = Math.max(0, game.shock - dt * 1.7);
    if (game.time > game.zoneUntil) chooseZone();

    const ramp = clamp(game.time / game.failAt, 0, 1);
    const finaleRamp = clamp((game.time - game.finaleAt) / Math.max(1, game.failAt - game.finaleAt), 0, 1);
    game.pressure = clamp(ramp * 0.74 + finaleRamp * 0.18, 0, 0.92);

    const slowFactor = game.slowTimer > 0 ? 0.68 : game.pullTimer > 0 ? 0.82 : 1;
    const speed = (96 + game.pressure * 78 + (keys.boost ? 28 : 0) + (game.zone === "rush" ? 18 : 0)) * slowFactor;
    game.cameraY += speed * dt;
    game.depth = Math.floor(game.cameraY * 0.62);

    while (game.nextSpawnY < game.cameraY + H + 360) {
      spawnCluster(game.nextSpawnY);
      game.nextSpawnY += Math.max(72, rand(96, 152) - game.pressure * 18);
    }

    if (game.time > game.nextDramaAt && game.time < game.finaleAt - 5) {
      spawnDramaHazard();
      game.nextDramaAt = game.time + rand(13, 18) - game.pressure * 1.4;
    }

    if (game.time > game.finaleAt) startFinale();

    const nextKeys = autopilotInput(dt);
    Object.assign(keys, nextKeys);
    applyPhysics(dt);
    updateHazards(dt);
    updateCollectibles();
    updateParticles(dt);
    checkCollisions();
    updateHud();
  }

  function applyPhysics(dt) {
    const worldY = game.cameraY + jelly.y;
    const cur = currentAt(jelly.x, jelly.y, worldY);
    const controlSlow = game.stunTimer > 0 ? 0.48 : game.slowTimer > 0 ? 0.7 : game.pullTimer > 0 ? 0.76 : 1;
    const accel = (340 + (keys.boost ? 260 : 0)) * controlSlow;
    const ax = (keys.left ? -accel : 0) + (keys.right ? accel : 0) + cur.x;
    const ay = (keys.up ? -accel : 0) + (keys.down ? accel : 0) + cur.y;
    const damping = keys.brake ? 0.82 : 0.976;

    jelly.vx = (jelly.vx + ax * dt) * Math.pow(damping, dt * 60);
    jelly.vy = (jelly.vy + ay * dt) * Math.pow(damping, dt * 60);
    jelly.vy += (H * 0.58 - jelly.y) * dt * 1.1;
    jelly.x += jelly.vx * dt;
    jelly.y += jelly.vy * dt;
    jelly.spin = lerp(jelly.spin, clamp(jelly.vx / 220, -0.45, 0.45), 0.08);
    jelly.glow = lerp(jelly.glow, keys.boost ? 2.2 : 1 + game.rewardPulse * 0.65, 0.1);
    game.inputEnergy = lerp(game.inputEnergy, Object.values(keys).filter(Boolean).length / 4, 0.08);

    const cave = caveAt(game.cameraY + jelly.y);
    if (jelly.x < cave.left + jelly.r) {
      jelly.x = cave.left + jelly.r;
      jelly.vx = Math.abs(jelly.vx) * 0.55;
      scrape("左壁擦边");
    }
    if (jelly.x > cave.right - jelly.r) {
      jelly.x = cave.right - jelly.r;
      jelly.vx = -Math.abs(jelly.vx) * 0.55;
      scrape("右壁擦边");
    }
    jelly.y = clamp(jelly.y, H * 0.22, H * 0.82);

    trails.push({
      x: jelly.x,
      y: jelly.y + jelly.r * 0.38,
      age: 0,
      life: 0.95,
      vx: -jelly.vx * 0.05 + rand(-8, 8),
      vy: 28 + rand(0, 22),
      hue: keys.boost ? 316 : 184 + Math.sin(game.time) * 34,
      r: jelly.r * rand(0.16, 0.32) * jelly.glow,
    });
    while (trails.length > (highQuality ? 150 : 86)) trails.shift();
  }

  function scrape(text) {
    if (game.time - game.lastRescueAt > 2.4) {
      game.eventText = text;
      game.lastRescueAt = game.time;
      applyDamage("wall", jelly.x, jelly.y, text);
    }
  }

  function updateHazards(dt) {
    for (const h of hazards) {
      h.phase += dt * (h.type === "blackhole" ? 2.6 : h.type === "gate" ? 3.3 : 4.8);
      if (h.type === "bubble") {
        h.x += Math.sin(game.time * 1.3 + h.phase) * dt * 14;
      }
      if (h.type === "mine") {
        if (h.seeker) updateSeekerMine(h, dt);
        else h.x += Math.sin(game.time * 1.9 + h.phase) * h.drift * dt;
      }
      if (h.type === "predator") updatePredator(h, dt);
      if (h.type === "comet") {
        h.x += h.vx * dt;
        h.y += h.vy * dt;
      }
      if (h.type === "blackhole") {
        const sy = h.y - game.cameraY;
        const d = dist(jelly.x, jelly.y, h.x, sy);
        if (d < h.pull) {
          const force = ((h.pull - d) / h.pull) * (h.pull * 1.05);
          jelly.vx += ((h.x - jelly.x) / Math.max(1, d)) * force * dt * 5;
          jelly.vy += ((sy - jelly.y) / Math.max(1, d)) * force * dt * 5;
        }
      }
    }

    for (let i = hazards.length - 1; i >= 0; i -= 1) {
      const h = hazards[i];
      if (h.y - game.cameraY < -190 || h.x < -180 || h.x > W + 180) hazards.splice(i, 1);
    }

    for (let i = currents.length - 1; i >= 0; i -= 1) {
      const c = currents[i];
      c.life -= dt;
      if (c.y - game.cameraY < -160 || c.life <= 0) currents.splice(i, 1);
    }
  }

  function updateSeekerMine(h, dt) {
    const sy = h.y - game.cameraY;
    const targetY = game.cameraY + jelly.y;
    const d = dist(jelly.x, targetY, h.x, h.y);

    if (h.chaseState === "idle") {
      h.x += Math.sin(game.time * 1.9 + h.phase) * h.drift * dt;
      if (sy > -30 && sy < H + 80 && d < h.trigger) {
        h.chaseState = "chasing";
        h.announced = true;
        game.eventText = "雷泡锁定";
        game.shock = Math.max(game.shock, 0.36);
      }
      return;
    }

    if (h.chaseState === "chasing") {
      h.chaseT -= dt;
      const moved = dist(h.x, h.y, h.originX, h.originY);
      if (h.chaseT <= 0 || moved > h.range || sy < -70) {
        h.chaseState = "spent";
        h.vx = (h.x < jelly.x ? -1 : 1) * rand(76, 118);
        h.vy *= 0.25;
      } else {
        const speed = 82 + game.pressure * 52;
        const dx = jelly.x - h.x;
        const dy = targetY - h.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        h.vx = lerp(h.vx, (dx / len) * speed, 0.1);
        h.vy = lerp(h.vy, (dy / len) * speed, 0.1);
      }
    }

    h.x += h.vx * dt;
    h.y += h.vy * dt;
    h.vx *= Math.pow(0.992, dt * 60);
    h.vy *= Math.pow(0.992, dt * 60);
  }

  function updatePredator(h, dt) {
    if (h.chaseState === "chasing") {
      h.chaseT -= dt;
      const moved = dist(h.x, h.y, h.originX, h.originY);
      if (h.chaseT <= 0 || moved > h.range || h.y - game.cameraY < -70) {
        h.chaseState = "spent";
        h.vx = h.side * rand(145, 190);
        h.vy *= 0.25;
      } else {
        const targetX = jelly.x + jelly.vx * 0.16;
        const targetY = game.cameraY + jelly.y + jelly.vy * 0.16;
        const dx = targetX - h.x;
        const dy = targetY - h.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        const speed = 126 + game.pressure * 74;
        h.vx = lerp(h.vx, (dx / len) * speed, 0.12);
        h.vy = lerp(h.vy, (dy / len) * speed, 0.12);
      }
    }

    h.x += h.vx * dt;
    h.y += h.vy * dt;
  }

  function gateMetrics(h) {
    const closed = clamp(0.58 + Math.sin(game.time * 2.7 + h.phase) * 0.42, 0.16, 1);
    const gapCenter = h.gapX + Math.sin(game.time * 1.8 + h.phase) * 18;
    const gapW = h.gapW * (1.08 - closed * 0.26);
    return { closed, gapCenter, gapW, gapL: gapCenter - gapW * 0.5, gapR: gapCenter + gapW * 0.5 };
  }

  function updateCollectibles() {
    for (const item of collectibles) {
      if (item.taken) continue;
      const sy = item.y - game.cameraY;
      if (dist(jelly.x, jelly.y, item.x, sy) < jelly.r + item.r + 11) {
        item.taken = true;
        game.rewardCombo += item.value;
        game.rewardTimer = 1.8;
        game.rewardPulse = 1;
        applyReward(item, sy);
        jelly.energy = clamp(jelly.energy + 0.035 * item.value, 0, 1);
        jelly.glow = 2.5;
        burst(item.x, sy, (highQuality ? 12 : 6) + item.value * 3, item.hue, 0.86);
        ring(item.x, sy, item.hue, 0.75 + item.value * 0.12);
        floatText(item.x, sy - 14, rewardFloatText(item), item.hue);
        if (game.rewardCombo % 3 === 0 || item.value > 1) {
          game.eventText = `${game.lastRewardText}  连吃 x${game.rewardCombo}`;
          game.shock = Math.max(game.shock, 0.34);
        }
      }
    }

    for (let i = collectibles.length - 1; i >= 0; i -= 1) {
      const item = collectibles[i];
      if (item.taken || item.y - game.cameraY < -90) collectibles.splice(i, 1);
    }
  }

  function rewardFloatText(item) {
    if (item.kind === "heal") return `+${10 * item.value}生命`;
    if (item.kind === "shield") return `+${12 * item.value}甲`;
    return "清负面";
  }

  function applyReward(item, screenY) {
    if (item.kind === "heal") {
      const amount = 10 * item.value;
      game.health = clamp(game.health + amount, 0, game.maxHealth);
      game.lastRewardText = `回血 +${amount}`;
    } else if (item.kind === "shield") {
      const amount = 12 * item.value;
      game.shield = clamp(game.shield + amount, 0, game.maxShield);
      game.lastRewardText = `护甲 +${amount}`;
    } else {
      const hadDebuff = hasDebuff();
      clearDebuffs();
      game.essenceGuardTimer = clamp(game.essenceGuardTimer + 3 * item.value, 0, 6);
      game.lastRewardText = hadDebuff ? "净化 清负面" : `净化免疫 ${Math.ceil(game.essenceGuardTimer)}s`;
    }
    game.lastHitText = game.lastRewardText;
    game.lastHitTimer = 1.2;
    ring(item.x, screenY, item.hue, 0.62);
  }

  function applyDamage(source, x = jelly.x, y = jelly.y, note = "") {
    const rule = damageRules[source] || damageRules.wall;
    if (rule.amount <= 0) {
      const debuffBlocked = Boolean(rule.debuff && game.essenceGuardTimer > 0);
      applyDebuff(rule);
      game.lastHitText = debuffBlocked ? "净化免疫" : rule.consequence || `${rule.label} ${rule.seconds}s`;
      game.lastHitTimer = 1.4;
      game.eventText = note ? `${note}  ${game.lastHitText}` : game.lastHitText;
      floatText(jelly.x, jelly.y - 18, game.lastHitText, rule.hue);
      ring(jelly.x, jelly.y, rule.hue, 0.45);
      return false;
    }

    if (game.damageCooldown > 0) return false;

    const debuffBlocked = Boolean(rule.debuff && game.essenceGuardTimer > 0);
    const effectiveArmor = game.fractureTimer > 0 ? game.shield * 0.45 : game.shield;
    const reduction = clamp(effectiveArmor / 180, 0, 0.5);
    const amount = Math.max(1, Math.round(rule.amount * (1 - reduction)));
    const armorLoss = Math.min(game.shield, Math.max(1, Math.round(rule.amount * 0.22)));
    game.shield = Math.max(0, game.shield - armorLoss);
    game.health = Math.max(0, game.health - amount);
    applyDebuff(rule);
    game.damageCooldown = 0.55;
    game.shock = Math.max(game.shock, 0.78);
    game.lastHitTimer = 1.8;

    const parts = [`${rule.label} -${amount}`];
    if (reduction > 0) parts.push(`护甲减${Math.round(reduction * 100)}%`);
    if (armorLoss > 0) parts.push(`耗甲${armorLoss}`);
    if (rule.consequence && rule.consequence !== "无负面") parts.push(debuffBlocked ? "净化免疫" : rule.consequence);
    game.lastHitText = parts.join(" ");
    game.eventText = note ? `${note}  ${game.lastHitText}` : game.lastHitText;

    const d = Math.max(1, dist(jelly.x, jelly.y, x, y));
    jelly.vx += ((jelly.x - x) / d) * 190 + rand(-24, 24);
    jelly.vy += ((jelly.y - y) / d) * 140 - 35;
    jelly.glow = 2.4;
    burst(jelly.x, jelly.y, highQuality ? 24 : 12, rule.hue, 1);
    ring(jelly.x, jelly.y, rule.hue, 0.85);
    floatText(jelly.x, jelly.y - 20, `-${amount} ${rule.label}`, rule.hue);

    if (game.health <= 0) beginCrash(reasonForDamage(source), x, y);
    return true;
  }

  function reasonForDamage(source) {
    if (source === "blackhole") return "blackhole";
    if (source === "electric" || source === "mine") return "electric";
    if (source === "predator") return "current";
    if (source === "comet") return "current";
    if (source === "energy") return "energy";
    if (source === "crystal" || source === "gate" || source === "wall") return "shatter";
    return "energy";
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.985, dt * 60);
      p.vy *= Math.pow(0.985, dt * 60);
    }
    for (const t of trails) {
      t.age += dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
    }
    for (const r of rings) {
      r.age += dt;
      r.radius += r.speed * dt;
    }
    for (const f of floaters) {
      f.age += dt;
      f.y += f.vy * dt;
      f.x += Math.sin(f.age * 8 + f.seed) * dt * 12;
    }
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      if (particles[i].age > particles[i].life) particles.splice(i, 1);
    }
    for (let i = trails.length - 1; i >= 0; i -= 1) {
      if (trails[i].age > trails[i].life) trails.splice(i, 1);
    }
    for (let i = rings.length - 1; i >= 0; i -= 1) {
      if (rings[i].age > rings[i].life) rings.splice(i, 1);
    }
    for (let i = floaters.length - 1; i >= 0; i -= 1) {
      if (floaters[i].age > floaters[i].life) floaters.splice(i, 1);
    }
    const maxParticles = highQuality ? 560 : 210;
    const maxRings = highQuality ? 54 : 22;
    const maxFloaters = highQuality ? 22 : 10;
    if (particles.length > maxParticles) particles.splice(0, particles.length - maxParticles);
    if (rings.length > maxRings) rings.splice(0, rings.length - maxRings);
    if (floaters.length > maxFloaters) floaters.splice(0, floaters.length - maxFloaters);
  }

  function checkCollisions() {
    if (game.crash) return;

    for (const h of hazards) {
      const sy = h.y - game.cameraY;
      if (sy < -70 || sy > H + 90) continue;

      if (h.type === "blackhole") {
        const d = dist(jelly.x, jelly.y, h.x, sy);
        if (d < h.r + jelly.r * 0.34) applyDamage("blackhole", h.x, sy, "黑洞牵引");
        else nearMiss(h, d, h.r + jelly.r + 18, "黑洞边缘拉回来了");
      }

      if (h.type === "crystal") {
        const d = dist(jelly.x, jelly.y, h.x, sy);
        if (d < h.r + jelly.r * 0.42) applyDamage("crystal", h.x, sy, "水晶割裂");
        else nearMiss(h, d, h.r + jelly.r + 13, "贴刺穿过去了");
      }

      if (h.type === "electric") {
        const active = electricActive(h);
        const gapCenter = h.gapX + Math.sin(game.time * 1.7 + h.phase) * 10;
        const inGap = Math.abs(jelly.x - gapCenter) < h.gapW * 0.5 - jelly.r * 0.35;
        const closeY = Math.abs(sy - jelly.y) < jelly.r + 8;
        if (active && closeY && !inGap) applyDamage("electric", jelly.x, jelly.y, "电弧命中");
        else if (active && Math.abs(sy - jelly.y) < 18 && inGap) nearMiss(h, 0, 10, "压着电弧空档过了");
      }

      if (h.type === "gate") {
        const gate = gateMetrics(h);
        const closeY = Math.abs(sy - jelly.y) < jelly.r + 10;
        const inGap = jelly.x > gate.gapL + jelly.r * 0.2 && jelly.x < gate.gapR - jelly.r * 0.2;
        if (closeY && gate.closed > 0.55 && !inGap) applyDamage("gate", jelly.x, sy, "贝门夹击");
        else if (closeY && inGap) nearMiss(h, 0, 10, "贝门夹缝钻过了");
      }

      if (h.type === "mine") {
        const d = dist(jelly.x, jelly.y, h.x, sy);
        const activeR = h.r + Math.max(0, Math.sin(game.time * 4.6 + h.phase)) * 10;
        const hitNote = h.seeker ? "追猎雷泡放电" : "雷泡放电";
        const missNote = h.seeker ? "追猎雷泡甩开了" : "雷泡边上甩开了";
        if (d < activeR + jelly.r * 0.48) applyDamage("mine", h.x, sy, hitNote);
        else nearMiss(h, d, activeR + jelly.r + 14, missNote);
      }

      if (h.type === "predator") {
        const d = dist(jelly.x, jelly.y, h.x, sy);
        if (d < h.r + jelly.r * 0.55) applyDamage("predator", h.x, sy, "猎光鱼追咬");
        else nearMiss(h, d, h.r + jelly.r + 16, "猎光鱼擦身甩开");
      }

      if (h.type === "comet") {
        const d = dist(jelly.x, jelly.y, h.x, sy);
        if (d < h.r + jelly.r * 0.46) applyDamage("comet", h.x, sy, "横流冲击");
        else nearMiss(h, d, h.r + jelly.r + 18, "横流擦过去了");
      }

      if (h.type === "bubble") {
        const d = dist(jelly.x, jelly.y, h.x, sy);
        if (!h.near && d < h.r + jelly.r) {
          h.near = true;
          jelly.vx *= 0.9;
          jelly.vy *= 0.9;
          applyDamage("bubble", h.x, sy, "泡泡陷阱");
        }
      }
    }

    if (game.health <= 0 && !game.crash) beginCrash("energy", jelly.x, jelly.y);
  }

  function nearMiss(h, d, threshold, text) {
    if (h.near || d > threshold || game.time - game.lastRescueAt < 2.2) return;
    h.near = true;
    game.lastRescueAt = game.time;
    game.lastHitText = "擦边躲过";
    game.lastHitTimer = 1.4;
    game.eventText = text;
    game.shock = Math.max(game.shock, 0.52);
    burst(jelly.x, jelly.y, highQuality ? 28 : 12, 188, 1.1);
    ring(jelly.x, jelly.y, 188, 0.7);
    floatText(jelly.x, jelly.y - 18, "擦边", 188);
  }

  function electricActive(h) {
    return Math.sin(game.time * 4.5 + h.phase) > -0.18 || h.finale;
  }

  function beginCrash(reason, x = jelly.x, y = jelly.y) {
    if (game.state === "crashed") return;
    game.state = "crashed";
    clearInputTelemetry("重启中");
    game.restartAt = performance.now() + 1000;
    game.crash = {
      reason,
      timer: 0,
      x,
      y,
      startX: jelly.x,
      startY: jelly.y,
      spin: jelly.spin,
    };
    game.mistakes += 1;
    hud.failReason.textContent = failReasons[reason] || "被水流卷走";
    hud.finalTime.textContent = formatTime(game.time);
    hud.finalDepth.textContent = `${game.depth}m`;
    hud.finalShield.textContent = String(Math.round(game.shield));
    burst(jelly.x, jelly.y, highQuality ? (reason === "shatter" ? 90 : 56) : 24, reason === "electric" ? 304 : 186, 1.35);
  }

  function updateCrash(dt) {
    if (!game.crash) return;
    game.crash.timer += dt;
    const c = game.crash;
    clearInputTelemetry("重启中");

    if (c.timer < 0) {
      game.time += dt;
      game.cameraY += 80 * dt;
      applyPhysics(dt * 0.7);
      updateHazards(dt);
      updateParticles(dt);
      updateHud();
      return;
    }

    if (c.reason === "blackhole") {
      const t = clamp(c.timer / 2.1, 0, 1);
      jelly.x = lerp(c.startX, c.x, t * t);
      jelly.y = lerp(c.startY, c.y, t * t);
      jelly.r = lerp(jelly.r, 3, t);
      jelly.spin += dt * 5.5;
    } else if (c.reason === "current") {
      const t = clamp(c.timer / 2.2, 0, 1);
      jelly.x = c.startX + Math.sin(t * TAU * 2.2) * (30 + t * 80);
      jelly.y = c.startY - t * H * 0.55;
      jelly.spin += dt * (5 + t * 13);
    } else if (c.reason === "energy") {
      jelly.energy = clamp(1 - c.timer / 2.2, 0, 1);
      jelly.r = lerp(jelly.r, 12, 0.05);
      jelly.y += dt * 24;
    } else {
      jelly.r = lerp(jelly.r, c.reason === "electric" ? 20 : 8, 0.08);
      jelly.spin += dt * 8;
    }

    updateParticles(dt);

    if (c.timer > 0.2) hud.resultPanel.classList.add("show");
    hud.restartHint.textContent = "1秒后重开";
    if (game.restartAt && performance.now() > game.restartAt) resetRound();
    updateHud();
  }

  function burst(x, y, count, hue, power = 1) {
    const maxParticles = highQuality ? 460 : 180;
    if (particles.length > maxParticles) particles.splice(0, particles.length - maxParticles);
    for (let i = 0; i < count; i += 1) {
      const a = rand(0, TAU);
      const s = rand(28, 150) * power;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        r: rand(1, 3.6) * power,
        hue: hue + rand(-22, 22),
        age: 0,
        life: rand(0.45, 1.25),
      });
    }
  }

  function ring(x, y, hue, power = 1) {
    if (rings.length > (highQuality ? 42 : 18)) rings.shift();
    rings.push({
      x,
      y,
      hue,
      age: 0,
      life: 0.58 + power * 0.18,
      radius: 8,
      speed: 118 * power,
      width: 2 + power * 2,
    });
  }

  function floatText(x, y, text, hue) {
    if (floaters.length > (highQuality ? 18 : 8)) floaters.shift();
    floaters.push({
      x,
      y,
      text,
      hue,
      age: 0,
      life: 0.9,
      vy: -42,
      seed: rand(0, TAU),
    });
  }

  function render() {
    drawBackground();
    drawCurrents();
    drawCave();
    drawCollectibles();
    drawHazards();
    drawTrails();
    drawParticles();
    drawRings();
    drawJelly();
    drawFloaters();
    drawWarnings();
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    const hueA = 218 + Math.sin(game.seed) * 18;
    const hueB = 276 + Math.cos(game.time * 0.08) * 26;
    g.addColorStop(0, `hsl(${hueA} 70% 5%)`);
    g.addColorStop(0.48, `hsl(${hueB} 68% 8%)`);
    g.addColorStop(1, `hsl(${180 + game.pressure * 40} 82% 6%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const star of stars) {
      const y = (star.y + game.cameraY * star.p * 0.22) % (H + 30);
      const pulse = 0.55 + Math.sin(game.time * 2 + star.x) * 0.35;
      ctx.fillStyle = `hsla(${star.h}, 94%, 72%, ${0.16 + pulse * 0.25})`;
      ctx.beginPath();
      ctx.arc(star.x, y - 15, star.r, 0, TAU);
      ctx.fill();
      if (game.pressure > 0.08 || game.zone === "rush") {
        ctx.strokeStyle = `hsla(${star.h}, 94%, 72%, ${0.06 + game.pressure * 0.06})`;
        ctx.lineWidth = Math.max(1, star.r * 0.8);
        ctx.beginPath();
        ctx.moveTo(star.x, y - 15);
        ctx.lineTo(star.x, y - 15 + 18 + game.pressure * 28);
        ctx.stroke();
      }
    }

    for (let i = 0; i < 9; i += 1) {
      const x = ((i + 0.5) / 9) * W;
      const sway = Math.sin(game.time * 0.25 + i * 1.9 + game.seed) * 24;
      ctx.strokeStyle = `hsla(${175 + i * 13}, 90%, 60%, ${0.035 + game.pressure * 0.015})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let y = -30; y <= H + 30; y += 42) {
        const px = x + sway + Math.sin(y * 0.012 + game.time + i) * 28;
        if (y === -30) ctx.moveTo(px, y);
        else ctx.lineTo(px, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCave() {
    const leftPts = [];
    const rightPts = [];
    for (let y = -80; y <= H + 80; y += 18) {
      const c = caveAt(game.cameraY + y);
      leftPts.push({ x: c.left, y });
      rightPts.push({ x: c.right, y });
    }

    const wall = ctx.createLinearGradient(0, 0, W, 0);
    wall.addColorStop(0, "rgba(0, 0, 0, 0.74)");
    wall.addColorStop(0.42, "rgba(5, 12, 34, 0.34)");
    wall.addColorStop(0.58, "rgba(5, 12, 34, 0.34)");
    wall.addColorStop(1, "rgba(0, 0, 0, 0.74)");

    ctx.fillStyle = wall;
    ctx.beginPath();
    ctx.moveTo(0, -90);
    for (const p of leftPts) ctx.lineTo(p.x, p.y);
    ctx.lineTo(0, H + 90);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(W, -90);
    for (const p of rightPts) ctx.lineTo(p.x, p.y);
    ctx.lineTo(W, H + 90);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowBlur = fx(18);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(94, 249, 255, 0.44)";
    ctx.shadowColor = "rgba(79, 242, 255, 0.85)";
    strokePts(leftPts);
    strokePts(rightPts);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255, 83, 214, 0.22)";
    ctx.shadowColor = "rgba(255, 83, 214, 0.65)";
    strokePts(leftPts.map((p, i) => ({ x: p.x + Math.sin(i + game.time) * 5, y: p.y })));
    strokePts(rightPts.map((p, i) => ({ x: p.x + Math.cos(i + game.time) * 5, y: p.y })));
    ctx.restore();
  }

  function strokePts(points) {
    ctx.beginPath();
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
  }

  function drawCurrents() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const c of currents) {
      const sy = c.y - game.cameraY;
      if (sy < -120 || sy > H + 120) continue;
      const alpha = clamp(c.life / 6, 0, 1) * 0.18;
      ctx.strokeStyle = `hsla(${c.hue}, 95%, 68%, ${alpha})`;
      ctx.lineWidth = 8;
      ctx.lineCap = "round";
      for (let i = -2; i <= 2; i += 1) {
        ctx.beginPath();
        const y = sy + i * 18;
        for (let t = 0; t <= 1; t += 0.1) {
          const x = c.x - c.w * 0.5 + c.w * t;
          const yy = y + Math.sin(t * TAU * 1.2 + game.time * 3 + i) * 10;
          if (t === 0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawCollectibles() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const item of collectibles) {
      const sy = item.y - game.cameraY;
      if (sy < -40 || sy > H + 40) continue;
      const pulse = 0.82 + Math.sin(game.time * 6.4 + item.x) * 0.24;
      const r = item.r * pulse;
      ctx.shadowBlur = fx(18 + item.value * 8);
      ctx.shadowColor = `hsl(${item.hue} 96% 70%)`;
      ctx.strokeStyle = `hsla(${item.hue}, 98%, 72%, ${0.28 + item.value * 0.08})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(item.x, sy, r * (2.2 + item.value * 0.45), 0, TAU);
      ctx.stroke();
      ctx.fillStyle = `hsla(${item.hue}, 98%, 68%, 0.9)`;
      drawRewardShape(item, sy, r);
    }
    ctx.restore();
  }

  function drawRewardShape(item, sy, r) {
    ctx.beginPath();
    if (item.kind === "heal") {
      ctx.moveTo(item.x, sy + r * 0.85);
      ctx.bezierCurveTo(item.x - r * 1.35, sy - r * 0.05, item.x - r * 0.85, sy - r * 1.2, item.x, sy - r * 0.42);
      ctx.bezierCurveTo(item.x + r * 0.85, sy - r * 1.2, item.x + r * 1.35, sy - r * 0.05, item.x, sy + r * 0.85);
    } else if (item.kind === "shield") {
      ctx.moveTo(item.x, sy - r * 1.2);
      ctx.lineTo(item.x + r * 1.05, sy - r * 0.35);
      ctx.lineTo(item.x + r * 0.72, sy + r * 1.05);
      ctx.lineTo(item.x, sy + r * 1.32);
      ctx.lineTo(item.x - r * 0.72, sy + r * 1.05);
      ctx.lineTo(item.x - r * 1.05, sy - r * 0.35);
      ctx.closePath();
    } else {
      for (let i = 0; i < 5; i += 1) {
        const a = -Math.PI / 2 + (i / 5) * TAU;
        const px = item.x + Math.cos(a) * r * (i % 2 ? 0.58 : 1.1);
        const py = sy + Math.sin(a) * r * (i % 2 ? 0.58 : 1.1);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }
    ctx.fill();
  }

  function drawHazards() {
    for (const h of hazards) {
      const sy = h.y - game.cameraY;
      if (sy < -150 || sy > H + 150) continue;
      if (h.type === "blackhole") drawBlackhole(h, sy);
      if (h.type === "crystal") drawCrystal(h, sy);
      if (h.type === "electric") drawElectric(h, sy);
      if (h.type === "gate") drawGate(h, sy);
      if (h.type === "mine") drawMine(h, sy);
      if (h.type === "predator") drawPredator(h, sy);
      if (h.type === "comet") drawComet(h, sy);
      if (h.type === "bubble") drawBubble(h, sy);
      drawHazardLabel(h, sy);
    }
  }

  function drawHazardLabel(h, sy) {
    const source =
      h.type === "crystal"
        ? "crystal"
        : h.type === "gate"
          ? "gate"
          : h.type === "mine"
            ? "mine"
            : h.type === "predator"
              ? "predator"
              : h.type === "comet"
                ? "comet"
                : h.type;
    const rule = damageRules[source];
    if (!rule) return;
    const x = h.x ?? h.gapX ?? W * 0.5;
    const tail = rule.consequence && rule.consequence !== "无负面" ? ` ${rule.consequence.replace(/[0-9.]+s/g, "")}` : "";
    const text = rule.amount > 0 ? `-${rule.amount} ${rule.label}${tail}` : rule.label;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.font = "700 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(2, 7, 18, 0.68)";
    const width = Math.max(42, text.length * 10);
    ctx.fillRect(x - width / 2, sy - 36, width, 18);
    ctx.fillStyle = `hsl(${rule.hue} 96% 74%)`;
    ctx.fillText(text, x, sy - 27);
    ctx.restore();
  }

  function drawBlackhole(h, sy) {
    ctx.save();
    ctx.translate(h.x, sy);
    ctx.rotate(h.phase);
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowBlur = fx(28);
    ctx.shadowColor = "rgba(255, 54, 214, 0.75)";
    for (let i = 0; i < 4; i += 1) {
      ctx.strokeStyle = `hsla(${286 + i * 22}, 92%, ${62 - i * 7}%, ${0.36 - i * 0.06})`;
      ctx.lineWidth = 2 + i;
      ctx.beginPath();
      ctx.ellipse(0, 0, h.r + i * 11, h.r * 0.58 + i * 6, i * 0.7, 0.3, TAU * 0.86);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, h.r * 1.1);
    g.addColorStop(0, "rgba(0, 0, 0, 1)");
    g.addColorStop(0.58, "rgba(2, 0, 10, 0.98)");
    g.addColorStop(1, "rgba(82, 0, 84, 0.08)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, h.r * 1.1, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawCrystal(h, sy) {
    ctx.save();
    ctx.translate(h.x, sy);
    ctx.rotate(Math.sin(h.phase) * 0.18);
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowBlur = fx(18);
    ctx.shadowColor = "rgba(255, 78, 186, 0.8)";
    const g = ctx.createLinearGradient(-h.r, -h.r, h.r, h.r);
    g.addColorStop(0, "rgba(255, 139, 224, 0.86)");
    g.addColorStop(0.5, "rgba(126, 252, 255, 0.54)");
    g.addColorStop(1, "rgba(255, 255, 255, 0.18)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -h.r * 1.18);
    ctx.lineTo(h.r * 0.82 * -h.side, -h.r * 0.12);
    ctx.lineTo(h.r * 0.3 * -h.side, h.r * 1.05);
    ctx.lineTo(h.r * 0.92 * h.side, h.r * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.38)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawElectric(h, sy) {
    const c = caveAt(h.y);
    const active = electricActive(h);
    const gapCenter = h.gapX + Math.sin(game.time * 1.7 + h.phase) * 10;
    const gapL = gapCenter - h.gapW * 0.5;
    const gapR = gapCenter + h.gapW * 0.5;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.shadowBlur = fx(active ? 18 : 6);
    ctx.shadowColor = active ? "rgba(255, 71, 218, 0.9)" : "rgba(95, 236, 255, 0.35)";
    ctx.strokeStyle = active ? "rgba(255, 99, 224, 0.88)" : "rgba(105, 232, 255, 0.22)";
    ctx.lineWidth = active ? 3 : 1;
    bolt(c.left + 4, sy, gapL, sy, h.phase);
    bolt(gapR, sy, c.right - 4, sy, h.phase + 2);
    ctx.strokeStyle = "rgba(125, 250, 255, 0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(gapCenter, sy, h.gapW * 0.46, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function bolt(x1, y1, x2, y2, phase) {
    const steps = 8;
    ctx.beginPath();
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = lerp(x1, x2, t);
      const y = lerp(y1, y2, t) + Math.sin(t * TAU * 2 + phase + game.time * 17) * rand(2, 8);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawBubble(h, sy) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowBlur = fx(18);
    ctx.shadowColor = "rgba(112, 239, 255, 0.55)";
    ctx.strokeStyle = "rgba(151, 250, 255, 0.34)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(h.x, sy, h.r + Math.sin(h.phase) * 2, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = "rgba(91, 238, 255, 0.045)";
    ctx.fill();
    ctx.restore();
  }

  function drawGate(h, sy) {
    const c = caveAt(h.y);
    const gate = gateMetrics(h);
    const jaw = 18 + gate.closed * 26;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowBlur = fx(18);
    ctx.shadowColor = "rgba(255, 226, 102, 0.72)";
    ctx.fillStyle = "rgba(255, 214, 116, 0.22)";
    ctx.strokeStyle = "rgba(255, 235, 152, 0.66)";
    ctx.lineWidth = 2;

    drawJaw(c.left, gate.gapL, sy, jaw, -1);
    drawJaw(gate.gapR, c.right, sy, jaw, 1);

    ctx.strokeStyle = "rgba(143, 252, 255, 0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(gate.gapCenter, sy, gate.gapW * 0.44, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawJaw(x1, x2, y, jaw, side) {
    const teeth = 6;
    ctx.beginPath();
    ctx.moveTo(x1, y - jaw);
    for (let i = 0; i <= teeth; i += 1) {
      const x = lerp(x1, x2, i / teeth);
      const yy = y + (i % 2 === 0 ? jaw * side * 0.16 : jaw * side);
      ctx.lineTo(x, yy);
    }
    ctx.lineTo(x2, y + jaw);
    ctx.lineTo(x1, y + jaw * 0.66);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function drawMine(h, sy) {
    const pulse = Math.max(0, Math.sin(game.time * 4.6 + h.phase));
    const r = h.r + pulse * 8;
    const chasing = h.seeker && h.chaseState === "chasing";
    ctx.save();
    ctx.translate(h.x, sy);
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowBlur = fx(24);
    ctx.shadowColor = chasing ? "rgba(255, 180, 55, 0.9)" : "rgba(255, 64, 196, 0.85)";
    ctx.strokeStyle = chasing ? `rgba(255, 185, 68, ${0.28 + pulse * 0.48})` : `rgba(255, 87, 207, ${0.18 + pulse * 0.42})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r + 10, 0, TAU);
    ctx.stroke();
    if (h.seeker) {
      ctx.setLineDash(chasing ? [5, 4] : [2, 5]);
      ctx.strokeStyle = chasing ? "rgba(255, 216, 118, 0.72)" : "rgba(255, 216, 118, 0.24)";
      ctx.beginPath();
      ctx.arc(0, 0, r + 20 + Math.sin(game.time * 7) * 3, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = "rgba(12, 3, 20, 0.88)";
    ctx.beginPath();
    ctx.arc(0, 0, h.r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 241, 117, 0.72)";
    for (let i = 0; i < 8; i += 1) {
      const a = h.phase + (i / 8) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * h.r * 0.7, Math.sin(a) * h.r * 0.7);
      ctx.lineTo(Math.cos(a) * (h.r + 8 + pulse * 8), Math.sin(a) * (h.r + 8 + pulse * 8));
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(255, 246, 130, ${0.52 + pulse * 0.36})`;
    ctx.beginPath();
    ctx.arc(0, 0, h.r * 0.32, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawPredator(h, sy) {
    const chasing = h.chaseState === "chasing";
    const angle = Math.atan2(h.vy, h.vx || h.side);
    ctx.save();
    ctx.translate(h.x, sy);
    ctx.rotate(angle);
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowBlur = fx(chasing ? 24 : 14);
    ctx.shadowColor = chasing ? "rgba(255, 135, 54, 0.88)" : "rgba(255, 195, 92, 0.42)";
    ctx.fillStyle = chasing ? "rgba(255, 126, 58, 0.82)" : "rgba(255, 192, 92, 0.42)";
    ctx.strokeStyle = "rgba(255, 238, 166, 0.62)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(h.r * 1.55, 0);
    ctx.quadraticCurveTo(h.r * 0.15, -h.r * 0.95, -h.r * 1.2, -h.r * 0.42);
    ctx.quadraticCurveTo(-h.r * 0.55, 0, -h.r * 1.2, h.r * 0.42);
    ctx.quadraticCurveTo(h.r * 0.15, h.r * 0.95, h.r * 1.55, 0);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(20, 3, 9, 0.9)";
    ctx.beginPath();
    ctx.arc(h.r * 0.55, -h.r * 0.18, h.r * 0.14, 0, TAU);
    ctx.fill();
    if (chasing) {
      ctx.rotate(-angle);
      ctx.setLineDash([7, 6]);
      ctx.strokeStyle = "rgba(255, 212, 102, 0.38)";
      ctx.beginPath();
      ctx.arc(0, 0, h.r * 2.1 + Math.sin(game.time * 8) * 3, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawComet(h, sy) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.shadowBlur = fx(20);
    ctx.shadowColor = `hsla(${h.hue}, 96%, 66%, 0.86)`;
    const tail = clamp(Math.abs(h.vx) * 0.46, 42, 92);
    const dir = h.vx > 0 ? -1 : 1;
    const g = ctx.createLinearGradient(h.x + dir * tail, sy, h.x, sy);
    g.addColorStop(0, `hsla(${h.hue}, 96%, 66%, 0)`);
    g.addColorStop(1, `hsla(${h.hue}, 96%, 70%, 0.86)`);
    ctx.strokeStyle = g;
    ctx.lineWidth = h.r * 1.35;
    ctx.beginPath();
    ctx.moveTo(h.x + dir * tail, sy - h.vy * 0.16);
    ctx.lineTo(h.x, sy);
    ctx.stroke();
    ctx.fillStyle = `hsla(${h.hue}, 96%, 74%, 0.95)`;
    ctx.beginPath();
    ctx.arc(h.x, sy, h.r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawTrails() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const t of trails) {
      const life = 1 - t.age / t.life;
      ctx.fillStyle = `hsla(${t.hue}, 96%, 66%, ${life * 0.25})`;
      ctx.shadowBlur = fx(16 * life);
      ctx.shadowColor = `hsl(${t.hue} 96% 66%)`;
      ctx.beginPath();
      ctx.ellipse(t.x, t.y, t.r * (0.9 + life), t.r * (1.4 + life * 2.2), 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of particles) {
      const life = 1 - p.age / p.life;
      ctx.fillStyle = `hsla(${p.hue}, 96%, 68%, ${life * 0.86})`;
      ctx.shadowBlur = fx(12 * life);
      ctx.shadowColor = `hsl(${p.hue} 96% 70%)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * life, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRings() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const r of rings) {
      const life = 1 - r.age / r.life;
      ctx.strokeStyle = `hsla(${r.hue}, 96%, 68%, ${life * 0.62})`;
      ctx.lineWidth = r.width * life;
      ctx.shadowBlur = fx(18 * life);
      ctx.shadowColor = `hsl(${r.hue} 96% 68%)`;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFloaters() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const f of floaters) {
      const life = 1 - f.age / f.life;
      ctx.globalAlpha = life;
      ctx.font = `700 ${Math.round(15 + life * 5)}px sans-serif`;
      ctx.shadowBlur = fx(18);
      ctx.shadowColor = `hsl(${f.hue} 96% 68%)`;
      ctx.fillStyle = `hsl(${f.hue} 96% 76%)`;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }

  function drawJelly() {
    if (game.crash && game.crash.reason === "shatter" && game.crash.timer > 0.42) return;

    const pulse = 1 + Math.sin(game.time * 5.2) * 0.035 + game.rewardPulse * 0.12;
    const squash = clamp(Math.abs(jelly.vx) / 380 + Math.abs(jelly.vy) / 520, 0, 0.28);
    const alpha = game.crash && game.crash.reason === "energy" ? jelly.energy : 1;

    ctx.save();
    ctx.translate(jelly.x, jelly.y);
    ctx.rotate(jelly.spin);
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowBlur = fx(28 * jelly.glow);
    ctx.shadowColor = "rgba(89, 250, 255, 0.92)";

    if (game.shield > 0 || game.essenceGuardTimer > 0) {
      const shieldRatio = clamp(game.shield / game.maxShield, 0, 1);
      ctx.strokeStyle = game.essenceGuardTimer > 0 ? "rgba(255, 245, 111, 0.58)" : `rgba(125, 253, 255, ${0.22 + shieldRatio * 0.34})`;
      ctx.lineWidth = 2 + shieldRatio * 2;
      ctx.beginPath();
      ctx.arc(0, -jelly.r * 0.16, jelly.r * (1.32 + shieldRatio * 0.28), 0, TAU);
      ctx.stroke();
    }

    for (let i = -3; i <= 3; i += 1) {
      const baseX = i * jelly.r * 0.22;
      const sway = Math.sin(game.time * 4 + i) * jelly.r * 0.28 + jelly.vx * 0.04;
      const len = jelly.r * (1.7 + Math.abs(i) * 0.17 + (keys.boost ? 0.7 : 0));
      ctx.strokeStyle = `hsla(${184 + i * 12}, 96%, 68%, ${0.34 - Math.abs(i) * 0.028})`;
      ctx.lineWidth = 2.2 - Math.abs(i) * 0.18;
      ctx.beginPath();
      ctx.moveTo(baseX, jelly.r * 0.45);
      ctx.bezierCurveTo(baseX + sway, jelly.r, baseX - sway * 0.7, len, baseX + sway * 0.45, len * 1.18);
      ctx.stroke();
    }

    ctx.scale(1 + squash * 0.8, pulse - squash * 0.28);
    const body = ctx.createRadialGradient(-jelly.r * 0.28, -jelly.r * 0.42, jelly.r * 0.1, 0, 0, jelly.r * 1.25);
    body.addColorStop(0, "rgba(255, 255, 255, 0.92)");
    body.addColorStop(0.2, "rgba(157, 252, 255, 0.86)");
    body.addColorStop(0.68, "rgba(87, 175, 255, 0.36)");
    body.addColorStop(1, "rgba(255, 88, 219, 0.16)");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-jelly.r * 1.04, jelly.r * 0.25);
    ctx.bezierCurveTo(-jelly.r * 1.02, -jelly.r * 0.86, -jelly.r * 0.42, -jelly.r * 1.18, 0, -jelly.r * 1.2);
    ctx.bezierCurveTo(jelly.r * 0.68, -jelly.r * 1.1, jelly.r * 1.05, -jelly.r * 0.58, jelly.r * 1.02, jelly.r * 0.22);
    ctx.bezierCurveTo(jelly.r * 0.68, jelly.r * 0.48, jelly.r * 0.35, jelly.r * 0.35, 0, jelly.r * 0.52);
    ctx.bezierCurveTo(-jelly.r * 0.35, jelly.r * 0.34, -jelly.r * 0.7, jelly.r * 0.5, -jelly.r * 1.04, jelly.r * 0.25);
    ctx.fill();
    ctx.strokeStyle = "rgba(227, 255, 255, 0.7)";
    ctx.lineWidth = 1.3;
    ctx.stroke();

    ctx.fillStyle = "rgba(3, 19, 32, 0.62)";
    ctx.beginPath();
    ctx.arc(-jelly.r * 0.28, -jelly.r * 0.2, jelly.r * 0.08, 0, TAU);
    ctx.arc(jelly.r * 0.28, -jelly.r * 0.2, jelly.r * 0.08, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawWarnings() {
    const finale = clamp((game.time - game.finaleAt) / Math.max(1, game.failAt - game.finaleAt), 0, 1);
    if (finale <= 0 && game.state !== "crashed" && game.shock <= 0) return;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const alpha = game.state === "crashed" ? 0.24 : finale * (0.12 + Math.sin(game.time * 12) * 0.04) + game.shock * 0.08;
    ctx.strokeStyle = `rgba(255, 72, 196, ${alpha})`;
    ctx.lineWidth = 10 + finale * 10 + game.shock * 8;
    ctx.strokeRect(5, 5, W - 10, H - 10);
    ctx.restore();
  }

  function updateHud() {
    hud.survival.textContent = formatTime(game.time);
    hud.depth.textContent = `${game.depth}m`;
    hud.healthText.textContent = String(Math.round(game.health));
    hud.shieldText.textContent = String(Math.round(game.shield));
    hud.hitReadout.textContent = game.lastHitText;
    hud.debuffReadout.textContent = debuffSummary();
    const zone = zones.find((item) => item.key === game.zone);
    hud.zoneName.textContent = zone ? zone.label : "梦海漂流";

    const panic = clamp((game.time - game.finaleAt) / Math.max(1, game.failAt - game.finaleAt), 0, 1);
    const healthRatio = clamp(game.health / game.maxHealth, 0, 1);
    hud.meterFill.style.transform = `scaleX(${healthRatio})`;
    hud.meterFill.parentElement.classList.toggle("danger", healthRatio < 0.34);
    const buffText = game.essenceGuardTimer > 0 ? `净化：${Math.ceil(game.essenceGuardTimer)}s` : hasDebuff() ? debuffSummary().replace("负面：", "") : "状态：清爽";
    hud.feel.textContent = buffText;
    const armorReduction = clamp((game.fractureTimer > 0 ? game.shield * 0.45 : game.shield) / 180, 0, 0.5);
    hud.mistakes.textContent = `护甲减伤：${Math.round(armorReduction * 100)}%`;
    hud.eventChip.textContent = game.eventText;
    hud.commandLine.textContent = game.commandText;
    hud.comboLabel.textContent = game.rewardCombo > 0 ? `连吃 x${game.rewardCombo}` : game.lastRewardText;
    hud.pilotCard.classList.toggle("hot", game.danger > 0.46 || game.shock > 0.1);

    const tx = game.controlX * 42;
    const ty = game.controlY * 24;
    const len = clamp(Math.hypot(game.controlX, game.controlY), 0.1, 1.15);
    const angle = Math.atan2(game.controlY, game.controlX);
    const thumbScale = 1 + (keys.boost ? 0.22 : 0) + game.danger * 0.08;
    hud.gestureThumb.style.transform = `translate(${tx}px, ${ty}px) scale(${thumbScale})`;
    hud.gestureLine.style.transform = `translateY(-50%) rotate(${angle}rad) scaleX(${0.35 + len * 1.12})`;
    hud.gesturePad.style.borderColor = game.danger > 0.5 ? "rgba(255, 92, 216, 0.58)" : "rgba(141, 242, 255, 0.22)";

    for (const btn of hud.keys) {
      const key = btn.dataset.key;
      btn.classList.toggle("active", Boolean(keys[key]));
    }
  }

  function loop(now) {
    if (document.hidden) {
      lastFrame = now;
      requestAnimationFrame(loop);
      return;
    }
    if (now - lastDraw < targetFrameMs) {
      requestAnimationFrame(loop);
      return;
    }
    const dt = Math.min(highQuality ? 0.033 : 0.05, (now - lastFrame) / 1000 || 0.016);
    lastFrame = now;
    lastDraw = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("pointerdown", (event) => {
    touch.active = true;
    touch.x0 = event.clientX;
    touch.y0 = event.clientY;
    touch.x = event.clientX;
    touch.y = event.clientY;
    touch.last = game.time;
  });
  window.addEventListener("pointermove", (event) => {
    if (!touch.active) return;
    touch.x = event.clientX;
    touch.y = event.clientY;
    touch.last = game.time;
  });
  window.addEventListener("pointerup", () => {
    touch.active = false;
    touch.last = game.time;
  });
  window.addEventListener("pointercancel", () => {
    touch.active = false;
    touch.last = game.time;
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "KeyA" || event.code === "ArrowLeft") keyboard.left = true;
    if (event.code === "KeyD" || event.code === "ArrowRight") keyboard.right = true;
    if (event.code === "KeyW" || event.code === "ArrowUp") keyboard.up = true;
    if (event.code === "KeyS" || event.code === "ArrowDown") keyboard.down = true;
    if (event.code === "Space") keyboard.boost = true;
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") keyboard.brake = true;
  });

  window.addEventListener("keyup", (event) => {
    if (event.code === "KeyA" || event.code === "ArrowLeft") keyboard.left = false;
    if (event.code === "KeyD" || event.code === "ArrowRight") keyboard.right = false;
    if (event.code === "KeyW" || event.code === "ArrowUp") keyboard.up = false;
    if (event.code === "KeyS" || event.code === "ArrowDown") keyboard.down = false;
    if (event.code === "Space") keyboard.boost = false;
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") keyboard.brake = false;
  });

  resize();
  resetRound();
  requestAnimationFrame(loop);
})();
