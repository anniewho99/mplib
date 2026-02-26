/**
 * leaderAgent.js
 * 
 * Leader agent algorithm with probability-based action selection.
 * Block numbering: yellow=1, red=2, blue=3
 * Action is sampled from a distribution based on the lowest available (non-locked) block number.
 */

// Probability table: P(action | lowest_available)
// Rows: lowest_available (1, 2, 3)
// Columns: block1 (yellow), block2 (red), block3 (blue), obstacle
const PROB_TABLE = {
    1: { yellow: 0.4101, red: 0.3183, blue: 0.0574, obstacle: 0.2142 },
    2: { yellow: 0.0000, red: 0.8515, blue: 0.1131, obstacle: 0.0354 },
    3: { yellow: 0.0000, red: 0.0000, blue: 0.9828, obstacle: 0.0172 },
};

const BLOCK_NUMBER = { yellow: 1, red: 2, blue: 3 };

export function executeLeaderAgent(GameState, castVote) {
    console.log('🤖 Leader Agent: Running leader diagnostic...');
    
    const result = runLeaderDiagnostic(GameState);
    
    if (result && result.chosen) {
        console.log('🤖 Leader chose:', result.chosen);
        
        const { type, id, dir } = result.chosen;
        const isObstacle = (type === 'obstacle');
        
        castVote(id, dir, isObstacle);
    } else {
        console.log('🤖 Leader: No valid move found');
    }
}

function runLeaderDiagnostic(GameState) {
    // Convert GameState to snapshot format
    const snapshot = {
        blocks: {},
        obstacles: {},
        slots: {}
    };
    
    for (const [name, block] of Object.entries(GameState.blocks || {})) {
        snapshot.blocks[name] = {
            x: block.location?.x ?? block.x,
            y: block.location?.y ?? block.y,
            locked: block.locked || false
        };
    }
    
    for (const [name, obs] of Object.entries(GameState.obstacles || {})) {
        snapshot.obstacles[name] = {
            x: obs.location?.x ?? obs.x,
            y: obs.location?.y ?? obs.y,
            id: name,
            immovable: obs.immovable || false
        };
    }
    
    for (const [name, slot] of Object.entries(GameState.slots || {})) {
        snapshot.slots[name] = {
            x: slot.x,
            y: slot.y
        };
    }
    
    console.log('🤖 Snapshot created:', snapshot);

    const GRID = 20;          
    const BLOCK_SIZE = 3;
    const OBS_SIZE = 2;
    const INF = 1e9;

    // ----- Walls -----
    const wallSet = new Set();
    for (let x=0; x<GRID; x++){
        wallSet.add(`${x},0`);
        wallSet.add(`${x},${GRID-1}`);
    }
    for (let y=0; y<GRID; y++){
        wallSet.add(`0,${y}`);
        wallSet.add(`${GRID-1},${y}`);
    }
    if (Array.isArray(snapshot.walls)){
        for (const w of snapshot.walls){
            if (w && Number.isFinite(w.x) && Number.isFinite(w.y)){
                wallSet.add(`${w.x|0},${w.y|0}`);
            }
        }
    }

    const inBoundsTL = (x,y,sz)=> (x>=0 && y>=0 && (x+sz)<=GRID && (y+sz)<=GRID);

    const rectOverlap = (ax,ay,asz, bx,by,bsz)=>
        (ax < bx + bsz && bx < ax + asz && ay < by + bsz && by < ay + asz);

    const footprintHitsWalls = (tlx,tly,sz)=>{
        for (let dy=0; dy<sz; dy++){
            for (let dx=0; dx<sz; dx++){
                if (wallSet.has(`${tlx+dx},${tly+dy}`)) return true;
            }
        }
        return false;
    };

    const obstaclesArr = Object.values(snapshot.obstacles || {});
    const immObs = obstaclesArr.filter(o=>!!o.immovable);
    const movObs = obstaclesArr.filter(o=>!o.immovable);

    const slotsArr = Object.values(snapshot.slots || {});

    // Lock blocks already in a slot
    function isBlockInAnySlotTL(b){
        const bx = b.x|0, by = b.y|0;
        for (const sl of slotsArr){
            if ((sl.x|0) === bx && (sl.y|0) === by) return true;
        }
        return false;
    }
    for (const [bn,b] of Object.entries(snapshot.blocks || {})){
        if (b && isBlockInAnySlotTL(b)){
            b.locked = true;
        }
    }

    const TL_W = GRID - BLOCK_SIZE + 1;
    const TL_H = GRID - BLOCK_SIZE + 1;

    function okBlockTL(x,y, includeMovables){
        if (!inBoundsTL(x,y,BLOCK_SIZE)) return false;
        if (footprintHitsWalls(x,y,BLOCK_SIZE)) return false;
        for (const o of immObs){
            if (rectOverlap(x,y,BLOCK_SIZE, o.x,o.y,OBS_SIZE)) return false;
        }
        if (includeMovables){
            for (const o of movObs){
                if (rectOverlap(x,y,BLOCK_SIZE, o.x,o.y,OBS_SIZE)) return false;
            }
        }
        return true;
    }

    function bfs(includeMovables){
        const dist = Array.from({length: TL_H}, ()=>Array(TL_W).fill(INF));
        const qx = new Array(TL_W*TL_H);
        const qy = new Array(TL_W*TL_H);
        let head=0, tail=0;

        for (const sl of slotsArr){
            const sx = sl.x|0, sy = sl.y|0;
            if (sx<0 || sy<0 || sx>=TL_W || sy>=TL_H) continue;
            if (!okBlockTL(sx,sy, includeMovables)) continue;
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
                if (!okBlockTL(nx,ny, includeMovables)) continue;
                if (dist[ny][nx] <= nd) continue;
                dist[ny][nx] = nd;
                qx[tail]=nx; qy[tail]=ny; tail++;
            }
        }
        return dist;
    }

    const D_imm = bfs(false);
    const D_all = bfs(true);

    function getDist(D, x,y){
        if (x<0 || y<0 || x>=TL_W || y>=TL_H) return INF;
        return D[y][x];
    }

    // ----- Obstacle move helpers -----
    const DIRS_OBS = [
        {name:'up',dx:0,dy:-1},
        {name:'down',dx:0,dy:1},
        {name:'left',dx:-1,dy:0},
        {name:'right',dx:1,dy:0},
    ];

    function isObstacleMoveLegal(state, obsKey, dir){
        const o = state.obstacles?.[obsKey];
        if (!o) return {ok:false, reason:`Missing obstacle ${obsKey}`};
        if (o.immovable) return {ok:false, reason:`${obsKey} is immovable`};

        const nx = (o.x|0) + dir.dx;
        const ny = (o.y|0) + dir.dy;
        if (!inBoundsTL(nx, ny, OBS_SIZE)) return {ok:false, reason:'Out of bounds'};
        if (footprintHitsWalls(nx, ny, OBS_SIZE)) return {ok:false, reason:'Hits wall'};

        for (const [k2,o2] of Object.entries(state.obstacles || {})){
            if (k2 === obsKey) continue;
            if (rectOverlap(nx,ny,OBS_SIZE, o2.x|0,o2.y|0,OBS_SIZE)) return {ok:false, reason:`Hits obstacle ${k2}`};
        }
        for (const [bn,b] of Object.entries(state.blocks || {})){
            if (b && b.locked) continue;
            if (rectOverlap(nx,ny,OBS_SIZE, b.x|0,b.y|0,BLOCK_SIZE)) return {ok:false, reason:`Hits block ${bn}`};
        }
        return {ok:true, reason:'OK'};
    }

    function applyObstacleMove(state, obsKey, dir){
        const t = JSON.parse(JSON.stringify(state));
        t.obstacles[obsKey].x = (t.obstacles[obsKey].x|0) + dir.dx;
        t.obstacles[obsKey].y = (t.obstacles[obsKey].y|0) + dir.dy;
        return t;
    }

    function computeDAllFor(stateX){
        const obsArr = Object.values(stateX.obstacles || {});
        const immX = obsArr.filter(o=>!!o.immovable);
        const movX = obsArr.filter(o=>!o.immovable);

        function okTL_X(x,y){
            if (!inBoundsTL(x,y,BLOCK_SIZE)) return false;
            if (footprintHitsWalls(x,y,BLOCK_SIZE)) return false;
            for (const o of immX){
                if (rectOverlap(x,y,BLOCK_SIZE, o.x|0,o.y|0,OBS_SIZE)) return false;
            }
            for (const o of movX){
                if (rectOverlap(x,y,BLOCK_SIZE, o.x|0,o.y|0,OBS_SIZE)) return false;
            }
            return true;
        }

        const dist = Array.from({length: TL_H}, ()=>Array(TL_W).fill(INF));
        const qx = new Array(TL_W*TL_H);
        const qy = new Array(TL_W*TL_H);
        let head=0, tail=0;

        for (const sl of Object.values(stateX.slots || {})){
            const sx = sl.x|0, sy = sl.y|0;
            if (sx<0 || sy<0 || sx>=TL_W || sy>=TL_H) continue;
            if (!okTL_X(sx,sy)) continue;
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
                if (!okTL_X(nx,ny)) continue;
                if (dist[ny][nx] <= nd) continue;
                dist[ny][nx] = nd;
                qx[tail]=nx; qy[tail]=ny; tail++;
            }
        }
        return dist;
    }

    function scoreStateAgainstBaseline(stateX, baselineDAll, blocksToScore){
        const D = computeDAllFor(stateX);
        const INF_WIN = 1000;
        let score = 0;
        const per = {};

        for (const bn of blocksToScore){
            const b = stateX.blocks?.[bn];
            if (!b || b.locked) continue;
            const before = getDist(baselineDAll, b.x|0, b.y|0);
            const after  = getDist(D,             b.x|0, b.y|0);

            let imp = 0;
            if (before>=INF && after<INF) imp = INF_WIN;
            else if (before<INF && after<INF) imp = Math.max(0, before-after);
            else imp = 0;

            score += imp;
            per[bn] = { before: (before>=INF? null: before), after: (after>=INF? null: after), improvement: imp };
        }
        return { score, perBlock: per };
    }

    function suggestObstaclePlan(affectedEntries){
        const movableKeys = Object.entries(snapshot.obstacles || {})
            .filter(([k,o])=>!o.immovable)
            .map(([k,o])=>({key:k, id:o.id ?? k}));

        const blocksToScore = affectedEntries.map(e=>e.block);
        const baseline = D_all;

        let best = null;

        for (const ok of movableKeys.map(o=>o.key)){
            for (const d1 of DIRS_OBS){
                const c1 = isObstacleMoveLegal(snapshot, ok, d1);
                if (!c1.ok) continue;
                const s1 = applyObstacleMove(snapshot, ok, d1);
                const r1 = scoreStateAgainstBaseline(s1, baseline, blocksToScore);
                const cand = { obstacle: ok, steps:[d1.name], score:r1.score, perBlock:r1.perBlock };
                if (!best || cand.score > best.score) best = cand;
            }
        }

        for (const ok of movableKeys.map(o=>o.key)){
            for (const d1 of DIRS_OBS){
                const c1 = isObstacleMoveLegal(snapshot, ok, d1);
                if (!c1.ok) continue;
                const s1 = applyObstacleMove(snapshot, ok, d1);
                for (const d2 of DIRS_OBS){
                    const c2 = isObstacleMoveLegal(s1, ok, d2);
                    if (!c2.ok) continue;
                    const s2 = applyObstacleMove(s1, ok, d2);
                    const r2 = scoreStateAgainstBaseline(s2, baseline, blocksToScore);
                    const cand = { obstacle: ok, steps:[d1.name, d2.name], score:r2.score, perBlock:r2.perBlock };
                    if (!best || cand.score > best.score) best = cand;
                }
            }
        }

        return best;
    }

    // Pick a random valid obstacle move (any movable obstacle, any direction, no collision)
    function randomObstacleMove(){
        const movableKeys = Object.keys(snapshot.obstacles || {}).filter(k => !snapshot.obstacles[k].immovable);
        // Shuffle to avoid bias
        for (let i = movableKeys.length - 1; i > 0; i--){
            const j = Math.floor(Math.random() * (i + 1));
            [movableKeys[i], movableKeys[j]] = [movableKeys[j], movableKeys[i]];
        }
        for (const ok of movableKeys){
            const shuffledDirs = [...DIRS_OBS].sort(() => Math.random() - 0.5);
            for (const d of shuffledDirs){
                if (isObstacleMoveLegal(snapshot, ok, d).ok){
                    return { obstacle: ok, dir: d.name };
                }
            }
        }
        return null;
    }

    // ----- Block move helpers -----
    const DIRS_BLOCK = [
        {name:"up", dx:0, dy:-1},
        {name:"down", dx:0, dy:1},
        {name:"left", dx:-1, dy:0},
        {name:"right", dx:1, dy:0},
    ];

    function canPlaceBlockAt(x,y,selfName){
        if (!inBoundsTL(x,y,BLOCK_SIZE)) return false;
        if (footprintHitsWalls(x,y,BLOCK_SIZE)) return false;
        for (const o of immObs){
            if (rectOverlap(x,y,BLOCK_SIZE, o.x|0,o.y|0,OBS_SIZE)) return false;
        }
        for (const o of movObs){
            if (rectOverlap(x,y,BLOCK_SIZE, o.x|0,o.y|0,OBS_SIZE)) return false;
        }
        for (const [bn,b] of Object.entries(snapshot.blocks || {})){
            if (bn === selfName) continue;
            if (b && b.locked) continue;
            if (rectOverlap(x,y,BLOCK_SIZE, b.x|0,b.y|0,BLOCK_SIZE)) return false;
        }
        return true;
    }

    function okBlockTL_withBlocks(x,y, selfName){
        if (!inBoundsTL(x,y,BLOCK_SIZE)) return false;
        if (footprintHitsWalls(x,y,BLOCK_SIZE)) return false;
        for (const o of immObs){
            if (rectOverlap(x,y,BLOCK_SIZE, o.x|0,o.y|0,OBS_SIZE)) return false;
        }
        for (const [bn,b] of Object.entries(snapshot.blocks || {})){
            if (bn === selfName) continue;
            if (b && b.locked) continue;
            if (rectOverlap(x,y,BLOCK_SIZE, b.x|0,b.y|0,BLOCK_SIZE)) return false;
        }
        return true;
    }

    function bfsImmWithBlocks(selfName){
        const dist = Array.from({length: TL_H}, ()=>Array(TL_W).fill(INF));
        const qx = new Array(TL_W*TL_H);
        const qy = new Array(TL_W*TL_H);
        let head=0, tail=0;

        for (const sl of slotsArr){
            const sx = sl.x|0, sy = sl.y|0;
            if (sx<0 || sy<0 || sx>=TL_W || sy>=TL_H) continue;
            if (!okBlockTL_withBlocks(sx,sy, selfName)) continue;
            dist[sy][sx] = 0;
            qx[tail]=sx; qy[tail]=sy; tail++;
        }

        const DX=[0,0,-1,1], DY=[-1,1,0,0];
        while (head<tail){
            const x=qx[head], y=qy[head]; head++;
            const nd = dist[y][x] + 1;
            for (let k=0;k<4;k++){
                const nx=x+DX[k], ny=y+DY[k];
                if (nx<0 || ny<0 || nx>=TL_W || ny>=TL_H) continue;
                if (!okBlockTL_withBlocks(nx,ny, selfName)) continue;
                if (dist[ny][nx] <= nd) continue;
                dist[ny][nx] = nd;
                qx[tail]=nx; qy[tail]=ny; tail++;
            }
        }
        return dist;
    }

    function chooseDownhillStepWithBlockGate(blockName){
        const b = snapshot.blocks?.[blockName];
        if (!b || b.locked) return {block:blockName, ok:false, reason:"locked/in slot"};

        const x = b.x|0, y = b.y|0;

        const di0 = getDist(D_imm, x, y);
        const da0 = getDist(D_all, x, y);
        const obstacleBlocked = (di0 < INF && (da0 >= INF || da0 > di0));
        if (obstacleBlocked){
            return {block:blockName, ok:false, reason:`obstacle-blocked`};
        }

        const D_imm_blocks = bfsImmWithBlocks(blockName);
        const dib0 = getDist(D_imm_blocks, x, y);
        const blockedByOtherBlocks =
            (di0 < INF && dib0 >= INF) || (di0 < INF && dib0 > di0);

        if (blockedByOtherBlocks){
            return {block:blockName, ok:false, reason:`blocked by other blocks`};
        }

        for (const d of DIRS_BLOCK){
            const nx = x + d.dx, ny = y + d.dy;
            const d1 = getDist(D_all, nx, ny);
            if (d1 >= da0) continue;
            if (!canPlaceBlockAt(nx, ny, blockName)) continue;
            return {block:blockName, ok:true, step:d.name, from:{x,y}, to:{x:nx,y:ny}, d0:da0, d1};
        }
        return {block:blockName, ok:false, reason:"no downhill legal move"};
    }

    // ----- Determine lowest_available -----
    // yellow=1, red=2, blue=3
    const blockAvailable = {
        yellow: !!(snapshot.blocks?.yellow && !snapshot.blocks.yellow.locked),
        red:    !!(snapshot.blocks?.red    && !snapshot.blocks.red.locked),
        blue:   !!(snapshot.blocks?.blue   && !snapshot.blocks.blue.locked),
    };

    let lowestAvailable = null;
    if (blockAvailable.yellow) lowestAvailable = 1;
    else if (blockAvailable.red) lowestAvailable = 2;
    else if (blockAvailable.blue) lowestAvailable = 3;

    console.log('🤖 blockAvailable:', blockAvailable, '→ lowestAvailable:', lowestAvailable);

    if (lowestAvailable === null){
        console.log('🤖 No available blocks');
        return { chosen: null };
    }

    // ----- Try actions based on probability distribution with fallback -----
    // Action keys: 'yellow', 'red', 'blue', 'obstacle'
    const probRow = PROB_TABLE[lowestAvailable];

    // Build mutable probability pool (only include available blocks + obstacle)
    let pool = {};
    if (blockAvailable.yellow) pool.yellow  = probRow.yellow;
    if (blockAvailable.red)    pool.red     = probRow.red;
    if (blockAvailable.blue)   pool.blue    = probRow.blue;
    pool.obstacle = probRow.obstacle;

    function sampleFromPool(p){
        const total = Object.values(p).reduce((a,b)=>a+b, 0);
        if (total <= 0) return null;
        let r = Math.random() * total;
        for (const [key, w] of Object.entries(p)){
            r -= w;
            if (r <= 0) return key;
        }
        // fallback: last key
        return Object.keys(p)[Object.keys(p).length - 1];
    }

    // Try actions, removing infeasible ones and re-sampling
    while (Object.keys(pool).length > 0){
        const action = sampleFromPool(pool);
        if (!action) break;

        console.log('🤖 Sampled action:', action);

        if (action === 'obstacle'){
            // First try purposeful obstacle clearing
            const perBlock = [];
            for (const [name,b] of Object.entries(snapshot.blocks || {})){
                const bx = b.x|0, by = b.y|0;
                const di = getDist(D_imm, bx, by);
                const da = getDist(D_all, bx, by);
                let status = "ok";
                if (b.locked) status = "in_slot_locked";
                else if (da>=INF && di<INF) status = "blocked_by_movable";
                else if (da>di) status = "detour_due_to_movable";
                else if (di>=INF && da>=INF) status = "unreachable_even_ignoring_movable";
                if (!b.locked && (status==="blocked_by_movable" || status==="detour_due_to_movable")){
                    perBlock.push({ block: name });
                }
            }

            if (perBlock.length > 0){
                const plan = suggestObstaclePlan(perBlock);
                if (plan && plan.score > 0){
                    console.log('🤖 Obstacle plan (purposeful):', plan);
                    return { chosen: { type: 'obstacle', id: plan.obstacle, dir: plan.steps[0] } };
                }
            }

            // Fallback: random valid obstacle move
            const rnd = randomObstacleMove();
            if (rnd){
                console.log('🤖 Obstacle move (random):', rnd);
                return { chosen: { type: 'obstacle', id: rnd.obstacle, dir: rnd.dir } };
            }

            console.log('🤖 Obstacle action infeasible, removing from pool');
            delete pool.obstacle;

        } else {
            // Block move
            const r = chooseDownhillStepWithBlockGate(action);
            if (r.ok){
                console.log('🤖 Block move chosen:', r);
                return { chosen: { type: 'block', id: r.block, dir: r.step } };
            }
            console.log(`🤖 Block ${action} infeasible (${r.reason}), removing from pool`);
            delete pool[action];
        }
    }

    console.log('🤖 No valid action found');
    return { chosen: null };
}