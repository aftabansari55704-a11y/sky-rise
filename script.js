const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 400;
canvas.height = 600;

// ===== CONSTANTS =====
const BH = 32;         // block height
const BD = 12;         // 3D depth
const INIT_W = 160;    // starting width
const CRANE_Y = 22;    // crane arm screen Y
const SWING_Y = 130;   // block swings at this screen Y
const AMP = 160;       // swing left-right amplitude

const COLORS = [
    {m:'#E63946', t:'#FF8585', s:'#9B1D24'},
    {m:'#2196F3', t:'#71C4FF', s:'#0D5FA3'},
    {m:'#4CAF50', t:'#88D98B', s:'#276B2A'},
    {m:'#FF9800', t:'#FFCA7A', s:'#A65B00'},
    {m:'#9C27B0', t:'#D18BE0', s:'#5E1070'},
    {m:'#00BCD4', t:'#6EEEFF', s:'#007080'},
    {m:'#FF5722', t:'#FF9070', s:'#8F2500'},
    {m:'#8BC34A', t:'#C0E08A', s:'#4D7020'},
];

// ===== STATE =====
let gState = 'start';
let score = 0, lives = 5;
let highScore = parseInt(localStorage.getItem('skyrise_hs') || '0');
let soundOn = true;
let stack = [], camY = 0;
let swingT = 0;
let drop = null; // falling block: {x, worldY, w, vy, ci}

// ===== AUDIO =====
let ac = null;
function beep(freq, dur, vol) {
    if (!soundOn) return;
    try {
        if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
        const o = ac.createOscillator(), g = ac.createGain();
        o.connect(g); g.connect(ac.destination);
        o.frequency.value = freq;
        g.gain.setValueAtTime(vol, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
        o.start(); o.stop(ac.currentTime + dur);
    } catch(e) {}
}
function speak(txt) {
    if (!soundOn || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(txt);
    u.lang = 'hi-IN'; u.rate = 1.1;
    window.speechSynthesis.speak(u);
}

// ===== INIT =====
function initGame() {
    score = 0; lives = 5; stack = []; camY = 0; drop = null; swingT = 0;
    stack.push({
        x: (canvas.width - INIT_W) / 2,
        worldY: canvas.height - BH - 25,
        w: INIT_W, ci: 0, isBase: true
    });
    updateUI();
}

// ===== SWING =====
function swingSpeed() { return 0.020 + Math.floor(score / 10) * 0.003; }
function swingX() {
    const w = stack[stack.length - 1].w;
    return 200 + AMP * Math.sin(swingT) - w / 2;
}

// ===== RELEASE =====
function relBlock() {
    if (gState !== 'playing' || drop) return;
    const top = stack[stack.length - 1];
    const ci = Math.floor(score / 10) % COLORS.length;
    drop = { x: swingX(), worldY: SWING_Y + camY, w: top.w, vy: 1, ci: ci };
    beep(330, 0.08, 0.2);
}

// ===== LAND =====
function landBlock() {
    if (!drop) return;
    const top = stack[stack.length - 1];
    const left = Math.max(drop.x, top.x);
    const right = Math.min(drop.x + drop.w, top.x + top.w);
    const overlap = right - left;

    if (overlap <= 0) {
        drop = null; lives--;
        updateUI(); beep(180, 0.6, 0.35); speak('गया!');
        if (lives <= 0) endGame();
        return;
    }
    const perfect = Math.abs(drop.x - top.x) <= 5;
    stack.push({
        x: perfect ? top.x : left,
        worldY: drop.worldY,
        w: perfect ? top.w : overlap,
        ci: drop.ci, isBase: false
    });
    score++;
    drop = null;
    if (perfect) {
        if (lives < 5) lives++;
        beep(700, 0.35, 0.4); speak('शाबाश!');
    } else {
        beep(500, 0.15, 0.3);
    }
    if (score % 10 === 0) setTimeout(() => speak(score + ' ब्लॉक पूरे!'), 200);
    if (score >= 100) { winGame(); return; }
    updateUI(); updateCam();
}

function updateCam() {
    const top = stack[stack.length - 1];
    const t = top.worldY - canvas.height * 0.62;
    if (t < camY) camY = t;
}

function endGame() {
    gState = 'gameover'; beep(130, 1.5, 0.4); speak('खेल खत्म!');
    if (score > highScore) { highScore = score; localStorage.setItem('skyrise_hs', highScore); }
    document.getElementById('final-score').textContent = score;
    document.getElementById('final-hs').textContent = highScore;
    document.getElementById('gameover-screen').style.display = 'flex';
}
function winGame() {
    gState = 'win'; speak('बधाई हो! सौ ब्लॉक पूरे!');
    if (score > highScore) { highScore = score; localStorage.setItem('skyrise_hs', highScore); }
    document.getElementById('win-screen').style.display = 'flex';
}

// ===== DRAW 3D BLOCK =====
function drawBlock(x, sy, w, ci, isBase) {
    if (w <= 0) return;
    const col = COLORS[ci % COLORS.length];
    const h = BH, d = BD;

    // Top face
    ctx.fillStyle = col.t;
    ctx.beginPath();
    ctx.moveTo(x, sy); ctx.lineTo(x+w, sy);
    ctx.lineTo(x+w+d, sy-d); ctx.lineTo(x+d, sy-d);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 0.5; ctx.stroke();

    // Right side
    ctx.fillStyle = col.s;
    ctx.beginPath();
    ctx.moveTo(x+w, sy); ctx.lineTo(x+w+d, sy-d);
    ctx.lineTo(x+w+d, sy+h-d); ctx.lineTo(x+w, sy+h);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // Front face
    ctx.fillStyle = col.m;
    ctx.fillRect(x, sy, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.8;
    ctx.strokeRect(x, sy, w, h);

    // Door (base only)
    if (isBase && w > 30) {
        const dw = Math.min(16, w * 0.22), dh = h * 0.65;
        ctx.fillStyle = 'rgba(20,10,5,0.85)';
        ctx.fillRect(x + w/2 - dw/2, sy + h - dh, dw, dh);
        ctx.strokeStyle = 'rgba(210,170,60,0.9)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + w/2 - dw/2, sy + h - dh, dw, dh);
    }

    // Windows
    if (w > 35) {
        if (w > 75) {
            drawWin(x + w*0.15, sy + h*0.1, 10, 9);
            drawWin(x + w*0.60, sy + h*0.1, 10, 9);
        } else {
            drawWin(x + w*0.33, sy + h*0.1, 10, 9);
        }
    }
}

function drawWin(wx, wy, ww, wh) {
    ctx.fillStyle = 'rgba(200,235,255,0.85)';
    ctx.fillRect(wx, wy, ww, wh);
    ctx.strokeStyle = 'rgba(100,160,220,1)';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(wx, wy, ww, wh);
    ctx.beginPath();
    ctx.moveTo(wx+ww/2, wy); ctx.lineTo(wx+ww/2, wy+wh);
    ctx.moveTo(wx, wy+wh/2); ctx.lineTo(wx+ww, wy+wh/2);
    ctx.stroke();
}

// ===== CRANE & ROPE =====
function drawCrane(ropeToX) {
    // Crane arm
    ctx.strokeStyle = '#777'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(20, CRANE_Y); ctx.lineTo(380, CRANE_Y); ctx.stroke();
    // Support post
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(200, 0); ctx.lineTo(200, CRANE_Y); ctx.stroke();

    if (ropeToX !== undefined) {
        // Moving pulley dot
        ctx.fillStyle = '#aaa';
        ctx.beginPath(); ctx.arc(ropeToX, CRANE_Y, 5, 0, Math.PI*2); ctx.fill();
        // Rope
        ctx.strokeStyle = '#8B6520'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ropeToX, CRANE_Y + 5);
        ctx.lineTo(ropeToX, SWING_Y);
        ctx.stroke();
    }
}

function getBg() {
    if (score < 10) return {sky:'#7EC8E3', label:'🌳 गाँव'};
    if (score < 20) return {sky:'#F4A460', label:'🏪 बाज़ार'};
    if (score < 30) return {sky:'#4682B4', label:'🏙️ शहर'};
    if (score < 40) return {sky:'#2F4F6F', label:'🌆 ऊँचा शहर'};
    return {sky:'#050520', label:'🌌 आसमान'};
}

// ===== LOOP =====
function update() {
    if (gState !== 'playing') return;
    if (!drop) { swingT += swingSpeed(); }
    if (drop) {
        drop.vy += 0.55;
        drop.worldY += drop.vy;
        const top = stack[stack.length - 1];
        if (drop.worldY >= top.worldY) { drop.worldY = top.worldY; landBlock(); }
        if (drop.worldY - camY > canvas.height + 80) {
            drop = null; lives--;
            updateUI(); beep(180, 0.5, 0.3); speak('गया!');
            if (lives <= 0) endGame();
        }
    }
}

function draw() {
    const bg = getBg();
    ctx.fillStyle = bg.sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw stack
    for (const b of stack) {
        const sy = b.worldY - camY;
        if (sy > -BH*2 && sy < canvas.height + BH) drawBlock(b.x, sy, b.w, b.ci, b.isBase);
    }

    if (!drop) {
        // Swinging block on rope
        const bx = swingX();
        const ci = Math.floor(score/10) % COLORS.length;
        const bcx = bx + stack[stack.length-1].w / 2;
        drawCrane(bcx);
        drawBlock(bx, SWING_Y, stack[stack.length-1].w, ci, false);
    } else {
        // Crane only (no rope) while falling
        drawCrane();
        const sy = drop.worldY - camY;
        drawBlock(drop.x, sy, drop.w, drop.ci, false);
    }

    // Scene label
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(bg.label, canvas.width/2, canvas.height - 8);
}

function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('high-score').textContent = highScore;
    let h = '';
    for (let i=0;i<5;i++) h += (i<lives)?'❤️':'🖤';
    document.getElementById('hearts').textContent = h;
}

function toggleSound() {
    soundOn = !soundOn;
    document.getElementById('sound-btn').textContent = soundOn ? '🔊' : '🔇';
}

function loop() { update(); draw(); requestAnimationFrame(loop); }

function onTap(e) { e.preventDefault(); if (gState === 'playing' && !drop) relBlock(); }
canvas.addEventListener('click', onTap);
canvas.addEventListener('touchstart', onTap, {passive:false});

document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('start-screen').style.display = 'none';
    gState = 'playing'; initGame();
});
document.getElementById('restart-btn').addEventListener('click', () => {
    document.getElementById('gameover-screen').style.display = 'none';
    gState = 'playing'; initGame();
});
document.getElementById('play-again-btn').addEventListener('click', () => {
    document.getElementById('win-screen').style.display = 'none';
    gState = 'playing'; initGame();
});
document.getElementById('share-btn').addEventListener('click', () => {
    const msg = '🏗️ SKY RISE में मैंने '+score+' ब्लॉक बनाए! हाई स्कोर: '+highScore+'. क्या तुम beat कर सकते हो?';
    window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
});

highScore = parseInt(localStorage.getItem('skyrise_hs')||'0');
const hsEl = document.getElementById('hs-show');
if (hsEl && highScore > 0) hsEl.textContent = 'हाई स्कोर: '+highScore;
updateUI(); loop();
