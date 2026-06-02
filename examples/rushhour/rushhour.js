/*
  rushhour_sp.js
  Rush Hour – Solo version (single player)
*/

import {
  updateConfigFromUrl,
  initializeMPLIB,
  joinSession,
  leaveSession,
  updateStateDirect,
  updateStateTransaction,
  hasControl,
  getCurrentPlayerId,
  getCurrentPlayerIds,
  getPlayerInfo,
  getNumberCurrentPlayers,
  getCurrentPlayerArrivalIndex,
  getSessionId,
  getSessionError,
  getWaitRoomInfo
} from "/mplib/src/mplib.js";

const COLS = 6, ROWS = 6, CELL = 78, GAP = 4;
const VOTING_DURATION = 5;
const MAX_ROUNDS_PER_LEVEL = 60;
const NUM_LEVELS = 4;

const NUM_PLAYERS = 1;

const PHASE_LEASE_MS  = 6000;
const PHASE_DRIFT_MS  = 1000;
const PHASE_TICK_MS   = 500;

const PLAYER_COLORS = ['p1'];
const PLAYER_LABELS = ['Player 1'];

const LEVELS = [
  {
    blocks: [
      { id: 'b0', type: 'target',   dir: 'h', col: 0, row: 2, size: 2 },
      { id: 'b1', type: 'obstacle', dir: 'v', col: 2, row: 1, size: 2 },
      { id: 'b2', type: 'obstacle', dir: 'v', col: 3, row: 2, size: 2 },
      { id: 'b3', type: 'obstacle', dir: 'v', col: 4, row: 2, size: 2 },
      { id: 'b4', type: 'obstacle', dir: 'h', col: 1, row: 0, size: 2 },
      { id: 'b5', type: 'obstacle', dir: 'h', col: 4, row: 4, size: 2 },
      { id: 'b6', type: 'obstacle', dir: 'v', col: 5, row: 1, size: 2 },
    ]
  },
  {
    blocks: [
      { id: 'b0', type: 'target',   dir: 'h', col: 0, row: 2, size: 2 },
      { id: 'b1', type: 'obstacle', dir: 'v', col: 2, row: 0, size: 3 },
      { id: 'b2', type: 'obstacle', dir: 'v', col: 4, row: 2, size: 3 },
      { id: 'b3', type: 'obstacle', dir: 'h', col: 1, row: 3, size: 2 },
      { id: 'b4', type: 'obstacle', dir: 'v', col: 3, row: 1, size: 2 },
      { id: 'b5', type: 'obstacle', dir: 'h', col: 4, row: 5, size: 2 },
      { id: 'b6', type: 'obstacle', dir: 'v', col: 5, row: 0, size: 3 },
    ]
  },
  {
    blocks: [
      { id: 'b0', type: 'target',   dir: 'h', col: 0, row: 2, size: 2 },
      { id: 'b1', type: 'obstacle', dir: 'v', col: 2, row: 0, size: 3 },
      { id: 'b2', type: 'obstacle', dir: 'v', col: 4, row: 1, size: 3 },
      { id: 'b3', type: 'obstacle', dir: 'h', col: 2, row: 3, size: 2 },
      { id: 'b4', type: 'obstacle', dir: 'h', col: 4, row: 4, size: 2 },
      { id: 'b5', type: 'obstacle', dir: 'v', col: 5, row: 0, size: 2 },
      { id: 'b6', type: 'obstacle', dir: 'v', col: 0, row: 3, size: 2 },
    ]
  },
  {
    blocks: [
      { id: 'b0', type: 'target',   dir: 'h', col: 0, row: 2, size: 2 },
      { id: 'b1', type: 'obstacle', dir: 'v', col: 2, row: 0, size: 3 },
      { id: 'b2', type: 'obstacle', dir: 'v', col: 4, row: 2, size: 3 },
      { id: 'b3', type: 'obstacle', dir: 'h', col: 1, row: 3, size: 2 },
      { id: 'b4', type: 'obstacle', dir: 'v', col: 3, row: 1, size: 2 },
      { id: 'b5', type: 'obstacle', dir: 'h', col: 3, row: 5, size: 2 },
      { id: 'b6', type: 'obstacle', dir: 'v', col: 5, row: 0, size: 3 },
      { id: 'b7', type: 'obstacle', dir: 'v', col: 0, row: 3, size: 2 },
    ]
  },
];

const studyId = typeof GameName !== 'undefined' ? GameName : 'rushhour_sp';
const sessionConfig = {
  minPlayersNeeded:              1,
  maxPlayersNeeded:              1,
  maxParallelSessions:           typeof MaxSessions !== 'undefined' ? MaxSessions : 0,
  allowReplacements:             false,
  exitDelayWaitingRoom:          0,
  maxDurationBelowMinPlayersNeeded: 300,
  maxHoursSession:               typeof MaxSessionTime !== 'undefined' ? MaxSessionTime : 2,
  recordData:                    typeof SaveData !== 'undefined' ? SaveData : true,
};
const verbosity = 1;
updateConfigFromUrl(sessionConfig);

let thisPlayerId = getCurrentPlayerId();
let playerColorMap = {};
let playerName = generateRandomName();

let currentLevel = 0;
let blockPositions = {};
let currentVoteCache = {};
let currentRawVoteCache = {};

let currentPhaseSnap = null;
let currentLevelSnap = null;
let iAmController = false;
let txBackoffMs = 0;
let leaseHeartbeatId = null;
let timerInterval = null;

let _lastLevelState = null;
let _lastLevelEndAt = null;

let _pendingMoves = {};
let _pendingMovesEvent = -1;
let _movesApplied = false;

const instructionSteps = [
  {
    text: `Welcome to Rush Hour!\n\nSolve each puzzle on your own. The game is played on a 6×6 grid, just like the classic Rush Hour puzzle.\n\nThe goal is to move the red TARGET block to the EXIT on the right side of the board.\n\nBlocks can slide only in the direction they face: horizontally or vertically.\n\nTry to solve each puzzle in as few moves as possible!`,
    demo: 'board',
  },
  {
    text: `Each round you have 5 seconds to vote on which block to move and in which direction. There is a timer at the bottom. Click any arrow on any block to cast your vote. You can change it anytime before the timer runs out.\n\nTry it now — click any arrow!`,
    demo: 'board-interactive',
  },
  {
    text: `That's it! You'll play 4 levels. You need to finish each level within 60 rounds.\n\nYour player name is: ${playerName}\n\nPress Join Game when you're ready! Please do not refresh the page after joining.`,
    showNameEntry: true,
  },
];

// ── Mini practice board ──
const DEMO_CELL = 68, DEMO_GAP = 4, DEMO_COLS = 6, DEMO_ROWS = 6;
let demoPracticeTimer = null;
let demoVoted = false;

function demoCellPx(col, row) {
  return { x: DEMO_GAP + col*(DEMO_CELL+DEMO_GAP), y: DEMO_GAP + row*(DEMO_CELL+DEMO_GAP) };
}

function buildDemoGrid(container) {
  const totalW = DEMO_GAP + 6*(DEMO_CELL+DEMO_GAP);
  const totalH = DEMO_GAP + 6*(DEMO_CELL+DEMO_GAP);

  const wrapper = document.createElement('div');
  wrapper.style.cssText = `position:relative;width:${totalW}px;height:${totalH}px;`;

  const grid = document.createElement('div');
  grid.style.cssText = `display:grid;grid-template-columns:repeat(6,${DEMO_CELL}px);grid-template-rows:repeat(6,${DEMO_CELL}px);gap:${DEMO_GAP}px;background:#111;padding:${DEMO_GAP}px;border:1px solid #2a2a2a;border-radius:8px;position:relative;width:${totalW}px;height:${totalH}px;box-sizing:border-box;`;
  for (let i = 0; i < 36; i++) {
    const cell = document.createElement('div');
    cell.style.cssText = `width:${DEMO_CELL}px;height:${DEMO_CELL}px;background:#1a1a1a;border-radius:4px;border:1px solid #2a2a2a;`;
    grid.appendChild(cell);
  }
  wrapper.appendChild(grid);

  const exit = document.createElement('div');
  exit.style.cssText = `position:absolute;right:-12px;top:${DEMO_GAP+2*(DEMO_CELL+DEMO_GAP)}px;width:10px;height:${DEMO_CELL}px;background:#2a9d8f;border-radius:0 4px 4px 0;display:flex;align-items:center;justify-content:center;writing-mode:vertical-rl;font-size:7px;font-family:'Space Mono',monospace;color:white;`;
  exit.textContent = 'EXIT';
  wrapper.appendChild(exit);

  container.appendChild(wrapper);
  return grid;
}

function addDemoBlock(grid, type, dir, col, row, size, extraHtml) {
  const el = document.createElement('div');
  const w = dir === 'h' ? size*(DEMO_CELL+DEMO_GAP)-DEMO_GAP : DEMO_CELL;
  const h = dir === 'v' ? size*(DEMO_CELL+DEMO_GAP)-DEMO_GAP : DEMO_CELL;
  const pos = demoCellPx(col, row);
  el.style.cssText = `position:absolute;left:${pos.x}px;top:${pos.y}px;width:${w}px;height:${h}px;border-radius:6px;border:2px solid rgba(255,255,255,.15);overflow:hidden;transition:left .35s ease,top .35s ease;`;
  el.style.background = type === 'target' ? '#e63946' : '#457b9d';
  el.dataset.dir = dir;
  el.dataset.col = col;
  el.dataset.row = row;
  el.dataset.size = size;
  if (extraHtml) el.innerHTML = extraHtml;
  grid.appendChild(el);
  return el;
}

function renderDemoInstructions(stepIdx) {
  clearInterval(demoPracticeTimer);
  demoPracticeTimer = null;
  demoVoted = false;
  const demo = document.getElementById('instructionDemo');
  demo.innerHTML = '';

  if (stepIdx === 0) {
    const gridWrap = document.createElement('div');
    gridWrap.style.position = 'relative';
    const grid = buildDemoGrid(gridWrap);
    addDemoBlock(grid, 'target', 'h', 0, 2, 2,
      '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:9px;font-family:\'Space Mono\',monospace;opacity:.6;">TARGET</div>');
    addDemoBlock(grid, 'obstacle', 'v', 2, 1, 2, '');
    addDemoBlock(grid, 'obstacle', 'h', 3, 0, 2, '');
    addDemoBlock(grid, 'obstacle', 'v', 4, 2, 2, '');
    demo.appendChild(gridWrap);
  }

  else if (stepIdx === 1) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

    const gridWrap = document.createElement('div');
    gridWrap.style.cssText = 'position:relative;display:inline-block;';
    const grid = buildDemoGrid(gridWrap);
    const target = addDemoBlock(grid, 'target', 'h', 0, 2, 2,
      '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:9px;font-family:\'Space Mono\',monospace;opacity:.6;">TARGET</div>');
    const b1 = addDemoBlock(grid, 'obstacle', 'v', 2, 1, 2, '');
    const b2 = addDemoBlock(grid, 'obstacle', 'h', 3, 0, 2, '');
    const b3 = addDemoBlock(grid, 'obstacle', 'v', 4, 2, 2, '');

    const btnStyle = 'position:absolute;background:rgba(0,0,0,.6);border:2px solid rgba(255,255,255,.5);color:white;border-radius:5px;cursor:pointer;font-size:18px;padding:2px 8px;line-height:1;z-index:20;font-weight:bold;';
    const nextBtn = document.getElementById('nextInstruction');
    nextBtn.style.display = 'none';

    const timerEl = document.createElement('div');
    timerEl.style.cssText = "font-family:'Space Mono',monospace;font-size:36px;font-weight:700;color:#f4a261;text-align:center;margin-top:8px;";
    timerEl.textContent = '5';

    let demoVoteBlock = null, demoVoteDir = null, demoYellowDot = null;

    [target, b1, b2, b3].forEach(function(block) {
      const dir = block.dataset.dir;
      const fwd = dir === 'h' ? '\u2192' : '\u2193';
      const bck = dir === 'h' ? '\u2190' : '\u2191';
      const fb = document.createElement('button');
      fb.innerHTML = fwd;
      fb.style.cssText = btnStyle + (dir === 'h' ? 'right:28px;top:50%;transform:translateY(-50%);' : 'bottom:28px;left:50%;transform:translateX(-50%);');
      const bb = document.createElement('button');
      bb.innerHTML = bck;
      bb.style.cssText = btnStyle + (dir === 'h' ? 'left:28px;top:50%;transform:translateY(-50%);' : 'top:28px;left:50%;transform:translateX(-50%);');

      function onVote(voteDir) {
        demoVoted = true;
        demoVoteBlock = block;
        demoVoteDir = voteDir;
        if (demoYellowDot) demoYellowDot.remove();
        demoYellowDot = document.createElement('span');
        const dotBase = 'position:absolute;width:13px;height:13px;border-radius:50%;background:#f4c400;box-shadow:0 0 5px #f4c400;z-index:15;';
        if (dir === 'h') {
          demoYellowDot.style.cssText = dotBase + (voteDir === 'fwd' ? 'right:6px;top:calc(50% - 6px);' : 'left:6px;top:calc(50% - 6px);');
        } else {
          demoYellowDot.style.cssText = dotBase + (voteDir === 'fwd' ? 'bottom:6px;left:calc(50% - 6px);' : 'top:6px;left:calc(50% - 6px);');
        }
        block.appendChild(demoYellowDot);
      }

      fb.onclick = function() { onVote('fwd'); };
      bb.onclick = function() { onVote('back'); };
      block.appendChild(fb); block.appendChild(bb);
    });

    wrapper.appendChild(gridWrap);
    wrapper.appendChild(timerEl);
    demo.appendChild(wrapper);

    let t = 5;
    function tickDemo() {
      t--;
      if (t <= 0) {
        clearInterval(demoPracticeTimer);
        timerEl.textContent = '0';
        timerEl.style.color = '#e63946';
        setTimeout(function() {
          if (demoVoted && demoVoteBlock) {
            const dir = demoVoteBlock.dataset.dir;
            const col = parseInt(demoVoteBlock.dataset.col);
            const row = parseInt(demoVoteBlock.dataset.row);
            const size = parseInt(demoVoteBlock.dataset.size);
            const isFwd = demoVoteDir === 'fwd';
            const newCol = dir === 'h' ? col + (isFwd ? 1 : -1) : col;
            const newRow = dir === 'v' ? row + (isFwd ? 1 : -1) : row;
            const validH = dir === 'h' && newCol >= 0 && newCol + size <= DEMO_COLS;
            const validV = dir === 'v' && newRow >= 0 && newRow + size <= DEMO_ROWS;
            if (validH || validV) {
              const pos = demoCellPx(newCol, newRow);
              demoVoteBlock.style.left = pos.x + 'px';
              demoVoteBlock.style.top  = pos.y + 'px';
              demoVoteBlock.dataset.col = newCol;
              demoVoteBlock.dataset.row = newRow;
            }
            if (demoYellowDot) { setTimeout(function(){ if(demoYellowDot) demoYellowDot.remove(); }, 300); }
            grid.querySelectorAll('button').forEach(b => {
              b.style.background = 'rgba(0,0,0,.6)';
              b.style.borderColor = 'rgba(255,255,255,.5)';
            });
            timerEl.textContent = '\u2713 Block moved!';
            timerEl.style.color = '#2a9d8f';
            timerEl.style.fontSize = '18px';
            nextBtn.style.display = 'inline-block';
          } else {
            t = 5; timerEl.textContent = '5'; timerEl.style.color = '#f4a261';
            timerEl.style.fontSize = '36px';
            demoPracticeTimer = setInterval(tickDemo, 1000);
          }
        }, 800);
        return;
      }
      timerEl.textContent = t;
      timerEl.style.color = t <= 2 ? '#e63946' : '#f4a261';
    }
    demoPracticeTimer = setInterval(tickDemo, 1000);
  }
}


let currentStep = 0;
const params = new URLSearchParams(window.location.search);
if (params.has('skipinstruction')) currentStep = instructionSteps.length - 1;

function renderInstructionStep() {
  const step = instructionSteps[currentStep];
  document.getElementById('instructionText').innerText = step.text;
  const nextBtn = document.getElementById('nextInstruction');
  nextBtn.style.display = currentStep < instructionSteps.length - 1 ? 'inline-block' : 'none';
  document.getElementById('name-entry').style.display = step.showNameEntry ? 'block' : 'none';
  renderDemoInstructions(currentStep);
}

document.getElementById('nextInstruction').onclick = () => {
  if (currentStep < instructionSteps.length - 1) { currentStep++; renderInstructionStep(); }
};

document.getElementById('consentProceed').onclick = () => {
  if (!document.getElementById('consentcheckbox').checked) {
    alert('Please check the consent box to proceed.');
    return;
  }
  document.getElementById('consentScreen').style.display = 'none';
  document.getElementById('instructionsScreen').style.display = 'block';
  renderInstructionStep();
};

document.getElementById('joinBtn').onclick = (e) => {
  e.preventDefault();
  document.getElementById('instructionsScreen').style.display = 'none';
  document.getElementById('waitingRoomScreen').style.display = 'block';
  joinSession();
};

const funList = {
  sessionChangeFunction: {
    joinedWaitingRoom,
    updateWaitingRoom,
    startSession,
    updateOngoingSession,
    endSession,
  },
  receiveStateChangeFunction: receiveStateChange,
  evaluateUpdateFunction: evaluateUpdate,
  removePlayerStateFunction: removePlayerState,
};

const listenerPaths = ['players', 'blocks', 'phase', 'level', 'votes', 'moves'];

initializeMPLIB(sessionConfig, studyId, funList, listenerPaths, verbosity);

window.addEventListener('beforeunload', () => {
  leaveSession();
});

let _waitingRoomTimeoutId = null;

function joinedWaitingRoom() {
  document.getElementById('messageWaitingRoom').innerHTML =
    `<div>Connecting…</div>`;
}

function updateWaitingRoom(info) {
  const [countdown, secsLeft] = getWaitRoomInfo();
  const el = document.getElementById('messageWaitingRoom');
  if (countdown) {
    el.innerHTML = `<div style="color:var(--exit)">Starting in ${secsLeft}s…</div>`;
  } else {
    el.innerHTML = `<div>Connecting…</div>`;
  }
}

function startSession() {
  document.getElementById('waitingRoomScreen').style.display = 'none';
  document.getElementById('gameScreen').style.display = 'flex';
  initGame();
}

function updateOngoingSession() {}
function endSession() {
  document.getElementById('gameScreen').style.display = 'none';
  document.getElementById('waitingRoomScreen').style.display = 'none';
  const msg = document.createElement('div');
  msg.style.cssText = 'max-width:500px;margin:80px auto;text-align:center;color:#f0f0f0;font-family:"Space Mono",monospace;';
  msg.innerHTML = `<h2 style="color:#e63946;margin-bottom:16px;">Session Ended</h2>
    <p style="color:#aaa;">The session has been closed. Please return to Prolific.</p>`;
  document.body.appendChild(msg);
}

function removePlayerState(playerId) {
  leaveSession();
}

function initGame() {
  thisPlayerId = getCurrentPlayerId();
  assignColors();
  writePlayerName();
  renderPlayerPanel();
  initGrid();

  (async () => {
    try {
      await updateStateTransaction('phase', 'lease', { currentEvent: 0 });
      setTimeout(async () => {
        const hasCurrent = !!(currentPhaseSnap && currentPhaseSnap.current);
        if (!hasCurrent) {
          await updateStateTransaction('phase', 'advance', {
            expectVersion: 0,
            nextPhase: 'voting',
            durationMs: VOTING_DURATION * 1000,
            eventNumber: 0,
          });
        }
      }, 200);
    } catch (e) { console.warn('[phase bootstrap]', e); }
  })();

  startLeaseHeartbeat();
  seedLevelIfNeeded();
}

function assignColors() {
  playerColorMap[thisPlayerId] = {
    color: 0,
    name: playerName,
  };
}

function writePlayerName() {
  updateStateDirect(`players/${thisPlayerId}`, { name: playerName, arrivalColor: 0 }, 'register player');
}

function renderPlayerPanel() {
  // Only show p1 slot; hide p2 and p3
  document.getElementById('pb1').classList.add('active');
  const pb2 = document.getElementById('pb2');
  const pb3 = document.getElementById('pb3');
  if (pb2) pb2.style.display = 'none';
  if (pb3) pb3.style.display = 'none';
}

async function seedLevelIfNeeded() {
  try {
    await updateStateTransaction('level', 'seed', {});
  } catch (e) { /* already seeded */ }
}

// ─────────────────────────────────────────
//  Grid rendering
// ─────────────────────────────────────────
function initGrid() {
  const g = document.getElementById('rhGrid');
  g.innerHTML = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'rh-cell';
      g.appendChild(cell);
    }
  }
}

function cellPx(col, row) {
  return {
    x: GAP + col * (CELL + GAP),
    y: GAP + row * (CELL + GAP),
  };
}

function renderLevel(levelIdx) {
  const g = document.getElementById('rhGrid');
  g.querySelectorAll('.rh-block').forEach(el => el.remove());
  blockPositions = {};

  const level = LEVELS[levelIdx];
  if (!level) return;

  level.blocks.forEach(b => {
    blockPositions[b.id] = { col: b.col, row: b.row };
    renderBlock(b.id, b.type, b.dir, b.col, b.row, b.size);
  });

  document.getElementById('levelIndicator').textContent = `Level ${levelIdx + 1} of ${NUM_LEVELS}`;
}

function renderBlock(id, type, dir, col, row, size) {
  const g = document.getElementById('rhGrid');

  const old = document.getElementById('rh-' + id);
  if (old) old.remove();

  const el = document.createElement('div');
  el.id = 'rh-' + id;
  el.className = 'rh-block ' + type;
  el.dataset.bid  = id;
  el.dataset.dir  = dir;
  el.dataset.size = size;
  el.dataset.type = type;
  el.dataset.col  = col;
  el.dataset.row  = row;

  const fwdArrow  = dir === 'h' ? '→' : '↓';
  const backArrow = dir === 'h' ? '←' : '↑';

  const dotBase = `width:13px;height:13px;border-radius:50%;display:inline-block;`;
  const btnStyle = `position:absolute;background:rgba(0,0,0,.6);
    border:2px solid rgba(255,255,255,.5);color:white;border-radius:5px;
    cursor:pointer;font-size:22px;padding:3px 10px;line-height:1;z-index:20;font-weight:bold;`;

  let html = '';

  if (dir === 'h') {
    html += `<div id="bdots-${id}" style="position:absolute;left:6px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:3px;">
      <span class="vdot" id="dot-${id}-back-0" style="${dotBase}"></span>
    </div>`;
    html += `<div id="fdots-${id}" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:3px;">
      <span class="vdot" id="dot-${id}-fwd-0" style="${dotBase}"></span>
    </div>`;
    html += `<button class="dir-btn back-btn" style="${btnStyle}left:28px;top:50%;transform:translateY(-50%);">${backArrow}</button>`;
    html += `<button class="dir-btn fwd-btn"  style="${btnStyle}right:28px;top:50%;transform:translateY(-50%);">${fwdArrow}</button>`;
  } else {
    html += `<div id="bdots-${id}" style="position:absolute;top:6px;left:50%;transform:translateX(-50%);display:flex;flex-direction:row;gap:3px;">
      <span class="vdot" id="dot-${id}-back-0" style="${dotBase}"></span>
    </div>`;
    html += `<div id="fdots-${id}" style="position:absolute;bottom:6px;left:50%;transform:translateX(-50%);display:flex;flex-direction:row;gap:3px;">
      <span class="vdot" id="dot-${id}-fwd-0" style="${dotBase}"></span>
    </div>`;
    html += `<button class="dir-btn back-btn" style="${btnStyle}top:28px;left:50%;transform:translateX(-50%);">${backArrow}</button>`;
    html += `<button class="dir-btn fwd-btn"  style="${btnStyle}bottom:28px;left:50%;transform:translateX(-50%);">${fwdArrow}</button>`;
  }

  el.innerHTML = html;

  el.querySelector('.fwd-btn').addEventListener('click',  e => { e.stopPropagation(); castVote(id, 'fwd');  });
  el.querySelector('.back-btn').addEventListener('click', e => { e.stopPropagation(); castVote(id, 'back'); });

  const w = dir === 'h' ? size * (CELL + GAP) - GAP : CELL;
  const h = dir === 'v' ? size * (CELL + GAP) - GAP : CELL;
  const pos = cellPx(col, row);

  el.style.position = 'absolute';
  el.style.left     = pos.x + 'px';
  el.style.top      = pos.y + 'px';
  el.style.width    = w + 'px';
  el.style.height   = h + 'px';
  el.style.overflow = 'hidden';

  if (col >= COLS) {
    el.style.display = 'none';
  }

  g.appendChild(el);
}

function updateBlockPosition(id, col, row) {
  const el = document.getElementById('rh-' + id);
  if (!el) return;
  if (col >= COLS) { el.style.display = 'none'; return; }
  el.dataset.col = col;
  el.dataset.row = row;
  const pos = cellPx(col, row);
  el.style.transition = 'left .35s ease, top .35s ease';
  el.style.left = pos.x + 'px';
  el.style.top  = pos.y + 'px';
}

// ─────────────────────────────────────────
//  Voting
// ─────────────────────────────────────────
let myVote = null;

function castVote(blockId, dir) {
  if (myVote && myVote.blockId === blockId && myVote.dir === dir) {
    myVote = null;
  } else {
    myVote = { blockId, dir };
  }

  document.querySelectorAll('.dir-btn').forEach(b => {
    b.style.background = 'rgba(0,0,0,.5)';
    b.style.borderColor = 'rgba(255,255,255,.3)';
  });
  if (myVote) {
    const blockEl = document.getElementById('rh-' + blockId);
    if (blockEl) {
      const btn = blockEl.querySelector('.' + dir + '-btn');
      if (btn) { btn.style.background = 'rgba(255,255,255,.25)'; btn.style.borderColor = 'white'; }
    }
  }

  const eventNum = currentLevelSnap?.eventNumber || 0;
  const voteData = myVote ? { blockId, dir, timestamp: Date.now(), level: currentLevel } : null;
  updateStateDirect('votes/' + eventNum + '/' + thisPlayerId, voteData, 'player vote');
  updateMyVoteIndicator();
}

function updateRoundCounter(eventNumber) {
  const startAt = currentLevelSnap?.startAt || 0;
  const round = Math.max(0, (eventNumber || 0) - startAt);
  const el = document.getElementById('roundCounter');
  if (el) el.textContent = `Round ${round} / ${MAX_ROUNDS_PER_LEVEL}`;
}

function updateMyVoteIndicator() {
  const pvEl = document.getElementById('pv1');
  if (!pvEl) return;
  if (!myVote) { pvEl.textContent = '—'; return; }
  const el = document.getElementById('rh-' + myVote.blockId);
  if (!el) return;
  const dir = el.dataset.dir;
  pvEl.innerHTML = myVote.dir === 'fwd'
    ? (dir === 'h' ? '→' : '↓')
    : (dir === 'h' ? '←' : '↑');
}

function updateVoteDisplay(votesForEvent) {
  document.querySelectorAll('.vdot').forEach(d => { d.className = 'vdot'; });

  const v = votesForEvent[thisPlayerId];
  const pvEl = document.getElementById('pv1');
  if (!v) { if (pvEl) pvEl.textContent = '—'; return; }

  const dot = document.getElementById(`dot-${v.blockId}-${v.dir}-0`);
  if (dot) dot.className = 'vdot p1f';

  if (pvEl) {
    const blockEl = document.getElementById('rh-' + v.blockId);
    if (!blockEl) return;
    const bdir = blockEl.dataset.dir;
    pvEl.innerHTML = v.dir === 'fwd'
      ? (bdir === 'h' ? '→' : '↓')
      : (bdir === 'h' ? '←' : '↑');
  }
}

// ─────────────────────────────────────────
//  Timer
// ─────────────────────────────────────────
function startLocalTimer(endTimeMs) {
  clearInterval(timerInterval);
  const tick = () => {
    const secsLeft = Math.max(0, Math.ceil((endTimeMs - Date.now()) / 1000));
    const el = document.getElementById('timerEl');
    if (el) {
      el.textContent = secsLeft;
      el.className = 'timer-big' + (secsLeft <= 2 ? ' urgent' : '');
    }
  };
  tick();
  timerInterval = setInterval(tick, 250);
}

function stopLocalTimer() {
  clearInterval(timerInterval);
  const el = document.getElementById('timerEl');
  if (el) { el.textContent = '…'; el.className = 'timer-big'; }
}

function setButtonsEnabled(enabled) {
  document.querySelectorAll('.dir-btn').forEach(btn => {
    btn.style.display = enabled ? 'block' : 'none';
    btn.disabled = !enabled;
    btn.style.background = 'rgba(0,0,0,.6)';
    btn.style.borderColor = 'rgba(255,255,255,.5)';
  });
}

function renderPhase(p) {
  if (!p || !p.current) return;
  if (p.current === 'voting') {
    startLocalTimer(p.endTime);
    setButtonsEnabled(true);
  } else if (p.current === 'moving') {
    stopLocalTimer();
    setButtonsEnabled(false);
    maybeApplyPendingMoves();
  }
}

function maybeApplyPendingMoves() {
  if (_movesApplied) return;
  if (currentPhaseSnap?.current !== 'moving') return;
  const resolvedEvent = (currentPhaseSnap.eventNumber || 0) - 1;
  if (_pendingMovesEvent !== resolvedEvent) return;
  if (Object.keys(_pendingMoves).length === 0) {
    _movesApplied = true;
    clearVoteDisplay();
    return;
  }
  _movesApplied = true;
  const won = applyMoves(_pendingMoves);
  if (won) {
    updateStateTransaction('level', 'toSurvey', { reason: 'cleared' });
  }
}

// ─────────────────────────────────────────
//  Move resolution
// ─────────────────────────────────────────
function computeMoves(votes) {
  const counts = {};
  Object.values(votes || {}).forEach(v => {
    if (!v) return;
    if (!counts[v.blockId]) counts[v.blockId] = { fwd: 0, back: 0 };
    counts[v.blockId][v.dir]++;
  });

  const intended = {};
  Object.entries(counts).forEach(([bid, c]) => {
    if (c.fwd === c.back) return;
    const el = document.getElementById('rh-' + bid);
    if (!el) return;
    const dir = el.dataset.dir;
    const type = el.dataset.type;
    const pos = blockPositions[bid];
    if (!pos) return;
    const size = parseInt(el.dataset.size);
    const fwdWins = c.fwd > c.back;
    let n = fwdWins ? (c.fwd - c.back) : (c.back - c.fwd);

    if (dir === 'h') {
      if (fwdWins) {
        const maxFwd = type === 'target' ? (COLS - pos.col) : (COLS - size - pos.col);
        n = Math.min(n, Math.max(0, maxFwd));
      } else {
        n = Math.min(n, pos.col);
      }
    } else {
      if (fwdWins) {
        n = Math.min(n, ROWS - size - pos.row);
      } else {
        n = Math.min(n, pos.row);
      }
    }

    for (const [otherId, otherPos] of Object.entries(blockPositions)) {
      if (otherId === bid) continue;
      if (otherPos.col >= COLS) continue;
      const otherEl = document.getElementById('rh-' + otherId);
      if (!otherEl) continue;
      const os = parseInt(otherEl.dataset.size);
      const od = otherEl.dataset.dir;

      if (dir === 'h') {
        const otherRowMin = otherPos.row;
        const otherRowMax = otherPos.row + (od === 'v' ? os - 1 : 0);
        const otherColMin = otherPos.col;
        const otherColMax = otherPos.col + (od === 'h' ? os - 1 : 0);
        if (pos.row >= otherRowMin && pos.row <= otherRowMax) {
          if (fwdWins && otherColMin >= pos.col + size) {
            n = Math.min(n, otherColMin - (pos.col + size));
          } else if (!fwdWins && otherColMax < pos.col) {
            n = Math.min(n, pos.col - otherColMax - 1);
          }
        }
      } else {
        const otherRowMin = otherPos.row;
        const otherRowMax = otherPos.row + (od === 'v' ? os - 1 : 0);
        const otherColMin = otherPos.col;
        const otherColMax = otherPos.col + (od === 'h' ? os - 1 : 0);
        if (pos.col >= otherColMin && pos.col <= otherColMax) {
          if (fwdWins && otherRowMin >= pos.row + size) {
            n = Math.min(n, otherRowMin - (pos.row + size));
          } else if (!fwdWins && otherRowMax < pos.row) {
            n = Math.min(n, pos.row - otherRowMax - 1);
          }
        }
      }
    }

    if (n <= 0) return;
    const dc = dir === 'h' ? (fwdWins ? n : -n) : 0;
    const dr = dir === 'v' ? (fwdWins ? n : -n) : 0;
    intended[bid] = { dc, dr };
  });

  const plans = [];
  Object.entries(intended).forEach(([bid, { dc, dr }]) => {
    const pos = blockPositions[bid];
    if (!pos) return;
    const el = document.getElementById('rh-' + bid);
    if (!el) return;
    const size = parseInt(el.dataset.size);
    const dir  = el.dataset.dir;
    const type = el.dataset.type;

    const newCol = pos.col + dc;
    const newRow = pos.row + dr;

    if (type === 'target' && dc > 0 && newCol + size > COLS) {
      plans.push({ bid, dc, dr, cells: [], isExit: true });
      return;
    }
    if (dir === 'h' && (newCol < 0 || newCol + size > COLS)) return;
    if (dir === 'v' && (newRow < 0 || newRow + size > ROWS)) return;

    const cells = [];
    if (dir === 'h') {
      for (let c = newCol; c < newCol + size; c++) cells.push({ col: c, row: newRow });
    } else {
      for (let r = newRow; r < newRow + size; r++) cells.push({ col: newCol, row: r });
    }

    let blockedByStationary = false;
    for (const cell of cells) {
      for (const [otherId, otherPos] of Object.entries(blockPositions)) {
        if (otherId === bid || otherId in intended) continue;
        if (otherPos.col >= COLS) continue;
        const otherEl = document.getElementById('rh-' + otherId);
        if (!otherEl) continue;
        const os = parseInt(otherEl.dataset.size);
        const od = otherEl.dataset.dir;
        if (od === 'h') {
          if (otherPos.row === cell.row && cell.col >= otherPos.col && cell.col < otherPos.col + os) {
            blockedByStationary = true; break;
          }
        } else {
          if (otherPos.col === cell.col && cell.row >= otherPos.row && cell.row < otherPos.row + os) {
            blockedByStationary = true; break;
          }
        }
      }
      if (blockedByStationary) break;
    }
    if (blockedByStationary) return;

    plans.push({ bid, dc, dr, cells, isExit: false });
  });

  // No multi-mover collision needed for single player, but kept for correctness
  for (let i = 0; i < plans.length; i++) {
    for (let j = i + 1; j < plans.length; j++) {
      const a = plans[i], b = plans[j];
      if (a.isExit || b.isExit) continue;
      const destOverlap = a.cells.some(ca => b.cells.some(cb => ca.col === cb.col && ca.row === cb.row));
      if (!destOverlap) continue;
      const aPos = blockPositions[a.bid];
      const bPos = blockPositions[b.bid];
      const aEl  = document.getElementById('rh-' + a.bid);
      const bEl  = document.getElementById('rh-' + b.bid);
      const aSize = parseInt(aEl.dataset.size), aDirEl = aEl.dataset.dir;
      const bSize = parseInt(bEl.dataset.size), bDirEl = bEl.dataset.dir;
      const aCurrent = [];
      if (aDirEl === 'h') { for (let c = aPos.col; c < aPos.col + aSize; c++) aCurrent.push({ col: c, row: aPos.row }); }
      else                { for (let r = aPos.row; r < aPos.row + aSize; r++) aCurrent.push({ col: aPos.col, row: r }); }
      const bCurrent = [];
      if (bDirEl === 'h') { for (let c = bPos.col; c < bPos.col + bSize; c++) bCurrent.push({ col: c, row: bPos.row }); }
      else                { for (let r = bPos.row; r < bPos.row + bSize; r++) bCurrent.push({ col: bPos.col, row: r }); }
      const bIntoAcurrent = b.cells.some(cb => aCurrent.some(ca => ca.col === cb.col && ca.row === cb.row));
      const aIntoBcurrent = a.cells.some(ca => bCurrent.some(cb => ca.col === cb.col && ca.row === cb.row));
      if (bIntoAcurrent && !aIntoBcurrent) { b.blocked = true; }
      else if (aIntoBcurrent && !bIntoAcurrent) { a.blocked = true; }
      else { a.blocked = true; b.blocked = true; }
    }
  }

  const moves = {};
  plans.forEach(({ bid, dc, dr, blocked, isExit }) => {
    if (!blocked) moves[bid] = { dc, dr };
  });
  return moves;
}

function applyMoves(moves) {
  let won = false;

  document.querySelectorAll('.rh-block').forEach(el => {
    const bid = el.dataset.bid;
    if (!blockPositions[bid]) {
      blockPositions[bid] = { col: parseInt(el.dataset.col || 0), row: parseInt(el.dataset.row || 0) };
    }
  });

  Object.entries(moves).forEach(([bid, move]) => {
    const dc = Number(move.dc);
    const dr = Number(move.dr);
    const pos = blockPositions[bid];
    if (!pos) return;
    const el = document.getElementById('rh-' + bid);
    if (!el) return;
    const size = parseInt(el.dataset.size);
    const type = el.dataset.type;

    const newCol = pos.col + dc;
    const newRow = pos.row + dr;

    if (type === 'target' && dc > 0 && newCol + size > COLS) {
      blockPositions[bid] = { col: COLS, row: pos.row };
      el.style.display = 'none';
      won = true;
    } else {
      blockPositions[bid] = { col: newCol, row: newRow };
      updateBlockPosition(bid, newCol, newRow);
    }
  });

  clearVoteDisplay();
  return won;
}

function clearVoteDisplay() {
  document.querySelectorAll('.vdot').forEach(d => { d.className = 'vdot'; });
  document.querySelectorAll('.dir-btn').forEach(b => {
    b.style.background = 'rgba(0,0,0,.6)';
    b.style.borderColor = 'rgba(255,255,255,.5)';
  });
  const pvEl = document.getElementById('pv1');
  if (pvEl) pvEl.textContent = '—';
  myVote = null;
}

// ─────────────────────────────────────────
//  Controller loop
// ─────────────────────────────────────────
function startLeaseHeartbeat() {
  if (leaseHeartbeatId) return;
  leaseHeartbeatId = setInterval(() => {
    if (canIBeController(currentPhaseSnap)) {
      renewLease();
      maybeAdvancePhase();
    } else {
      iAmController = false;
    }
  }, PHASE_TICK_MS);
}

function canIBeController(p) {
  const now = Date.now();
  return !p || !p.leaseUntil || now > (p.leaseUntil - PHASE_DRIFT_MS) || p.controllerId === thisPlayerId;
}

async function renewLease() {
  try {
    const currentEvent = currentLevelSnap?.eventNumber || 0;
    await updateStateTransaction('phase', 'lease', { currentEvent });
    iAmController = true;
    txBackoffMs = 0;
  } catch (e) {
    iAmController = false;
    txBackoffMs = Math.min((txBackoffMs || 500) * 2, 8000);
  }
}

async function maybeAdvancePhase() {
  const p = currentPhaseSnap;
  if (!p || !iAmController) return;
  if (currentLevelSnap?.state === 'survey' || currentLevelSnap?.state === 'ended' || currentLevelSnap?.state === 'redirecting') return;

  try {
    const expectVersion = Number(p.version || 0);

    if (p.current === 'voting') {
      const currentEvent = currentLevelSnap?.eventNumber || 0;
      const res = await updateStateTransaction('phase', 'advance', {
        expectVersion,
        nextPhase: 'moving',
        durationMs: 2500,
        eventNumber: currentEvent,
      });

      if (res) {
        const moves = computeMoves(currentRawVoteCache);
        for (const [bid, move] of Object.entries(moves)) {
          await updateStateDirect(`moves/${currentEvent}/${bid}`, move, 'computed move');
        }
        await updateStateTransaction('level', 'incrementEvent', {});
        currentRawVoteCache = {};
        await updateStateDirect(`votes/${currentEvent}`, null, 'clear votes');
      }

    } else if (p.current === 'moving') {
      const currentEvent = currentLevelSnap?.eventNumber || 0;
      if (currentEvent >= (currentLevelSnap?.endAt || MAX_ROUNDS_PER_LEVEL)) {
        await updateStateTransaction('level', 'toSurvey', { reason: 'time' });
        return;
      }
      await updateStateTransaction('phase', 'advance', {
        expectVersion,
        nextPhase: 'voting',
        durationMs: VOTING_DURATION * 1000,
        eventNumber: currentEvent,
      });
    }
    txBackoffMs = 0;
  } catch (e) {
    txBackoffMs = Math.min((txBackoffMs || 500) * 2, 8000);
    console.warn('[ADVANCE ERROR]', e);
  }
}

// ─────────────────────────────────────────
//  receiveStateChange
// ─────────────────────────────────────────
function receiveStateChange(pathNow, nodeName, newState, typeChange) {

  if (pathNow === 'players' && (typeChange === 'onChildAdded' || typeChange === 'onChildChanged')) {
    const pid = nodeName;
    const data = newState;
    if (data && data.name) {
      if (!playerColorMap[pid]) playerColorMap[pid] = {};
      playerColorMap[pid].name = data.name;
      playerColorMap[pid].color = 0;
      updatePlayerNameDisplay(pid);
    }
    return;
  }

  if (pathNow.startsWith('votes')) {
    const eventNum = parseInt(nodeName);
    const votesForEvent = newState;
    const currentEvent = currentPhaseSnap?.eventNumber || 0;
    if (eventNum === currentEvent) {
      currentRawVoteCache = {};
      Object.entries(votesForEvent || {}).forEach(([pid, v]) => {
        if (v) currentRawVoteCache[pid] = v;
      });
      updateVoteDisplay(currentRawVoteCache);
    }
    return;
  }

  if (pathNow === 'moves') {
    const eventNum = parseInt(nodeName);
    if (newState && typeof newState === 'object') {
      if (eventNum !== _pendingMovesEvent) {
        _pendingMoves = {};
        _pendingMovesEvent = eventNum;
        _movesApplied = false;
      }
      Object.entries(newState).forEach(([bid, m]) => {
        if (m) _pendingMoves[bid] = { dc: Number(m.dc), dr: Number(m.dr) };
      });
      maybeApplyPendingMoves();
    }
    return;
  }

  if (pathNow === 'phase') {
    currentPhaseSnap = currentPhaseSnap || {};
    if (nodeName === 'current')      currentPhaseSnap.current = newState;
    if (nodeName === 'endTime')      currentPhaseSnap.endTime = newState;
    if (nodeName === 'controllerId') currentPhaseSnap.controllerId = newState;
    if (nodeName === 'leaseUntil')   currentPhaseSnap.leaseUntil = newState;
    if (nodeName === 'version')      currentPhaseSnap.version = newState;
    if (nodeName === 'eventNumber')  currentPhaseSnap.eventNumber = newState;
    renderPhase(currentPhaseSnap);
    return;
  }

  if (pathNow === 'level') {
    currentLevelSnap = currentLevelSnap || {};
    if (nodeName === 'index')       currentLevelSnap.index = newState;
    if (nodeName === 'state')       currentLevelSnap.state = newState;
    if (nodeName === 'startAt')     currentLevelSnap.startAt = newState;
    if (nodeName === 'endAt')       currentLevelSnap.endAt = newState;
    if (nodeName === 'reason')      currentLevelSnap.reason = newState;
    if (nodeName === 'surveyDone')  currentLevelSnap.surveyDone = newState;
    if (nodeName === 'eventNumber') {
      currentLevelSnap.eventNumber = newState;
      if (currentPhaseSnap) currentPhaseSnap.eventNumber = newState;
      updateRoundCounter(newState);
    }

    const stateChanged = currentLevelSnap.state !== _lastLevelState;
    const endAtChanged = currentLevelSnap.endAt !== _lastLevelEndAt;
    if (stateChanged || (currentLevelSnap.state === 'play' && endAtChanged)) {
      _lastLevelState = currentLevelSnap.state;
      _lastLevelEndAt = currentLevelSnap.endAt;
      renderLevelFromAuthority(currentLevelSnap);
    }
    return;
  }
}

function updatePlayerNameDisplay(pid) {
  const info = playerColorMap[pid];
  if (!info) return;
  const nameEl = document.getElementById('pname1');
  if (nameEl) nameEl.textContent = info.name + ' (you)';
}

function renderLevelFromAuthority(L) {
  if (!L) return;
  currentLevel = L.index;

  if (L.state === 'play') {
    const lcScreen = document.getElementById('levelCompleteScreen');
    if (lcScreen) lcScreen.style.display = 'none';
    initGrid();
    renderLevel(L.index);
    clearVoteDisplay();
    updateRoundCounter(L.eventNumber || 0);
    _pendingMoves = {};
    _pendingMovesEvent = -1;
    _movesApplied = false;
  } else if (L.state === 'survey') {
    showBetweenLevelSurvey(L.index);
  } else if (L.state === 'ended') {
    showFinalSurvey();
  } else if (L.state === 'redirecting') {
    redirectToProlific();
  }
}

// ─────────────────────────────────────────
//  evaluateUpdate
// ─────────────────────────────────────────
function evaluateUpdate(path, state, action, args) {
  const now = Date.now();
  const me  = thisPlayerId;

  if (path === 'phase') {
    const p = state || {};
    const current    = p.current ?? null;
    const endTime    = Number(p.endTime || 0);
    const controller = p.controllerId ?? null;
    const leaseUntil = Number(p.leaseUntil || 0);
    const version    = Number(p.version || 0);

    if (action === 'lease') {
      const { currentEvent } = args || {};
      const leaseOk = !state || now > (leaseUntil - PHASE_DRIFT_MS) || controller === me;
      if (!leaseOk) return { isAllowed: false, newState: null };
      return {
        isAllowed: true,
        newState: {
          current: current || 'voting',
          endTime: endTime || (now + VOTING_DURATION * 1000),
          controllerId: me,
          leaseUntil: now + PHASE_LEASE_MS,
          version,
          eventNumber: currentEvent !== undefined ? currentEvent : (state?.eventNumber || 0),
        },
      };
    }

    if (action === 'advance') {
      const { expectVersion, nextPhase, durationMs, eventNumber: passedEvent } = args || {};
      const expV      = Number(expectVersion ?? version);
      const holderOk  = controller === me;
      const leaseOk   = now <= (leaseUntil + PHASE_DRIFT_MS);
      const phaseOk   = nextPhase === 'moving' || nextPhase === 'voting';
      const versionOk = version === expV || (version === 0 && expV === 0);
      const timeOk    = now >= endTime;

      if (!holderOk || !leaseOk || !phaseOk || !versionOk || !timeOk) {
        return { isAllowed: false, newState: null };
      }
      return {
        isAllowed: true,
        newState: {
          current: nextPhase,
          endTime: now + Number(durationMs || 1500),
          controllerId: me,
          leaseUntil: now + PHASE_LEASE_MS,
          version: version + 1,
          eventNumber: passedEvent !== undefined ? passedEvent : (state?.eventNumber || 0),
        },
      };
    }
    return { isAllowed: false, newState: null };
  }

  if (path === 'level') {
    const L = state || {};
    const index      = Number.isFinite(L.index) ? L.index : 0;
    const stateName  = L.state || null;
    const surveyDone = L.surveyDone || {};

    if (action === 'seed') {
      if (!state) {
        return {
          isAllowed: true,
          newState: {
            index: 0, state: 'play',
            startAt: 0, endAt: MAX_ROUNDS_PER_LEVEL,
            reason: null, controllerId: null, leaseUntil: 0,
            surveyDone: {}, eventNumber: 0,
          },
        };
      }
      return { isAllowed: false, newState: null };
    }

    if (action === 'incrementEvent') {
      if (stateName === 'play') {
        return { isAllowed: true, newState: { ...L, eventNumber: Number(L.eventNumber || 0) + 1 } };
      }
      return { isAllowed: false, newState: null };
    }

    if (action === 'toSurvey') {
      const reason = args?.reason === 'cleared' ? 'cleared' : 'time';
      if (stateName === 'play') {
        return { isAllowed: true, newState: { ...L, state: 'survey', reason, surveyDone: {} } };
      }
      if (stateName === 'survey') return { isAllowed: true, newState: L };
      return { isAllowed: false, newState: null };
    }

    if (action === 'markDone') {
      if (stateName === 'survey') {
        return { isAllowed: true, newState: { ...L, surveyDone: { ...surveyDone, [me]: true } } };
      }
      return { isAllowed: false, newState: null };
    }

    if (action === 'finalDone') {
      if (stateName === 'ended') {
        // Single player — immediately flip to redirecting
        return {
          isAllowed: true,
          newState: { ...L, state: 'redirecting' },
        };
      }
      return { isAllowed: false, newState: null };
    }

    if (action === 'advance') {
      if (stateName === 'survey') {
        // Single player — always advance immediately
        const nextIndex = index + 1;
        if (nextIndex >= NUM_LEVELS) {
          return { isAllowed: true, newState: { ...L, index: NUM_LEVELS, state: 'ended' } };
        }
        const t0 = Number(L.eventNumber || 0);
        return {
          isAllowed: true,
          newState: {
            ...L, index: nextIndex, state: 'play',
            startAt: t0, endAt: t0 + MAX_ROUNDS_PER_LEVEL,
            reason: null, surveyDone: {},
          },
        };
      }
      return { isAllowed: false, newState: null };
    }

    return { isAllowed: false, newState: null };
  }

  return { isAllowed: false, newState: null };
}

// ─────────────────────────────────────────
//  Between-level survey
// ─────────────────────────────────────────
function showBetweenLevelSurvey(levelIdx) {
  stopLocalTimer();
  const lcScreen = document.getElementById('levelCompleteScreen');
  lcScreen.innerHTML = '';
  lcScreen.style.display = 'flex';
  lcScreen.style.flexDirection = 'column';
  lcScreen.style.alignItems = 'center';
  lcScreen.style.justifyContent = 'center';

  const isLast = levelIdx >= NUM_LEVELS - 1;

  const card = document.createElement('div');
  card.className = 'survey-card';
  card.innerHTML = `
    <div class="lc-title" style="font-size:22px; margin-bottom:10px;">${isLast ? 'All Levels Complete!' : 'Level ' + (levelIdx + 1) + ' Complete!'}</div>
    <p style="margin-bottom:16px;">${isLast ? 'Please answer a few quick questions before finishing.' : 'Before Level ' + (levelIdx + 2) + ', please answer a few quick questions.'}</p>
    <div class="mb-3">
      <label><strong>How satisfied are you with the gameplay?</strong></label>
      <div class="likert-row">
        <span>Not at all</span>
        ${[1,2,3,4,5,6,7].map(v => `<label><input type="radio" name="bl-satisfaction" value="${v}"> ${v}</label>`).join(' ')}
        <span>Very satisfied</span>
      </div>
    </div>
    <div class="mb-3">
      <label><strong>How difficult was the level?</strong></label>
      <div class="likert-row">
        <span>Not difficult</span>
        ${[1,2,3,4,5,6,7].map(v => `<label><input type="radio" name="bl-difficulty" value="${v}"> ${v}</label>`).join(' ')}
        <span>Extremely difficult</span>
      </div>
    </div>
    <div class="mb-3">
      <label><strong>Did you feel like you contributed?</strong></label>
      <div class="likert-row">
        <span>Not at all</span>
        ${[1,2,3,4,5,6,7].map(v => `<label><input type="radio" name="bl-contribution" value="${v}"> ${v}</label>`).join(' ')}
        <span>A lot</span>
      </div>
    </div>
  `;

  const submitBtn = document.createElement('button');
  submitBtn.textContent = isLast ? 'Submit & Continue to Final Survey' : 'Submit & Continue';
  submitBtn.onclick = () => submitBetweenLevel(levelIdx);
  card.appendChild(submitBtn);
  lcScreen.appendChild(card);
}

function submitBetweenLevel(levelIdx) {
  const satisfaction = document.querySelector('input[name="bl-satisfaction"]:checked')?.value || null;
  const difficulty   = document.querySelector('input[name="bl-difficulty"]:checked')?.value || null;
  const contribution = document.querySelector('input[name="bl-contribution"]:checked')?.value || null;
  if (!satisfaction || !difficulty || !contribution) {
    alert('Please answer all questions before continuing.');
    return;
  }

  updateStateDirect(`players/${thisPlayerId}`, { level: levelIdx, satisfaction, difficulty, contribution }, 'betweenLevel');

  const lcScreen = document.getElementById('levelCompleteScreen');
  lcScreen.innerHTML = `<div class="lc-sub">Saving…</div>`;

  updateStateTransaction('level', 'markDone', {});
  updateStateTransaction('level', 'advance', {});
}

// ─────────────────────────────────────────
//  Final survey
// ─────────────────────────────────────────
function showFinalSurvey() {
  document.getElementById('gameScreen').style.display = 'none';
  document.getElementById('levelCompleteScreen').style.display = 'none';
  document.getElementById('finishScreen').style.display = 'block';
  window.scrollTo(0, 0);

  const form = document.getElementById('postTrialForm');
  form.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'teammate-block';
  card.innerHTML = `
    <div style="font-size:18px;font-weight:bold;margin-bottom:16px;">Final Survey</div>
    <div class="mb-3">
      <label><strong>How satisfied are you with the gameplay overall?</strong></label>
      <div class="likert-row">
        <span>Not at all</span>
        ${[1,2,3,4,5,6,7].map(v => `<label><input type="radio" name="final-satisfaction" value="${v}"> ${v}</label>`).join(' ')}
        <span>Very satisfied</span>
      </div>
    </div>
    <div class="mb-3">
      <label><strong>How difficult did you find the game overall?</strong></label>
      <div class="likert-row">
        <span>Not difficult</span>
        ${[1,2,3,4,5,6,7].map(v => `<label><input type="radio" name="final-difficulty" value="${v}"> ${v}</label>`).join(' ')}
        <span>Extremely difficult</span>
      </div>
    </div>
    <div class="mb-3">
      <label><strong>Did you feel like you contributed to solving the puzzles?</strong></label>
      <div class="likert-row">
        <span>Not at all</span>
        ${[1,2,3,4,5,6,7].map(v => `<label><input type="radio" name="final-contribution" value="${v}"> ${v}</label>`).join(' ')}
        <span>A lot</span>
      </div>
    </div>
    <div class="mb-3">
      <label><strong>Please enter your Prolific ID:</strong></label><br>
      <input type="text" id="prolific-id-input" placeholder="e.g. 5f3e2a1b9c7d4e8f2a0b1c3d"
        style="width:100%;max-width:500px;margin-top:8px;background:#111;border:1px solid #333;
        color:#eee;border-radius:4px;padding:8px;font-family:'Space Mono',monospace;font-size:13px;">
    </div>
  `;

  const submitBtn = document.createElement('button');
  submitBtn.className = 'submit-btn';
  submitBtn.textContent = 'Submit';
  submitBtn.onclick = submitFinalSurvey;
  card.appendChild(submitBtn);
  form.appendChild(card);
}

function submitFinalSurvey() {
  const satisfaction = document.querySelector('input[name="final-satisfaction"]:checked')?.value || null;
  const difficulty   = document.querySelector('input[name="final-difficulty"]:checked')?.value || null;
  const contribution = document.querySelector('input[name="final-contribution"]:checked')?.value || null;
  const prolificId   = document.getElementById('prolific-id-input')?.value.trim() || '';

  if (!satisfaction || !difficulty || !contribution) {
    alert('Please answer all questions before submitting.');
    return;
  }
  if (!prolificId) {
    alert('Please enter your Prolific ID before submitting.');
    return;
  }

  document.querySelectorAll('.submit-btn').forEach(b => {
    b.disabled = true;
    b.textContent = 'Submitting…';
  });

  updateStateDirect(`players/${thisPlayerId}`, { prolificId, finalSatisfaction: satisfaction, finalDifficulty: difficulty, finalContribution: contribution }, 'finalSurvey');

  document.getElementById('messageFinish').innerHTML =
    `<p>Thank you! Your responses have been recorded. Redirecting…</p>`;

  (async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const ok = await updateStateTransaction('level', 'finalDone', {});
      if (ok) return;
      if (currentLevelSnap?.state === 'redirecting') return;
      await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
    }
  })();
}

function redirectToProlific() {
  document.getElementById('messageFinish').innerHTML =
    '<p>All done! Redirecting to Prolific…</p>';
  setTimeout(() => {
    window.location.href = 'https://app.prolific.com/submissions/complete?cc=C1QNECVZ';
  }, 1500);
}

function generateRandomName() {
  const adj = ['Swift','Bold','Bright','Cool','Sharp','Calm','Quick','Keen','Brave','Clever'];
  const noun = ['Fox','Owl','Bear','Hawk','Wolf','Lynx','Deer','Crow','Pike','Seal'];
  return adj[Math.floor(Math.random()*adj.length)] + noun[Math.floor(Math.random()*noun.length)];
}