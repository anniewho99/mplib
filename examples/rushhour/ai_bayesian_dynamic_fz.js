/**
 * ai_bayesian_dynamic_fz.js
 * =========================
 * Bayesian AI Agent with VOI timing and Dynamic Fixed-Zone (λ,α) belief.
 *
 * Beliefs are FACTORED: a separate distribution over λ (rationality) and
 * α (conformity) per player.  The λ prior is updated at each round start
 * by looking up the BFS zone (from the board distance), which conditions
 * the λ distribution on how far along the puzzle we are.  Observations
 * then update both λ and α via mean-field Bayesian updates.
 *
 * ── Usage ──────────────────────────────────────────────────────────────────
 *
 *   // 1. Load JSON data once (at game start):
 *   const bfsTable     = await fetch('model/bfs_table.json').then(r => r.json());
 *   const dynamicPrior = await fetch('model/dynamic_prior.json').then(r => r.json());
 *
 *   // 2. Create one agent per game session / level:
 *   const agent = createDynamicFZBayesianAgent({ level: 0, bfsTable, dynamicPrior });
 *
 *   // 3. At the start of each voting round (before any human votes arrive):
 *   agent.startRound({
 *     boardState,         // {blockId: {col, row}}
 *     playerIds,          // string[] — human player IDs (exclude the AI)
 *     round               // round index (used for internal cache keying)
 *   });
 *
 *   // 4. When a human vote arrives (call BEFORE ai.decide on this vote):
 *   agent.observeVote({
 *     playerId,           // string
 *     vote,               // {blockId, dir} or null (null = no-vote)
 *     priorVotes          // array of {blockId,dir}|null committed BEFORE this player
 *   });
 *
 *   // 5. Ask the agent whether to vote (call at round start AND after each human vote):
 *   const { shouldVoteNow, vote } = agent.decide({
 *     committedVotes,     // array of {blockId,dir}|null cast so far this round
 *     remainingPlayerIds  // string[] players yet to vote this round
 *   });
 *   // shouldVoteNow : boolean
 *   // vote          : {blockId, dir} or null
 *
 * ── Board-state format ─────────────────────────────────────────────────────
 *   boardState = {
 *     b0: { col: 3, row: 2 },   // target block (red car)
 *     b1: { col: 0, row: 0 },
 *     ...
 *   }
 *
 * ── Vote format ────────────────────────────────────────────────────────────
 *   { blockId: 'b1', dir: 'fwd' }  — move block b1 one step forward
 *   { blockId: 'b2', dir: 'back' } — move block b2 one step backward
 *   null                           — no-vote (abstain)
 *
 * ── Zone mapping ───────────────────────────────────────────────────────────
 *   BFS distance d is mapped to zone 0..4:
 *     zone 4 = d ≤ 5   (very close to solution — late game)
 *     zone 3 = d ≤ 10
 *     zone 2 = d ≤ 20
 *     zone 1 = d ≤ 35
 *     zone 0 = d > 35  (far from solution — early game)
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * λ grid used for the dynamic mode.
 * NOTE: The dynamic_prior.json also stores a lambda_grid field; its values are
 * used as indices into these grid positions (both are length 4, same index mapping).
 */
const DYN_LAMBDA_GRID = [0.0, 0.3, 1.0, 3.0];   // N_DYN_LAM = 4

/** α grid shared across all modes. */
const ALPHA_GRID = [0.0, 1.0, 2.0, 3.0];          // N_ALP = 4

/** Utility penalty assigned to the no-vote option. */
const NO_VOTE_PENALTY = 0.5;

/** Board size (6×6 grid). */
const BOARD_SIZE = 6;

/** Target block (red car) exits when its left edge reaches this column. */
const TARGET_EXIT_COL = 5;

const EV_TIE_EPSILON = 1e-9;

/**
 * Fixed-zone BFS distance boundaries (ascending).
 * Zone assignment: zone = 4 if d ≤ 5, zone = 3 if d ≤ 10, ..., zone = 0 if d > 35.
 * Mirrors Python model/belief.py FIXED_ZONE_BOUNDARIES.
 */
const FIXED_ZONE_BOUNDS = [5, 10, 20, 35];  // length must equal n_zones - 1

/**
 * Block metadata per level: direction ('h'|'v') and size in cells.
 * Mirrors Python model/board.py LEVEL_CONFIGS.
 */
const LEVEL_META = {
  0: {
    b0: { dir: 'h', size: 2 }, b1: { dir: 'v', size: 2 }, b2: { dir: 'v', size: 2 },
    b3: { dir: 'v', size: 2 }, b4: { dir: 'h', size: 2 }, b5: { dir: 'h', size: 2 },
    b6: { dir: 'v', size: 2 }
  },
  1: {
    b0: { dir: 'h', size: 2 }, b1: { dir: 'v', size: 3 }, b2: { dir: 'v', size: 3 },
    b3: { dir: 'h', size: 2 }, b4: { dir: 'v', size: 2 }, b5: { dir: 'h', size: 2 },
    b6: { dir: 'v', size: 3 }
  },
  2: {
    b0: { dir: 'h', size: 2 }, b1: { dir: 'v', size: 3 }, b2: { dir: 'v', size: 3 },
    b3: { dir: 'h', size: 2 }, b4: { dir: 'h', size: 2 }, b5: { dir: 'v', size: 2 },
    b6: { dir: 'v', size: 2 }
  },
  3: {
    b0: { dir: 'h', size: 2 }, b1: { dir: 'v', size: 3 }, b2: { dir: 'v', size: 3 },
    b3: { dir: 'h', size: 2 }, b4: { dir: 'v', size: 2 }, b5: { dir: 'h', size: 2 },
    b6: { dir: 'v', size: 3 }, b7: { dir: 'v', size: 2 }
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// BOARD UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Encode board state as the BFS table lookup key.
 * Format: "col,row;col,row;..." with blocks sorted by block ID.
 * Matches Python board.py _table_key().
 */
function _tableKey(positions) {
  return Object.keys(positions)
    .sort()
    .map(id => `${positions[id].col},${positions[id].row}`)
    .join(';');
}

/**
 * Look up BFS distance for a board state.
 * Returns 0 for solved states (b0 at exit column), null if not found.
 */
function _bfsLookup(positions, level, bfsTable) {
  if (positions['b0'] && positions['b0'].col >= TARGET_EXIT_COL) return 0;
  const levelTable = bfsTable[String(level)];
  if (!levelTable) return null;
  const val = levelTable[_tableKey(positions)];
  return val !== undefined ? val : null;
}

/**
 * Aggregate votes to per-block net-vote profile.
 * Opposing votes cancel: net = fwd_count − back_count.
 * Blocks with net == 0 are omitted.
 * Mirrors Python model/features.py aggregate_votes().
 */
function _aggregateVotes(votes) {
  const counts = {};
  for (const v of votes) {
    if (!v || !v.blockId) continue;
    if (!counts[v.blockId]) counts[v.blockId] = { fwd: 0, back: 0 };
    counts[v.blockId][v.dir] = (counts[v.blockId][v.dir] || 0) + 1;
  }
  const profile = {};
  for (const [blockId, dirs] of Object.entries(counts)) {
    const net = dirs.fwd - dirs.back;
    if (net > 0)      profile[blockId] = ['fwd',  net];
    else if (net < 0) profile[blockId] = ['back', -net];
    // net == 0: cancelled — omit
  }
  return profile;
}

/**
 * Apply a vote profile to a board state.
 * Each block moves by netCount steps in the winning direction, clamped
 * to the board boundary.  The target block (b0) may exit the right edge.
 * Mirrors Python model/board.py apply_profile().
 */
/**
 * Return the set of grid cells occupied by a block at the given position.
 * @returns {Set<string>}  "col,row" strings
 */
function _occupiedCells(pos, blockId, meta) {
  const m = meta[blockId];
  const cells = new Set();
  for (let i = 0; i < m.size; i++) {
    cells.add(m.dir === 'h' ? `${pos.col + i},${pos.row}` : `${pos.col},${pos.row + i}`);
  }
  return cells;
}

/**
 * Apply a vote profile to a board state, with inter-block collision detection.
 * When two simultaneously-moving blocks' intended cells overlap, BOTH moves
 * are cancelled.  Mirrors Python model/board.py apply_profile().
 */
function _applyProfile(positions, profile, meta) {
  const newPos = {};
  for (const [id, p] of Object.entries(positions)) newPos[id] = { col: p.col, row: p.row };

  const moving = Object.keys(profile).filter(id => meta[id] && newPos[id]);
  const intended = {};

  // Compute intended position for each moving block, clamped by walls AND
  // all other blocks' ORIGINAL positions (mirrors Python _max_fwd/_max_back).
  for (const blockId of moving) {
    const [dir, count] = profile[blockId];
    const m   = meta[blockId];
    const pos = newPos[blockId];

    // Build occupied set: all cells of ALL OTHER blocks at their original positions
    const others = new Set();
    for (const [id, p] of Object.entries(positions)) {
      if (id === blockId) continue;
      const om = meta[id];
      if (!om) continue;
      for (let i = 0; i < om.size; i++) {
        others.add(om.dir === 'h' ? `${p.col + i},${p.row}` : `${p.col},${p.row + i}`);
      }
    }

    let actual = 0;
    if (m.dir === 'h') {
      if (dir === 'fwd') {
        const wall = (blockId === 'b0') ? BOARD_SIZE + 1 : BOARD_SIZE;
        for (let c = pos.col + m.size; c < wall; c++) {
          if (others.has(`${c},${pos.row}`)) break;
          actual++;
        }
        actual = Math.min(count, actual);
        intended[blockId] = { col: pos.col + actual, row: pos.row };
      } else {
        for (let c = pos.col - 1; c >= 0; c--) {
          if (others.has(`${c},${pos.row}`)) break;
          actual++;
        }
        actual = Math.min(count, actual);
        intended[blockId] = { col: pos.col - actual, row: pos.row };
      }
    } else {
      if (dir === 'fwd') {
        for (let r = pos.row + m.size; r < BOARD_SIZE; r++) {
          if (others.has(`${pos.col},${r}`)) break;
          actual++;
        }
        actual = Math.min(count, actual);
        intended[blockId] = { col: pos.col, row: pos.row + actual };
      } else {
        for (let r = pos.row - 1; r >= 0; r--) {
          if (others.has(`${pos.col},${r}`)) break;
          actual++;
        }
        actual = Math.min(count, actual);
        intended[blockId] = { col: pos.col, row: pos.row - actual };
      }
    }
  }

  // Cancel both blocks if their intended cells overlap
  const cancelled = new Set();
  for (let i = 0; i < moving.length; i++) {
    for (let j = i + 1; j < moving.length; j++) {
      const b1 = moving[i], b2 = moving[j];
      const cells1 = _occupiedCells(intended[b1], b1, meta);
      for (const cell of _occupiedCells(intended[b2], b2, meta)) {
        if (cells1.has(cell)) { cancelled.add(b1); cancelled.add(b2); break; }
      }
    }
  }

  for (const blockId of moving) {
    if (!cancelled.has(blockId)) newPos[blockId] = intended[blockId];
  }
  return newPos;
}

/**
 * Convert BFS distance d to a zone index (0 = early game, 4 = late game).
 * Zone 4: d ≤ 5; zone 3: d ≤ 10; zone 2: d ≤ 20; zone 1: d ≤ 35; zone 0: d > 35.
 */
function _distanceToZone(d) {
  const bounds = FIXED_ZONE_BOUNDS;  // [5, 10, 20, 35]
  const n = bounds.length;           // 4 boundaries → 5 zones
  for (let z = 0; z < n; z++) {
    if (d <= bounds[z]) return n - z;  // zone 4, 3, 2, 1
  }
  return 0;  // d > 35 → zone 0 (early game)
}

/**
 * Compute tau: marginal BFS change from adding vote on top of priorVotes.
 * tau < 0 means closer to solution (good).
 */
function _computeTau(vote, priorVotes, boardState, level, meta, bfsTable) {
  const priorProfile = _aggregateVotes(priorVotes);
  const priorState   = _applyProfile(boardState, priorProfile, meta);
  const bfsPrior     = _bfsLookup(priorState, level, bfsTable) ?? _bfsLookup(boardState, level, bfsTable) ?? 0;

  if (!vote || !vote.blockId) return 0;

  const combinedProfile = _aggregateVotes([...priorVotes, vote]);
  const combinedState   = _applyProfile(boardState, combinedProfile, meta);
  const bfsCombined     = _bfsLookup(combinedState, level, bfsTable) ?? bfsPrior;

  return bfsCombined - bfsPrior;
}

/** Compute sigma: count of prior votes matching this vote. */
function _computeSigma(vote, priorVotes) {
  if (!vote) return 0;
  return priorVotes.filter(v => v && v.blockId === vote.blockId && v.dir === vote.dir).length;
}

/**
 * Enumerate valid single-block moves by BFS table lookup.
 * A move is valid only if the block actually moves (not blocked by wall) AND
 * the resulting state is found in the BFS table or is solved.
 * Mirrors Python board.py valid_choice_set_from_board().
 * Always includes null (no-vote).
 */
function _getChoiceSet(positions, level, meta, bfsTable) {
  const moves = [];
  const origKey = _tableKey(positions);
  for (const blockId of Object.keys(meta)) {
    for (const dir of ['fwd', 'back']) {
      const newPos = _applyProfile(positions, { [blockId]: [dir, 1] }, meta);
      if (_tableKey(newPos) === origKey) continue;  // blocked at wall — zero-step move
      if (_bfsLookup(newPos, level, bfsTable) !== null) {
        moves.push({ blockId, dir });
      }
    }
  }
  moves.push(null);
  return moves;
}

// ═══════════════════════════════════════════════════════════════════════════
// MATH UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/** Numerically stable softmax. */
function _softmax(arr) {
  const m = Math.max(...arr);
  const exps = arr.map(x => Math.exp(x - m));
  const total = exps.reduce((a, b) => a + b, 0);
  return exps.map(e => e / total);
}

/**
 * Deterministic ordering for breaking genuine EV ties in _selectVote:
 * lexicographic by blockId then direction. Matches ai_bayesian_static.js's
 * _voteLess and the Python reference model's tuple-comparison tie-break.
 */
function _voteLess(a, b) {
  if (a.blockId !== b.blockId) return a.blockId < b.blockId;
  return a.dir < b.dir;
}

/**
 * Compute vote utilities for given λ and α.
 * u(vote) = -λ·τ + α·σ;  u(no-vote) = -NO_VOTE_PENALTY
 */
function _utilities(features, lam, alp) {
  return features.map(f => f.isNoVote ? -NO_VOTE_PENALTY : -lam * f.tau + alp * f.sigma);
}

/**
 * Precompute tau/sigma features for a choice set.
 * Independent of (λ, α) — compute once per decision point.
 */
function _computeFeatures(choiceSet, priorVotes, boardState, level, meta, bfsTable) {
  return choiceSet.map(vote => {
    if (!vote) return { tau: 0, sigma: 0, isNoVote: true };
    return {
      tau:     _computeTau(vote, priorVotes, boardState, level, meta, bfsTable),
      sigma:   _computeSigma(vote, priorVotes),
      isNoVote: false
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// DYNAMIC FIXED-ZONE PLAYER BELIEF
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Factored belief: independent distributions over λ and α.
 *
 * λ belief is seeded from the fixed-zone prior at round start (based on BFS
 * distance), then updated with mean-field Bayesian updates.
 *
 * α belief is seeded from a global alpha_prior and updated independently.
 */
class DynamicFZPlayerBelief {
  /**
   * @param {number[]}   alphaInitial     Initial α prior (length 4, sums to ~1)
   * @param {number[]}   lambdaInitial    Initial λ values (length 4; overwritten by first setZone)
   * @param {number[][]} zoneLambdaPriors [nZones × N_DYN_LAM] per-zone λ prior
   * @param {number[][][]} transitionMats [nZones × N_DYN_LAM × N_DYN_LAM] transition matrices
   * @param {number|null} currentZone    Current zone (null = not yet initialised)
   */
  constructor(alphaInitial, lambdaInitial, zoneLambdaPriors, transitionMats, currentZone = null) {
    this._alphaBelief    = new Float64Array(alphaInitial);
    this._lambdaBelief   = new Float64Array(lambdaInitial);
    this._zonePriors     = zoneLambdaPriors;
    this._transitionMats = transitionMats;  // transition_matrices from dynamic_prior.json fixed_zones
    this._currentZone    = currentZone;
    this._normalizeAlpha();
    this._normalizeLambda();
  }

  /**
   * Create from the data loaded from dynamic_prior.json.
   * @param {Object} dynamicPriorData  Parsed JSON
   * @returns {DynamicFZPlayerBelief}
   */
  static fromData(dynamicPriorData) {
    const fz             = dynamicPriorData.fixed_zones;
    const alphaInitial   = dynamicPriorData.alpha_prior;      // [0.071, 0.109, 0.247, 0.573]
    const zonePriors     = fz.zone_lambda_priors;             // [nZones × 4]
    const transitionMats = fz.transition_matrices;            // [nZones × 4 × 4]
    const nDyn           = DYN_LAMBDA_GRID.length;
    const lambdaInit     = Array(nDyn).fill(1 / nDyn);        // uniform; overwritten by first setZone
    return new DynamicFZPlayerBelief(alphaInitial, lambdaInit, zonePriors, transitionMats, null);
  }

  _normalizeAlpha() {
    let t = 0;
    for (let j = 0; j < this._alphaBelief.length; j++) t += this._alphaBelief[j];
    if (t > 0) for (let j = 0; j < this._alphaBelief.length; j++) this._alphaBelief[j] /= t;
  }

  _normalizeLambda() {
    let t = 0;
    for (let i = 0; i < this._lambdaBelief.length; i++) t += this._lambdaBelief[i];
    if (t > 0) for (let i = 0; i < this._lambdaBelief.length; i++) this._lambdaBelief[i] /= t;
  }

  /**
   * Update λ belief when transitioning to a new zone.
   * Mirrors Python DynamicPlayerBelief.set_zone():
   *   - First call (currentZone = null): replace λ belief with zone prior directly.
   *   - Later calls: apply transition matrix then combine with zone prior.
   *
   * @param {number} zone  0..4  (0 = early game, 4 = late game)
   */
  setZone(zone) {
    if (this._currentZone === zone) return;

    const N_DYN    = DYN_LAMBDA_GRID.length;
    const zonePrior = (this._zonePriors[zone] || Array(N_DYN).fill(1 / N_DYN));
    let newLam;

    if (this._currentZone === null) {
      // First zone assignment — use zone prior directly
      newLam = Array.from(zonePrior);
    } else {
      const T = (this._transitionMats && this._transitionMats[this._currentZone]) || null;
      let fromT;
      if (T) {
        // fromT[j] = Σ_i lambdaBelief[i] * T[i][j]
        fromT = Array(N_DYN).fill(0);
        for (let i = 0; i < N_DYN; i++) {
          for (let j = 0; j < N_DYN; j++) {
            fromT[j] += this._lambdaBelief[i] * T[i][j];
          }
        }
      } else {
        fromT = Array.from(this._lambdaBelief);
      }
      // Posterior ∝ fromT × zonePrior
      const combined = fromT.map((v, i) => v * zonePrior[i]);
      const s = combined.reduce((a, b) => a + b, 0);
      newLam = s > 1e-300 ? combined.map(v => v / s) : Array.from(zonePrior);
    }

    const total = newLam.reduce((a, b) => a + b, 0);
    this._lambdaBelief = new Float64Array(total > 1e-300 ? newLam.map(v => v / total) : newLam);
    this._currentZone  = zone;
  }

  /**
   * Update λ belief from BFS distance.
   * @param {number|null} d  BFS distance (null → no update)
   */
  setZoneFromDistance(d) {
    if (d === null || d === undefined) return;
    this.setZone(_distanceToZone(d));
  }

  /**
   * Mean-field Bayesian update after observing a vote.
   *
   * λ update: P(λ_i) ∝ P(λ_i) · Σ_j P(α_j) · P(vote | λ_i, α_j)
   * α update: P(α_j) ∝ P(α_j) · Σ_i P(λ_i) · P(vote | λ_i, α_j)
   *
   * @param {Array}  features  [{tau, sigma, isNoVote}] for the full choice set
   * @param {number} voteIdx   Index of observed vote in the choice set
   */
  update(features, voteIdx) {
    const idx = voteIdx >= 0 ? voteIdx : features.findIndex(f => f.isNoVote);
    if (idx < 0) return;

    const N_LAM = DYN_LAMBDA_GRID.length;
    const N_ALP = ALPHA_GRID.length;

    // --- Update λ (marginalise over current α belief) ---
    for (let i = 0; i < N_LAM; i++) {
      let lik = 0;
      for (let j = 0; j < N_ALP; j++) {
        const utils = _utilities(features, DYN_LAMBDA_GRID[i], ALPHA_GRID[j]);
        const probs = _softmax(utils);
        lik += this._alphaBelief[j] * (probs[idx] || 1e-10);
      }
      this._lambdaBelief[i] *= lik;
    }
    this._normalizeLambda();

    // --- Update α (marginalise over current λ belief) ---
    for (let j = 0; j < N_ALP; j++) {
      let lik = 0;
      for (let i = 0; i < N_LAM; i++) {
        const utils = _utilities(features, DYN_LAMBDA_GRID[i], ALPHA_GRID[j]);
        const probs = _softmax(utils);
        lik += this._lambdaBelief[i] * (probs[idx] || 1e-10);
      }
      this._alphaBelief[j] *= lik;
    }
    this._normalizeAlpha();
  }

  /**
   * Maximum-a-posteriori (λ, α) estimate (from marginals).
   * @returns {{lambda: number, alpha: number}}
   */
  mapEstimate() {
    let bestLam = 0, bestLamVal = -1;
    for (let i = 0; i < this._lambdaBelief.length; i++) {
      if (this._lambdaBelief[i] > bestLamVal) { bestLamVal = this._lambdaBelief[i]; bestLam = i; }
    }
    let bestAlp = 0, bestAlpVal = -1;
    for (let j = 0; j < this._alphaBelief.length; j++) {
      if (this._alphaBelief[j] > bestAlpVal) { bestAlpVal = this._alphaBelief[j]; bestAlp = j; }
    }
    return {
      lambda: DYN_LAMBDA_GRID[bestLam],
      alpha:  ALPHA_GRID[bestAlp]
    };
  }

  /**
   * Predictive distribution P(vote | belief) = Σ_{λ,α} P(λ)·P(α)·P(vote|λ,α).
   * Returns a Map from vote index to probability.
   *
   * @param {Array} features  [{tau, sigma, isNoVote}]
   * @returns {Map<number, number>}
   */
  predictiveByIndex(features) {
    const N_LAM  = DYN_LAMBDA_GRID.length;
    const N_ALP  = ALPHA_GRID.length;
    const nVotes = features.length;
    const probs  = new Float64Array(nVotes);

    for (let i = 0; i < N_LAM; i++) {
      for (let j = 0; j < N_ALP; j++) {
        const w = this._lambdaBelief[i] * this._alphaBelief[j];
        if (w < 1e-12) continue;
        const utils = _utilities(features, DYN_LAMBDA_GRID[i], ALPHA_GRID[j]);
        const p = _softmax(utils);
        for (let k = 0; k < nVotes; k++) probs[k] += w * p[k];
      }
    }
    const result = new Map();
    for (let k = 0; k < nVotes; k++) result.set(k, probs[k]);
    return result;
  }

  /** Deep copy (preserves current zone and belief state). */
  copy() {
    return new DynamicFZPlayerBelief(
      Array.from(this._alphaBelief),
      Array.from(this._lambdaBelief),
      this._zonePriors,
      this._transitionMats,
      this._currentZone
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BAYESIAN AGENT
// ═══════════════════════════════════════════════════════════════════════════

class DynamicFZBayesianAgent {
  /**
   * @param {Object} config
   * @param {number} config.level         Puzzle level (0-3)
   * @param {Object} config.bfsTable      Loaded from model/bfs_table.json
   * @param {Object} config.dynamicPrior  Loaded from model/dynamic_prior.json
   */
  constructor({ level, bfsTable, dynamicPrior }) {
    if (!(level in LEVEL_META)) throw new Error(`Unknown level ${level}`);
    this._level        = level;
    this._meta         = LEVEL_META[level];
    this._bfsTable     = bfsTable;
    this._dynamicPrior = dynamicPrior;

    this._beliefs    = new Map();   // playerId → DynamicFZPlayerBelief
    this._boardState = null;
    this._round      = null;
    this._playerIds  = [];
    this._choiceSet  = [];
    this._ebfsCache  = new Map();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Call at the start of each voting round.
   *
   * @param {Object}   boardState  {blockId: {col, row}}
   * @param {string[]} playerIds   Human player IDs for this round (exclude AI)
   * @param {number}   round       Round index
   */
  startRound(boardState, playerIds, round) {
    this._boardState = boardState;
    this._round      = round;
    this._playerIds  = playerIds;
    this._choiceSet  = _getChoiceSet(boardState, this._level, this._meta, this._bfsTable);
    this._ebfsCache.clear();

    const d = _bfsLookup(boardState, this._level, this._bfsTable);

    for (const pid of playerIds) {
      if (!this._beliefs.has(pid)) {
        this._beliefs.set(pid, DynamicFZPlayerBelief.fromData(this._dynamicPrior));
      }
      // Update zone belief at each round start
      this._beliefs.get(pid).setZoneFromDistance(d);
    }
  }

  /**
   * Update belief for a player after observing their vote.
   * Must be called BEFORE the next ai.decide() call.
   *
   * @param {string}      playerId
   * @param {Object|null} vote        {blockId, dir} or null
   * @param {Array}       priorVotes  Votes committed before this player
   */
  observeVote(playerId, vote, priorVotes) {
    const belief = this._beliefs.get(playerId);
    if (!belief) return;

    const features = _computeFeatures(
      this._choiceSet, priorVotes, this._boardState, this._level, this._meta, this._bfsTable
    );
    const voteIdx = vote === null
      ? this._choiceSet.findIndex(v => v === null)
      : this._choiceSet.findIndex(v => v && v.blockId === vote.blockId && v.dir === vote.dir);

    belief.update(features, voteIdx);
    this._ebfsCache.clear();
  }

  /**
   * Main decision function.
   * Call at round start and after each human vote.
   *
   * @param {Array}    committedVotes      Votes cast so far this round
   * @param {string[]} remainingPlayerIds  Players yet to vote
   * @returns {{ shouldVoteNow: boolean, vote: Object|null }}
   */
  decide(committedVotes, remainingPlayerIds) {
    const candidates = this._choiceSet.filter(v => v !== null);
    if (candidates.length === 0) return { shouldVoteNow: false, vote: null };

    if (remainingPlayerIds.length === 0) {
      const [best] = this._selectVote(candidates, [], committedVotes);
      return { shouldVoteNow: true, vote: best };
    }

    const shouldVote = this._shouldVoteNow(candidates, remainingPlayerIds, committedVotes);
    if (!shouldVote) return { shouldVoteNow: false, vote: null };

    const [best] = this._selectVote(candidates, remainingPlayerIds, committedVotes);
    return { shouldVoteNow: true, vote: best };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────────────────────────────────

  _expectedBfsDelta(aiVote, remainingIds, committed) {
    return this._expectedBfsExact(remainingIds, [...committed, aiVote]);
  }

  /**
   * Exact enumeration using independent marginals — mirrors Python _expected_bfs_exact():
   * all predictives computed simultaneously with the same `committed` context.
   */
  _expectedBfsExact(remainingIds, committed) {
    if (remainingIds.length === 0) {
      return this._bfsDeltaFromVotes(committed);
    }

    // Pre-compute ALL predictives with the same context (independent marginals)
    const predictives = remainingIds.map(pid => {
      const belief   = this._beliefs.get(pid);
      const features = _computeFeatures(
        this._choiceSet, committed, this._boardState, this._level, this._meta, this._bfsTable
      );
      return belief ? belief.predictiveByIndex(features) : null;
    });

    return this._evalCombos(predictives, 0, committed);
  }

  /** Recursive Cartesian-product enumeration over per-player vote choices. */
  _evalCombos(predictives, pidIdx, accVotes) {
    if (pidIdx >= predictives.length) {
      return this._bfsDeltaFromVotes(accVotes);
    }
    const pred    = predictives[pidIdx];
    const nChoice = this._choiceSet.length;
    let totalEV = 0, totalW = 0;
    for (let k = 0; k < nChoice; k++) {
      const prob = pred ? (pred.get(k) ?? 0) : 1 / nChoice;
      if (prob < 1e-10) continue;
      const vote     = this._choiceSet[k];
      const newVotes = vote ? [...accVotes, vote] : accVotes;
      totalEV += prob * this._evalCombos(predictives, pidIdx + 1, newVotes);
      totalW  += prob;
    }
    return totalW > 1e-12 ? totalEV / totalW : 0;
  }

  _bfsDeltaFromVotes(votes) {
    const profile  = _aggregateVotes(votes.filter(v => v !== null));
    const before   = _bfsLookup(this._boardState, this._level, this._bfsTable) ?? 0;
    const newState = _applyProfile(this._boardState, profile, this._meta);
    const after    = _bfsLookup(newState, this._level, this._bfsTable) ?? before;
    return after - before;
  }

  /**
   * Recursive VOI: min(V_now, V_wait).
   *
   * V_now  = min_{v ∈ candidates} E_BFS(v, remaining, committed)
   * V_wait = (1/|R|) Σ_p Σ_o P_p(o) · V*(candidates, R\{p}, committed+o)
   */
  _optimalValue(candidates, remainingIds, committed) {
    const key = JSON.stringify({
      r: remainingIds,
      c: committed.map(v => v ? `${v.blockId}:${v.dir}` : 'null')
    });
    if (this._ebfsCache.has(key)) return this._ebfsCache.get(key);

    // V_now
    let vNow = Infinity;
    for (const vote of candidates) {
      const ev = this._expectedBfsDelta(vote, remainingIds, committed);
      if (ev < vNow) vNow = ev;
    }

    if (remainingIds.length === 0) {
      this._ebfsCache.set(key, vNow);
      return vNow;
    }

    // V_wait
    let vWait = 0;
    for (const nextPid of remainingIds) {
      const restIds  = remainingIds.filter(p => p !== nextPid);
      const belief   = this._beliefs.get(nextPid);
      const features = _computeFeatures(
        this._choiceSet, committed, this._boardState, this._level, this._meta, this._bfsTable
      );
      const pred = belief ? belief.predictiveByIndex(features) : null;

      let vWaitPid = 0, probSum = 0;
      for (let k = 0; k < this._choiceSet.length; k++) {
        const prob = pred ? (pred.get(k) ?? 0) : 1 / this._choiceSet.length;
        if (prob < 1e-10) continue;
        const vote         = this._choiceSet[k];
        const newCommitted = vote ? [...committed, vote] : committed;
        vWaitPid += prob * this._optimalValue(candidates, restIds, newCommitted);
        probSum  += prob;
      }
      vWait += probSum > 0 ? vWaitPid / probSum : 0;
    }
    vWait /= remainingIds.length;

    const val = Math.min(vNow, vWait);
    this._ebfsCache.set(key, val);
    return val;
  }

  _shouldVoteNow(candidates, remainingIds, committed) {
    let vNow = Infinity;
    for (const vote of candidates) {
      const ev = this._expectedBfsDelta(vote, remainingIds, committed);
      if (ev < vNow) vNow = ev;
    }

    let vWait = 0;
    for (const nextPid of remainingIds) {
      const restIds  = remainingIds.filter(p => p !== nextPid);
      const belief   = this._beliefs.get(nextPid);
      const features = _computeFeatures(
        this._choiceSet, committed, this._boardState, this._level, this._meta, this._bfsTable
      );
      const pred = belief ? belief.predictiveByIndex(features) : null;

      let vWaitPid = 0, probSum = 0;
      for (let k = 0; k < this._choiceSet.length; k++) {
        const prob = pred ? (pred.get(k) ?? 0) : 1 / this._choiceSet.length;
        if (prob < 1e-10) continue;
        const vote         = this._choiceSet[k];
        const newCommitted = vote ? [...committed, vote] : committed;
        vWaitPid += prob * this._optimalValue(candidates, restIds, newCommitted);
        probSum  += prob;
      }
      vWait += probSum > 0 ? vWaitPid / probSum : 0;
    }
    vWait /= remainingIds.length;

    return vNow <= vWait;
  }

  _selectVote(candidates, remainingIds, committed) {
    let bestVote = null, bestEV = Infinity;
    for (const vote of candidates) {
      const ev = this._expectedBfsDelta(vote, remainingIds, committed);
      if (ev < bestEV - EV_TIE_EPSILON) {
        bestEV = ev;
        bestVote = vote;
      } else if (bestVote && Math.abs(ev - bestEV) <= EV_TIE_EPSILON && _voteLess(vote, bestVote)) {
        bestVote = vote;
      }
    }
    return [bestVote, bestEV];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a dynamic fixed-zone Bayesian AI agent.
 *
 * @param {Object} config
 * @param {number} config.level         Puzzle level (0-3)
 * @param {Object} config.bfsTable      Loaded from model/bfs_table.json
 * @param {Object} config.dynamicPrior  Loaded from model/dynamic_prior.json
 * @returns {DynamicFZBayesianAgent}
 *
 * @example
 * const agent = createDynamicFZBayesianAgent({ level: 0, bfsTable, dynamicPrior });
 *
 * // At the start of each round:
 * agent.startRound(boardState, playerIds, roundNumber);
 *
 * // Check VOI before any human has voted:
 * let { shouldVoteNow, vote } = agent.decide([], remainingPlayerIds);
 *
 * // After each human vote arrives:
 * agent.observeVote(playerId, voteOrNull, priorVotesBefore);
 * ({ shouldVoteNow, vote } = agent.decide(committedVotes, remainingPlayerIds));
 * if (shouldVoteNow && vote) {
 *   // submit vote to Firebase / game engine
 * }
 */
function createDynamicFZBayesianAgent(config) {
  return new DynamicFZBayesianAgent(config);
}

// ─── Module export ──────────────────────────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createDynamicFZBayesianAgent, DynamicFZBayesianAgent };
}

export { createDynamicFZBayesianAgent, DynamicFZBayesianAgent };