/*
groupestimation.js

    |   Author          :   Helio Tejeda
    |   Date            :   July 2024
    |   Organization    :   MADLAB - University of California, Irvine

 ---------------------------
|   MPLib.js Game Example   |
 ---------------------------
Demonstrate how MPLib.js can be used to program a [insert game type] game.

 ---------------------------
|   Group Estimation Game   |
 ---------------------------
This is a group estimation game. Participants are given an image and need to
estimate the number of objects in the image (as an example, estimating the
number of objects in a jar).
*/


/*
    Imports from MPLib.js
    ---------------------

Import all necessary functionality from the library.
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
    getAllPlayerIds,
    getPlayerInfo,
    getNumberCurrentPlayers,
    getNumberAllPlayers,
    getCurrentPlayerArrivalIndex,
    getSessionId,
    getSessionError,
    getWaitRoomInfo
} from "/mplib/src/mplib.js";


/*
    Game Configuration
    ------------------

Configure all of the game settings. This includes:
    - Game Variables
    - Session Configuration
    - Logging Verbosity
    - Finalize Game Config with URL Params
    - Create Function Callback Object
    - Initialize Game Session with Library
*/

//  Conatant Game Variables

function getNumPlayersFromURL() {
    const params = new URLSearchParams(window.location.search);
    const num = parseInt(params.get("numPlayers"));
    return isNaN(num) ? 5 : Math.max(2, Math.min(num, 5)); // default to 5, clamp between 2–5
}

let GameName = "groupestimation";
let NumPlayers = getNumPlayersFromURL();
let MinPlayers = NumPlayers;
let MaxPlayers = NumPlayers;
let MaxSessions = 0;
let PlayerReplacement = false;
let LeaveWaitingRoomTime = 3;
let MinPlayerTimeout = 0;
let MaxSessionTime = 0;
let SaveData = true;

let playerId;

let arrivalIndex;

const CELL_WIDTH = 45;
const CELL_HEIGHT = 45;

//  Configuration Settings for the Session
const studyId = GameName; 
const sessionConfig = {
    minPlayersNeeded: MinPlayers,
    maxPlayersNeeded: MaxPlayers,
    maxParallelSessions: MaxSessions,
    allowReplacements: PlayerReplacement,
    exitDelayWaitingRoom: LeaveWaitingRoomTime,
    maxDurationBelowMinPlayersNeeded: MinPlayerTimeout,
    maxHoursSession: MaxSessionTime,
    recordData: SaveData
};
const verbosity = 2;

//  Update Config Settings based on URL Parameters
updateConfigFromUrl( sessionConfig );

//  Create Function List
//      An object with all necessary callback functions for gameplay
let funList = { 
    sessionChangeFunction: {
        joinedWaitingRoom: joinWaitingRoom,
        updateWaitingRoom: updateWaitingRoom,
        startSession: startSession,
        updateOngoingSession: updateOngoingSession,
        endSession: endSession
    },
    receiveStateChangeFunction: receiveStateChange,
    evaluateUpdateFunction: evaluateUpdate,
    removePlayerStateFunction: removePlayerState
};

// List the node names where we place listeners for any changes to the children of these nodes; set to '' if listening to changes for children of the root
let listenerPaths = [ 'players', 'blocks', 'slots', 'obs' ];

//  Initialize the Game Session with all Configs
initializeMPLIB( sessionConfig , studyId , funList, listenerPaths, verbosity );


/*
    Game Variables
    --------------

Initialize all game variables that will be used. This includes:
    - Global Variables
    - Graphic Handles
    - Event Listeners
*/

//  Game Global Variables
let thisPlayerID = getCurrentPlayerId();
let allPlayerIDs;
console.log("Game Starting...", thisPlayerID);

// let gameState = {
//     images: {},
//     players: {
//     }
// };
let GameState = {
    blocks: {},
    slots: {},
    players: {},
    obstacles: {}
};

let lockedBlocks = {};


//  Game Graphics Handles

//      Instructions
let instructionsScreen = document.getElementById('instructionsScreen');
let instructionsText = document.getElementById('instructionText');
let joinButton = document.getElementById('joinBtn');

//      Waiting Room
let waitingRoomScreen = document.getElementById('waitingRoomScreen');
let messageWaitingRoom = document.getElementById('messageWaitingRoom');

//      Game Interface
let gameScreen = document.getElementById('gameScreen');
let messageGame = document.getElementById('messageGame');
let submitGuess; // = document.getElementById('estimation-button');
let submitSelection;
let playerID = document.getElementById('playerID');
//let messageToPlayer = document.getElementById('messageToPlayer');
let imageContainer = document.getElementById('image-to-estimate');
let leaveButton = document.getElementById('leaveBtn');

//      Complete Screen
let messageFinish = document.getElementById('messageFinish');


//let turnText = document.getElementById('turnMessage');


//imageContainer.src = images[selectedImages[trialNumber]].path;

// Set up correct instructions
instructionsText.innerHTML = `<p>Move some block with friends!</p>`;


//  Game Event Listeners

//      Join Button
joinButton.addEventListener('click', function () {
    /*
    Call the library function to attempt to join a session.
    
    This results in one of the following:
        - starting a session directly
        - starting a waiting room
    */
    joinSession();
});

//      Leave Button (End Session Button)
leaveButton.addEventListener('click', function () {
    /*
    Call the library function to leave a session.
    
    This then triggers the local function endSession.
    */
    leaveSession();
});

/*
    Game Logic and UI
    -----------------

Game logic and functionality. All functions for gameplay. This includes:
    -
    -
    -
*/

let roundTimer;

let votingDuration = 5; 
let breakDuration = 2; 

let countdownInterval;

let playerColorMap = {}; 


function assignAvatarColors() {

    arrivalIndex = getCurrentPlayerArrivalIndex(); // 1-based


    updateStateDirect(`players/${getCurrentPlayerId()}`, {
        color: arrivalIndex 
    });

    playerColorMap[getCurrentPlayerId()] = arrivalIndex;

}

// let playerColorMap = {}; 


// function assignAvatarColors() {
//     const PLAYER_COLORS = [
//         '#E69F00', // Orange
//         '#009E73', // Green
//         '#F0E442', // Yellow
//         '#CC79A7', // Pink/Magenta
//         '#0072B2'  // Blue
//     ];

//     const arrivalIndex = getCurrentPlayerArrivalIndex(); // 1-based
//     const numPlayers = getNumberCurrentPlayers();

//     const root = document.documentElement;

//     // 1. Set color for local player (#player1)
//     const myColor = PLAYER_COLORS[arrivalIndex - 1];
//     root.style.setProperty('--player1avatar-backgroundcolor', myColor);

//     updateStateDirect(`players/${getCurrentPlayerId()}`, {
//         color: myColor
//     });

//     playerColorMap[getCurrentPlayerId()] = myColor;

//     // 2. Assign the remaining N-1 colors to player2–playerN
//     let colorIndex = 0;
//     for (let i = 2; i <= numPlayers; i++) {
//         if (colorIndex === arrivalIndex - 1) colorIndex++; // Skip local player's color
//         root.style.setProperty(`--player${i}avatar-backgroundcolor`, PLAYER_COLORS[colorIndex]);
//         colorIndex++;
//     }
// }

// function disableSubmitButton() {
//     if (submitSelection) {
//         submitSelection.disabled = true;
//     }
// }

// function enableSubmitButton() {
//     if (submitSelection) {
//         submitSelection.disabled = false;
//     }
// }

function showDirectionButtons() {
    const buttons = document.querySelectorAll('.direction-button');
    buttons.forEach(btn => {
        btn.style.display = 'block';
        btn.style.pointerEvents = 'auto';
        btn.style.opacity = '1';
    });
}

function hideDirectionButtons() {
    const buttons = document.querySelectorAll('.direction-button');
    buttons.forEach(btn => {
        btn.style.pointerEvents = 'none';
        btn.style.opacity = '0.4';
    });
}


function startVotingPhase() {
    clearTimeout(roundTimer);
    clearInterval(countdownInterval);

    let countdown = votingDuration;
    const turnMessage = document.getElementById('turnMessage');
    turnMessage.innerText = `Decide which block you want to move in ${countdown} seconds`;

    // Update the countdown every second
    countdownInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            turnMessage.innerText = `Decide which block you want to move in ${countdown} seconds`;
        }
    }, 1000);


    // Start 15 second timer
    roundTimer = setTimeout(() => {
        clearInterval(countdownInterval);
        finalizeVotes();
    }, countdown * 1000);
}

function finalizeVotes() {
    getCurrentPlayerIds().forEach(pid => {
        updateStateDirect(`players/${pid}`, { block: null, direction: null, obstacle: null });
    });

    hideDirectionButtons();
    const turnMessage = document.getElementById('turnMessage');
    turnMessage.innerText = `Moving the blocks now...`;

    const container = document.getElementById('image-container');
    const blocks = container.querySelectorAll('.block');
    const futurePlans = [];

    blocks.forEach(block => {
        const voteCounts = { up: 0, down: 0, left: 0, right: 0 };
        const arrows = block.querySelectorAll('.arrow');

        arrows.forEach(arrow => {
            const direction = arrow.dataset.direction;
            voteCounts[direction]++;
        });

        const id = block.dataset.color;
        const minRequired = getMinRequiredVotes(id);
        const majorityDirection = getMajorityDirection(voteCounts, minRequired);

        let x = parseInt(block.dataset.x);
        let y = parseInt(block.dataset.y);

        let targetX = x;
        let targetY = y;

        if (majorityDirection === 'up') targetY -= 1;
        if (majorityDirection === 'down') targetY += 1;
        if (majorityDirection === 'left') targetX -= 1;
        if (majorityDirection === 'right') targetX += 1;

        const size = block.dataset.obstacle === 'true' ? 2 : 3;

        futurePlans.push({
            id,
            block,
            direction: majorityDirection,
            willMove: !!majorityDirection,
            size,
            futureCoords: getOccupiedCells(targetX, targetY, size)
        });

        arrows.forEach(arrow => arrow.remove());
    });

    for (let i = 0; i < futurePlans.length; i++) {
        for (let j = i + 1; j < futurePlans.length; j++) {
            const a = futurePlans[i];
            const b = futurePlans[j];
    
            const overlap = a.futureCoords.some(posA =>
                b.futureCoords.some(posB => posA.x === posB.x && posA.y === posB.y)
            );
    
            if (overlap) {
                console.warn(`Conflict between ${a.id} and ${b.id}`);
                a.willMove = false;
                b.willMove = false;
            }
        }
    }
    
    futurePlans.forEach(plan => {
        if (plan.willMove) {
            moveBlock(plan.block, plan.direction);
        }
    });

    setTimeout(() => {
        showDirectionButtons();
        startVotingPhase();
    }, breakDuration * 1000);
}


function getOccupiedCells(startX, startY, size) {
    const cells = [];
    for (let dx = 0; dx < size; dx++) {
        for (let dy = 0; dy < size; dy++) {
            cells.push({ x: startX + dx, y: startY + dy });
        }
    }
    return cells;
}


function getMajorityDirection(votes, minRequired) {
    let maxCount = 0;
    let majority = null;
    let countOfMax = 0;

    // Step 1: Find direction with most votes
    for (let direction in votes) {
        if (votes[direction] > maxCount) {
            maxCount = votes[direction];
            majority = direction;
            countOfMax = 1;
        } else if (votes[direction] === maxCount && maxCount !== 0) {
            countOfMax++;
        }
    }

    // Step 2: Handle ties
    if (countOfMax > 1) {
        console.log("No move: tie between directions.");
        return null;
    }

    // Step 3: Adjust maxCount by subtracting competing votes
    let competingVotes = 0;
    for (let direction in votes) {
        if (direction !== majority) {
            competingVotes += votes[direction];
        }
    }

    const adjustedVoteCount = maxCount - competingVotes;

    // Step 4: Final threshold check
    if (adjustedVoteCount < minRequired) {
        console.log(`No move: adjusted vote count (${adjustedVoteCount}) below minimum required (${minRequired}).`);
        return null;
    }

    console.log(`Moving in direction: ${majority} (raw: ${maxCount}, adjusted: ${adjustedVoteCount})`);
    return majority;
}


function getMinRequiredVotes(color) {
    const minVotesMap = {
        blue: 3,
        red: 2,
        yellow: 1,
    };
    return minVotesMap[color] || 1; // default to 1 if undefined
}


function moveBlock(block, direction) {
    const color = block.dataset.color;

    // Skip slot locking logic if it's an obstacle
    const isObstacle = block.dataset.obstacle === "true";

    // Don't move if already locked (only applies to non-obstacles)
    if (!isObstacle && lockedBlocks[color]) return;

    let x = parseInt(block.dataset.x);
    let y = parseInt(block.dataset.y);

    if (direction === 'up') y -= 1;
    if (direction === 'down') y += 1;
    if (direction === 'left') x -= 1;
    if (direction === 'right') x += 1;

    x = Math.max(0, Math.min(17, x));
    y = Math.max(0, Math.min(11, y));

    block.dataset.x = x;
    block.dataset.y = y;

    block.style.left = (x * CELL_WIDTH) + 'px';
    block.style.top = (y * CELL_HEIGHT) + 'px';

    block.style.transition = 'top 0.2s ease, left 0.2s ease, transform 0.2s';
    block.style.transform = 'scale(1.1)';
    setTimeout(() => {
        block.style.transform = 'scale(1)';
    }, 200);


    // Only check slot match if it's not an obstacle
    if (!isObstacle) {
        for (let slotColor in GameState.slots) {
            const slot = GameState.slots[slotColor];
            if (slot && slot.x === x && slot.y === y) {
                console.log(`Block ${color} reached slot at (${x}, ${y}). Locking.`);

                lockedBlocks[color] = true;

                // // Visually indicate it's locked
                // block.style.border = '4px solid gold';
                // block.style.backgroundColor = 'lightgray';

                const arrows = block.querySelectorAll('.direction-button');
                arrows.forEach(btn => btn.remove());

                block.style.backgroundImage = "url('./images/slot.png')"; // or a tinted version
                block.style.backgroundSize = 'cover';
                block.style.boxShadow = '0 0 6px gold';
                block.style.border = '2px solid gold';

                block.style.transition = 'opacity 2s';
                block.style.opacity = '0';

                setTimeout(() => {
                    block.remove(); // Remove from DOM
                    delete GameState.blocks[color]; // Remove from state
                }, 2000);
                // delete GameState.slots[slotColor];
                break;
            }
        }
    }
}



function getBlockLabel(color) {
    const labelMap = {
        'blue': 'A',
        'red': 'B',
        'yellow': 'C'
    };
    return labelMap[color] || '?';
}
function drawSlot(slot) {
    const container = document.getElementById('image-container');
    const div = document.createElement('div');
    div.classList.add('slot');

    const width = CELL_WIDTH * 3;
    const height = CELL_HEIGHT * 3;

    // Position and style
    div.style.position = 'absolute';
    div.style.left = (slot.x * CELL_WIDTH) + 'px';
    div.style.top = (slot.y * CELL_HEIGHT) + 'px';
    div.style.width = `${width}px`;
    div.style.height = `${height}px`;

    // ⚡ Bold glowing pixel-style border
    div.style.border = '4px dashed #3090c7'; // bright cyan
    div.style.borderRadius = '0px'; // sharp pixel corners
    div.style.backgroundColor = 'rgba(0, 255, 255, 0.05)';
    div.style.boxShadow = '0 0 6px rgba(0, 255, 255, 0.7), inset 0 0 6px rgba(0, 255, 255, 0.3)';
    div.style.imageRendering = 'pixelated';

    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.justifyContent = 'center';
    div.style.color = 'black';

    div.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';

    // // Label (based on color key)
    // div.innerText = getBlockLabel(slot.color);

    container.appendChild(div);
}

function drawBlock(block, isObstacle) {
    const container = document.getElementById('image-container');
    const div = document.createElement('div');
    div.classList.add('block');
    let width;
    let height;
    if(isObstacle){
        width = CELL_WIDTH * 2.3;
        height = CELL_HEIGHT * 2.3;
    }else{
        width = CELL_WIDTH * 3;
        height = CELL_HEIGHT * 3;
    }

    const id = isObstacle ? block.id : block.color;

    div.setAttribute('data-color', id);
    if(!isObstacle){
        div.dataset.color = block.color;
    }
    div.dataset.x = block.x; 
    div.dataset.y = block.y;
    div.dataset.obstacle = isObstacle;

    // Align with top-left grid cell
    div.style.position = 'absolute';
    div.style.left = (block.x * CELL_WIDTH) + 'px';
    div.style.top = (block.y * CELL_HEIGHT) + 'px';
    div.style.width = `${width}px`;
    div.style.height = `${height}px`;

    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.justifyContent = 'center';
    div.style.flexDirection = 'column';
    div.style.zIndex = '1';
    div.style.backgroundRepeat = 'no-repeat';
    div.style.backgroundSize = 'cover';
    div.style.imageRendering = 'pixelated';

    div.style.backgroundImage = isObstacle
    ? "url('./images/obstacle.png')"
    : "url('./images/block.png')";


    if(isObstacle == false){
        // div.style.backgroundColor = '#8ab6d6'; 
        // div.style.borderRadius = '10px';
        const minPlayersMap = {
            blue: 3,
            red: 2,
            yellow: 1
        };
        const minRequired = minPlayersMap[block.color] || 1;
    
        const minText = document.createElement('div');
        minText.innerText = `min: ${minRequired}`;
        minText.style.fontSize = '14px';
        minText.style.fontWeight = 'bold';
        minText.style.color = 'white';
        minText.style.marginBottom = '4px';
        minText.style.textShadow = '1px 1px 0 #000';
        minText.style.padding = '2px 6px';
        minText.style.borderRadius = '3px';
        minText.style.imageRendering = 'pixelated';
        minText.style.fontFamily = 'monospace'; 
    
        div.appendChild(minText);

    }else{
        // div.style.backgroundColor = '#555'; // dark gray
        // div.style.borderRadius = '50%';
        const minText = document.createElement('div');
        minText.innerText = `min: 1`;
        minText.style.fontSize = '11.5px';
        minText.style.fontWeight = 'bold';
        minText.style.textShadow = '1px 1px 0 #000';
        minText.style.color = 'white';
        minText.style.marginBottom = '2px';
        minText.style.imageRendering = 'pixelated';
        minText.style.fontFamily = 'monospace'; 
        div.appendChild(minText);

    }


    const directions = ['up', 'right', 'down', 'left'];
    directions.forEach(dir => {
        const arrow = document.createElement('div');
        arrow.classList.add('triangle', dir, 'direction-button');
        arrow.dataset.direction = dir;
        arrow.dataset.targetId = id;
        arrow.dataset.isObstacle = isObstacle;
        if (isObstacle) {
            switch (dir) {
                case 'up':
                    arrow.style.borderWidth = '12px 15px 20px 15px';
                    break;
                case 'down':
                    arrow.style.borderWidth = '20px 15px 12px 15px';
                    break;
                case 'left':
                    arrow.style.borderWidth = '15px 17px 15px 12px';
                    break;
                case 'right':
                    arrow.style.borderWidth = '15px 12px 15px 17px';
                    break;
            }
        }
        

        arrow.addEventListener('click', () => {
            const playerId = getCurrentPlayerId();
            if (isObstacle) {
                updateStateDirect(`players/${playerId}`, {
                    obstacle: id,
                    direction: dir
                });
            } else {
                updateStateDirect(`players/${playerId}`, {
                    block: id,
                    direction: dir
                });
            }
        });

        div.appendChild(arrow);
    });

    container.appendChild(div);
}


function addArrowToBlock(color, direction, playerId) {
    const container = document.getElementById('image-container');
    const block = container.querySelector(`.block[data-color="${color}"]`);
    if (!block) return;

    // Remove this player's previous arrow from any block
    removeArrowFromPlayer(playerId);

    // Get the arrival index to determine the correct image
    const arrivalIndex = playerColorMap[playerId]; // assumes 1-based index
    const imgSrc = `./images/player${arrivalIndex}_arrow.png`;


    const arrow = document.createElement('div');
    arrow.classList.add('arrow');
    arrow.style.width = '50px';
    arrow.style.height = '50px';
    arrow.style.position = 'absolute';
    arrow.style.pointerEvents = 'none';
    arrow.style.zIndex = '10000';
    arrow.style.transformOrigin = 'center center';
    arrow.style.backgroundImage = `url(${imgSrc}) `;
    arrow.style.backgroundRepeat = 'no-repeat';
    arrow.style.backgroundSize = `${6 * 50}px 50px`; // assumes 32 frames of 45px
    arrow.style.imageRendering = 'pixelated';


    // Rotate based on direction
    const rotationMap = {
        up: 'rotate(90deg)',
        right: 'rotate(180deg)',
        down: 'rotate(270deg)',
        left: 'rotate(0deg)'
    };
    arrow.dataset.rotation = rotationMap[direction] || 'rotate(0deg)';

    arrow.dataset.playerId = playerId;
    arrow.dataset.direction = direction;
    animateSpriteOnce(arrow, 6, 50, 50, 6);

    block.appendChild(arrow);

    // Re-layout all arrows of this direction in the block
    layoutDirectionalArrows(block, direction);
}


function layoutDirectionalArrows(block, direction) {
    const arrows = Array.from(block.querySelectorAll(`.arrow[data-direction="${direction}"]`));
    const OFFSET_STEP = 30;

    arrows.forEach((arrow, i) => {
        // Only rotation string from previous transform
        const rotation = arrow.dataset.rotation || 'rotate(0deg)';

        switch (direction) {
            case 'up':
                arrow.style.top = '0'; // anchor to top of block
                arrow.style.left = `${i * OFFSET_STEP}px`;
                arrow.style.right = '';
                arrow.style.bottom = '';
                arrow.style.transform = `${rotation} translate(-90%, -10%)`; 
                break;

            case 'down':
                arrow.style.top = '100%'; // anchor to bottom of block
                arrow.style.left = `${i * OFFSET_STEP}px`;
                arrow.style.right = '';
                arrow.style.bottom = '';
                arrow.style.transform = `${rotation} translate(5%, -10%)`; // match up styling
                break;

            case 'left':
                arrow.style.top = `${15 + i * OFFSET_STEP}px`;
                arrow.style.left = '5px';
                arrow.style.right = '';
                arrow.style.bottom = '';
                arrow.style.transform = `${rotation} translate(-100%, -50%)`;
                break;

            case 'right':
                arrow.style.top = `${i * OFFSET_STEP}px`;
                arrow.style.left = 'calc(100% - 10px)';
                arrow.style.right = '';
                arrow.style.bottom = '';
                arrow.style.transform = `${rotation} translate(-5%, -10%)`;
                break;
        }
    });
}

function animateSpriteOnce(arrowDiv, frameCount = 6, frameWidth = 45, frameHeight = 45, fps = 6) {
    let currentFrame = frameCount - 1; // Start from the rightmost frame

    const interval = setInterval(() => {
        const xOffset = -currentFrame * frameWidth;
        arrowDiv.style.backgroundPosition = `${xOffset}px 0px`;
        currentFrame--;

        if (currentFrame < 0) {
            clearInterval(interval); // Stop after reaching the first frame
        }
    }, 1000 / fps);
}



function directionToArrowSymbol(direction) {
    switch (direction) {
        case 'up': return '↑';
        case 'down': return '↓';
        case 'left': return '←';
        case 'right': return '→';
        default: return '?';
    }
}

function removeArrowFromPlayer(playerId) {
    const container = document.getElementById('image-container');
    const allArrows = container.querySelectorAll('.arrow');

    allArrows.forEach(arrow => {
        if (arrow.dataset.playerId === playerId) {
            arrow.remove();
        }
    });
}


function _randomizeGamePlacement() {
    let newGameState = {
        blocks: {},
        slots: {},
        players: {},
        obstacles: {}
    };

    // Block setup — all in the middle
    const blockSettings = [
        { color: 'blue', minVotes: 3 },
        { color: 'red', minVotes: 2 },
        { color: 'yellow', minVotes: 1 }
    ];

    const possibleStartY = [1, 5, 9];
    shuffleArray(possibleStartY);

    blockSettings.forEach((block, index) => {
        newGameState.blocks[block.color] = {
            x: 8, // middle of the board
            y: possibleStartY[index],
            color: block.color,
            minVotes: block.minVotes
        };
    });

    // Slots on both sides (3 left + 3 right)
    const possibleSlotPositions = [
        { x: 0, y: 3 },
        { x: 0, y: 9 },
        { x: 14, y: 2 },
        { x: 15, y: 9 }
    ];
    shuffleArray(possibleSlotPositions);

    // Use all 6 slots
    for (let i = 0; i < 4; i++) {
        newGameState.slots[`slot${i}`] = {
            x: possibleSlotPositions[i].x,
            y: possibleSlotPositions[i].y
        };
    }

    newGameState.obstacles = {
        obs1: { x: 2, y: 6, id: 'obs1'},
        obs2: { x: 5, y: 6, id: 'obs2' },
        obs3: { x: 12, y: 1, id: 'obs3' },
        obs4: { x: 13, y: 9, id: 'obs4'}
    };

    // Initialize player choices
    let allPlayerIDs = getCurrentPlayerIds();
    allPlayerIDs.forEach(player => {
        newGameState.players[player] = {
            selectedBlock: null,
            selectedPosition: null
        };
    });

    return newGameState;
}

// helper to shuffle
function shuffleArray(array) {
    return array.sort(() => Math.random() - 0.5);
}

function _setPlayerAvatarCSS() {
    /*
        Update Player N's avatar if they have made an estimate
    */

    console.log("setting CSS");
    // Get element responsible for player avatar colors
    let root = document.querySelector(":root");
    console.log("Root", root);
    let allPlayerIDs = getCurrentPlayerIds();
    allPlayerIDs.forEach((player) => root.style.setProperty(
        "--" + player + "-avatar-backgroundcolor", 'lightgray'
    ));
    console.log("set all players as light gray");
    //let thisPlayerID = getCurrentPlayerId();
    root.style.setProperty(
        "--" + thisPlayerID + "-avatar-backgroundcolor", 'black'
    )
    console.log("set this player as black");

};

// function _createThisPlayerAvatar() {
//     let thisPlayerContainer = document.getElementById('player1-container');
//     thisPlayerContainer.innerHTML = `
//         <div class="row" id="${thisPlayerID}-container">
//             <div class="col-12" id="${thisPlayerID}-content">
//                 <h3 id="${thisPlayerID}-name">You</h3>
//             </div>
//         </div>
//         <div class="row" id="${thisPlayerID}-avatar-container">
//             <div class="col-12" id="${thisPlayerID}-avatar-content">
//                 <div class="person" id="player1"></div>
//             </div>
//         </div>
//     `;

// }

function _createThisPlayerAvatar() {
    const container = document.getElementById('player1-container');
    arrivalIndex = getCurrentPlayerArrivalIndex();
    const imgSrc = `./images/player${arrivalIndex}.png`;

    container.innerHTML = `
        <div class="row" id="${playerId}-container">
            <div class="col-12" id="${playerId}-content">
                <h3 id="${playerId}-name" style="font-size: 16px;">You</h3>
            </div>
        </div>
        <div class="row" id="${playerId}-avatar-container">
            <div class="col-12" id="${playerId}-avatar-content">
                <img src="${imgSrc}" class="player-avatar" style="width: 50px; height: 50px;"/>
            </div>
        </div>
    `;
}



function _createOtherPlayerAvatar() {
    let otherPlayerContainer = document.getElementById('other-player-content');

    const thisPlayerID = getCurrentPlayerId();
    const allPlayerIDs = getCurrentPlayerIds();

    // Create a list of indices 1–5, remove this player's index
    let avatarIndices = [1, 2, 3, 4, 5].filter(i => i !== arrivalIndex);

    let avatarAssignIndex = 0;
    let visualPlayerNumber = 2;

    allPlayerIDs.forEach((playerId) => {
        if (playerId !== thisPlayerID) {
            const columnSize = {
                5: 3,
                4: 4,
                3: 6
            }[allPlayerIDs.length] || 12;

            const avatarIndex = avatarIndices[avatarAssignIndex];
            const avatarSrc = `./images/player${avatarIndex}.png`;

            otherPlayerContainer.innerHTML += `
                <div class="col-${columnSize}" id="${playerId}-container">
                    <div class="row" id="${playerId}-name-container">
                        <div class="col-12" id="${playerId}-name-content">
                            <h3 id="${playerId}-name" style="font-size: 16px;">Player ${visualPlayerNumber}</h3>
                        </div>
                    </div>
                    <div class="row" id="${playerId}-avatar-container">
                        <div class="col-12" id="${playerId}-avatar-content">
                            <img src="${avatarSrc}" class="player-avatar" id="player${visualPlayerNumber}" style="width: 50px; height: 50px;">
                        </div>
                    </div>
                </div>
            `;
            avatarAssignIndex++;
            visualPlayerNumber++;
        }
    });
}


function _updatePlayerAvatar(n, color) {
    /*
        Update Player N's avatar if they have made an estimate
    */

    // Get element responsible for player avatar colors
    let root = document.querySelector(":root");

    // Update the color
    root.style.setProperty("--player" + n + "avatar-backgroundcolor", color);


};

function _updatePlayerAvatarV2(player) {
    /*
        Update Player N's avatar if they have made an estimate
    */

    // Get element responsible for player avatar colors
    let root = document.querySelector(":root");

    // Update the color
    root.style.setProperty("--" + player + "-avatar-backgroundcolor", 'green');


};


function newGame() {
    // Initialize a game
    //let whoStarts;
    assignAvatarColors();
    _setPlayerAvatarCSS();
    _createThisPlayerAvatar();
    _createOtherPlayerAvatar();


    GameState = _randomizeGamePlacement();

    let arrivalIndex = getCurrentPlayerArrivalIndex();

    if (arrivalIndex == 1){
        updateStateDirect('blocks', GameState.blocks, 'initalizeBlock');
        updateStateDirect('slots', GameState.slots, 'initalizeSlots');
        updateStateDirect('obs', GameState.obstacles, 'initalizeObstacle');

        Object.values(GameState.slots).forEach(slot => {
            drawSlot(slot);
        });
        
        Object.values(GameState.blocks).forEach(block => {
            drawBlock(block, false);
        });

        Object.values(GameState.obstacles).forEach(obstacles => {
            drawBlock(obstacles, true);
        });
        
    }

    console.log("Initialized GameState:", GameState);
}


// --------------------------------------------------------------------------------------
//   Handle Events triggered by MPLIB
//   These callback functions are required, but the contents can be empty and left inconsequential  
//   (note: all timestamps are server-side expressed in milliseconds since the Unix Epoch)
// --------------------------------------------------------------------------------------
// Function to receive state changes from Firebase
function receiveStateChange(pathNow, nodeName, newState, typeChange ) {
    // console.log("State change received");
    // console.log("pathNow", pathNow);
    // console.log("nodeName", nodeName);
    // console.log("New state", newState);
    // console.log("type change", typeChange);
    // console.log("Current Game State");
    // console.log(GameState);

    

    if (pathNow == "players" && (typeChange == 'onChildAdded' ||typeChange == 'onChildChanged')) {
        const playerId = nodeName; // nodeName is the player ID
        const playerData = newState; // newState contains { selectedBlock, selectedDirection }

        if (playerData.color) {
            playerColorMap[playerId] = playerData.color;
            console.log("color received");
            console.log(playerColorMap);
        }
    
        // 2. Draw the new arrow if both block and direction are selected
        if (playerData.block && playerData.direction) {
            console.log(`player ${playerId} decided to move ${playerData.block} to ${playerData.direction} .`);
            addArrowToBlock(playerData.block, playerData.direction, playerId);
        }else if (playerData.block && playerData.direction) {
            addArrowToBlock(playerData.block, playerData.direction, playerId);
        } else if (playerData.obstacle && playerData.direction) {
            addArrowToBlock(playerData.obstacle, playerData.direction, playerId);
        }

    } else if(pathNow == "blocks" && (typeChange == 'onChildAdded' ||typeChange == 'onChildChanged')){
        let arrivalIndex = getCurrentPlayerArrivalIndex();
        if(arrivalIndex != 1){
            GameState.blocks[nodeName] = newState;  // update your local GameState
            drawBlock(newState, false)
        }

    }else if(pathNow == "slots" && (typeChange == 'onChildAdded' ||typeChange == 'onChildChanged')){
        let arrivalIndex = getCurrentPlayerArrivalIndex();
        if(arrivalIndex != 1){
            GameState.slots[nodeName] = newState; // update your local GameState
            drawSlot(newState);
        }
    }else if(pathNow == "obs" && (typeChange == 'onChildAdded' ||typeChange == 'onChildChanged')){
        console.log("received obstacle update");
        let arrivalIndex = getCurrentPlayerArrivalIndex();
        if(arrivalIndex != 1){
            GameState.obstacles[newState.id] = newState; 
            drawBlock(newState, true);
        }
    }

}


function evaluateUpdate( path, state, action, actionArgs ) {
    let isAllowed = false;
    let newState = null;

    if ((action === 'initialize') && ((state === null))) {
        isAllowed = true;
        newState = actionArgs;
    }

    console.log("Initial State");
    console.log(state);
    console.log("Initial actionArgs");
    console.log(actionArgs);

    let actionResult = { isAllowed, newState };
    return actionResult;
}

// Function triggered when this client closes the window and the player needs to be removed from the state 
function removePlayerState( playerId ) {

}

// --------------------------------------------------------------------------------------
//   Handle any session change relating to the waiting room or ongoing session 
// --------------------------------------------------------------------------------------

function joinWaitingRoom() {
    /*
        Functionality to invoke when joining a waiting room.

        This function does the following:
            - Determines the number of players needed for the game
            - Creates an appropriate message based on players needed and players in waiting room
            - Displays the waiting room screen
    */
    playerId = getCurrentPlayerId(); // the playerId for this client
    let numPlayers = getNumberCurrentPlayers(); // the current number of players
    let numNeeded = sessionConfig.minPlayersNeeded - numPlayers; // Number of players still needed (in case the player is currently in a waiting room)
    
    let str2 = `Waiting for ${ numNeeded } additional ${ numPlayers > 1 ? 'players' : 'player' }...`;
    messageWaitingRoom.innerText = str2;
    
    // switch screens from instruction to waiting room
    instructionsScreen.style.display = 'none';
    waitingRoomScreen.style.display = 'block';
}

function updateWaitingRoom() {
    /*
        Functionality to invoke when updating the waiting room.

        This function does the following:
            - Displays the waiting room screen
            - Checks the status of the current session
                - If the status is 'waitingRoomCountdown' then the game will start
                - otherwise continue waiting
            - Displays a 'game will start' message if appropriate
    */
    instructionsScreen.style.display = 'none';
    waitingRoomScreen.style.display = 'block';

    // Waiting Room is full and we can start game
    let [ doCountDown , secondsLeft ] = getWaitRoomInfo();
    if (doCountDown) {
        let str2 = `Game will start in ${ secondsLeft } seconds...`;
        messageWaitingRoom.innerText = str2;
    } else { // Still waiting for more players, update wait count
        let numPlayers = getNumberCurrentPlayers(); // the current number of players
        let numNeeded = sessionConfig.minPlayersNeeded - numPlayers; // Number of players still needed (in case the player is currently in a waiting room)
        
        let str2 = `Waiting for ${ numNeeded } additional ${ numPlayers > 1 ? 'players' : 'player' }...`;
        messageWaitingRoom.innerText = str2;
    }
}

function startSession() {
    /*
        Funtionality to invoke when starting a session.

        This function does the following:
            - Displays the game screen
            - Logs the start of the game with the session ID and timestamp
            - Displays a "game started" message
            - Starts a new game
    */
    // Assign playerUniqueID
    // sessinoInfo.playerID
    /*playerUniqueID = sessionInfo.playerId;
    playerIDsAll = sessionInfo.playerIds;
    console.log("all player IDs", playerIDsAll);
    playerNumber = sessionInfo.arrivalIndex;*/

    instructionsScreen.style.display = 'none';
    waitingRoomScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    
    let playerId = getCurrentPlayerId(); // the playerId for this client
    let dateString = timeStr(getPlayerInfo( playerId ).sessionStartedAt);
    let str = `Started game with session id ${getSessionId()} with ${getNumberCurrentPlayers()} players at ${dateString}.`;
    myconsolelog( str );

    //playerID.innerText = 1;
    //let str2 = `<p>The game has started...</p><p>Number of players: ${ sessionInfo.numPlayers}</p><p>Session ID: ${ sessionInfo.sessionId}$</p>`;
    //messageGame.innerHTML = str2;

    //thisSession = sessionInfo;
    allPlayerIDs = getCurrentPlayerIds();
    console.log("Session Starts here...", allPlayerIDs);
    newGame();
    startVotingPhase();
}


function updateOngoingSession() {
    /*
        Functionality to invoke when updating an ongoing session.
  
        This function is currently empty.
    */
  }

function endSession() {
    /*
    Functionality to invoke when ending a session.

    This function does the following:
        - Displays the finish screen (hides all other divs)
        - Checks if any players terminated their session abnormally
            - If so, an "abnormal termination" message is created
            - If not, then the session completed normally
        - Displays a message based on the termination status [normal, abnormal]
    */
    instructionsScreen.style.display = 'none';
    waitingRoomScreen.style.display = 'none';
    gameScreen.style.display = 'none';
    finishScreen.style.display = 'block';

    let err = getSessionError();

    if ( anyPlayerTerminatedAbnormally()) {
        // Another player closed their window or were disconnected prematurely
        messageFinish.innerHTML = `<p>Session ended abnormally because the other player closed their window or was disconnected</p>`;
        
    } else if (err.errorCode == 1) {
        // No sessions available
        messageFinish.innerHTML = `<p>Session ended abnormally because there are no available sessions to join</p>`;
    } else if (err.errorCode==2) {
        // This client was disconnected (e.g. internet connectivity issues) 
        messageFinish.innerHTML = `<p>Session ended abnormally because you are experiencing internet connectivity issues</p>`;
    } else if (err.errorCode==3) {
        // This client is using an incompatible browser
        messageFinish.innerHTML = `<p>Session ended abnormally because you are using the Edge browser which is incompatible with this experiment. Please use Chrome or Firefox</p>`;
    } else {
        messageFinish.innerHTML = `<p>You have completed the session.</p>`;
    }
};


// -------------------------------------
//       Display Information
// -------------------------------------
function myconsolelog(message) {
    if (verbosity > 0) {
        console.log(message);
    }
}


// Converts the server-side timestamp expressed in milliseconds since the Unix Epoch to a string in local time
function timeStr(timestamp) {
    let date = new Date(timestamp);  // JavaScript uses milliseconds

    // Add leading zero to hours, minutes, and seconds if they are less than 10
    let hours = ("0" + date.getHours()).slice(-2);
    let minutes = ("0" + date.getMinutes()).slice(-2);
    let seconds = ("0" + date.getSeconds()).slice(-2);

    let timeString = `${hours}:${minutes}:${seconds}`;
    return timeString;
}