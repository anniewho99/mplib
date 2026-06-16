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
const MAX_ROUNDS_PER_LEVEL = 100;
const NUM_LEVELS = 4;

// ── AI configuration ──────────────────────────────────────────────────────────
const AI_MODE        = 'follower'; // 'initiator' | 'follower' | null
const AI_PLAYER_ID   = '_ai_player';
const AI_PLAYER_NAME = 'Robot Player';
const AI_COLOR       = 2;           // purple (index 2)
// ─────────────────────────────────────────────────────────────────────────────

const NUM_PLAYERS = AI_MODE ? 1 : 3;


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

const studyId = typeof GameName !== 'undefined' ? GameName : 'rushhour_2_follow';
const sessionConfig = {
  minPlayersNeeded:              typeof MinPlayers !== 'undefined' ? MinPlayers : NUM_PLAYERS,
  maxPlayersNeeded:              typeof MaxPlayers !== 'undefined' ? MaxPlayers : NUM_PLAYERS,
  maxParallelSessions:           typeof MaxSessions !== 'undefined' ? MaxSessions : 0,
  allowReplacements:             typeof PlayerReplacement !== 'undefined' ? PlayerReplacement : false,
  exitDelayWaitingRoom:          5,      // 5 second countdown once all players joined
  maxDurationBelowMinPlayersNeeded: 300, // kick after 5 minutes waiting
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

// AI player state
let aiVoteTimeoutId      = null;   // scheduled setTimeout for AI vote this round
let _aiRegistered        = false;  // guard: only register once per session
let _lastAIScheduledKey  = '';     // 'phase|endTime' key — same guard as groupestimation.js

// Moves are buffered here as Firebase fires one child at a time.
// We apply them all at once when the phase switches to 'moving'.
let _pendingMoves = {};      // bid → { dc, dr }
let _pendingMovesEvent = -1; // which event these moves belong to
let _movesApplied = false;   // guard: apply only once per event

// const instructionSteps = [
//   {
//     text: `Welcome to multi-player Rush Hour!\n\nWork together to solve each level. The game is played on a 6×6 grid, just like the classic Rush Hour puzzle.\n\nThe goal is to move the red TARGET block to the EXIT on the right side of the board.\n\nBlocks can slide only in the direction they face: horizontally or vertically.\n\nTry to work together to solve the puzzle in as few moves as possible!`,
//     demo: 'board',
//   },
//   {
//     text: `You are the yellow player 🟡\n\nEach round you have 5 seconds to vote on which block to move and in which direction. There is a timer at the bottom now. Click any arrow on any block to cast your vote. You can change it anytime before the timer runs out. Your choice will be represented by a yellow dot on the block. \n\nTry it now — click any arrow!`,
//     demo: 'board-interactive',
//   },
//   {
//     text: `You'll be playing with one other real person and one robot player.\n\nThe human player will appear as green 🟢, the robot player as purple 🟣. You will see their choices the second they click on any of the buttons — coordination is key!`,
//     demo: 'teammates',
//   },
//   {
//     text: `Key mechanic: if multiple players vote for the same block in the same direction, it moves that many cells in one round.\n\nThe green player has already voted to move the red block right ➡. Click the same arrow to move it 2 cells at once!`,
//     demo: 'multivote',
//   },
//   {
//     text: `That's it! You'll play 4 levels together. Your team need to finish a level within 100 rounds. \n\nYour player name is: ${playerName}\n\nPress Join Game when you're ready! Please do not refresh the page after joining the game.`,
//     showNameEntry: true,
//   },
// ];

const instructionSteps = [
  {
    text: `Welcome to multi-player Rush Hour!\n\nWork together to solve each level. The game is played on a 6×6 grid, just like the classic Rush Hour puzzle.\n\nThe goal is to move the red TARGET block to the EXIT on the right side of the board.\n\nBlocks can slide only in the direction they face: horizontally or vertically.\n\nTry to work together to solve the puzzle in as few moves as possible!`,
    demo: 'board',
  },
  {
    text: `You are the yellow player 🟡\n\nEach round you have 5 seconds to vote on which block to move and in which direction. There is a timer at the bottom now. Click any arrow on any block to cast your vote. You can change it anytime before the timer runs out. Your choice will be represented by a yellow dot on the block. \n\nTry it now — click any arrow!`,
    demo: 'board-interactive',
  },
  {
    text: `You'll be playing with one robot player.\n\nThe robot player will appear as purple 🟣. You will see their choices the second they click on any of the buttons — coordination is key!`,
    demo: 'teammates',
  },
  {
    text: `Key mechanic: if multiple players vote for the same block in the same direction, it moves that many cells in one round.\n\nThe green player has already voted to move the red block right ➡. Click the same arrow to move it 2 cells at once!`,
    demo: 'multivote',
  },
  {
    text: `That's it! You'll play 4 levels together. Your team need to finish a level within 100 rounds. \n\nYour player name is: ${playerName}\n\nPress Join Game when you're ready! Please do not refresh the page after joining the game.`,
    showNameEntry: true,
  },
];

// ── Mini practice board ──
const DEMO_CELL = 68, DEMO_GAP = 4, DEMO_COLS = 6, DEMO_ROWS = 6;
let demoPracticeTimer = null;
let demoVoted = false;
let demoMultiVoted = false;

function demoCellPx(col, row) {
  return { x: DEMO_GAP + col*(DEMO_CELL+DEMO_GAP), y: DEMO_GAP + row*(DEMO_CELL+DEMO_GAP) };
}

function buildDemoGrid(container) {
  // Exact pixel size of the grid content
  const totalW = DEMO_GAP + 6*(DEMO_CELL+DEMO_GAP);
  const totalH = DEMO_GAP + 6*(DEMO_CELL+DEMO_GAP);

  // Wrapper sized exactly to grid — exit marker attached here
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

  // Exit marker on the wrapper, aligned to row 2
  const exit = document.createElement('div');
  exit.style.cssText = `position:absolute;right:-12px;top:${DEMO_GAP+2*(DEMO_CELL+DEMO_GAP)}px;width:10px;height:${DEMO_CELL}px;background:#2a9d8f;border-radius:0 4px 4px 0;display:flex;align-items:center;justify-content:center;writing-mode:vertical-rl;font-size:7px;font-family:'Space Mono',monospace;color:white;`;
  exit.textContent = 'EXIT';
  wrapper.appendChild(exit);

  container.appendChild(wrapper);
  return grid;  // return grid so blocks are appended to it
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
  demoMultiVoted = false;
  const demo = document.getElementById('instructionDemo');
  demo.innerHTML = '';

  if (stepIdx === 0) {
    // Static board
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
    // Yellow badge + interactive board + timer
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

    const badge = document.createElement('div');
    badge.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 14px;background:#1a1a1a;border-radius:8px;border:1px solid #2a2a2a;width:fit-content;';
    badge.innerHTML = '<div style="width:16px;height:16px;border-radius:50%;background:#f4c400;box-shadow:0 0 8px #f4c400;"></div><span style="font-family:\'Space Mono\',monospace;font-size:12px;color:#f4c400;">You are the yellow player</span>';
    wrapper.appendChild(badge);

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

    // Track which block+dir was voted
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
        // Remove old yellow dot
        if (demoYellowDot) demoYellowDot.remove();
        // Show yellow dot on voted side
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
            // Animate the voted block moving 1 cell
            const dir = demoVoteBlock.dataset.dir;
            const col = parseInt(demoVoteBlock.dataset.col);
            const row = parseInt(demoVoteBlock.dataset.row);
            const size = parseInt(demoVoteBlock.dataset.size);
            const isFwd = demoVoteDir === 'fwd';
            const newCol = dir === 'h' ? col + (isFwd ? 1 : -1) : col;
            const newRow = dir === 'v' ? row + (isFwd ? 1 : -1) : row;
            // Bounds check
            const validH = dir === 'h' && newCol >= 0 && newCol + size <= DEMO_COLS;
            const validV = dir === 'v' && newRow >= 0 && newRow + size <= DEMO_ROWS;
            if (validH || validV) {
              const pos = demoCellPx(newCol, newRow);
              demoVoteBlock.style.left = pos.x + 'px';
              demoVoteBlock.style.top  = pos.y + 'px';
              demoVoteBlock.dataset.col = newCol;
              demoVoteBlock.dataset.row = newRow;
            }
            // Clear dot and highlight
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
            // No vote — restart countdown
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

  // else if (stepIdx === 2) {
  //   // Three player colors
  //   const wrap = document.createElement('div');
  //   wrap.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;';
  //   [['#f4c400','You (yellow)'], ['#44cc44','Green player'], ['#9b59ff','Robot player']].forEach(function(pair) {
  //     const item = document.createElement('div');
  //     item.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px 16px;background:#1a1a1a;border-radius:8px;border:1px solid #2a2a2a;';
  //     item.innerHTML = '<div style="width:22px;height:22px;border-radius:50%;background:' + pair[0] + ';box-shadow:0 0 8px ' + pair[0] + ';flex-shrink:0;"></div><div style="font-family:\'Space Mono\',monospace;font-size:12px;color:' + pair[0] + ';">' + pair[1] + '</div>';
  //     wrap.appendChild(item);
  //   });
  //   demo.appendChild(wrap);
  // }

  else if (stepIdx === 2) {
    // Three player colors
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;';
    [['#f4c400','You (yellow)'], ['#9b59ff','Robot player']].forEach(function(pair) {
      const item = document.createElement('div');
      item.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px 16px;background:#1a1a1a;border-radius:8px;border:1px solid #2a2a2a;';
      item.innerHTML = '<div style="width:22px;height:22px;border-radius:50%;background:' + pair[0] + ';box-shadow:0 0 8px ' + pair[0] + ';flex-shrink:0;"></div><div style="font-family:\'Space Mono\',monospace;font-size:12px;color:' + pair[0] + ';">' + pair[1] + '</div>';
      wrap.appendChild(item);
    });
    demo.appendChild(wrap);
  }

  else if (stepIdx === 3) {
    // Multi-vote demo
    const gridWrap = document.createElement('div');
    gridWrap.style.cssText = 'position:relative;';
    const grid = buildDemoGrid(gridWrap);
    const target = addDemoBlock(grid, 'target', 'h', 2, 2, 2,
      '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:9px;font-family:\'Space Mono\',monospace;opacity:.6;">TARGET</div>');

    const greenDot = document.createElement('span');
    greenDot.style.cssText = 'position:absolute;right:6px;top:calc(50% - 6px);width:13px;height:13px;border-radius:50%;background:#44cc44;box-shadow:0 0 5px #44cc44;z-index:15;';
    target.appendChild(greenDot);

    const btnStyle = 'position:absolute;background:rgba(0,0,0,.6);border:2px solid rgba(255,255,255,.5);color:white;border-radius:5px;cursor:pointer;font-size:18px;padding:2px 8px;line-height:1;z-index:20;font-weight:bold;';
    const fwdBtn = document.createElement('button');
    fwdBtn.innerHTML = '\u2192';
    fwdBtn.style.cssText = btnStyle + 'right:28px;top:50%;transform:translateY(-50%);';

    const resultEl = document.createElement('div');
    resultEl.style.cssText = 'margin-top:14px;font-family:"Space Mono",monospace;font-size:13px;color:#2a9d8f;text-align:center;min-height:20px;';

    const nextBtn = document.getElementById('nextInstruction');
    nextBtn.style.display = 'none';

    fwdBtn.onclick = function() {
      if (demoMultiVoted) return;
      demoMultiVoted = true;
      fwdBtn.style.background = 'rgba(255,255,255,.25)';
      fwdBtn.style.borderColor = 'white';
      const yellowDot = document.createElement('span');
      yellowDot.style.cssText = 'position:absolute;right:6px;top:calc(50% + 8px);width:13px;height:13px;border-radius:50%;background:#f4c400;box-shadow:0 0 5px #f4c400;z-index:15;';
      target.appendChild(yellowDot);
      setTimeout(function() {
        const pos = demoCellPx(4, 2);
        target.style.left = pos.x + 'px';
        resultEl.textContent = '2 votes \u2192 moves 2 cells! \u2713';
        nextBtn.style.display = 'inline-block';
      }, 600);
    };

    target.appendChild(fwdBtn);
    demo.appendChild(gridWrap);
    demo.appendChild(resultEl);
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

// If a player refreshes or closes the tab mid-session, signal disconnect to all other clients.
window.addEventListener('beforeunload', () => {
  leaveSession();
});

let _waitingRoomTimeoutId = null;
let _waitingRoomDeadline = null;
const WAITING_ROOM_TIMEOUT_MS = 5 * 60 * 1000;

function joinedWaitingRoom() {
  _waitingRoomDeadline = Date.now() + WAITING_ROOM_TIMEOUT_MS;
  document.getElementById('messageWaitingRoom').innerHTML =
    `<div>1 / ${NUM_PLAYERS} players connected.</div>
     <div style="color:#555;font-size:12px;margin-top:8px;">Session will close if not enough players join within 5:00.</div>`;
  _startWaitingRoomCountdown();
}

function _startWaitingRoomCountdown() {
  if (_waitingRoomTimeoutId) return;
  _waitingRoomTimeoutId = setInterval(() => {
    const secsLeft = Math.ceil((_waitingRoomDeadline - Date.now()) / 1000);
    if (secsLeft <= 0) {
      clearInterval(_waitingRoomTimeoutId);
      _waitingRoomTimeoutId = null;
      document.getElementById('waitingRoomScreen').style.display = 'none';
      const msg = document.createElement('div');
      msg.style.cssText = 'max-width:500px;margin:80px auto;text-align:center;color:#f0f0f0;font-family:"Space Mono",monospace;';
      msg.innerHTML = `<h2 style="color:#e63946;margin-bottom:16px;">Session Timed Out</h2>
        <p style="color:#aaa;">Not enough players joined within 5 minutes.<br>
        Please return to Prolific and try again later.</p>`;
      document.body.appendChild(msg);
      leaveSession();
      return;
    }
    const [countdown] = getWaitRoomInfo();
    if (!countdown) {
      const n = getNumberCurrentPlayers();
      const mins = Math.floor(secsLeft / 60);
      const secs = secsLeft % 60;
      const timeStr = mins + ':' + secs.toString().padStart(2, '0');
      document.getElementById('messageWaitingRoom').innerHTML =
        `<div>${n} / ${NUM_PLAYERS} players connected. Waiting for ${NUM_PLAYERS - n} more…</div>
         <div style="color:#555;font-size:12px;margin-top:8px;">Session will close in ${timeStr} if not enough players join.</div>`;
    }
  }, 1000);
}

function updateWaitingRoom(info) {
  const [countdown, secsLeft] = getWaitRoomInfo();
  const n = getNumberCurrentPlayers();
  const el = document.getElementById('messageWaitingRoom');
  if (countdown) {
    el.innerHTML = `<div style="color:var(--exit)">${n} / ${NUM_PLAYERS} players ready — starting in ${secsLeft}s…</div>`;
  } else {
    el.innerHTML =
      `<div>${n} / ${NUM_PLAYERS} players connected. Waiting for ${NUM_PLAYERS - n} more…</div>
       <div style="color:#555;font-size:12px;margin-top:8px;">Session will close if not enough players join within 5 minutes.</div>`;
  }
}

function startSession() {
  if (_waitingRoomTimeoutId) { clearInterval(_waitingRoomTimeoutId); _waitingRoomTimeoutId = null; }
  document.getElementById('waitingRoomScreen').style.display = 'none';
  document.getElementById('gameScreen').style.display = 'flex';
  initGame();
}

function updateOngoingSession() {}
function endSession() {
  // Show disconnection message on all screens
  document.getElementById('gameScreen').style.display = 'none';
  document.getElementById('waitingRoomScreen').style.display = 'none';
  const msg = document.createElement('div');
  msg.style.cssText = 'max-width:500px;margin:80px auto;text-align:center;color:#f0f0f0;font-family:"Space Mono",monospace;';
  msg.innerHTML = `<h2 style="color:#e63946;margin-bottom:16px;">Session Ended</h2>
    <p style="color:#aaa;">A player disconnected. The session has been closed.<br>
    Please return to Prolific and try again.</p>`;
  document.body.appendChild(msg);
}

function removePlayerState(playerId) {
  // A player disconnected — end the session for everyone
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
  if (AI_MODE) registerAIPlayer();
}

function assignColors() {
  playerColorMap[thisPlayerId] = {
    color: 0,  // always yellow for self
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
  if (!AI_MODE && NUM_PLAYERS < 3) {
    const pb3 = document.getElementById('pb3');
    if (pb3) pb3.style.display = 'none';
  }
  if (AI_MODE && NUM_PLAYERS === 1) {
    const pb2 = document.getElementById('pb2');
    if (pb2) pb2.style.display = 'none';
  }
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

  const dotBase = `width:13px;height:13px;border-radius:50%;display:inline-block;`;
  const btnStyle = `position:absolute;background:rgba(0,0,0,.6);
    border:2px solid rgba(255,255,255,.5);color:white;border-radius:5px;
    cursor:pointer;font-size:22px;padding:3px 10px;line-height:1;z-index:20;font-weight:bold;`;

  let html = '';

  if (dir === 'h') {
    html += `<div id="bdots-${id}" style="position:absolute;left:6px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:3px;">
      <span class="vdot" id="dot-${id}-back-0" style="${dotBase}"></span>
      <span class="vdot" id="dot-${id}-back-1" style="${dotBase}"></span>
      <span class="vdot" id="dot-${id}-back-2" style="${dotBase}"></span>
    </div>`;
    html += `<div id="fdots-${id}" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:3px;">
      <span class="vdot" id="dot-${id}-fwd-0" style="${dotBase}"></span>
      <span class="vdot" id="dot-${id}-fwd-1" style="${dotBase}"></span>
      <span class="vdot" id="dot-${id}-fwd-2" style="${dotBase}"></span>
    </div>`;
    html += `<button class="dir-btn back-btn" style="${btnStyle}left:28px;top:50%;transform:translateY(-50%);">${backArrow}</button>`;
    html += `<button class="dir-btn fwd-btn"  style="${btnStyle}right:28px;top:50%;transform:translateY(-50%);">${fwdArrow}</button>`;
  } else {
    html += `<div id="bdots-${id}" style="position:absolute;top:6px;left:50%;transform:translateX(-50%);display:flex;flex-direction:row;gap:3px;">
      <span class="vdot" id="dot-${id}-back-0" style="${dotBase}"></span>
      <span class="vdot" id="dot-${id}-back-1" style="${dotBase}"></span>
      <span class="vdot" id="dot-${id}-back-2" style="${dotBase}"></span>
    </div>`;
    html += `<div id="fdots-${id}" style="position:absolute;bottom:6px;left:50%;transform:translateX(-50%);display:flex;flex-direction:row;gap:3px;">
      <span class="vdot" id="dot-${id}-fwd-0" style="${dotBase}"></span>
      <span class="vdot" id="dot-${id}-fwd-1" style="${dotBase}"></span>
      <span class="vdot" id="dot-${id}-fwd-2" style="${dotBase}"></span>
    </div>`;
    html += `<button class="dir-btn back-btn" style="${btnStyle}top:28px;left:50%;transform:translateX(-50%);">${backArrow}</button>`;
    html += `<button class="dir-btn fwd-btn"  style="${btnStyle}bottom:28px;left:50%;transform:translateX(-50%);">${fwdArrow}</button>`;
  }

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
  const playerVotes = {};
  Object.entries(votesForEvent || {}).forEach(([pid, v]) => {
    if (!v) return;
    playerVotes[pid] = v;
  });

  // Reset all dots to empty
  document.querySelectorAll('.vdot').forEach(d => {
    d.className = 'vdot';
  });

  const colorClass = ['p1f', 'p2f', 'p3f'];
  const colorValues = ['#f4c400', '#44cc44', '#9b59ff'];

  Object.entries(playerColorMap).forEach(([pid, info]) => {
    const colorIdx = typeof info.color === 'number' ? info.color : 0;
    const pvEl = document.getElementById('pv' + (colorIdx + 1));
    const v = playerVotes[pid];

    if (!v) { if (pvEl) pvEl.textContent = '—'; return; }

    // Light up this player's dot on the correct direction edge
    const dot = document.getElementById(`dot-${v.blockId}-${v.dir}-${colorIdx}`);
    if (dot) dot.className = 'vdot ' + colorClass[colorIdx];

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
    // Always reset highlight when toggling — clears ghost highlights from previous round
    btn.style.background = 'rgba(0,0,0,.6)';
    btn.style.borderColor = 'rgba(255,255,255,.5)';
  });
}

function renderPhase(p) {
  if (!p || !p.current) return;
  if (p.current === 'voting') {
    startLocalTimer(p.endTime);
    setButtonsEnabled(true);
    // Schedule AI vote once per unique voting round, using phase|endTime as key
    // (same guard as groupestimation.js — more robust than eventNumber which may lag)
    if (AI_MODE) {
      const key = `voting|${p.endTime}`;
      if (_lastAIScheduledKey !== key) {
        _lastAIScheduledKey = key;
        scheduleAIVote();
      }
    }
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

  // Collect intended moves — distance = margin, clamped to board bounds
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

    // Clamp n to how far the block can actually move
    if (dir === 'h') {
      if (fwdWins) {
        // Target can exit — allow up to COLS - pos.col (off board), others stop at COLS - size
        const maxFwd = type === 'target' ? (COLS - pos.col) : (COLS - size - pos.col);
        n = Math.min(n, Math.max(0, maxFwd));
      } else {
        n = Math.min(n, pos.col); // can't go past col 0
      }
    } else {
      if (fwdWins) {
        n = Math.min(n, ROWS - size - pos.row);
      } else {
        n = Math.min(n, pos.row);
      }
    }

    // Clamp n further to the nearest stationary block in the path.
    // The grid-edge clamp above only handles the wall; this handles neighbouring blocks.
    // Without this, n=2 with 1 cell of space would overshoot into the blocker and
    // then fail the destination-overlap check, cancelling the move entirely instead
    // of moving the 1 available cell.
    for (const [otherId, otherPos] of Object.entries(blockPositions)) {
      if (otherId === bid) continue;
      if (otherPos.col >= COLS) continue;
      const otherEl = document.getElementById('rh-' + otherId);
      if (!otherEl) continue;
      const os = parseInt(otherEl.dataset.size);
      const od = otherEl.dataset.dir;

      if (dir === 'h') {
        // Other block occupies rows [otherPos.row .. otherPos.row + (od==='v' ? os-1 : 0)]
        //                     cols [otherPos.col .. otherPos.col + (od==='h' ? os-1 : 0)]
        const otherRowMin = otherPos.row;
        const otherRowMax = otherPos.row + (od === 'v' ? os - 1 : 0);
        const otherColMin = otherPos.col;
        const otherColMax = otherPos.col + (od === 'h' ? os - 1 : 0);
        // Our block occupies row pos.row, cols pos.col .. pos.col+size-1
        if (pos.row >= otherRowMin && pos.row <= otherRowMax) {
          if (fwdWins && otherColMin >= pos.col + size) {
            n = Math.min(n, otherColMin - (pos.col + size));
          } else if (!fwdWins && otherColMax < pos.col) {
            n = Math.min(n, pos.col - otherColMax - 1);
          }
        }
      } else { // dir === 'v'
        const otherRowMin = otherPos.row;
        const otherRowMax = otherPos.row + (od === 'v' ? os - 1 : 0);
        const otherColMin = otherPos.col;
        const otherColMax = otherPos.col + (od === 'h' ? os - 1 : 0);
        // Our block occupies col pos.col, rows pos.row .. pos.row+size-1
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

  // Build plans with destination cells for each mover
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

    // Bounds check — target exit is always valid
    if (type === 'target' && dc > 0 && newCol + size > COLS) {
      plans.push({ bid, dc, dr, cells: [], isExit: true });
      return;
    }
    // (bounds already clamped in intended — this is just a safety guard)
    if (dir === 'h' && (newCol < 0 || newCol + size > COLS)) return;
    if (dir === 'v' && (newRow < 0 || newRow + size > ROWS)) return;

    // Compute destination cells (full footprint at new position)
    const cells = [];
    if (dir === 'h') {
      for (let c = newCol; c < newCol + size; c++) cells.push({ col: c, row: newRow });
    } else {
      for (let r = newRow; r < newRow + size; r++) cells.push({ col: newCol, row: r });
    }

    // Also check against stationary blocks (non-movers)
    let blockedByStationary = false;
    for (const cell of cells) {
      for (const [otherId, otherPos] of Object.entries(blockPositions)) {
        if (otherId === bid || otherId in intended) continue; // skip self and movers
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

  // Collision check between movers:
  // If A's destination overlaps B's destination, block BOTH (genuine conflict).
  // But if B's destination overlaps A's *current* position AND A is moving away,
  // only block B — A's move is valid and B is trying to move into a cell A is leaving.
  for (let i = 0; i < plans.length; i++) {
    for (let j = i + 1; j < plans.length; j++) {
      const a = plans[i], b = plans[j];
      if (a.isExit || b.isExit) continue;

      const destOverlap = a.cells.some(ca => b.cells.some(cb => ca.col === cb.col && ca.row === cb.row));
      if (!destOverlap) continue;

      // Destinations overlap — figure out who's at fault.
      // Check if B is moving into A's destination (A has right of way since its dest is empty).
      // Check if A is moving into B's destination (B has right of way).
      // If both destinations conflict with each other symmetrically, block both.
      const aPos = blockPositions[a.bid];
      const bPos = blockPositions[b.bid];
      const aEl  = document.getElementById('rh-' + a.bid);
      const bEl  = document.getElementById('rh-' + b.bid);
      const aSize = parseInt(aEl.dataset.size), aDirEl = aEl.dataset.dir;
      const bSize = parseInt(bEl.dataset.size), bDirEl = bEl.dataset.dir;

      // Current cells of A and B
      const aCurrent = [];
      if (aDirEl === 'h') { for (let c = aPos.col; c < aPos.col + aSize; c++) aCurrent.push({ col: c, row: aPos.row }); }
      else                { for (let r = aPos.row; r < aPos.row + aSize; r++) aCurrent.push({ col: aPos.col, row: r }); }
      const bCurrent = [];
      if (bDirEl === 'h') { for (let c = bPos.col; c < bPos.col + bSize; c++) bCurrent.push({ col: c, row: bPos.row }); }
      else                { for (let r = bPos.row; r < bPos.row + bSize; r++) bCurrent.push({ col: bPos.col, row: r }); }

      // Does B's destination overlap A's CURRENT cells? (B moving into where A currently is)
      const bIntoAcurrent = b.cells.some(cb => aCurrent.some(ca => ca.col === cb.col && ca.row === cb.row));
      // Does A's destination overlap B's CURRENT cells? (A moving into where B currently is)
      const aIntoBcurrent = a.cells.some(ca => bCurrent.some(cb => ca.col === cb.col && ca.row === cb.row));

      if (bIntoAcurrent && !aIntoBcurrent) {
        // B is trying to move into A's current spot; A is moving away → only block B
        b.blocked = true;
      } else if (aIntoBcurrent && !bIntoAcurrent) {
        // A is trying to move into B's current spot; B is moving away → only block A
        a.blocked = true;
      } else {
        // Genuine head-on conflict — block both
        a.blocked = true;
        b.blocked = true;
      }
    }
  }

  const moves = {};
  plans.forEach(({ bid, dc, dr, blocked, isExit }) => {
    if (!blocked) moves[bid] = { dc, dr };
  });
  return moves;
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

    if (type === 'target' && dc > 0 && newCol + size > COLS) {
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

  clearVoteDisplay();
  return won;
}

function clearVoteDisplay() {
  document.querySelectorAll('.vdot').forEach(d => { d.className = 'vdot'; });
  document.querySelectorAll('.dir-btn').forEach(b => {
    b.style.background = 'rgba(0,0,0,.6)';
    b.style.borderColor = 'rgba(255,255,255,.5)';
  });
  ['pv1','pv2','pv3'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '—';
  });
  myVote = null;
}



// ─────────────────────────────────────────
//  BFS solver (used by AI player)
// ─────────────────────────────────────────

function buildBlockMeta(levelBlocks) {
  const meta = {};
  levelBlocks.forEach(b => { meta[b.id] = { dir: b.dir, size: b.size, type: b.type }; });
  return meta;
}

function blockMetaFromDOM() {
  const meta = {};
  document.querySelectorAll('.rh-block').forEach(el => {
    meta[el.dataset.bid] = { dir: el.dataset.dir, size: parseInt(el.dataset.size), type: el.dataset.type };
  });
  return meta;
}

function encodeBoardState(positions) {
  return Object.keys(positions).sort().map(id => {
    const p = positions[id];
    return `${id}:${p.col},${p.row}`;
  }).join(';');
}

function getValidMoves(positions, meta) {
  const moves = [];
  for (const [bid, pos] of Object.entries(positions)) {
    if (pos.col >= COLS) continue;
    const { dir, size, type } = meta[bid] || {};
    if (!dir) continue;
    const candidates = dir === 'h'
      ? [{ dc:  1, dr: 0, label: 'fwd' }, { dc: -1, dr: 0, label: 'back' }]
      : [{ dc: 0, dr:  1, label: 'fwd' }, { dc: 0, dr: -1, label: 'back' }];
    for (const { dc, dr, label } of candidates) {
      const nc = pos.col + dc, nr = pos.row + dr;
      if (dir === 'h') {
        if (dc < 0 && nc < 0) continue;
        if (dc > 0 && type !== 'target' && nc + size > COLS) continue;
        if (dc > 0 && type === 'target' && nc > COLS) continue;
      } else {
        if (dr < 0 && nr < 0) continue;
        if (dr > 0 && nr + size > ROWS) continue;
      }
      let blocked = false;
      for (const [oid, opos] of Object.entries(positions)) {
        if (oid === bid || opos.col >= COLS) continue;
        const om = meta[oid]; if (!om) continue;
        const os = om.size, od = om.dir;
        if (dir === 'h') {
          if (od === 'h') { if (opos.row === pos.row && nc < opos.col + os && nc + size > opos.col) { blocked = true; break; } }
          else            { if (pos.row >= opos.row && pos.row < opos.row + os && nc < opos.col + 1 && nc + size > opos.col) { blocked = true; break; } }
        } else {
          if (od === 'v') { if (opos.col === pos.col && nr < opos.row + os && nr + size > opos.row) { blocked = true; break; } }
          else            { if (pos.col >= opos.col && pos.col < opos.col + os && nr < opos.row + 1 && nr + size > opos.row) { blocked = true; break; } }
        }
      }
      if (blocked) continue;
      moves.push({ blockId: bid, dir: label, dc, dr, newPositions: { ...positions, [bid]: { col: nc, row: nr } } });
    }
  }
  return moves;
}

function bfsDistance(positions, meta) {
  const b0size = meta['b0']?.size ?? 2;
  if ((positions['b0']?.col ?? 0) + b0size >= COLS) return 0;
  const startKey = encodeBoardState(positions);
  const visited = new Set([startKey]);
  const queue = [{ positions, dist: 0 }];
  while (queue.length > 0) {
    const { positions: cur, dist } = queue.shift();
    for (const move of getValidMoves(cur, meta)) {
      const np = move.newPositions, key = encodeBoardState(np);
      if (visited.has(key)) continue;
      visited.add(key);
      if ((np['b0']?.col ?? 0) + b0size >= COLS) return dist + 1;
      queue.push({ positions: np, dist: dist + 1 });
    }
  }
  return Infinity;
}

function bfsImprovingMoves(positions, meta) {
  const curDist = bfsDistance(positions, meta);
  if (!isFinite(curDist)) return [];
  return getValidMoves(positions, meta).filter(m => bfsDistance(m.newPositions, meta) < curDist);
}

// Pre-compute BFS good moves for each level's initial state at script load time
const LEVEL_INITIAL_GOOD_MOVES = LEVELS.map(level => {
  const meta = buildBlockMeta(level.blocks);
  const positions = {};
  level.blocks.forEach(b => { positions[b.id] = { col: b.col, row: b.row }; });
  return bfsImprovingMoves(positions, meta);
});
console.log('[AI] precomputed initial good moves:', LEVEL_INITIAL_GOOD_MOVES.map(m => m.length));

// ─────────────────────────────────────────
//  AI player
// ─────────────────────────────────────────

function registerAIPlayer() {
  if (!AI_MODE || _aiRegistered) return;
  _aiRegistered = true;
  updateStateDirect(`players/${AI_PLAYER_ID}`,
    { name: AI_PLAYER_NAME, arrivalColor: AI_COLOR, isAI: true },
    'register AI player');
  playerColorMap[AI_PLAYER_ID] = { name: AI_PLAYER_NAME, color: AI_COLOR };
  updatePlayerNameDisplay(AI_PLAYER_ID);
}

function scheduleAIVote() {
  if (!AI_MODE || !canIBeController(currentPhaseSnap)) return;
  clearTimeout(aiVoteTimeoutId);
  // Schedule from local arrival time — avoids server/client clock offset issues.
  // Initiator: 500ms into the window. Follower: 4500ms.
  const delay = AI_MODE === 'initiator' ? 500 : 4100;
  console.log(`[AI] scheduling ${AI_MODE} vote in ${delay}ms`);
  aiVoteTimeoutId = setTimeout(castAIVote, delay);
}

function castAIVote() {
  if (!AI_MODE || !canIBeController(currentPhaseSnap)) return;
  const eventNum = currentLevelSnap?.eventNumber || 0;
  const startAt  = currentLevelSnap?.startAt || 0;

  let goodMoves;
  if (eventNum === startAt && LEVEL_INITIAL_GOOD_MOVES[currentLevel]) {
    goodMoves = LEVEL_INITIAL_GOOD_MOVES[currentLevel];
  } else {
    goodMoves = bfsImprovingMoves({ ...blockPositions }, blockMetaFromDOM());
  }
  console.log(`[AI] casting ${AI_MODE} vote for event ${eventNum}, ${goodMoves.length} good moves`);

  let chosen = null;
  if (AI_MODE === 'initiator') {
    if (goodMoves.length > 0) chosen = goodMoves[Math.floor(Math.random() * goodMoves.length)];
  } else {
    const humanVotes = Object.entries(currentRawVoteCache)
      .filter(([pid]) => pid !== AI_PLAYER_ID).map(([, v]) => v).filter(Boolean);
    const humanVoteKeys = new Set(humanVotes.map(v => `${v.blockId}|${v.dir}`));
    const uncovered = goodMoves.filter(m => !humanVoteKeys.has(`${m.blockId}|${m.dir}`));
    if (uncovered.length > 0) {
      chosen = uncovered[Math.floor(Math.random() * uncovered.length)];
    } else if (humanVotes.length > 0) {
      const tally = {};
      humanVotes.forEach(v => {
        const k = `${v.blockId}|${v.dir}`;
        tally[k] = tally[k] || { v, count: 0 };
        tally[k].count++;
      });
      const best = Object.values(tally).sort((a, b) => b.count - a.count)[0];
      chosen = best ? { blockId: best.v.blockId, dir: best.v.dir } : null;
    }
  }

  if (!chosen) return;
  updateStateDirect(`votes/${eventNum}/${AI_PLAYER_ID}`,
    { blockId: chosen.blockId, dir: chosen.dir, timestamp: Date.now(), level: currentLevel, isAI: true },
    'AI vote');
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
      if (typeof data.arrivalColor === 'number' && pid !== thisPlayerId) {
        if (pid === AI_PLAYER_ID) {
          playerColorMap[pid].color = AI_COLOR;
        } else {
          const myArrival = getCurrentPlayerArrivalIndex() - 1;
          let c = data.arrivalColor;
          if (c === myArrival) c = 0;
          const nonSelf = [0, 1, 2].filter(x => x !== myArrival);
          const relIdx = nonSelf.indexOf(c);
          playerColorMap[pid].color = relIdx === 0 ? 1 : 2;
        }
      }
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
    _lastAIScheduledKey = ''; // allow AI to schedule fresh for next voting phase
  } else if (L.state === 'survey') {
    clearTimeout(aiVoteTimeoutId);
    showBetweenLevelSurvey(L.index);
  } else if (L.state === 'ended') {
    clearTimeout(aiVoteTimeoutId);
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
        const finalDone = L.finalDone || {};
        const updated = { ...finalDone, [me]: true };
        const ids = Object.keys(playerColorMap).filter(id => id !== AI_PLAYER_ID);
        const allDone = ids.length > 0 && ids.every(id => !!updated[id]);
        return {
          isAllowed: true,
          newState: { ...L, finalDone: updated, state: allDone ? 'redirecting' : 'ended' },
        };
      }
      return { isAllowed: false, newState: null };
    }

    if (action === 'advance') {
      if (stateName === 'survey') {
        const ids = Object.keys(playerColorMap).filter(id => id !== AI_PLAYER_ID);
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

  const card = document.createElement('div');
  card.className = 'survey-card';
  card.innerHTML = `
    <div class="lc-title" style="font-size:22px; margin-bottom:10px;">${isLast ? 'All Levels Complete!' : 'Level ' + (levelIdx + 1) + ' Complete!'}</div>
    <p style="margin-bottom:16px;">${isLast ? 'Please answer a few final questions about your experience.' : 'Before Level ' + (levelIdx + 2) + ', please answer a few quick questions.'}</p>
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
  lcScreen.innerHTML = `<div class="lc-sub">Thanks! Waiting for other players…</div>`;

  (async () => {
    await updateStateTransaction('level', 'markDone', {});
    for (let attempt = 0; attempt < 10; attempt++) {
      const ok = await updateStateTransaction('level', 'advance', {});
      if (ok) return;
      if (currentLevelSnap?.state === 'play') return;
      await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
    }
  })();
}

// ─────────────────────────────────────────
//  Final survey
// ─────────────────────────────────────────
function showFinalSurvey() {
  document.getElementById('gameScreen').style.display = 'none';
  document.getElementById('levelCompleteScreen').style.display = 'none';
  document.getElementById('finishScreen').style.display = 'block';
  window.scrollTo(0, 0);

  const container = document.getElementById('teammate-questions');
  container.innerHTML = '';

  Object.entries(playerColorMap).forEach(([pid, info]) => {
    if (pid === thisPlayerId) return;
    const colorIdx = info.color ?? 0;
    const name = info.name || `Player ${colorIdx + 1}`;

    const block = document.createElement('div');
    const colorValues = ['#f4c400', '#44cc44', '#9b59ff'];
    const colorVal = colorValues[colorIdx] || '#aaa';
    block.className = 'teammate-block';
    block.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <div style="width:18px;height:18px;border-radius:50%;background:${colorVal};box-shadow:0 0 6px ${colorVal};flex-shrink:0;"></div>
        <div style="font-weight:bold;">${name}</div>
      </div>
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

  const prolificCard = document.createElement('div');
  prolificCard.className = 'teammate-block';
  prolificCard.innerHTML = `
    <label><strong>Please enter your Prolific ID:</strong></label><br>
    <input type="text" id="prolific-id-input" placeholder="e.g. 5f3e2a1b9c7d4e8f2a0b1c3d"
      style="width:100%;max-width:500px;margin-top:8px;background:#111;border:1px solid #333;
      color:#eee;border-radius:4px;padding:8px;font-family:'Space Mono',monospace;font-size:13px;">
  `;
  document.getElementById('postTrialForm').appendChild(prolificCard);

  const submitBtn = document.createElement('button');
  submitBtn.className = 'submit-btn';
  submitBtn.textContent = 'Submit';
  submitBtn.onclick = submitFinalSurvey;
  document.getElementById('postTrialForm').appendChild(submitBtn);
}

function submitFinalSurvey() {
  const prolificId = document.getElementById('prolific-id-input')?.value.trim() || '';
  if (!prolificId) {
    alert('Please enter your Prolific ID before submitting.');
    return;
  }

  const teammateResponses = {};
  let incomplete = false;

  Object.entries(playerColorMap).forEach(([pid, info]) => {
    if (pid === thisPlayerId) return;
    const colorIdx = typeof info.color === 'number' ? info.color : 0;
    const fields = ['collab','team','competent','intentionthem','intentionmy','easy','fun','similar','human'];
    const responses = {};
    fields.forEach(f => {
      const el = document.querySelector(`input[name="${f}-${pid}"]:checked`);
      responses[f] = el ? el.value : null;
      if (!el) incomplete = true;
    });
    const desc = document.getElementById(`desc-${pid}`)?.value.trim() || '';
    if (desc.length < 20) incomplete = true;
    teammateResponses[pid] = {
      teammateId: pid,
      teammateName: info.name,
      displayColor: colorIdx,
      ...responses,
      description: desc
    };
  });

  if (incomplete) {
    alert('Please answer all questions about your teammates. Descriptions must be at least 20 characters.');
    return;
  }

  // Disable submit button to prevent double-submit
  document.querySelectorAll('.submit-btn').forEach(b => {
    b.disabled = true;
    b.textContent = 'Submitting…';
  });

  // Save this player's responses
  updateStateDirect(`players/${thisPlayerId}`, { prolificId, teammates: teammateResponses }, 'finalSurvey');

  const otherNames = Object.entries(playerColorMap)
    .filter(([pid]) => pid !== thisPlayerId)
    .map(([, info]) => info.name || 'another player')
    .join(' and ');
  document.getElementById('messageFinish').innerHTML =
    `<p>Thank you! Your responses have been recorded. Please do not close the tab — after your teammate submits their response, you will be redirected automatically.</p><p>Waiting for ${otherNames} to finish…</p>`;

  // Mark this player done; when all players are done the state flips to 'redirecting'
  // and renderLevelFromAuthority fires redirectToProlific() on every client simultaneously.
  // Retry because Firebase transactions can silently return isSuccess=false on first attempt
  // (known null-state quirk) and unlike between-level surveys there's no heartbeat to retry.
  (async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const ok = await updateStateTransaction('level', 'finalDone', {});
      if (ok) return;
      // If state already flipped to redirecting (other player finished first), stop retrying
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