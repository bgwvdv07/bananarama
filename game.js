window.addEventListener("keydown", function(ev) {
  console.log("Raw event:", ev);
});


const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const socket = io();

const endGif = new Image();
endGif.src = "./public/8bit.gif"; // your premade GIF

const bananas = [];
const bananaImg = new Image();
bananaImg.src = "public/banana.png"; // your banana sprite


let glowPulse = 0;
let glowHue = 0;
let gridState = "tunnel"; // "plane", "wave", "cube"
let morphing = false;
let morphStartTime = 0;
let morphDuration = 1000; // ms, ~1s smooth morph

function easeInOut(t) {
  return t * t * (3 - 2 * t);  // smoothstep
}


window.addEventListener("keydown", (ev) => {
  if (ev.key === "1") gridState = "tunnel";
  if (ev.key === "2") gridState = "plane";
  if (ev.key === "3") gridState = "wave";
  if (ev.key === "4") gridState = "sphere";
  if (ev.key === "5") gridState = "cube";
  if (ev.key === "6") gridState = "spiral";
  if (ev.key === "7") gridState = "checker";
  if (ev.key === "8") gridState = "breath";

  console.log("Grid state switched to:", gridState);

  tunnelPoints.forEach(p => setGridPosition(p, p.col, p.row, performance.now()));
  morphing = true;
  morphStartTime = performance.now();
});




// --- Menu ---
let role = null;
function chooseRole(r){ role = r; }
function startGame(){ document.getElementById("menu").style.display = "none"; }



// ---- Tunnel: coherent stochastic motion (replace your tunnel section) ----
const cols = 16, rows = 16, tunnelDepth = 2000, tunnelRadius = 200, speed = 4;
let cameraZ = 0, fieldHue = 180;
const tunnelPoints = [];

// --- seeded PRNG so you can reproduce motion if you want ---
function mulberry32(a) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}
const rng = mulberry32(12345678); // change seed for different variations

// --- OU process helper (simple discrete Ornstein-Uhlenbeck) ---
function makeOU(theta = 0.02, mu = 0, sigma = 0.6) {
  return {
    x: 0,
    theta,
    mu,
    sigma,
    step(dt = 1) {
      // Euler discretization
      const dx = this.theta * (this.mu - this.x) * dt + this.sigma * Math.sqrt(dt) * (rng() * 2 - 1);
      this.x += dx;
      return this.x;
    }
  };
}

// initialize points and OU states for coherence
const colOU = makeOU(0.01, 0, 0.3);
const rowOU = makeOU(0.01, 0, 0.3);


// per-column/per-row phase offsets so things don't all align
const colPhase = new Array(cols).fill(0).map(_ => rng() * Math.PI * 2);
const rowPhase = new Array(rows).fill(0).map(_ => rng() * Math.PI * 2);


/* 
// Build tunnel grid points (same as before but store col/row indices)
for (let i = 0; i < cols; i++) {
  for (let j = 0; j < rows; j++) {
    const angle = (i / (cols - 1)) * Math.PI * 2;
    tunnelPoints.push({
      baseX: Math.cos(angle) * tunnelRadius,
      baseY: Math.sin(angle) * tunnelRadius,
      z: j * (tunnelDepth / rows),
      col: i,
      row: j,
      // keep a stable baseline to perturb from
      bx: Math.cos(angle) * tunnelRadius,
      by: Math.sin(angle) * tunnelRadius
    });
  }
}
 
 */
 
 // --- Build tunnel grid points ---
for (let i = 0; i < cols; i++) {
  for (let j = 0; j < rows; j++) {
    const p = {
  col: i,
  row: j,
  z: j * (tunnelDepth / rows) + cameraZ,  // current Z
  bx: 0, by: 0,                           // current X/Y
  tx: 0, ty: 0,                           // target X/Y
  tz: 0                                   // target Z
};
    setGridPosition(p, i, j, 0); // initialize according to current gridState
    p.bx = p.tx;
p.by = p.ty;
p.z  = p.tz; // start current = target
    tunnelPoints.push(p);
  }
}
 

function setGridPosition(p, i, j, time) {
  const cellSize = 40;

  if (gridState === "tunnel") {
    const angle = (i / (cols - 1)) * Math.PI * 2;
    p.tx = Math.cos(angle) * tunnelRadius;
    p.ty = Math.sin(angle) * tunnelRadius;
    p.tz = j * (tunnelDepth / rows) + cameraZ;   // stacked tunnel depth
  } 
  else if (gridState === "plane") {
    p.tx = (i - cols/2) * cellSize;
    p.ty = (j - rows/2) * cellSize;
    p.tz = j * (tunnelDepth / rows) + cameraZ; // keep tunnel Z// push forward so closest row ≈ tunnel front
  } 
  else if (gridState === "wave") {
    p.tx = (i - cols/2) * cellSize;
    p.ty = (j - rows/2) * cellSize + Math.sin(i * 0.5 + time * 0.002) * 40;
     p.tz = j * (tunnelDepth / rows) + cameraZ; // same as plane but wavy Y
  }
  else if (gridState === "sphere") {
  const u = i / (cols - 1); // 0 → 1
  const v = j / (rows - 1); // 0 → 1
  const theta = u * Math.PI * 2;
  const phi = v * Math.PI;
  const r = tunnelRadius; // reuse radius
  p.tx = Math.sin(phi) * Math.cos(theta) * r;
  p.ty = Math.cos(phi) * r;
  p.tz = Math.sin(phi) * Math.sin(theta) * r + cameraZ + tunnelDepth/2;
}
else if (gridState === "cube") {
  const cellSize = 40;
  const face = Math.floor(i / (cols / 6)); // pick one of 6 cube faces
  const localI = i % (cols / 6);
  const x = (localI - (cols/12)) * cellSize;
  const y = (j - rows/2) * cellSize;
  const half = tunnelRadius;

  if (face === 0) { p.tx =  half; p.ty = y;    p.tz = x; }
  if (face === 1) { p.tx = -half; p.ty = y;    p.tz = -x; }
  if (face === 2) { p.tx = x;     p.ty =  half; p.tz = y; }
  if (face === 3) { p.tx = x;     p.ty = -half; p.tz = -y; }
  if (face === 4) { p.tx = x;     p.ty = y;    p.tz =  half; }
  if (face === 5) { p.tx = -x;    p.ty = y;    p.tz = -half; }
}
else if (gridState === "spiral") {
  const angle = (i / (cols - 1)) * Math.PI * 4; // multiple rotations
  const radius = tunnelRadius * (j / rows);     // tighter near start
  p.tx = Math.cos(angle) * radius;
  p.ty = Math.sin(angle) * radius;
  p.tz = j * (tunnelDepth / rows) + cameraZ;
}
else if (gridState === "checker") {
  const cellSize = 40;
  p.tx = (i - cols/2) * cellSize;
  p.ty = (j - rows/2) * cellSize;
  p.tz = cameraZ + ( (i + j) % 2 === 0 ? 200 : 400 );
}
else if (gridState === "breath") {
  p.tx = (i / (cols - 1) - 0.5) * canvas.width;

  const baseY = (j / (rows - 1) - 0.5) * canvas.height;

  // Slow breathing oscillation — subtle wave
  const breathPhase = time * 0.0015; // slower than "wave"
  const waveOffset = Math.sin(i * 0.3 + breathPhase) * 20; // smaller amplitude

  p.ty = baseY + waveOffset;

  // Reuse tunnel-style depth so it flows forward infinitely
  p.tz = j * (tunnelDepth / rows) + cameraZ;
}


}




// ---- Perlin Noise Implementation ----
const PERM = new Uint8Array(512);
(function initPerm() {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
})();

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a, b, t) { return a + t * (b - a); }
function grad(hash, x, y) {
  const h = hash & 3;
  const u = h < 2 ? x : y;
  const v = h < 2 ? y : x;
  return ((h & 1) ? -u : u) + ((h & 2) ? -2.0 * v : 2.0 * v);
}

// 2D Perlin noise
function perlin2(x, y) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  x -= Math.floor(x);
  y -= Math.floor(y);
  const u = fade(x), v = fade(y);

  const A = PERM[X] + Y, B = PERM[X + 1] + Y;
  return lerp(
    lerp(grad(PERM[A], x, y), grad(PERM[B], x - 1, y), u),
    lerp(grad(PERM[A + 1], x, y - 1), grad(PERM[B + 1], x - 1, y - 1), u),
    v
  );
}

// ---- Updated STOCH config ----
const STOCH = {
  globalWaveAmp: 20,
  columnAmp: 10,
  rowAmp: 6,
  jitterAmp: 0.5,
  timeScale: 0.0009,
  ouDt: 0.7,
  OUweight: 0.5,        // blend OU-based distortion
  PerlinWeight: 0.3,    // blend Perlin-based distortion
  perlinScale: 0.02     // zoom of Perlin field
};

// ---- Updated distortion using both OU + Perlin ----
function applyCoherentDistortion(p, time) {
  // OU-driven column & row coherence
  const colNoise = colOU.step(STOCH.ouDt);
  const rowNoise = rowOU.step(STOCH.ouDt);
  

  // Perlin-driven smooth field
  const scale = STOCH.perlinScale;
  const px = (p.bx + time * 0.05) * scale;
  const py = (p.by + p.z * 0.01 + time * 0.03) * scale;
  const n = perlin2(px, py);

  // Random jitter (closer to camera = more jitter)
  const jitter = (rng() * 2 - 1) * STOCH.jitterAmp * Math.min(1, (p.z - cameraZ) / 800 + 0.2);

  // Blend OU + Perlin fields
  const dx = STOCH.OUweight * colTerm * STOCH.columnAmp +
             STOCH.PerlinWeight * n * STOCH.globalWaveAmp;
  const dy = STOCH.OUweight * rowTerm * STOCH.rowAmp +
             STOCH.PerlinWeight * n * STOCH.globalWaveAmp * 0.6;

  p.baseX = p.bx + dx + jitter;
  p.baseY = p.by + dy + jitter * 0.6;
}

// small helper: layered sinusoids for smooth fields (coherent across space)
function layeredWaves(x, y, z, t) {
  // combine a few sinusoids with different frequencies
  let v = 0;
  v += Math.sin(x * 0.008 + t * 0.0007 + z * 0.0006);
  v += 0.6 * Math.sin(y * 0.006 + t * 0.0009 + z * 0.0009 + 1.57);
  v += 0.4 * Math.sin((x + y) * 0.004 + t * 0.0015 + z * 0.0004);
  return v;
}

// Apply coherent stochastic distortion to a point
function applyCoherentDistortion(p, time) {
  // step OU processes for the column and row (coherent low-frequency noise)
  const colNoise = colOU.step(STOCH.ouDt);
  const rowNoise = rowOU.step(STOCH.ouDt);
  
  // Global breathing (smooth sinusoidal motion)
const globalSwayX = Math.sin(time * 0.0003) * 20;  // slow left/right wave
const globalSwayY = Math.cos(time * 0.00025) * 15; // slow up/down wave

  // layered long-wave field
  const wave = layeredWaves(p.bx, p.by, p.z, time * STOCH.timeScale);

  // combine: base + column-driven x shift + row-driven y shift + wave + small jitter
  const colTerm = Math.sin(colPhase[p.col] + time * 0.0006 + p.z * 0.0005) * (1 + colNoise);
  const rowTerm = Math.cos(rowPhase[p.row] + time * 0.0004 + p.z * 0.0003) * (1 + rowNoise);

  const jitter = (rng() * 2 - 1) * STOCH.jitterAmp * Math.min(1, (p.z - cameraZ) / 800 + 0.2); // more jitter near viewer

  /* 
p.baseX = p.bx + colTerm * STOCH.columnAmp + wave * STOCH.globalWaveAmp + jitter;
  p.baseY = p.by + rowTerm * STOCH.rowAmp + wave * STOCH.globalWaveAmp * 0.5 + jitter * 0.6;
 */
  
  // Final position = base + OU + breathing
p.baseX = p.bx + colNoise * STOCH.columnAmp + globalSwayX;
p.baseY = p.by + rowNoise * STOCH.rowAmp + globalSwayY;
}

// project function unchanged but keeps existing fov behavior
function project(point) {
  const fov = 500;
  const scale = fov / (point.z - cameraZ + 0.0001);
  return { x: canvas.width / 2 + point.bx * scale, y: canvas.height / 2 + point.by * scale, scale };
}

// update tunnel: move camera and recycle points; call distortion
function updateTunnel(time) {

  cameraZ += speed;
  
   let progress = 1;
  if (morphing) {
    const elapsed = performance.now() - morphStartTime;
    progress = Math.min(1, elapsed / morphDuration);
    progress = easeInOut(progress);

    if (elapsed >= morphDuration) morphing = false;
  }
  
  for (let p of tunnelPoints) {
  
/* 
   
 if (p.z - cameraZ < 0) {
      p.z += tunnelDepth;
      setGridPosition(p, p.col, p.row, time); 
       }
 
 */
       // Smooth morph (lerp current → target)
    p.bx += (p.tx - p.bx) * 0.1;
    p.by += (p.ty - p.by) * 0.1;
    p.z  += (p.tz - p.z) * 0.1;
  
  /* 
  // refresh baseline to keep ring shape stable
      const angle = (p.col / (cols - 1)) * Math.PI * 2;
      p.bx = Math.cos(angle) * tunnelRadius;
      p.by = Math.sin(angle) * tunnelRadius;
      // optionally reset some phases slightly to keep life interesting
      colPhase[p.col] += (rng() - 0.5) * 0.2;
      rowPhase[p.row] += (rng() - 0.5) * 0.2;
 */
 
   
    applyCoherentDistortion(p, time);
   
}

  }


// draw tunnel lines — mostly same as before but we now use thicker/fade styling
function drawTunnel() {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
glowHue += 0.3;            // hue cycle speed
if (glowHue > 360) glowHue -= 360;

glowPulse = (Math.sin(Date.now() * 0.002) + 1) / 2;  
// oscillates between 0 → 1 smoothly

  const positions = tunnelPoints.map(p => project(p));

  for (let j = 0; j < rows; j++) {
    ctx.beginPath();
    for (let i = 0; i < cols; i++) {
      const idx = i * rows + j;
      const p = positions[idx];

      const worldDepth = (tunnelPoints[idx].z - cameraZ);
      const alpha =  1 / (1 + Math.exp((worldDepth - 800) * 0.002));
      const lineW = 2.5 * alpha;

      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
      
      const hue = fieldHue + j * 1.2;

   // Glow (color + pulsing brightness)
ctx.strokeStyle = `hsla(${glowHue}, 100%, 60%, ${alpha * 0.25 * (0.6 + glowPulse * 0.8)})`;
ctx.lineWidth = 6 * alpha;
ctx.stroke();

// Core line (stable hue)
ctx.strokeStyle = `hsla(${hue}, 100%, 70%, ${alpha})`;
ctx.lineWidth = 2.5 * alpha;
ctx.stroke();

    }
    ctx.stroke();
  }

  for (let i = 0; i < cols; i++) {
    ctx.beginPath();
    for (let j = 0; j < rows; j++) {
      const idx = i * rows + j;
      const p = positions[idx];

      const worldDepth = (tunnelPoints[idx].z - cameraZ);
      const alpha =  1 / (1 + Math.exp((worldDepth - 800) * 0.002));
      const lineW = 2.0 * alpha;

      if (j === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);

	const hue = fieldHue + j * 1.2;
	
// Glow (color + pulsing brightness)
ctx.strokeStyle = `hsla(${glowHue}, 100%, 60%, ${alpha * 0.25 * (0.6 + glowPulse * 0.8)})`;
ctx.lineWidth = 6 * alpha;
ctx.stroke();

// Core line (stable hue)
ctx.strokeStyle = `hsla(${hue}, 100%, 70%, ${alpha})`;
ctx.lineWidth = 2.5 * alpha;
ctx.stroke();

    }
    ctx.stroke();
  }

  fieldHue += 0.02;
  if (fieldHue > 360) fieldHue -= 360;
  ctx.fillStyle = "white";
ctx.font = "16px monospace";
ctx.fillText("State: " + gridState, 20, 30);

}



function spawnBananas() {
    if (Math.random() < 0.02) { // adjust frequency
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        // Shoot in a random direction toward tank
        const dx = tank.x + tank.w/2 - centerX;
        const dy = tank.y + tank.h/2 - centerY;
        const dist = Math.hypot(dx, dy);
        const speed = 5;

        bananas.push({
            x: centerX,
            y: centerY,
            vx: dx/dist * speed,
            vy: dy/dist * speed,
            w: 32,
            h: 16
        });
    }
}
function updateBananas() {
    for (let i = bananas.length - 1; i >= 0; i--) {
        const b = bananas[i];
        b.x += b.vx;
        b.y += b.vy;

        // Draw banana
        ctx.drawImage(bananaImg, b.x, b.y, b.w, b.h);

        // Collision with tank
        if (b.x < tank.x + tank.w && b.x + b.w > tank.x &&
            b.y < tank.y + tank.h && b.y + b.h > tank.y) {
            explosions.push({x: tank.x + tank.w/2, y: tank.y + tank.h/2, time: 0});
            bananas.splice(i, 1);
            continue;
        }

        // Remove off-screen bananas
        if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) {
            bananas.splice(i, 1);
        }
    }
}


// --- Tank & Player ---
const tank={x:canvas.width/2-50, y:canvas.height/2+100, w:100, h:50, speed:8};
const rockets=[], enemies=[], explosions=[];
let keys={};

window.addEventListener("keydown", e=>keys[e.key]=true);
window.addEventListener("keyup", e=>keys[e.key]=false);

window.addEventListener("keydown", e=>{
  if(role==="gunner" && e.key===" "){
    const rocket={x:tank.x+tank.w/2, y:tank.y, w:14, h:6, vx:10};
    rockets.push(rocket);
    socket.emit("fireRocket", rocket);
  }
});

socket.on("rocketFired", rocket=>{
  rockets.push(rocket);
});

function updateTank() {
    const nearestRowZ = tunnelPoints
        .filter(p => p.z - cameraZ > 0)
        .sort((a,b) => a.z - b.z)[0];

    if (!nearestRowZ) return;

    // Get all points in the same row (same z)
    const rowPoints = tunnelPoints.filter(p => Math.abs(p.z - nearestRowZ.z) < 1);

    // Determine min/max boundaries
    let minX = Math.min(...rowPoints.map(p => p.baseX));
    let maxX = Math.max(...rowPoints.map(p => p.baseX));
    let minY = Math.min(...rowPoints.map(p => p.baseY));
    let maxY = Math.max(...rowPoints.map(p => p.baseY));

    // Apply input
    if (keys["ArrowLeft"]) tank.x -= tank.speed;
    if (keys["ArrowRight"]) tank.x += tank.speed;
    if (keys["ArrowUp"]) tank.y -= tank.speed;
    if (keys["ArrowDown"]) tank.y += tank.speed;

    // Clamp to tunnel boundaries
    tank.x = Math.max(canvas.width/2 + minX, Math.min(canvas.width/2 + maxX - tank.w, tank.x));
    tank.y = Math.max(canvas.height/2 + minY, Math.min(canvas.height/2 + maxY - tank.h, tank.y));
}

function drawTank(){
  ctx.fillStyle="green";
  ctx.fillRect(tank.x,tank.y,tank.w,tank.h);
}




function updateRockets(){
  for(let i=rockets.length-1;i>=0;i--){
    const r=rockets[i]; r.x+=r.vx;
    ctx.fillStyle="red"; ctx.fillRect(r.x,r.y,r.w,r.h);
    if(r.x>canvas.width) rockets.splice(i,1);
  }
}

function drawEndGif() {
    const lead = getLeadingTunnelPoint();
    const proj = project(lead, cameraZ);
    const gifSize = 150;

    // Draw centered on projected leading point
    ctx.drawImage(endGif, proj.x - gifSize/2, proj.y - gifSize/2, gifSize, gifSize);
}




// --- Game Loop ---
function draw(time=0){
  updateTunnel(time);
  drawTunnel();
  /* 
drawTank();
  updateTank();
 */

  updateRockets();
  /* drawEndGif(); */
  requestAnimationFrame(draw);
}

draw();
