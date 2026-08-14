/**
 * ai_bayesian_static.js
 * =====================
 * Bayesian AI Agent with VOI timing and Static Joint (λ,α) belief.
 *
 * The agent maintains a 4×4 joint probability grid over rationality (λ) and
 * conformity (α) for each human player, updated via Bayesian inference after
 * each observed vote.  Timing is decided by Value of Information (VOI):
 * the AI votes when the expected BFS improvement from voting NOW is no worse
 * than waiting to see the next human vote.
 *
 * ── Usage ──────────────────────────────────────────────────────────────────
 *
 *   // 1. Load JSON data once (at game start):
 *   const bfsTable      = await fetch('model/bfs_table.json').then(r => r.json());
 *   const staticPrior   = await fetch('model/empirical_prior_unnorm.json').then(r => r.json());
 *
 *   // 2. Create one agent per game session / level:
 *   const agent = createStaticBayesianAgent({ level: 0, bfsTable, staticPrior });
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
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** λ grid used in static mode (must match empirical_prior_unnorm.json lambda_grid). */
const STATIC_LAMBDA_GRID = [0.0, 0.5, 1.0, 3.0];   // N_LAM = 4

/** α grid shared across all modes. */
const ALPHA_GRID = [0.0, 1.0, 2.0, 3.0];            // N_ALP = 4

/** Utility penalty assigned to the no-vote option. */
const NO_VOTE_PENALTY = 0.5;

/** Board size (6×6 grid). */
const BOARD_SIZE = 6;

/** Target block (red car) exits when its left edge reaches this column. */
const TARGET_EXIT_COL = 5;

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
 *
 * @param {Object} positions  {blockId: {col, row}}
 * @returns {string}
 */
function _tableKey(positions) {
  return Object.keys(positions)
    .sort()
    .map(id => `${positions[id].col},${positions[id].row}`)
    .join(';');
}

/**
 * Look up BFS (best-first-search) distance for a board state.
 * Returns 0 for solved states (b0 at exit), null if state not found.
 *
 * @param {Object} positions  {blockId: {col, row}}
 * @param {number} level
 * @param {Object} bfsTable   Loaded from model/bfs_table.json
 * @returns {number|null}
 */
function _bfsLookup(positions, level, bfsTable) {
  if ((positions['b0'] && positions['b0'].col >= TARGET_EXIT_COL)) return 0;
  const levelTable = bfsTable[String(level)];
  if (!levelTable) return null;
  const val = levelTable[_tableKey(positions)];
  return val !== undefined ? val : null;
}

/**
 * Aggregate an array of votes into a per-block net-vote profile.
 * Opposing votes cancel: net = fwd_count − back_count.
 * Blocks with net == 0 (fully cancelled) are omitted.
 * Mirrors Python model/features.py aggregate_votes().
 *
 * @param {Array}  votes  Array of {blockId, dir}|null
 * @returns {Object}      {blockId: ['fwd'|'back', netCount]}
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
    if (net > 0)       profile[blockId] = ['fwd',  net];
    else if (net < 0)  profile[blockId] = ['back', -net];
    // net == 0: cancelled — omit
  }
  return profile;
}

/**
 * Return the set of grid cells occupied by a block at the given position.
 * Used for inter-block collision detection.
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
 * Apply a vote profile to a board state, including inter-block collision
 * detection.  When two simultaneously-moving blocks' intended new cells
 * overlap, BOTH moves are cancelled (they stay in place).
 * Mirrors Python model/board.py apply_profile().
 *
 * @param {Object} positions  {blockId: {col, row}}
 * @param {Object} profile    {blockId: ['fwd'|'back', netCount]}
 * @param {Object} meta       LEVEL_META[level]
 * @returns {Object}          New positions
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

  // Detect inter-moving-block conflicts: cancel both if intended cells overlap
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

  // Apply non-cancelled moves
  for (const blockId of moving) {
    if (!cancelled.has(blockId)) newPos[blockId] = intended[blockId];
  }
  return newPos;
}

/**
 * Compute the BFS delta (improvement) from applying a single vote on top of
 * prior committed votes.
 *
 * tau = bfs(apply(state, profile(priorVotes + vote)))
 *     - bfs(apply(state, profile(priorVotes)))
 *
 * Negative tau means the combined profile is closer to solution — good!
 *
 * @param {Object|null} vote
 * @param {Array}       priorVotes
 * @param {Object}      boardState
 * @param {number}      level
 * @param {Object}      meta
 * @param {Object}      bfsTable
 * @returns {number}    tau (0 if BFS not available)
 */
function _computeTau(vote, priorVotes, boardState, level, meta, bfsTable) {
  const priorProfile    = _aggregateVotes(priorVotes);
  const priorState      = _applyProfile(boardState, priorProfile, meta);
  const bfsPrior        = _bfsLookup(priorState, level, bfsTable) ?? _bfsLookup(boardState, level, bfsTable) ?? 0;

  if (!vote || !vote.blockId) return 0;  // no-vote: no delta

  const combinedProfile = _aggregateVotes([...priorVotes, vote]);
  const combinedState   = _applyProfile(boardState, combinedProfile, meta);
  const bfsCombined     = _bfsLookup(combinedState, level, bfsTable) ?? bfsPrior;

  return bfsCombined - bfsPrior;
}

/**
 * Compute sigma (social conformity signal): number of prior votes matching
 * the given vote in both blockId and direction.
 */
function _computeSigma(vote, priorVotes) {
  if (!vote) return 0;
  return priorVotes.filter(v => v && v.blockId === vote.blockId && v.dir === vote.dir).length;
}

/**
 * Enumerate valid single-block moves for the current board state.
 * A move is valid if:
 *   1. The 1-step result differs from the current state (move is not blocked by a wall), AND
 *   2. The resulting state is found in the BFS table or is solved.
 * Mirrors Python board.py valid_choice_set_from_board().
 * Always appends null (no-vote).
 *
 * @param {Object} positions
 * @param {number} level
 * @param {Object} meta
 * @param {Object} bfsTable
 * @returns {Array}  Array of {blockId, dir}|null
 */
function _getChoiceSet(positions, level, meta, bfsTable) {
  const moves = [];
  const origKey = _tableKey(positions);
  for (const blockId of Object.keys(meta)) {
    for (const dir of ['fwd', 'back']) {
      const newPos = _applyProfile(positions, { [blockId]: [dir, 1] }, meta);
      // Reject if the block didn't actually move (blocked at wall or by another block)
      if (_tableKey(newPos) === origKey) continue;
      if (_bfsLookup(newPos, level, bfsTable) !== null) {
        moves.push({ blockId, dir });
      }
    }
  }
  moves.push(null);  // no-vote always available
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
 * Compute vote utilities for given λ and α.
 * u(vote) = -λ·τ + α·σ   (no-vote: u = -NO_VOTE_PENALTY)
 *
 * @param {Array}  features  [{tau, sigma, isNoVote}]
 * @param {number} lam
 * @param {number} alp
 * @returns {Array}  utilities
 */
function _utilities(features, lam, alp) {
  return features.map(f => f.isNoVote ? -NO_VOTE_PENALTY : -lam * f.tau + alp * f.sigma);
}

/**
 * Precompute features (tau, sigma) for a choice set.
 * This is independent of (λ, α) and expensive, so compute once per decision.
 *
 * @param {Array}  choiceSet    [{blockId, dir}|null]
 * @param {Array}  priorVotes   votes committed before this slot
 * @param {Object} boardState
 * @param {number} level
 * @param {Object} meta
 * @param {Object} bfsTable
 * @returns {Array}  [{tau, sigma, isNoVote}] (same length as choiceSet)
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
// STATIC PLAYER BELIEF
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Joint (λ, α) belief over a 4×4 grid.
 * Grid is stored flat, row-major: index = i*N_ALP + j
 * where i = lambda index, j = alpha index.
 */
class StaticPlayerBelief {
  /**
   * @param {Float64Array|number[]} prior  Flat 16-element array (unnormalized)
   */
  constructor(prior) {
    this._grid = new Float64Array(prior);
    this._normalize();
  }

  /**
   * Create from the data loaded from empirical_prior_unnorm.json.
   * @param {Object} priorData  Parsed JSON
   * @returns {StaticPlayerBelief}
   */
  static fromData(priorData) {
    return new StaticPlayerBelief(priorData.prior_grid);
  }

  _normalize() {
    let total = 0;
    for (let k = 0; k < this._grid.length; k++) total += this._grid[k];
    if (total > 0) for (let k = 0; k < this._grid.length; k++) this._grid[k] /= total;
  }

  /**
   * Bayesian update given observed vote index in choiceSet.
   *
   * @param {Array}  features   [{tau, sigma, isNoVote}] for ALL votes in choiceSet
   * @param {number} voteIdx    Index of the observed vote in choiceSet (-1 = no-vote)
   */
  update(features, voteIdx) {
    const N_LAM = STATIC_LAMBDA_GRID.length;
    const N_ALP = ALPHA_GRID.length;
    for (let i = 0; i < N_LAM; i++) {
      for (let j = 0; j < N_ALP; j++) {
        const utils = _utilities(features, STATIC_LAMBDA_GRID[i], ALPHA_GRID[j]);
        const probs = _softmax(utils);
        const idx = voteIdx < 0 ? features.findIndex(f => f.isNoVote) : voteIdx;
        const lik = (idx >= 0 && idx < probs.length) ? probs[idx] : 1e-10;
        this._grid[i * N_ALP + j] *= lik;
      }
    }
    this._normalize();
  }

  /**
   * Maximum-a-posteriori (λ, α) estimate.
   * @returns {{lambda: number, alpha: number}}
   */
  mapEstimate() {
    const N_ALP = ALPHA_GRID.length;
    let best = -1, bestVal = -1;
    for (let k = 0; k < this._grid.length; k++) {
      if (this._grid[k] > bestVal) { bestVal = this._grid[k]; best = k; }
    }
    return {
      lambda: STATIC_LAMBDA_GRID[Math.floor(best / N_ALP)],
      alpha:  ALPHA_GRID[best % N_ALP]
    };
  }

  /**
   * Predictive distribution: P(vote | belief) = Σ_{λ,α} P(vote|λ,α)·P(λ,α).
   * Returns a Map from vote index to probability.
   *
   * @param {Array} features  [{tau, sigma, isNoVote}]
   * @returns {Map<number, number>}  voteIdx → probability
   */
  predictiveByIndex(features) {
    const N_LAM = STATIC_LAMBDA_GRID.length;
    const N_ALP = ALPHA_GRID.length;
    const nVotes = features.length;
    const probs = new Float64Array(nVotes);

    for (let i = 0; i < N_LAM; i++) {
      for (let j = 0; j < N_ALP; j++) {
        const w = this._grid[i * N_ALP + j];
        if (w < 1e-12) continue;
        const utils = _utilities(features, STATIC_LAMBDA_GRID[i], ALPHA_GRID[j]);
        const p = _softmax(utils);
        for (let k = 0; k < nVotes; k++) probs[k] += w * p[k];
      }
    }
    const result = new Map();
    for (let k = 0; k < nVotes; k++) result.set(k, probs[k]);
    return result;
  }

  /** Deep copy of this belief. */
  copy() { return new StaticPlayerBelief(this._grid); }
}

// ═══════════════════════════════════════════════════════════════════════════
// BAYESIAN AGENT
// ═══════════════════════════════════════════════════════════════════════════

class StaticBayesianAgent {
  /**
   * @param {Object} config
   * @param {number} config.level        Puzzle level (0-3)
   * @param {Object} config.bfsTable     Loaded from model/bfs_table.json
   * @param {Object} config.staticPrior  Loaded from model/empirical_prior_unnorm.json
   */
  constructor({ level, bfsTable, staticPrior }) {
    if (!(level in LEVEL_META)) throw new Error(`Unknown level ${level}`);
    this._level    = level;
    this._meta     = LEVEL_META[level];
    this._bfsTable = bfsTable;
    this._prior    = staticPrior;

    this._beliefs    = new Map();   // playerId → StaticPlayerBelief
    this._boardState = null;
    this._round      = null;
    this._playerIds  = [];
    this._choiceSet  = [];
    this._ebfsCache  = new Map();   // memoize _optimalValue
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

    // Initialise belief for any new player
    for (const pid of playerIds) {
      if (!this._beliefs.has(pid)) {
        this._beliefs.set(pid, StaticPlayerBelief.fromData(this._prior));
      }
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

    const choiceSet = this._choiceSet;
    const features  = _computeFeatures(
      choiceSet, priorVotes, this._boardState, this._level, this._meta, this._bfsTable
    );
    // Find index of the observed vote
    const voteIdx = vote === null
      ? choiceSet.findIndex(v => v === null)
      : choiceSet.findIndex(v => v && v.blockId === vote.blockId && v.dir === vote.dir);

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

    // If no players remain, the AI MUST vote now
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

  /**
   * Expected BFS delta if AI casts `aiVote` (then waits for remaining players).
   */
  _expectedBfsDelta(aiVote, remainingIds, committed) {
    const allCommitted = [...committed, aiVote];
    return this._expectedBfsExact(remainingIds, allCommitted);
  }

  /**
   * Exact enumeration of expected BFS delta over all remaining-player vote combos.
   * Mirrors Python AIAgent._expected_bfs_exact():
   *   - All player predictives are computed SIMULTANEOUSLY with the same
   *     `committed` context (independent marginals) — NOT sequentially.
   *   - Weight of each combination = product of individual marginal probabilities.
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

  /**
   * Actual BFS improvement from applying the committed-vote profile to the board.
   * Returns the BFS delta (negative = better = closer to solution).
   */
  _bfsDeltaFromVotes(votes) {
    const nonNull  = votes.filter(v => v !== null);
    const profile  = _aggregateVotes(nonNull);
    const before   = _bfsLookup(this._boardState, this._level, this._bfsTable) ?? 0;
    const newState = _applyProfile(this._boardState, profile, this._meta);
    const after    = _bfsLookup(newState, this._level, this._bfsTable) ?? before;
    return after - before;
  }

  /**
   * Recursive VOI value: the best expected BFS delta achievable given the
   * remaining decision tree.
   *
   * V*(candidates, remaining, committed) =
   *   min(
   *     min_{v ∈ candidates} E_BFS(v, remaining, committed),   // vote now
   *     (1/|R|) Σ_p Σ_o P_p(o) · V*(candidates, R\{p}, committed+o)  // wait
   *   )
   */
  _optimalValue(candidates, remainingIds, committed) {
    // Memoize
    const key = JSON.stringify({ r: remainingIds, c: committed.map(v => v ? `${v.blockId}:${v.dir}` : 'null') });
    if (this._ebfsCache.has(key)) return this._ebfsCache.get(key);

    // Best value if AI votes now
    let vNow = Infinity;
    for (const vote of candidates) {
      const ev = this._expectedBfsDelta(vote, remainingIds, committed);
      if (ev < vNow) vNow = ev;
    }

    if (remainingIds.length === 0) {
      this._ebfsCache.set(key, vNow);
      return vNow;
    }

    // Expected value from waiting for the next player
    let vWait = 0;
    for (const nextPid of remainingIds) {
      const restIds = remainingIds.filter(p => p !== nextPid);
      const belief  = this._beliefs.get(nextPid);
      const features = _computeFeatures(
        this._choiceSet, committed, this._boardState, this._level, this._meta, this._bfsTable
      );
      const pred = belief ? belief.predictiveByIndex(features) : null;

      let vWaitPid = 0;
      let probSum  = 0;
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

  /** VOI timing rule: should the AI vote now? */
  _shouldVoteNow(candidates, remainingIds, committed) {
    // Compute V_now = best vote-now expected BFS delta
    let vNow = Infinity;
    for (const vote of candidates) {
      const ev = this._expectedBfsDelta(vote, remainingIds, committed);
      if (ev < vNow) vNow = ev;
    }

    // Compute V_wait = expected value of waiting for the next player
    let vWait = 0;
    for (const nextPid of remainingIds) {
      const restIds = remainingIds.filter(p => p !== nextPid);
      const belief  = this._beliefs.get(nextPid);
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

  /**
   * Select the vote with minimum expected BFS delta given remaining players.
   * @returns {[Object, number]}  [bestVote, expectedDelta]
   */
  _selectVote(candidates, remainingIds, committed) {
    let bestVote = null, bestEV = Infinity;
    for (const vote of candidates) {
      const ev = this._expectedBfsDelta(vote, remainingIds, committed);
      if (ev < bestEV) { bestEV = ev; bestVote = vote; }
    }
    return [bestVote, bestEV];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a static Bayesian AI agent.
 *
 * @param {Object} config
 * @param {number} config.level        Puzzle level (0-3)
 * @param {Object} config.bfsTable     Loaded from model/bfs_table.json
 * @param {Object} config.staticPrior  Loaded from model/empirical_prior_unnorm.json
 * @returns {StaticBayesianAgent}
 *
 * @example
 * const agent = createStaticBayesianAgent({ level: 0, bfsTable, staticPrior });
 *
 * agent.startRound(boardState, playerIds, roundNumber);
 *
 * // After each human vote:
 * agent.observeVote(playerId, vote, priorVotes);
 *
 * // Check timing:
 * const { shouldVoteNow, vote } = agent.decide(committedVotes, remainingPlayerIds);
 */
function createStaticBayesianAgent(config) {
  return new StaticBayesianAgent(config);
}

// ─── Module export (works in Node.js, modern bundlers, and as ES module) ───
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createStaticBayesianAgent, StaticBayesianAgent };
}

export { createStaticBayesianAgent, StaticBayesianAgent };