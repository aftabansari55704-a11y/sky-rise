const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 400;
canvas.height = 600;

// ===== STATE =====
let state = 'start';
let score = 0;
let lives = 5;
let highScore = parseInt(localStorage.getItem('skyrise_hs') || '0');
let soundOn = true;

const BH = 30;        // block height
const INIT_W = 200;   // starting block width

let stack = [];       // placed blocks
let mov = null;       // moving block
let camY = 0;         // camera scroll

const COLORS = ['#A0522D','#CC4444','#3377BB','#339944','#7744BB','#FF8C00','#008B8B','#CC4488'];

// ===== AUDIO =====
let ac = null;
function beep(freq, dur, vol) {
    if (!soundOn) return;
    try {
        if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
        let o = ac.createOscillator(), g = ac.createGain();
        o.connect(g); g.connect(ac.destination);
        o.frequency.value = freq;
        g.gain.setValueAtTime(vol||0.3, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
        o.start(); o.stop(ac.currentTime + dur);
    } catch(e) {}
}

function speak(txt) {
    if (!soundOn || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    let u = new SpeechSynthesisUtterance(txt);
    u.lang = 'hi-IN'; u.rate = 1.1;
    window.speechSynthesis.speak(u);
}

// ===== INIT =====
function initGame() {
    score = 0; lives = 5; stack = []; camY = 0;
    stack.push({ x:(canvas.width-INIT_W)/2, y:canvas.height-BH-20, w:INIT_W, color:COLORS[0], isBase:true });
    spawnMov();
    updateUI();
}

function getSpeed() { return 2 + Math.floor(score/10)*0.4; }

function spawnMov() {
    const top = stack[stack.length-1];
    const ci = Math.floor(score/10) % COLORS.length;
    mov = { x:-top.w, y:top.y-BH-2, w:top.w, dir:1, speed:getSpeed(), color:COLORS[ci] };
}

// ===== PLACE =====
function place() {
    if (state !== 'playing' || !mov) return;
    const top = stack[stack.length-1];
    const left  = Math.max(mov.x, top.x);
    const right = Math.min(mov.x + mov.w, top.x + top.w);
    const overlap = right - left;

    if (overlap <= 0) {
        lives--;
        updateUI();
        beep(150, 0.5, 0.35);
        speak('गया!');
        if (lives <= 0) { endGame(); return; }
        spawnMov();
        return;
    }

    const perfect = Math.abs(mov.x - top.x) <= 5;
    const placed = {
        x: perfect ? top.x : left,
        y: mov.y,
        w: perfect ? top.w : overlap,
        color: mov.color,
        isBase: false
    };
    stack.push(placed);
    score++;

    if (perfect) {
        if (lives < 5) { lives++; }
        beep(700, 0.3, 0.4);
        speak('शाबाश!');
    } else {
        beep(440, 0.15, 0.3);
    }

    if (score % 10 === 0) setTimeout(()=>speak(score+' ब्लॉक पूरे!'), 200);
    if (score >= 100) { winGame(); return; }

    updateUI();
    updateCam();
    spawnMov();
}

function updateCam() {
    const top = stack[stack.length-1];
    const t = top.y - canvas.height * 0.4;
    if (t < camY) camY = t;
}

// ===== END STATES =====
function endGame() {
    state = 'gameover';
    beep(150, 1.2, 0.4);
    speak('खेल खत्म!');
    if (score > highScore) { highScore = score; localStorage.setItem('skyrise_hs', highScore); }
    document.getElementById('final-score').textContent = score;
    document.getElementById('final-hs').textContent = highScore;
    document.getElementById('gameover-screen').style.display = 'flex';
}

function winGame() {
    state = 'win';
    speak('बधाई हो! सौ ब्लॉक पूरे! जीत गए!');
    if (score > highScore) { highScore = score; localStorage.setItem('skyrise_hs', highScore); }
    document.getElementById('win-screen').style.display = 'flex';
}

// ===== DRAW =====
function getBg() {
    if (score < 10) return { sky:'#87CEEB', label:'🌳 गाँव' };
    if (score < 20) return { sky:'#F4A460', label:'🏪 बाज़ार' };
    if (score < 30) return { sky:'#4682B4', label:'🏙️ शहर' };
    if (score < 40) return { sky:'#2F4F6F', label:'🌆 ऊँचा शहर' };
    return { sky:'#050520', label:'🌌 आसमान' };
}

function drawBlock(x, y, w, color, isBase) {
    if (w <= 0) return;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, BH);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x, y, w, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x+w-3, y, 3, BH);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, BH);

    if (w > 25) {
        const ws = 7;
        if (isBase) {
            const dw = Math.min(16, w*0.22);
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(x+w/2-dw/2, y+BH-dw*1.1, dw, dw*1.1);
        }
        ctx.fillStyle = 'rgba(255,255,160,0.85)';
        if (w > 55) {
            ctx.fillRect(x+w*0.2, y+9, ws, ws);
            ctx.fillRect(x+w*0.65, y+9, ws, ws);
        } else {
            ctx.fillRect(x+w*0.35, y+9, ws, ws);
        }
    }
}

function update() {
    if (state !== 'playing' || !mov) return;
    mov.x += mov.speed * mov.dir;
    if (mov.x + mov.w > canvas.width) mov.dir = -1;
    if (mov.x < 0) mov.dir = 1;
}

function draw() {
    const bg = getBg();
    ctx.fillStyle = bg.sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let b of stack) {
        const dy = b.y - camY;
        if (dy > -BH && dy < canvas.height+BH) drawBlock(b.x, dy, b.w, b.color, b.isBase);
    }
    if (mov && state === 'playing') {
        drawBlock(mov.x, mov.y - camY, mov.w, mov.color, false);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(bg.label, canvas.width/2, canvas.height-8);
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

// ===== LOOP =====
function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

// ===== EVENTS =====
function onTap(e) {
    e.preventDefault();
    if (state === 'playing') place();
}
canvas.addEventListener('click', onTap);
canvas.addEventListener('touchstart', onTap, {passive:false});

document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('start-screen').style.display = 'none';
    state = 'playing';
    initGame();
});
document.getElementById('restart-btn').addEventListener('click', () => {
    document.getElementById('gameover-screen').style.display = 'none';
    state = 'playing';
    initGame();
});
document.getElementById('play-again-btn').addEventListener('click', () => {
    document.getElementById('win-screen').style.display = 'none';
    state = 'playing';
    initGame();
});
document.getElementById('share-btn').addEventListener('click', () => {
    const msg = '🏗️ SKY RISE में मैंने '+score+' ब्लॉक बनाए! हाई स्कोर: '+highScore+'. क्या तुम beat कर सकते हो?';
    window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
});

// ===== START =====
highScore = parseInt(localStorage.getItem('skyrise_hs')||'0');
const hs = document.getElementById('hs-show');
if (hs && highScore > 0) hs.textContent = 'हाई स्कोर: '+highScore;
updateUI();
loop();
