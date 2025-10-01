

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




// --- Menu ---
let role = null;
function chooseRole(r){ role = r; }
function startGame(){ document.getElementById("menu").style.display = "none"; }



// --- Tunnel Grid ---
const cols=16, rows=16, tunnelDepth=2000, tunnelRadius=200, speed=5;
let cameraZ=0, fieldHue=180;
const tunnelPoints=[];

for(let i=0;i<cols;i++){
  for(let j=0;j<rows;j++){
    const angle = (i/(cols-1))*Math.PI*2;
    tunnelPoints.push({baseX:Math.cos(angle)*tunnelRadius, baseY:Math.sin(angle)*tunnelRadius, z:j*(tunnelDepth/rows), col:i, row:j});
  }
}

function applySlowDistortion(p,time){
  const slowFactor=0.2;
  p.baseX += Math.sin(p.z*0.002 + time*0.0005)*slowFactor;
  p.baseY += Math.cos(p.z*0.002 + time*0.0005)*slowFactor;
}

function getLeadingTunnelPoint() {
    // Find the tunnel point with the largest z relative to camera
    return tunnelPoints.reduce((maxP, p) => p.z > maxP.z ? p : maxP, tunnelPoints[0]);
}


function project(point){ 
  const fov=500;
  const scale=fov/(point.z-cameraZ);
  return {x:canvas.width/2 + point.baseX*scale, y:canvas.height/2 + point.baseY*scale, scale};
}

function updateTunnel(time){
  cameraZ += speed;
  for(let p of tunnelPoints){
    if(p.z-cameraZ<0){
      p.z += tunnelDepth;
      const angle = (p.col/(cols-1))*Math.PI*2;
      p.baseX = Math.cos(angle)*tunnelRadius;
      p.baseY = Math.sin(angle)*tunnelRadius;
    }
    applySlowDistortion(p,time);
  }
}

function drawTunnel(){
  ctx.fillStyle="black";
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle=`hsla(${fieldHue},100%,50%,0.7)`;
  ctx.lineWidth=2;
  const positions=tunnelPoints.map(p=>project(p));
  for(let i=0;i<cols-1;i++){
    for(let j=0;j<rows-1;j++){
      const idx=i*rows+j;
      const p1=positions[idx], p2=positions[idx+1], p3=positions[(i+1)*rows+j];
      ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p3.x,p3.y); ctx.stroke();
    }
  }
  fieldHue+=0.05; if(fieldHue>360)fieldHue=0;
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
  drawTank();
  updateTank();
   spawnBananas();
    updateBananas();
  updateRockets();
  /* drawEndGif(); */
  requestAnimationFrame(draw);
}

draw();
