/**
 * leaderAgent.js
 *
 * Leader agent algorithm with:
 * - Hierarchy based on lowest_available block
 * - Momentum: if last voted direction on a block was followed (block moved), keep going that way
 * - Peer influence: if last vote on red/blue was NOT followed, 15% chance to try a peer's direction
 */

// Module-level state persisted across rounds.
// Keyed by block name: { dir, blockPos: {x, y}, peerVotes: [{dir}] }
let prevRoundData = {};

export function executeLeaderAgent(GameState, castVote, previousVoteCache, robotPlayerId) {
    console.log('🤖 Leader Agent: Running leader diagnostic...');
    console.log('🤖 prevRoundData:', prevRoundData);
    console.log('🤖 previousVoteCache:', previousVoteCache);

    const result = runLeaderDiagnostic(GameState, previousVoteCache, robotPlayerId);

    if (result && result.chosen) {
        console.log('🤖 Leader chose:', result.chosen);

        const { type, id, dir } = result.chosen;
        const isObstacle = (type === 'obstacle');

        // --- Store this round's data for next round's momentum / peer-influence checks ---
        if (type === 'block') {
            const block = GameState.blocks?.[id];
            const bx = block?.location?.x ?? block?.x ?? null;
            const by = block?.location?.y ?? block?.y ?? null;

            // Collect peer votes for this block from previousVoteCache (raw per-player format)
            const peerVotes = [];
            if (previousVoteCache) {
                for (const [playerId, voteData] of Object.entries(previousVoteCache)) {
                    if (robotPlayerId && playerId === robotPlayerId) continue; // skip self
                    if (voteData.targetId === id) {
                        peerVotes.push({ dir: voteData.direction });
                    }
                }
            }

            prevRoundData[id] = {
                dir,
                blockPos: { x: bx, y: by },
                peerVotes
            };
            console.log(`🤖 Stored prevRoundData for ${id}:`, prevRoundData[id]);
        }

        castVote(id, dir, isObstacle);
    } else {
        console.log('🤖 Leader: No valid move found');
    }
}

function runLeaderDiagnostic(GameState, previousVoteCache, robotPlayerId) {
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
    for (let x = 0; x < GRID; x++) {
        wallSet.add(`${x},0`);
        wallSet.add(`${x},${GRID - 1}`);
    }
    for (let y = 0; y < GRID; y++) {
        wallSet.add(`0,${y}`);
        wallSet.add(`${GRID - 1},${y}`);
    }
    if (Array.isArray(snapshot.walls)) {
        for (const w of snapshot.walls) {
            if (w && Number.isFinite(w.x) && Number.isFinite(w.y)) {
                wallSet.add(`${w.x | 0},${w.y | 0}`);
            }
        }
    }

    // ----- Helpers -----
    const inBoundsTL = (x, y, sz) => (x >= 0 && y >= 0 && (x + sz) <= GRID && (y + sz) <= GRID);

    const rectOverlap = (ax, ay, asz, bx, by, bsz) =>
        (ax < bx + bsz && bx < ax + asz && ay < by + bsz && by < ay + asz);

    const footprintHitsWalls = (tlx, tly, sz) => {
        for (let dy = 0; dy < sz; dy++) {
            for (let dx = 0; dx < sz; dx++) {
                if (wallSet.has(`${tlx + dx},${tly + dy}`)) return true;
            }
        }
        return false;
    };

    const obstaclesArr = Object.values(snapshot.obstacles || {});
    const immObs = obstaclesArr.filter(o => !!o.immovable);
    const movObs = obstaclesArr.filter(o => !o.immovable);

    const slotsArr = Object.values(snapshot.slots || {});

    // Lock blocks already in a slot
    function isBlockInAnySlotTL(b) {
        const bx = b.x | 0, by = b.y | 0;
        for (const sl of slotsArr) {
            if ((sl.x | 0) === bx && (sl.y | 0) === by) return true;
        }
        return false;
    }
    for (const [bn, b] of Object.entries(snapshot.blocks || {})) {
        if (b && isBlockInAnySlotTL(b)) b.locked = true;
    }

    const TL_W = GRID - BLOCK_SIZE + 1;
    const TL_H = GRID - BLOCK_SIZE + 1;

    function okBlockTL(x, y, includeMovables) {
        if (!inBoundsTL(x, y, BLOCK_SIZE)) return false;
        if (footprintHitsWalls(x, y, BLOCK_SIZE)) return false;
        for (const o of immObs) {
            if (rectOverlap(x, y, BLOCK_SIZE, o.x, o.y, OBS_SIZE)) return false;
        }
        if (includeMovables) {
            for (const o of movObs) {
                if (rectOverlap(x, y, BLOCK_SIZE, o.x, o.y, OBS_SIZE)) return false;
            }
        }
        return true;
    }

    function bfs(includeMovables) {
        const dist = Array.from({ length: TL_H }, () => Array(TL_W).fill(INF));
        const qx = new Array(TL_W * TL_H);
        const qy = new Array(TL_W * TL_H);
        let head = 0, tail = 0;

        for (const sl of slotsArr) {
            const sx = sl.x | 0, sy = sl.y | 0;
            if (sx < 0 || sy < 0 || sx >= TL_W || sy >= TL_H) continue;
            if (!okBlockTL(sx, sy, includeMovables)) continue;
            if (dist[sy][sx] !== 0) {
                dist[sy][sx] = 0;
                qx[tail] = sx; qy[tail] = sy; tail++;
            }
        }

        const DX = [0, 0, -1, 1], DY = [-1, 1, 0, 0];
        while (head < tail) {
            const x = qx[head], y = qy[head]; head++;
            const nd = dist[y][x] + 1;
            for (let k = 0; k < 4; k++) {
                const nx = x + DX[k], ny = y + DY[k];
                if (nx < 0 || ny < 0 || nx >= TL_W || ny >= TL_H) continue;
                if (!okBlockTL(nx, ny, includeMovables)) continue;
                if (dist[ny][nx] <= nd) continue;
                dist[ny][nx] = nd;
                qx[tail] = nx; qy[tail] = ny; tail++;
            }
        }
        return dist;
    }

    const D_imm = bfs(false);
    const D_all = bfs(true);

    function getDist(D, x, y) {
        if (x < 0 || y < 0 || x >= TL_W || y >= TL_H) return INF;
        return D[y][x];
    }

    // ----- Obstacle blocking detection -----
    const affected = [];
    const perBlock = [];

    for (const [name, b] of Object.entries(snapshot.blocks || {})) {
        const bx = b.x | 0, by = b.y | 0;
        const di = getDist(D_imm, bx, by);
        const da = getDist(D_all, bx, by);

        let status = "ok";
        if (b.locked) {
            status = "in_slot_locked";
        } else if (da >= INF && di < INF) {
            status = "blocked_by_movable";
        } else if (da > di) {
            status = "detour_due_to_movable";
        } else if (di >= INF && da >= INF) {
            status = "unreachable_even_ignoring_movable";
        }

        const entry = {
            block: name,
            TL: { x: bx, y: by },
            D_imm: di >= INF ? null : di,
            D_all: da >= INF ? null : da,
            status
        };

        if (!b.locked && (status === "blocked_by_movable" || status === "detour_due_to_movable")) {
            affected.push(entry);
        }
        perBlock.push(entry);
    }

    const needsObstacleClearing = affected.length > 0;

    // ----- Obstacle move helpers -----
    const DIRS_OBS = [
        { name: 'up', dx: 0, dy: -1 },
        { name: 'down', dx: 0, dy: 1 },
        { name: 'left', dx: -1, dy: 0 },
        { name: 'right', dx: 1, dy: 0 },
    ];

    function isObstacleMoveLegal(state, obsKey, dir) {
        const o = state.obstacles?.[obsKey];
        if (!o) return { ok: false };
        if (o.immovable) return { ok: false };

        const nx = (o.x | 0) + dir.dx;
        const ny = (o.y | 0) + dir.dy;
        if (!inBoundsTL(nx, ny, OBS_SIZE)) return { ok: false };
        if (footprintHitsWalls(nx, ny, OBS_SIZE)) return { ok: false };

        for (const [ok2, o2] of Object.entries(state.obstacles || {})) {
            if (ok2 === obsKey) continue;
            if (rectOverlap(nx, ny, OBS_SIZE, o2.x | 0, o2.y | 0, OBS_SIZE)) return { ok: false };
        }
        for (const [bn, b] of Object.entries(state.blocks || {})) {
            if (rectOverlap(nx, ny, OBS_SIZE, b.x | 0, b.y | 0, BLOCK_SIZE)) return { ok: false };
        }
        return { ok: true };
    }

    function applyObstacleMove(state, obsKey, dir) {
        const newState = { blocks: { ...state.blocks }, obstacles: {}, slots: state.slots };
        for (const [k, o] of Object.entries(state.obstacles || {})) {
            newState.obstacles[k] = { ...o };
        }
        const o = newState.obstacles[obsKey];
        o.x = (o.x | 0) + dir.dx;
        o.y = (o.y | 0) + dir.dy;
        return newState;
    }

    function computeDAllFor(stateX) {
        const movObsX = Object.values(stateX.obstacles || {}).filter(o => !o.immovable);
        const slotsX = Object.values(stateX.slots || {});

        function okTL_X(x, y) {
            if (!inBoundsTL(x, y, BLOCK_SIZE)) return false;
            if (footprintHitsWalls(x, y, BLOCK_SIZE)) return false;
            for (const o of immObs) {
                if (rectOverlap(x, y, BLOCK_SIZE, o.x, o.y, OBS_SIZE)) return false;
            }
            for (const o of movObsX) {
                if (rectOverlap(x, y, BLOCK_SIZE, o.x, o.y, OBS_SIZE)) return false;
            }
            return true;
        }

        const dist = Array.from({ length: TL_H }, () => Array(TL_W).fill(INF));
        const qx = new Array(TL_W * TL_H);
        const qy = new Array(TL_W * TL_H);
        let head = 0, tail = 0;

        for (const sl of slotsX) {
            const sx = sl.x | 0, sy = sl.y | 0;
            if (sx < 0 || sy < 0 || sx >= TL_W || sy >= TL_H) continue;
            if (!okTL_X(sx, sy)) continue;
            if (dist[sy][sx] !== 0) {
                dist[sy][sx] = 0;
                qx[tail] = sx; qy[tail] = sy; tail++;
            }
        }

        const DX = [0, 0, -1, 1], DY = [-1, 1, 0, 0];
        while (head < tail) {
            const x = qx[head], y = qy[head]; head++;
            const nd = dist[y][x] + 1;
            for (let k = 0; k < 4; k++) {
                const nx = x + DX[k], ny = y + DY[k];
                if (nx < 0 || ny < 0 || nx >= TL_W || ny >= TL_H) continue;
                if (!okTL_X(nx, ny)) continue;
                if (dist[ny][nx] <= nd) continue;
                dist[ny][nx] = nd;
                qx[tail] = nx; qy[tail] = ny; tail++;
            }
        }
        return dist;
    }

    function scoreStateAgainstBaseline(stateX, baselineDAll, blocksToScore) {
        const D = computeDAllFor(stateX);
        const INF_WIN = 1000;
        let score = 0;
        const per = {};

        for (const bn of blocksToScore) {
            const b = stateX.blocks?.[bn];
            if (!b || b.locked) continue;
            const before = getDist(baselineDAll, b.x | 0, b.y | 0);
            const after = getDist(D, b.x | 0, b.y | 0);

            let imp = 0;
            if (before >= INF && after < INF) imp = INF_WIN;
            else if (before < INF && after < INF) imp = Math.max(0, before - after);

            score += imp;
            per[bn] = { before: before >= INF ? null : before, after: after >= INF ? null : after, improvement: imp };
        }
        return { score, perBlock: per };
    }

    function suggestObstaclePlan(affectedEntries) {
        const movableKeys = Object.entries(snapshot.obstacles || {})
            .filter(([k, o]) => !o.immovable)
            .map(([k]) => k);

        const blocksToScore = affectedEntries.map(e => e.block);
        const baseline = D_all;
        let best = null;

        for (const ok of movableKeys) {
            for (const d1 of DIRS_OBS) {
                const c1 = isObstacleMoveLegal(snapshot, ok, d1);
                if (!c1.ok) continue;
                const s1 = applyObstacleMove(snapshot, ok, d1);
                const r1 = scoreStateAgainstBaseline(s1, baseline, blocksToScore);
                const cand = { obstacle: ok, steps: [d1.name], score: r1.score };
                if (!best || cand.score > best.score) best = cand;
            }
        }

        for (const ok of movableKeys) {
            for (const d1 of DIRS_OBS) {
                const c1 = isObstacleMoveLegal(snapshot, ok, d1);
                if (!c1.ok) continue;
                const s1 = applyObstacleMove(snapshot, ok, d1);
                for (const d2 of DIRS_OBS) {
                    const c2 = isObstacleMoveLegal(s1, ok, d2);
                    if (!c2.ok) continue;
                    const s2 = applyObstacleMove(s1, ok, d2);
                    const r2 = scoreStateAgainstBaseline(s2, baseline, blocksToScore);
                    const cand = { obstacle: ok, steps: [d1.name, d2.name], score: r2.score };
                    if (!best || cand.score > best.score) best = cand;
                }
            }
        }

        return best;
    }

    // ----- Block move helpers -----
    const DIRS_BLOCK = [
        { name: "up", dx: 0, dy: -1 },
        { name: "down", dx: 0, dy: 1 },
        { name: "left", dx: -1, dy: 0 },
        { name: "right", dx: 1, dy: 0 },
    ];

    const DIR_VEC = {
        up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 },
        left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 }
    };

    function canPlaceBlockAt(x, y, selfName) {
        if (!inBoundsTL(x, y, BLOCK_SIZE)) return false;
        if (footprintHitsWalls(x, y, BLOCK_SIZE)) return false;
        for (const o of immObs) {
            if (rectOverlap(x, y, BLOCK_SIZE, o.x | 0, o.y | 0, OBS_SIZE)) return false;
        }
        for (const o of movObs) {
            if (rectOverlap(x, y, BLOCK_SIZE, o.x | 0, o.y | 0, OBS_SIZE)) return false;
        }
        for (const [bn, b] of Object.entries(snapshot.blocks || {})) {
            if (bn === selfName) continue;
            if (b && b.locked) continue;
            if (rectOverlap(x, y, BLOCK_SIZE, b.x | 0, b.y | 0, BLOCK_SIZE)) return false;
        }
        return true;
    }

    function okBlockTL_withBlocks(x, y, selfName) {
        if (!inBoundsTL(x, y, BLOCK_SIZE)) return false;
        if (footprintHitsWalls(x, y, BLOCK_SIZE)) return false;
        for (const o of immObs) {
            if (rectOverlap(x, y, BLOCK_SIZE, o.x | 0, o.y | 0, OBS_SIZE)) return false;
        }
        for (const [bn, b] of Object.entries(snapshot.blocks || {})) {
            if (bn === selfName) continue;
            if (b && b.locked) continue;
            if (rectOverlap(x, y, BLOCK_SIZE, b.x | 0, b.y | 0, BLOCK_SIZE)) return false;
        }
        return true;
    }

    function bfsImmWithBlocks(selfName) {
        const dist = Array.from({ length: TL_H }, () => Array(TL_W).fill(INF));
        const qx = new Array(TL_W * TL_H);
        const qy = new Array(TL_W * TL_H);
        let head = 0, tail = 0;

        for (const sl of slotsArr) {
            const sx = sl.x | 0, sy = sl.y | 0;
            if (sx < 0 || sy < 0 || sx >= TL_W || sy >= TL_H) continue;
            if (!okBlockTL_withBlocks(sx, sy, selfName)) continue;
            dist[sy][sx] = 0;
            qx[tail] = sx; qy[tail] = sy; tail++;
        }

        const DX = [0, 0, -1, 1], DY = [-1, 1, 0, 0];
        while (head < tail) {
            const x = qx[head], y = qy[head]; head++;
            const nd = dist[y][x] + 1;
            for (let k = 0; k < 4; k++) {
                const nx = x + DX[k], ny = y + DY[k];
                if (nx < 0 || ny < 0 || nx >= TL_W || ny >= TL_H) continue;
                if (!okBlockTL_withBlocks(nx, ny, selfName)) continue;
                if (dist[ny][nx] <= nd) continue;
                dist[ny][nx] = nd;
                qx[tail] = nx; qy[tail] = ny; tail++;
            }
        }
        return dist;
    }

    // ----- Core block move quality gate + direction selection -----
    // Applies momentum and peer influence where appropriate
    function chooseDownhillStepWithBlockGate(blockName) {
        const b = snapshot.blocks?.[blockName];
        if (!b || b.locked) return { block: blockName, ok: false, reason: "locked/in slot" };

        const x = b.x | 0, y = b.y | 0;

        const di0 = getDist(D_imm, x, y);
        const da0 = getDist(D_all, x, y);
        const obstacleBlocked = (di0 < INF && (da0 >= INF || da0 > di0));
        if (obstacleBlocked) {
            return { block: blockName, ok: false, reason: `obstacle-blocked` };
        }

        const D_imm_blocks = bfsImmWithBlocks(blockName);
        const dib0 = getDist(D_imm_blocks, x, y);
        const blockedByOtherBlocks = (di0 < INF && dib0 >= INF) || (di0 < INF && dib0 > di0);
        if (blockedByOtherBlocks) {
            return { block: blockName, ok: false, reason: `blocked by other blocks` };
        }

        // Helper: is a direction both downhill and physically legal right now?
        function isLegalDownhillDir(dirName) {
            const dv = DIR_VEC[dirName];
            if (!dv) return false;
            const nx = x + dv.dx, ny = y + dv.dy;
            if (getDist(D_all, nx, ny) >= da0) return false;
            return canPlaceBlockAt(nx, ny, blockName);
        }

        const prev = prevRoundData[blockName];

        // --- Momentum: block moved last round → keep same direction if still legal ---
        if (prev) {
            const blockMoved = (prev.blockPos.x !== x || prev.blockPos.y !== y);
            if (blockMoved && isLegalDownhillDir(prev.dir)) {
                console.log(`🤖 Momentum: ${blockName} moved last round, continuing ${prev.dir}`);
                return { block: blockName, ok: true, step: prev.dir, from: { x, y }, d0: da0, momentum: true };
            }

            // --- Peer influence: block did NOT move, red/blue only, 15% chance ---
            if (!blockMoved && (blockName === 'red' || blockName === 'blue') && prev.peerVotes?.length > 0) {
                const legalPeerDirs = prev.peerVotes
                    .map(pv => pv.dir)
                    .filter(d => isLegalDownhillDir(d));

                if (legalPeerDirs.length > 0 && Math.random() < 0.15) {
                    const chosen = legalPeerDirs[0];
                    console.log(`🤖 Peer influence: ${blockName} not followed, adopting peer dir ${chosen}`);
                    return { block: blockName, ok: true, step: chosen, from: { x, y }, d0: da0, peerInfluence: true };
                }
            }
        }

        // --- Default: first legal downhill step ---
        for (const d of DIRS_BLOCK) {
            const nx = x + d.dx, ny = y + d.dy;
            const d1 = getDist(D_all, nx, ny);
            if (d1 >= da0) continue;
            if (!canPlaceBlockAt(nx, ny, blockName)) continue;
            return { block: blockName, ok: true, step: d.name, from: { x, y }, to: { x: nx, y: ny }, d0: da0, d1 };
        }

        return { block: blockName, ok: false, reason: "no downhill legal move" };
    }

    // ----- Determine lowest_available -----
    // 1 = all 3 blocks still available
    // 2 = only red + blue (yellow locked/gone)
    // 3 = only blue remaining
    const yellowAvailable = snapshot.blocks?.yellow && !snapshot.blocks.yellow.locked;
    const redAvailable    = snapshot.blocks?.red    && !snapshot.blocks.red.locked;

    let lowest_available;
    if (yellowAvailable)   lowest_available = 1;
    else if (redAvailable) lowest_available = 2;
    else                   lowest_available = 3;

    console.log('🤖 lowest_available:', lowest_available);

    // ----- Priority hierarchy -----
    // Table (rank, lower = higher priority, NaN = skip):
    //               yellow  red   blue  obstacle
    // lowest=1:      2.0   1.0   4.0    3.0   → red, yellow, obstacle, blue
    // lowest=2:      NaN   1.0   2.0    3.0   → red, blue, obstacle
    // lowest=3:      NaN   NaN   1.0    2.0   → blue, obstacle
    const HIERARCHY = {
        1: ['red', 'yellow', 'obstacle', 'blue'],
        2: ['red', 'blue', 'obstacle'],
        3: ['blue', 'obstacle'],
    };

    console.log('🤖 needsObstacleClearing:', needsObstacleClearing);
    console.log('🤖 Trying options in order:', HIERARCHY[lowest_available]);

    for (const option of HIERARCHY[lowest_available]) {
        if (option === 'obstacle') {
            if (!needsObstacleClearing) {
                console.log('🤖 Skipping obstacle: no clearing needed');
                continue;
            }
            const plan = suggestObstaclePlan(affected);
            if (!plan || plan.score <= 0) {
                console.log('🤖 Skipping obstacle: no beneficial plan');
                continue;
            }
            console.log('🤖 Chose obstacle move:', plan);
            return { chosen: { type: 'obstacle', id: plan.obstacle, dir: plan.steps[0] } };
        } else {
            const r = chooseDownhillStepWithBlockGate(option);
            if (!r.ok) {
                console.log(`🤖 Skipping ${option}: ${r.reason}`);
                continue;
            }
            console.log('🤖 Chose block move:', r);
            return { chosen: { type: 'block', id: r.block, dir: r.step } };
        }
    }

    console.log('🤖 No valid move found after exhausting hierarchy');
    return { chosen: null };
}