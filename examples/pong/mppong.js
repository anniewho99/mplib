/*
  rushhour_mp.js
  Rush Hour – Group Voting, multiplayer version
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

const PHASE_LEASE_MS  = 6000;
const PHASE_DRIFT_MS  = 1000;
const PHASE_TICK_MS   = 500;

const PLAYER_COLORS = ['p1', 'p2', 'p3'];
const PLAYER_LABELS = ['Player 1', 'Player 2', 'Player 3'];

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

const studyId = typeof GameName !== 'undefined' ? GameName : 'rushhour_mp';
const sessionConfig = {
  minPlayersNeeded:              typeof MinPlayers !== 'undefined' ? MinPlayers : 3,
  maxPlayersNeeded:              typeof MaxPlayers !== 'undefined' ? MaxPlayers : 3,
  maxParallelSessions:           typeof MaxSessions !== 'undefined' ? MaxSessions : 0,
  allowReplacements:             typeof PlayerReplacement !== 'undefined' ? PlayerReplacement : false,
  exitDelayWaitingRoom:          typeof LeaveWaitingRoomTime !== 'undefined' ? LeaveWaitingRoomTime : 10,
  maxDurationBelowMinPlayersNeeded: typeof MinPlayerTimeout !== 'undefined' ? MinPlayerTimeout : 10,
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

// Moves are buffered here as Firebase fires one child at a time.
// We apply them all at once when the phase switches to 'moving'.
let _pendingMoves = {};      // bid → { dc, dr }
let _pendingMovesEvent = -1; // which event these moves belong to
let _movesApplied = false;   // guard: apply only once per event

const instructionSteps = [
  {
    text: `Welcome to the Rush Hour Voting game!\n\nYou'll be playing with two other participants. Together you need to slide the red TARGET block off the right side of the board (through the EXIT) — by voting on which blocks to move each round.\n\nWe'll walk you through everything step by step.`,
  },
  {
    text: `The board is a 6×6 grid. Blocks can only slide horizontally or vertically along their axis — they can't turn.\n\nThe red TARGET block starts somewhere on row 3 (the exit row). Your goal is to clear a path so it can slide all the way off the right edge.`,
  },
  {
    text: `Each round you have 5 seconds to vote.\n\nClick on a block to select it, then click the arrow direction you want it to move. You can vote for any block — and change your vote as many times as you like before time runs out.\n\nWhen the timer hits zero, each block moves in whichever direction got the most votes (if there's a tie or no votes, it stays put).`,
  },
  {
    text: `You're playing with two other people. All three of you vote at the same time, but you won't see each other's votes until the round resolves.\n\nCoordination is key — think about what your teammates might be planning.\n\nYour player name is: ${playerName}\n\nPress Join Game when you're ready!`,
    showNameEntry: true,
  },
];

let currentStep = 0;
const params = new URLSearchParams(window.location.search);
if (params.has('skipinstruction')) currentStep = instructionSteps.length - 1;

function renderInstructionStep() {
  const step = instructionSteps[currentStep];
  document.getElementById('instructionText').innerText = step.text;
  const nextBtn = document.getElementById('nextInstruction');
  nextBtn.style.display = currentStep < instructionSteps.length - 1 ? 'inline-block' : 'none';
  document.getElementById('name-entry').style.display = step.showNameEntry ? 'block' : 'none';
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

function joinedWaitingRoom() {
  document.getElementById('messageWaitingRoom').textContent = 'Waiting for other players to join…';
}

function updateWaitingRoom(info) {
  const [countdown, secsLeft] = getWaitRoomInfo();
  const n = getNumberCurrentPlayers();
  document.getElementById('messageWaitingRoom').textContent =
    countdown
      ? `${n}/3 players ready. Starting in ${secsLeft}s…`
      : `${n}/3 players connected. Waiting…`;
}

function startSession() {
  document.getElementById('waitingRoomScreen').style.display = 'none';
  document.getElementById('gameScreen').style.display = 'flex';
  initGame();
}

function updateOngoingSession() {}
function endSession() {}
function removePlayerState(playerId) {}

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
  const arrIdx = getCurrentPlayerArrivalIndex();
  playerColorMap[thisPlayerId] = {
    color: arrIdx - 1,
    name: playerName,
  };
}

function writePlayerName() {
  updateStateDirect(`players/${thisPlayerId}`, { name: playerName, arrivalColor: getCurrentPlayerArrivalIndex() - 1 }, 'register player');
}

function renderPlayerPanel() {
  const myColor = playerColorMap[thisPlayerId]?.color ?? 0;
  ['pb1','pb2','pb3'].forEach((id, i) => {
    document.getElementById(id).classList.toggle('active', i === myColor);
  });
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
  // Background cells
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'rh-cell';
      g.appendChild(cell);
    }
  }
}

// Convert grid col/row to pixel offsets within the grid element.
// The grid has padding=GAP on all sides, then cells are CELL px with GAP between.
function cellPx(col, row) {
  return {
    x: GAP + col * (CELL + GAP),
    y: GAP + row * (CELL + GAP),
  };
}

function renderLevel(levelIdx) {
  const g = document.getElementById('rhGrid');
  // Remove any existing block elements (leave background cells)
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

  // Remove old element if it exists (for re-renders)
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

  const dotBase = `position:absolute;width:12px;height:12px;border-radius:50%;
    background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.2);`;
  const btnStyle = `position:absolute;background:rgba(0,0,0,.5);
    border:2px solid rgba(255,255,255,.3);color:white;border-radius:4px;
    cursor:pointer;font-size:18px;padding:2px 8px;line-height:1;z-index:20;`;

  let html = '';

  if (dir === 'h') {
    // 3 dots on left (back) and right (fwd) edges
    html += `<span class="vdot" id="dot-${id}-back-0" style="${dotBase}left:5px;top:calc(50% - 21px);"></span>`;
    html += `<span class="vdot" id="dot-${id}-back-1" style="${dotBase}left:5px;top:calc(50% - 6px);"></span>`;
    html += `<span class="vdot" id="dot-${id}-back-2" style="${dotBase}left:5px;top:calc(50% + 9px);"></span>`;
    html += `<span class="vdot" id="dot-${id}-fwd-0"  style="${dotBase}right:5px;top:calc(50% - 21px);"></span>`;
    html += `<span class="vdot" id="dot-${id}-fwd-1"  style="${dotBase}right:5px;top:calc(50% - 6px);"></span>`;
    html += `<span class="vdot" id="dot-${id}-fwd-2"  style="${dotBase}right:5px;top:calc(50% + 9px);"></span>`;
    html += `<button class="dir-btn back-btn" style="${btnStyle}left:50%;top:50%;transform:translate(-110%,-50%);">${backArrow}</button>`;
    html += `<button class="dir-btn fwd-btn"  style="${btnStyle}left:50%;top:50%;transform:translate(10%,-50%);">${fwdArrow}</button>`;
  } else {
    // 3 dots on top (back) and bottom (fwd) edges
    html += `<span class="vdot" id="dot-${id}-back-0" style="${dotBase}top:5px;left:calc(50% - 21px);"></span>`;
    html += `<span class="vdot" id="dot-${id}-back-1" style="${dotBase}top:5px;left:calc(50% - 6px);"></span>`;
    html += `<span class="vdot" id="dot-${id}-back-2" style="${dotBase}top:5px;left:calc(50% + 9px);"></span>`;
    html += `<span class="vdot" id="dot-${id}-fwd-0"  style="${dotBase}bottom:5px;left:calc(50% - 21px);"></span>`;
    html += `<span class="vdot" id="dot-${id}-fwd-1"  style="${dotBase}bottom:5px;left:calc(50% - 6px);"></span>`;
    html += `<span class="vdot" id="dot-${id}-fwd-2"  style="${dotBase}bottom:5px;left:calc(50% + 9px);"></span>`;
    html += `<button class="dir-btn back-btn" style="${btnStyle}left:50%;top:50%;transform:translate(-50%,-110%);">${backArrow}</button>`;
    html += `<button class="dir-btn fwd-btn"  style="${btnStyle}left:50%;top:50%;transform:translate(-50%,10%);">${fwdArrow}</button>`;
  }

  if (type === 'target') {
    html += `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
      font-size:8px;letter-spacing:1px;opacity:.5;pointer-events:none;font-family:'Space Mono',monospace;">TARGET</div>`;
  }
  html += `<div class="vote-bar" id="bar-${id}" style="position:absolute;bottom:0;left:0;
    height:4px;width:0%;background:rgba(255,255,255,.55);border-radius:0 0 4px 4px;transition:width .2s;"></div>`;

  el.innerHTML = html;

  // Wire up vote buttons
  el.querySelector('.fwd-btn').addEventListener('click',  e => { e.stopPropagation(); castVote(id, 'fwd');  });
  el.querySelector('.back-btn').addEventListener('click', e => { e.stopPropagation(); castVote(id, 'back'); });

  // ── KEY FIX: size and position the block using absolute pixels ──
  // The grid uses CSS Grid for the background cells, but blocks float above it
  // as position:absolute children. The grid itself must be position:relative.
  const w = dir === 'h' ? size * (CELL + GAP) - GAP : CELL;
  const h = dir === 'v' ? size * (CELL + GAP) - GAP : CELL;
  const pos = cellPx(col, row);

  el.style.position = 'absolute';
  el.style.left     = pos.x + 'px';
  el.style.top      = pos.y + 'px';
  el.style.width    = w + 'px';
  el.style.height   = h + 'px';
  el.style.overflow = 'hidden';
  // Do NOT set display:flex — all children are position:absolute inside

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
  const myColor = playerColorMap[thisPlayerId]?.color ?? 0;
  const pvEl = document.getElementById('pv' + (myColor + 1));
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
  const counts = {};
  const playerVotes = {};

  Object.entries(votesForEvent || {}).forEach(([pid, v]) => {
    if (!v) return;
    playerVotes[pid] = v;
    if (!counts[v.blockId]) counts[v.blockId] = { fwd: 0, back: 0 };
    counts[v.blockId][v.dir]++;
  });

  document.querySelectorAll('.rh-block').forEach(el => {
    const bid = el.dataset.bid;
    const c = counts[bid] || { fwd: 0, back: 0 };
    const total = c.fwd + c.back;
    const bar = document.getElementById('bar-' + bid);
    if (bar) bar.style.width = Math.min(100, total / 3 * 100) + '%';
  });

  document.querySelectorAll('.vdot').forEach(d => {
    d.style.background = 'rgba(255,255,255,.15)';
    d.style.border = '1px solid rgba(255,255,255,.2)';
  });

  const colorValues = ['#e9c46a','#90be6d','#a8dadc'];

  Object.entries(playerColorMap).forEach(([pid, info]) => {
    const colorIdx = typeof info.color === 'number' ? info.color : 0;
    const colorVal = colorValues[colorIdx] || colorValues[0];
    const pvEl = document.getElementById('pv' + (colorIdx + 1));
    const v = playerVotes[pid];
    if (!v) { if (pvEl) pvEl.textContent = '—'; return; }

    const dotId = 'dot-' + v.blockId + '-' + v.dir + '-' + colorIdx;
    const dot = document.getElementById(dotId);
    if (dot) { dot.style.background = colorVal; dot.style.border = '1px solid ' + colorVal; }

    if (pvEl) {
      const blockEl = document.getElementById('rh-' + v.blockId);
      if (!blockEl) return;
      const bdir = blockEl.dataset.dir;
      pvEl.innerHTML = v.dir === 'fwd'
        ? (bdir === 'h' ? '→' : '↓')
        : (bdir === 'h' ? '←' : '↑');
    }
  });
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
    // Apply any buffered moves now that phase is confirmed moving
    maybeApplyPendingMoves();
  }
}

function maybeApplyPendingMoves() {
  if (_movesApplied) return;
  if (currentPhaseSnap?.current !== 'moving') return;
  // The event number in the phase snap tells us which round just resolved.
  // Moves were written under moves/{prevEvent}, which is eventNumber - 1
  // (controller increments eventNumber after writing moves).
  const resolvedEvent = (currentPhaseSnap.eventNumber || 0) - 1;
  if (_pendingMovesEvent !== resolvedEvent) return;
  if (Object.keys(_pendingMoves).length === 0) {
    // No moves this round — still mark applied and log
    _movesApplied = true;
    addLog('Round: no block moved', 'fail');
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

  // Collect intended moves (majority wins, ignoring validity for now)
  const intended = {};
  Object.entries(counts).forEach(([bid, c]) => {
    if (c.fwd === c.back) return;
    const el = document.getElementById('rh-' + bid);
    if (!el) return;
    const dir = el.dataset.dir;
    const fwdWins = c.fwd > c.back;
    const dc = dir === 'h' ? (fwdWins ? 1 : -1) : 0;
    const dr = dir === 'v' ? (fwdWins ? 1 : -1) : 0;
    intended[bid] = { dc, dr };
  });

  // Compute post-move positions for all intended movers, then validate
  // against the post-move world so that cooperative swaps are allowed.
  const postPositions = { ...blockPositions };
  Object.entries(intended).forEach(([bid, { dc, dr }]) => {
    const pos = blockPositions[bid];
    if (pos) postPositions[bid] = { col: pos.col + dc, row: pos.row + dr };
  });

  const moves = {};
  Object.entries(intended).forEach(([bid, { dc, dr }]) => {
    if (isValidMovePost(bid, dc, dr, postPositions)) {
      moves[bid] = { dc, dr };
    }
  });
  return moves;
}

// Validates a single block's move against a given position snapshot.
// This lets cooperative swaps work: each block's destination is checked
// against where *all* blocks land, not where they started.
function isValidMovePost(bid, dc, dr, positions) {
  const pos = positions[bid];
  if (!pos) return false;
  const el = document.getElementById('rh-' + bid);
  if (!el) return false;
  const size = parseInt(el.dataset.size);
  const dir  = el.dataset.dir;
  const type = el.dataset.type;

  // The new top-left after moving
  const newCol = pos.col;  // positions[bid] already has the post-move col/row
  const newRow = pos.row;

  if (dir === 'h') {
    // Check board bounds — target is allowed to slide off the right edge
    if (type === 'target' && dc === 1 && newCol + size > COLS) return true;
    if (newCol < 0 || newCol + size > COLS) return false;
    // Check no other block occupies the new cells (skip self)
    return !blockAtInPositions(newCol, newRow, bid, dir, size, positions);
  } else {
    if (newRow < 0 || newRow + size > ROWS) return false;
    return !blockAtInPositions(newCol, newRow, bid, dir, size, positions);
  }
}

// Check if any block OTHER than skipId occupies the rectangle [col,row,size,dir]
function blockAtInPositions(col, row, skipId, dir, size, positions) {
  for (const [bid, pos] of Object.entries(positions)) {
    if (bid === skipId) continue;
    if (pos.col >= COLS) continue; // already exited
    const el = document.getElementById('rh-' + bid);
    if (!el) continue;
    const bsize = parseInt(el.dataset.size);
    const bdir  = el.dataset.dir;

    // Check overlap between two blocks
    if (dir === 'h' && bdir === 'h') {
      if (pos.row !== row) continue;
      if (col < pos.col + bsize && col + size > pos.col) return true;
    } else if (dir === 'v' && bdir === 'v') {
      if (pos.col !== col) continue;
      if (row < pos.row + bsize && row + size > pos.row) return true;
    } else if (dir === 'h' && bdir === 'v') {
      // horizontal mover vs vertical block
      if (pos.col >= col && pos.col < col + size && row >= pos.row && row < pos.row + bsize) return true;
    } else {
      // vertical mover vs horizontal block
      if (pos.row >= row && pos.row < row + size && col >= pos.col && col < pos.col + bsize) return true;
    }
  }
  return false;
}

// Legacy helper still used by nothing — kept for safety
function blockAt(col, row, skipId) {
  for (const [bid, pos] of Object.entries(blockPositions)) {
    if (bid === skipId || pos.col >= COLS) continue;
    const el = document.getElementById('rh-' + bid);
    if (!el) continue;
    const size = parseInt(el.dataset.size);
    const dir  = el.dataset.dir;
    if (dir === 'h') { if (pos.row === row && col >= pos.col && col < pos.col + size) return true; }
    else              { if (pos.col === col && row >= pos.row && row < pos.row + size) return true; }
  }
  return false;
}

function applyMoves(moves) {
  let anyMoved = false;
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
    if (!pos) { console.warn('no position for', bid); return; }
    const el = document.getElementById('rh-' + bid);
    if (!el) return;
    const size = parseInt(el.dataset.size);
    const type = el.dataset.type;

    const newCol = pos.col + dc;
    const newRow = pos.row + dr;

    if (type === 'target' && dc === 1 && newCol + size > COLS) {
      // Target has slid past the exit — level cleared
      blockPositions[bid] = { col: COLS, row: pos.row };
      el.style.display = 'none';
      won = true;
    } else {
      blockPositions[bid] = { col: newCol, row: newRow };
      updateBlockPosition(bid, newCol, newRow);
    }
    anyMoved = true;
  });

  addLog(
    anyMoved ? `Round: ${Object.keys(moves).length} block(s) moved` : 'Round: no block moved',
    anyMoved ? 'success' : 'fail'
  );

  clearVoteDisplay();
  return won;
}

function clearVoteDisplay() {
  document.querySelectorAll('.rh-block').forEach(el => {
    const bid = el.dataset.bid;
    const bar = document.getElementById('bar-' + bid);
    if (bar) bar.style.width = '0%';
  });
  document.querySelectorAll('.vdot').forEach(d => {
    d.style.background = 'rgba(255,255,255,.15)';
    d.style.border = '1px solid rgba(255,255,255,.2)';
  });
  document.querySelectorAll('.dir-btn').forEach(b => {
    b.style.background = 'rgba(0,0,0,.5)';
    b.style.borderColor = 'rgba(255,255,255,.3)';
  });
  ['pv1','pv2','pv3'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '—';
  });
  myVote = null;
}

function addLog(msg, type) {
  const log = document.getElementById('logEl');
  const e = document.createElement('div');
  e.className = 'log-entry ' + (type || '');
  e.textContent = msg;
  log.prepend(e);
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
  if (currentLevelSnap?.state === 'survey' || currentLevelSnap?.state === 'ended') return;

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
      if (typeof data.arrivalColor === 'number') playerColorMap[pid].color = data.arrivalColor;
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
    // nodeName is the eventNumber; newState is { bid: {dc,dr}, ... } for that event.
    // Firebase fires this once per event node (or when the whole subtree updates).
    const eventNum = parseInt(nodeName);
    if (newState && typeof newState === 'object') {
      // Merge into pending buffer for this event
      if (eventNum !== _pendingMovesEvent) {
        _pendingMoves = {};
        _pendingMovesEvent = eventNum;
        _movesApplied = false;
      }
      Object.entries(newState).forEach(([bid, m]) => {
        if (m) _pendingMoves[bid] = { dc: Number(m.dc), dr: Number(m.dr) };
      });
      // Apply only if we're in moving phase and haven't applied yet
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
  if (!info || typeof info.color !== 'number') return;
  const nameEl = document.getElementById('pname' + (info.color + 1));
  if (nameEl) nameEl.textContent = info.name + (pid === thisPlayerId ? ' (you)' : '');
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
    addLog('Level ' + (L.index + 1) + ' started', 'success');
  } else if (L.state === 'survey') {
    showBetweenLevelSurvey(L.index);
  } else if (L.state === 'ended') {
    showFinalSurvey();
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

    if (action === 'advance') {
      if (stateName === 'survey') {
        const ids = Object.keys(playerColorMap);
        const allDone = ids.length > 0 && ids.every(id => !!surveyDone[id]);
        if (!allDone) return { isAllowed: false, newState: null };
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

  if (isLast) {
    lcScreen.innerHTML = `
      <div class="lc-title">All Levels Complete!</div>
      <div class="lc-sub">Redirecting to final questionnaire…</div>
    `;
    setTimeout(showFinalSurvey, 2500);
    return;
  }

  const card = document.createElement('div');
  card.className = 'survey-card';
  card.innerHTML = `
    <div class="lc-title" style="font-size:22px; margin-bottom:10px;">Level ${levelIdx + 1} Complete!</div>
    <p style="margin-bottom:16px;">Before Level ${levelIdx + 2}, please answer a few quick questions.</p>
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
  submitBtn.textContent = 'Submit & Continue';
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
  lcScreen.innerHTML = `<div class="lc-sub">Thanks! Waiting for other players…</div>`;

  updateStateTransaction('level', 'markDone', {});
  updateStateTransaction('level', 'advance', {});
}

// ─────────────────────────────────────────
//  Final survey
// ─────────────────────────────────────────
function showFinalSurvey() {
  document.getElementById('gameScreen').style.display = 'none';
  document.getElementById('levelCompleteScreen').style.display = 'none';

  const container = document.getElementById('teammate-questions');
  container.innerHTML = '';

  Object.entries(playerColorMap).forEach(([pid, info]) => {
    if (pid === thisPlayerId) return;
    const colorIdx = info.color ?? 0;
    const name = info.name || `Player ${colorIdx + 1}`;

    const block = document.createElement('div');
    block.className = 'teammate-block';
    block.innerHTML = `
      <div style="font-weight:bold; margin-bottom:12px;">${name}</div>
      <label><strong>This player is a good teammate.</strong></label>
      <div class="likert-row mb-2"><span>Completely disagree</span>
        ${[1,2,3,4,5,6,7].map(v=>`<label><input type="radio" name="collab-${pid}" value="${v}"> ${v}</label>`).join(' ')}
        <span>Completely agree</span></div>
      <label><strong>This player and I were a team.</strong></label>
      <div class="likert-row mb-2"><span>Completely disagree</span>
        ${[1,2,3,4,5,6,7].map(v=>`<label><input type="radio" name="team-${pid}" value="${v}"> ${v}</label>`).join(' ')}
        <span>Completely agree</span></div>
      <label><strong>This player was competent.</strong></label>
      <div class="likert-row mb-2"><span>Completely disagree</span>
        ${[1,2,3,4,5,6,7].map(v=>`<label><input type="radio" name="competent-${pid}" value="${v}"> ${v}</label>`).join(' ')}
        <span>Completely agree</span></div>
      <label><strong>I understood this player's intentions.</strong></label>
      <div class="likert-row mb-2"><span>Completely disagree</span>
        ${[1,2,3,4,5,6,7].map(v=>`<label><input type="radio" name="intentionthem-${pid}" value="${v}"> ${v}</label>`).join(' ')}
        <span>Completely agree</span></div>
      <label><strong>This player understood my intentions.</strong></label>
      <div class="likert-row mb-2"><span>Completely disagree</span>
        ${[1,2,3,4,5,6,7].map(v=>`<label><input type="radio" name="intentionmy-${pid}" value="${v}"> ${v}</label>`).join(' ')}
        <span>Completely agree</span></div>
      <label><strong>This player was easy to play with.</strong></label>
      <div class="likert-row mb-2"><span>Completely disagree</span>
        ${[1,2,3,4,5,6,7].map(v=>`<label><input type="radio" name="easy-${pid}" value="${v}"> ${v}</label>`).join(' ')}
        <span>Completely agree</span></div>
      <label><strong>This player was fun to play with.</strong></label>
      <div class="likert-row mb-2"><span>Completely disagree</span>
        ${[1,2,3,4,5,6,7].map(v=>`<label><input type="radio" name="fun-${pid}" value="${v}"> ${v}</label>`).join(' ')}
        <span>Completely agree</span></div>
      <label><strong>This player and I had a similar playing style.</strong></label>
      <div class="likert-row mb-2"><span>Completely disagree</span>
        ${[1,2,3,4,5,6,7].map(v=>`<label><input type="radio" name="similar-${pid}" value="${v}"> ${v}</label>`).join(' ')}
        <span>Completely agree</span></div>
      <label><strong>This player was human-like.</strong></label>
      <div class="likert-row mb-2"><span>Completely disagree</span>
        ${[1,2,3,4,5,6,7].map(v=>`<label><input type="radio" name="human-${pid}" value="${v}"> ${v}</label>`).join(' ')}
        <span>Completely agree</span></div>
      <label><strong>How would you describe this teammate? (min 20 chars)</strong></label><br>
      <textarea id="desc-${pid}" rows="3" style="width:100%;max-width:500px;margin-top:5px;background:#111;border:1px solid #333;color:#eee;border-radius:4px;padding:8px;"></textarea>
    `;
    container.appendChild(block);
  });

  const finalCard = document.createElement('div');
  finalCard.className = 'mb-4';
  finalCard.innerHTML = `
    <div><label><strong>How satisfied are you with the gameplay overall?</strong></label>
    <div class="likert-row">${[1,2,3,4,5,6,7].map(v=>`<label><input type="radio" name="satisfaction" value="${v}"> ${v}</label>`).join(' ')}</div></div>
    <div><label><strong>How difficult was the last level?</strong></label>
    <div class="likert-row">${[1,2,3,4,5,6,7].map(v=>`<label><input type="radio" name="difficulty" value="${v}"> ${v}</label>`).join(' ')}</div></div>
    <div><label><strong>Did you feel like you contributed?</strong></label>
    <div class="likert-row">${[1,2,3,4,5,6,7].map(v=>`<label><input type="radio" name="contribution" value="${v}"> ${v}</label>`).join(' ')}</div></div>
  `;
  document.getElementById('postTrialForm').prepend(finalCard);

  const submitBtn = document.createElement('button');
  submitBtn.className = 'submit-btn';
  submitBtn.textContent = 'Submit';
  submitBtn.onclick = submitFinalSurvey;
  document.getElementById('postTrialForm').appendChild(submitBtn);

  document.getElementById('finishScreen').style.display = 'block';
}

function submitFinalSurvey() {
  const satisfaction = document.querySelector('input[name="satisfaction"]:checked')?.value || null;
  const difficulty   = document.querySelector('input[name="difficulty"]:checked')?.value || null;
  const contribution = document.querySelector('input[name="contribution"]:checked')?.value || null;

  if (!satisfaction || !difficulty || !contribution) {
    alert('Please answer all general questions before submitting.');
    return;
  }

  const teammateResponses = {};
  let incomplete = false;

  Object.entries(playerColorMap).forEach(([pid, info]) => {
    if (pid === thisPlayerId) return;
    const fields = ['collab','team','competent','intentionthem','intentionmy','easy','fun','similar','human'];
    const responses = {};
    fields.forEach(f => {
      const el = document.querySelector(`input[name="${f}-${pid}"]:checked`);
      responses[f] = el ? el.value : null;
      if (!el) incomplete = true;
    });
    const desc = document.getElementById(`desc-${pid}`)?.value.trim() || '';
    if (desc.length < 20) incomplete = true;
    teammateResponses[pid] = { ...responses, description: desc };
  });

  if (incomplete) {
    alert('Please answer all questions about your teammates. Descriptions must be at least 20 characters.');
    return;
  }

  updateStateDirect(`players/${thisPlayerId}`, { satisfaction, difficulty, contribution, teammates: teammateResponses }, 'finalSurvey');

  document.getElementById('messageFinish').innerHTML = '<p>Thank you! Your responses have been recorded.<br>Redirecting to Prolific…</p>';
  setTimeout(() => {
    window.location.href = 'https://app.prolific.com/submissions/complete?cc=C71S2AXW';
    leaveSession();
  }, 3000);
}

function generateRandomName() {
  const adj = ['Swift','Bold','Bright','Cool','Sharp','Calm','Quick','Keen','Brave','Clever'];
  const noun = ['Fox','Owl','Bear','Hawk','Wolf','Lynx','Deer','Crow','Pike','Seal'];
  return adj[Math.floor(Math.random()*adj.length)] + noun[Math.floor(Math.random()*noun.length)];
}