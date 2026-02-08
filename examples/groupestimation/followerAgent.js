/**
 * followerAgent.js
 * 
 * EXACT COPY of follower logic from followerAgent.html
 * Implements sophisticated voting rules based on peer votes and default options
 */

export function executeFollowerAgent(GameState, castVote, getAllPlayerIdsWithRobot, isRobotPlayer) {
    console.log('🤖 Follower Agent: Running follower decision...');
    
    // Convert GameState to snapshot format
    const snapshot = convertGameStateToSnapshot(GameState);
    
    // Get peer votes from other players (excluding self)
    const peerVotes = getPeerVotes(getAllPlayerIdsWithRobot, isRobotPlayer);
    
    console.log('🤖 Follower: Snapshot =', snapshot);
    console.log('🤖 Follower: Peer votes =', peerVotes);
    
    // Add peer votes to snapshot
    snapshot.peerVotes = peerVotes;
    
    const result = chooseFollowerMove(snapshot);
    
    if (result && result.chosen) {
        console.log('🤖 Follower chose:', result.chosen, 'Reason:', result.reason);
        
        const { type, id, dir } = result.chosen;
        const isObstacle = (type === 'obstacle');
        
        castVote(id, dir, isObstacle);
    } else {
        console.log('🤖 Follower: No valid move found');
    }
}

function convertGameStateToSnapshot(GameState) {
    const snapshot = {
        blocks: {},
        obstacles: {},
        slots: {}
    };
    
    // Copy blocks
    for (const [name, block] of Object.entries(GameState.blocks || {})) {
        snapshot.blocks[name] = {
            x: block.location?.x ?? block.x,
            y: block.location?.y ?? block.y,
            locked: block.locked || false
        };
    }
    
    // Copy obstacles
    for (const [name, obs] of Object.entries(GameState.obstacles || {})) {
        snapshot.obstacles[name] = {
            x: obs.location?.x ?? obs.x,
            y: obs.location?.y ?? obs.y,
            immovable: obs.immovable || false
        };
    }
    
    // Copy slots
    for (const [name, slot] of Object.entries(GameState.slots || {})) {
        snapshot.slots[name] = {
            x: slot.x,
            y: slot.y
        };
    }
    
    return snapshot;
}

function getPeerVotes(getAllPlayerIdsWithRobot, isRobotPlayer) {
    const allPlayers = getAllPlayerIdsWithRobot();
    const robotId = allPlayers.find(id => isRobotPlayer(id));
    const peers = allPlayers.filter(id => id !== robotId);
    
    const peerVotes = { p2: null, p3: null };
    
    // Get votes from DOM arrows
    if (peers[0]) {
        peerVotes.p2 = getVoteFromDOM(peers[0]);
    }
    if (peers[1]) {
        peerVotes.p3 = getVoteFromDOM(peers[1]);
    }
    
    console.log('🤖 Follower: Peer IDs =', peers);
    console.log('🤖 Follower: P2 vote =', peerVotes.p2);
    console.log('🤖 Follower: P3 vote =', peerVotes.p3);
    
    return peerVotes;
}

function getVoteFromDOM(playerId) {
    const arrow = document.querySelector(`.arrow[data-player-id="${playerId}"]`);
    if (!arrow) {
        console.log(`🤖 Follower: No arrow found for player ${playerId}`);
        return { type: 'none', id: '', dir: 'stay' };
    }
    
    const targetBlock = arrow.closest('.block');
    if (!targetBlock) {
        console.log(`🤖 Follower: Arrow found but no parent block for player ${playerId}`);
        return { type: 'none', id: '', dir: 'stay' };
    }
    
    const targetId = targetBlock.dataset.color;
    const direction = arrow.dataset.direction;
    const isObstacle = targetBlock.dataset.obstacle === 'true';
    
    const vote = {
        type: isObstacle ? 'obstacle' : 'block',
        id: targetId,
        dir: direction
    };
    
    console.log(`🤖 Follower: Player ${playerId} vote =`, vote);
    
    return vote;
}

// ============================================================================
// EXACT COPY FROM followerAgent.html - START
// ============================================================================

const GRID = 20;  // FIXED: was 18, should be 20
const BLOCK_SIZE = 3;
const OBS_SIZE = 2;

const DIR_VEC = {
  up:{dx:0,dy:-1}, down:{dx:0,dy:1}, left:{dx:-1,dy:0}, right:{dx:1,dy:0}, stay:{dx:0,dy:0}
};

function deepCopy(o){ return JSON.parse(JSON.stringify(o)); }

function inBoundsTL(x,y,sz){
  return (x>=0 && y>=0 && (x+sz)<=GRID && (y+sz)<=GRID);
}

function rectOverlap(ax,ay,asz, bx,by,bsz){
  return (ax < bx + bsz && bx < ax + asz && ay < by + bsz && by < ay + asz);
}

function buildWallSetFromState(state){
  const wallSet = new Set();
  for (let x=0; x<GRID; x++){
    wallSet.add(`${x},0`);
    wallSet.add(`${x},${GRID-1}`);
  }
  for (let y=0; y<GRID; y++){
    wallSet.add(`0,${y}`);
    wallSet.add(`${GRID-1},${y}`);
  }
  if (Array.isArray(state.walls)){
    for (const w of state.walls){
      if (!w) continue;
      const wx = (w.x|0), wy = (w.y|0);
      if (wx>=0 && wy>=0 && wx<GRID && wy<GRID) wallSet.add(`${wx},${wy}`);
    }
  }
  return wallSet;
}

function footprintHitsWalls(tlx,tly,sz, wallSet){
  for (let dy=0; dy<sz; dy++){
    for (let dx=0; dx<sz; dx++){
      if (wallSet.has(`${tlx+dx},${tly+dy}`)) return true;
    }
  }
  return false;
}

function isMoveLegal(state, move, wallSet){
  if (!move || move.type === 'none') return false;
  const d = DIR_VEC[move.dir];
  if (!d) return false;

  if (move.type === 'block'){
    const b = state.blocks?.[move.id];
    if (!b) return false;
    const nx = (b.x|0) + d.dx;
    const ny = (b.y|0) + d.dy;
    if (!inBoundsTL(nx, ny, BLOCK_SIZE)) return false;
    if (footprintHitsWalls(nx, ny, BLOCK_SIZE, wallSet)) return false;

    for (const o of Object.values(state.obstacles || {})){
      if (rectOverlap(nx,ny,BLOCK_SIZE, o.x|0,o.y|0,OBS_SIZE)) return false;
    }
    for (const [bn,ob] of Object.entries(state.blocks || {})){
      if (bn === move.id) continue;
      if (rectOverlap(nx,ny,BLOCK_SIZE, ob.x|0,ob.y|0,BLOCK_SIZE)) return false;
    }
    return true;
  }

  if (move.type === 'obstacle'){
    const o = state.obstacles?.[move.id];
    if (!o || o.immovable) return false;
    const nx = (o.x|0) + d.dx;
    const ny = (o.y|0) + d.dy;
    if (!inBoundsTL(nx, ny, OBS_SIZE)) return false;
    if (footprintHitsWalls(nx, ny, OBS_SIZE, wallSet)) return false;

    for (const [ok,oo] of Object.entries(state.obstacles || {})){
      if (ok === move.id) continue;
      if (rectOverlap(nx,ny,OBS_SIZE, oo.x|0,oo.y|0,OBS_SIZE)) return false;
    }
    for (const b of Object.values(state.blocks || {})){
      if (rectOverlap(nx,ny,OBS_SIZE, b.x|0,b.y|0,BLOCK_SIZE)) return false;
    }
    return true;
  }

  return false;
}

function applyMove(state, move){
  const newState = deepCopy(state);
  const d = DIR_VEC[move.dir];
  if (!d) return newState;

  if (move.type === 'block'){
    if (newState.blocks[move.id]){
      newState.blocks[move.id].x += d.dx;
      newState.blocks[move.id].y += d.dy;
    }
  } else if (move.type === 'obstacle'){
    if (newState.obstacles[move.id]){
      newState.obstacles[move.id].x += d.dx;
      newState.obstacles[move.id].y += d.dy;
    }
  }
  return newState;
}

function computeDistForBlock(state, wallSet, blockName, includeMovables){
  const TL_W = GRID - BLOCK_SIZE + 1;
  const TL_H = GRID - BLOCK_SIZE + 1;
  const INF = 1e9;

  const dist = Array.from({length: TL_H}, ()=>Array(TL_W).fill(INF));
  const qx = new Array(TL_W*TL_H);
  const qy = new Array(TL_W*TL_H);
  let head=0, tail=0;

  const block = state.blocks[blockName];
  if (!block) {
    console.warn(`⚠️ computeDistForBlock: block ${blockName} not found`);
    return { dist, TL_W, TL_H, INF };
  }
  const startKey = `${block.x|0},${block.y|0}`;

  const immObs = Object.values(state.obstacles || {}).filter(o=>!!o.immovable);
  const movObs = Object.values(state.obstacles || {}).filter(o=>!o.immovable);

  function okTL(x,y){
    if (!inBoundsTL(x,y,BLOCK_SIZE)) return false;
    if (footprintHitsWalls(x,y,BLOCK_SIZE, wallSet)) return false;
    
    for (const o of immObs){
      if (rectOverlap(x,y,BLOCK_SIZE, o.x|0,o.y|0,OBS_SIZE)) return false;
    }
    
    if (includeMovables){
      for (const o of movObs){
        if (rectOverlap(x,y,BLOCK_SIZE, o.x|0,o.y|0,OBS_SIZE)) return false;
      }
    }
    
    for (const [bn,b] of Object.entries(state.blocks || {})){
      if (bn === blockName) continue;
      if (rectOverlap(x,y,BLOCK_SIZE, b.x|0,b.y|0,BLOCK_SIZE)) return false;
    }
    return true;
  }

  for (const sl of Object.values(state.slots || {})){
    const sx = sl.x|0, sy = sl.y|0;
    if (sx<0 || sy<0 || sx>=TL_W || sy>=TL_H) continue;
    if (!okTL(sx,sy)) continue;
    if (dist[sy][sx] !== 0){
      dist[sy][sx] = 0;
      qx[tail]=sx; qy[tail]=sy; tail++;
    }
  }

  const DX=[0,0,-1,1], DY=[-1,1,0,0];
  while (head<tail){
    const x=qx[head], y=qy[head]; head++;
    const nd = dist[y][x] + 1;
    for (let k=0;k<4;k++){
      const nx=x+DX[k], ny=y+DY[k];
      if (nx<0 || ny<0 || nx>=TL_W || ny>=TL_H) continue;

      const key = `${nx},${ny}`;
      const ok = (key === startKey) ? true : okTL(nx,ny);
      if (!ok) continue;

      if (dist[ny][nx] <= nd) continue;
      dist[ny][nx] = nd;
      qx[tail]=nx; qy[tail]=ny; tail++;
    }
  }

  return { dist, TL_W, TL_H, INF };
}

function getDist(distObj, x,y){
  const {dist, TL_W, TL_H, INF} = distObj;
  if (x<0 || y<0 || x>=TL_W || y>=TL_H) return INF;
  return dist[y][x];
}

function scoreImprovement(before, after, INF){
  if (before >= INF && after < INF) return 1000;
  if (before < INF && after < INF) return Math.max(0, before - after);
  return 0;
}

function findObstacleMovesForBlock(state, wallSet, blockName){
  const b = state.blocks[blockName];
  if (!b) {
    console.warn(`⚠️ findObstacleMovesForBlock: block ${blockName} not found`);
    return [];
  }
  
  const baselineDist = computeDistForBlock(state, wallSet, blockName, true);
  const baselineVal = getDist(baselineDist, b.x|0, b.y|0);

  const movableObs = Object.entries(state.obstacles || {})
    .filter(([k,o]) => !o.immovable)
    .map(([k,o]) => k);

  const candidates = [];

  // 1-step
  for (const obsKey of movableObs){
    for (const dir of ['up','down','left','right']){
      const move = {type:'obstacle', id:obsKey, dir};
      if (!isMoveLegal(state, move, wallSet)) continue;

      const testState = applyMove(state, move);
      if (!testState.blocks[blockName]) continue; // Safety check
      const newDist = computeDistForBlock(testState, wallSet, blockName, true);
      const afterVal = getDist(newDist, testState.blocks[blockName].x|0, testState.blocks[blockName].y|0);

      const improvement = scoreImprovement(baselineVal, afterVal, baselineDist.INF);

      if (improvement > 0){
        candidates.push({
          ...move,
          benefit: `clear_for_${blockName}`,
          improvement,
          steps: 1
        });
      }
    }
  }

  // 2-step
  for (const obsKey of movableObs){
    for (const dir1 of ['up','down','left','right']){
      const move1 = {type:'obstacle', id:obsKey, dir:dir1};
      if (!isMoveLegal(state, move1, wallSet)) continue;

      const state1 = applyMove(state, move1);
      if (!state1.blocks[blockName]) continue; // Safety check

      for (const dir2 of ['up','down','left','right']){
        const move2 = {type:'obstacle', id:obsKey, dir:dir2};
        if (!isMoveLegal(state1, move2, wallSet)) continue;

        const state2 = applyMove(state1, move2);
        if (!state2.blocks[blockName]) continue; // Safety check
        const newDist = computeDistForBlock(state2, wallSet, blockName, true);
        const afterVal = getDist(newDist, state2.blocks[blockName].x|0, state2.blocks[blockName].y|0);

        const improvement = scoreImprovement(baselineVal, afterVal, baselineDist.INF);

        if (improvement > 0){
          candidates.push({
            type: 'obstacle',
            id: obsKey,
            dir: dir1,
            benefit: `clear_for_${blockName}`,
            improvement,
            steps: 2,
            fullPlan: [dir1, dir2]
          });
        }
      }
    }
  }

  candidates.sort((a,b) => b.improvement - a.improvement);
  return candidates;
}

function buildDefaultOptions(state, wallSet){
  const defaultOptions = [];

  // Part A: Yellow advancement
  if (state.blocks.yellow) {
    const yellowDist = computeDistForBlock(state, wallSet, 'yellow', true);
    const y = state.blocks.yellow;
    const curDist = getDist(yellowDist, y.x|0, y.y|0);

    if (curDist < yellowDist.INF){
      for (const dir of ['up','down','left','right']){
        const d = DIR_VEC[dir];
        const nx = (y.x|0) + d.dx;
        const ny = (y.y|0) + d.dy;
        const newDist = getDist(yellowDist, nx, ny);

        if (newDist < curDist){
          const move = {type:'block', id:'yellow', dir};
          if (isMoveLegal(state, move, wallSet)){
            defaultOptions.push({
              ...move,
              benefit: 'yellow_advance',
              improvement: curDist - newDist
            });
          }
        }
      }
    }
  }

  // Part B: Obstacle clearing for all blocks
  for (const blockName of ['yellow', 'red', 'blue']){
    if (!state.blocks[blockName]) {
      console.log(`🤖 Follower: Skipping ${blockName} - block not found (already locked/removed)`);
      continue;
    }
    
    const D_imm = computeDistForBlock(state, wallSet, blockName, false);
    const D_all = computeDistForBlock(state, wallSet, blockName, true);

    const b = state.blocks[blockName];
    const di = getDist(D_imm, b.x|0, b.y|0);
    const da = getDist(D_all, b.x|0, b.y|0);

    if (da >= D_all.INF || da > di){
      const obstacleMoves = findObstacleMovesForBlock(state, wallSet, blockName);
      defaultOptions.push(...obstacleMoves);
    }
  }

  defaultOptions.sort((a,b) => b.improvement - a.improvement);
  return defaultOptions;
}

function filterNonOverlapping(options, peerVotes){
  return options.filter(opt => {
    for (const vote of peerVotes){
      if (voteIsNone(vote)) continue;
      if (opt.type === vote.type && opt.id === vote.id){
        return false;
      }
    }
    return true;
  });
}

function voteIsNone(v){ return !v || v.type === 'none'; }
function voteKey(v){ return `${v.type}:${v.id}:${v.dir}`; }
function votesConsistent(v2,v3){ 
  return !voteIsNone(v2) && !voteIsNone(v3) && voteKey(v2) === voteKey(v3); 
}

function chooseFollowerMove(state){
  const wallSet = buildWallSetFromState(state);
  const defaultOptions = buildDefaultOptions(state, wallSet);

  const v2 = state.peerVotes?.p2 || {type:'none',id:'',dir:'stay'};
  const v3 = state.peerVotes?.p3 || {type:'none',id:'',dir:'stay'};

  const v2Legal = !voteIsNone(v2) && isMoveLegal(state, v2, wallSet);
  const v3Legal = !voteIsNone(v3) && isMoveLegal(state, v3, wallSet);
  const consistent = votesConsistent(v2, v3);

  console.log('🤖 Follower: v2Legal =', v2Legal, 'v3Legal =', v3Legal, 'consistent =', consistent);
  console.log('🤖 Follower: defaultOptions count =', defaultOptions.length);
  if (defaultOptions.length > 0) {
    console.log('🤖 Follower: Top 3 defaults:', defaultOptions.slice(0, 3));
  }

  // Rule 1: Consistent on blue
  if (consistent && v2Legal && v2.type === 'block' && v2.id === 'blue'){
    console.log('🤖 Follower: Rule 1 - Consistent on blue, copying vote');
    return { 
      chosen: v2, 
      reason: 'consistent_blue_copy', 
      defaultOptions, 
      peer: {v2, v3, v2Legal, v3Legal, consistent} 
    };
  }

  // Rule 2: Consistent on other
  if (consistent && v2Legal){
    const nonOverlap = filterNonOverlapping(defaultOptions, [v2]);
    if (nonOverlap.length > 0){
      console.log('🤖 Follower: Rule 2a - Consistent on other, using default (non-overlapping)');
      return { 
        chosen: nonOverlap[0], 
        reason: 'consistent_other_use_default', 
        defaultOptions, 
        peer: {v2, v3, v2Legal, v3Legal, consistent} 
      };
    }
    console.log('🤖 Follower: Rule 2b - Consistent on other, no defaults, copying');
    return { 
      chosen: v2, 
      reason: 'consistent_other_no_defaults_copy', 
      defaultOptions, 
      peer: {v2, v3, v2Legal, v3Legal, consistent} 
    };
  }

  // Rule 3: Inconsistent
  const redVote = (v2Legal && v2.type==='block' && v2.id==='red') ? v2 :
                  (v3Legal && v3.type==='block' && v3.id==='red') ? v3 : null;
  if (redVote){
    console.log('🤖 Follower: Rule 3a - Inconsistent, following red');
    return { 
      chosen: redVote, 
      reason: 'inconsistent_follow_red', 
      defaultOptions, 
      peer: {v2, v3, v2Legal, v3Legal, consistent} 
    };
  }

  const nonOverlap = filterNonOverlapping(defaultOptions, [v2, v3]);
  if (nonOverlap.length > 0){
    console.log('🤖 Follower: Rule 3b - Inconsistent, using default (non-overlapping)');
    return { 
      chosen: nonOverlap[0], 
      reason: 'inconsistent_use_default', 
      defaultOptions, 
      peer: {v2, v3, v2Legal, v3Legal, consistent} 
    };
  }

  if (v2Legal){
    console.log('🤖 Follower: Rule 3c - No defaults, copying v2');
    return { 
      chosen: v2, 
      reason: 'no_defaults_copy_v2', 
      defaultOptions, 
      peer: {v2, v3, v2Legal, v3Legal, consistent} 
    };
  }
  if (v3Legal){
    console.log('🤖 Follower: Rule 3d - No defaults, copying v3');
    return { 
      chosen: v3, 
      reason: 'no_defaults_copy_v3', 
      defaultOptions, 
      peer: {v2, v3, v2Legal, v3Legal, consistent} 
    };
  }

  console.log('🤖 Follower: No legal moves found');
  return { 
    chosen: null, 
    reason: 'no_legal_moves', 
    defaultOptions, 
    peer: {v2, v3, v2Legal, v3Legal, consistent} 
  };
}

// ============================================================================
// EXACT COPY FROM followerAgent.html - END
// ============================================================================