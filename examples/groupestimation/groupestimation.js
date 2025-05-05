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
    return isNaN(num) ? 2 : Math.max(2, Math.min(num, 5)); // default to 5, clamp between 2–5
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

const CELL_WIDTH = 45;
const CELL_HEIGHT = 30;

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
let listenerPaths = [ 'players', 'blocks', 'slots' ];

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
    players: {}
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
    const PLAYER_COLORS = [
        '#E69F00', // Orange
        '#009E73', // Green
        '#F0E442', // Yellow
        '#CC79A7', // Pink/Magenta
        '#0072B2'  // Blue
    ];

    const arrivalIndex = getCurrentPlayerArrivalIndex(); // 1-based
    const numPlayers = getNumberCurrentPlayers();

    const root = document.documentElement;

    // 1. Set color for local player (#player1)
    const myColor = PLAYER_COLORS[arrivalIndex - 1];
    root.style.setProperty('--player1avatar-backgroundcolor', myColor);

    updateStateDirect(`players/${getCurrentPlayerId()}`, {
        color: myColor
    });

    playerColorMap[getCurrentPlayerId()] = myColor;

    // 2. Assign the remaining N-1 colors to player2–playerN
    let colorIndex = 0;
    for (let i = 2; i <= numPlayers; i++) {
        if (colorIndex === arrivalIndex - 1) colorIndex++; // Skip local player's color
        root.style.setProperty(`--player${i}avatar-backgroundcolor`, PLAYER_COLORS[colorIndex]);
        colorIndex++;
    }
}

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
        updateStateDirect(`players/${pid}`, { block: null, direction: null });
      });
    
    hideDirectionButtons();
    const turnMessage = document.getElementById('turnMessage');
    turnMessage.innerText = `Moving the blocks now...`;
    // For each block:
    const container = document.getElementById('image-container');
    const blocks = container.querySelectorAll('.block');

    blocks.forEach(block => {
        let voteCounts = {
            'up': 0,
            'down': 0,
            'left': 0,
            'right': 0
        };

        const arrows = block.querySelectorAll('.arrow');

        arrows.forEach(arrow => {
            const direction = arrow.dataset.direction;
            voteCounts[direction]++;
        });

        // Find majority direction
        let majorityDirection = getMajorityDirection(voteCounts);
        
        if (majorityDirection) {
            moveBlock(block, majorityDirection);
        }

        // Remove all arrows after move
        arrows.forEach(arrow => arrow.remove());
    });

    setTimeout(() => {
        showDirectionButtons();
        startVotingPhase();
    }, breakDuration * 1000);
}

function getMajorityDirection(votes) {
    let maxCount = 0;
    let majority = null;
    let countOfMax = 0;

    for (let direction in votes) {
        if (votes[direction] > maxCount) {
            maxCount = votes[direction];
            majority = direction;
            countOfMax = 1;
        } else if (votes[direction] === maxCount && maxCount !== 0) {
            countOfMax++;
        }
    }

    // Require at least 2 votes and no tie
    if (maxCount < 2 || countOfMax > 1) {
        console.log("No valid majority (either tie or fewer than 2 votes)");
        return null;
    }

    console.log("direction", majority);
    return majority;
}


function moveBlock(block, direction) {
    const color = block.dataset.color;
    if (lockedBlocks[color]) {
        console.log(`Block ${color} is locked and cannot move.`);
        return;
    }


    let x = parseInt(block.dataset.x);
    let y = parseInt(block.dataset.y);

    console.log(`moving Block ${color} to ${x}, ${y}.`);

    if (direction === 'up') y -= 1;
    if (direction === 'down') y += 1;
    if (direction === 'left') x -= 1;
    if (direction === 'right') x += 1;

    // Clamp within grid bounds
    x = Math.max(0, Math.min(17, x));
    y = Math.max(0, Math.min(17, y));

    // Update dataset
    block.dataset.x = x;
    block.dataset.y = y;

    // Move the block with matching logic
    const width = CELL_WIDTH * 3;
    const height = CELL_HEIGHT * 3;

    block.style.left = (x * CELL_WIDTH + CELL_WIDTH - width / 2) + 'px';
    block.style.top = (y * CELL_HEIGHT + CELL_HEIGHT - height / 2) + 'px';

    // Check if reached its slot
    const slot = GameState.slots[color];
    console.log(`Block ${color} final destination is ${slot.x}, ${slot.y}.`);
    if (slot && slot.x === x && slot.y === y) {
        console.log(`Block ${color} reached its slot. Locking.`);
        lockedBlocks[color] = true;
        block.style.border = '4px solid gold';
        block.style.backgroundColor = 'lightgray';
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
    div.style.left = (slot.x * CELL_WIDTH + CELL_WIDTH - width / 2) + 'px';
    div.style.top = (slot.y * CELL_HEIGHT + CELL_HEIGHT - height / 2) + 'px';
    div.style.width = `${width}px`;
    div.style.height = `${height}px`;
    div.style.border = '3px dashed black';
    div.style.borderRadius = '10px';
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.justifyContent = 'center';
    div.style.fontWeight = 'bold';
    div.style.color = 'black';
    div.style.backgroundColor = 'transparent';

    // Label (based on color key)
    div.innerText = getBlockLabel(slot.color);

    container.appendChild(div);
}


function drawBlock(block) {
    const container = document.getElementById('image-container');
    const div = document.createElement('div');
    div.classList.add('block');

    const width = CELL_WIDTH * 3;
    const height = CELL_HEIGHT * 3;

    div.setAttribute('data-color', block.color);
    div.dataset.color = block.color;
    div.dataset.x = block.x; 
    div.dataset.y = block.y;

    // Style and position
    div.style.position = 'absolute';
    div.style.left = (block.x * CELL_WIDTH + CELL_WIDTH - width / 2) + 'px';
    div.style.top = (block.y * CELL_HEIGHT + CELL_HEIGHT - height / 2) + 'px';
    div.style.width = `${width}px`;
    div.style.height = `${height}px`;
    div.style.backgroundColor = '#444'; // dark gray
    div.style.borderRadius = '10px';
    //div.style.border = '2px solid black';
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.justifyContent = 'center';
    div.style.position = 'absolute';
    div.style.zIndex = '5';
    div.style.flexDirection = 'column';

    // Label
    const label = document.createElement('div');
    label.innerText = getBlockLabel(block.color);
    label.style.color = 'white';
    label.style.fontWeight = 'bold';
    label.style.fontSize = '18px';

    const minText = document.createElement('div');
    minText.innerText = 'min: 2';
    minText.style.fontSize = '14px';
    minText.style.color = 'white';

    div.appendChild(label);
    div.appendChild(minText);

    // Directional buttons container
    const directions = ['up', 'right', 'down', 'left'];
    directions.forEach(dir => {
        const arrow = document.createElement('div');
        arrow.classList.add('triangle', dir, 'direction-button');
        arrow.dataset.direction = dir;
        arrow.dataset.blockColor = block.color;

        // Event listener
        arrow.addEventListener('click', () => {
            let playerId = getCurrentPlayerId();
            updateStateDirect(`players/${playerId}`, {
                block: block.color,
                direction: dir
            });
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

    // Add the arrow to the block
    const arrow = document.createElement('div');
    arrow.classList.add('arrow');
    arrow.innerText = directionToArrowSymbol(direction);
    arrow.style.position = 'absolute';
    arrow.style.fontSize = '40px';
    arrow.style.fontWeight = 'bold';
    arrow.style.pointerEvents = 'none';
    arrow.style.zIndex = '20';
    arrow.style.color = playerColorMap[playerId] || 'black';

    arrow.dataset.playerId = playerId;
    arrow.dataset.direction = direction;

    block.appendChild(arrow);

    // Re-layout all arrows of this direction in the block
    layoutDirectionalArrows(block, direction);
}



function layoutDirectionalArrows(block, direction) {
    const arrows = Array.from(block.querySelectorAll(`.arrow[data-direction="${direction}"]`));
    const OFFSET_STEP = 20;

    arrows.forEach((arrow, i) => {
        switch (direction) {
            case 'up':
                arrow.style.top = '-2px';
                arrow.style.left = `${20 + i * OFFSET_STEP}px`;
                arrow.style.transform = 'translate(-50%, -80%)';
                break;
            case 'down':
                arrow.style.bottom = '-2px';
                arrow.style.left = `${20 + i * OFFSET_STEP}px`;
                arrow.style.transform = 'translate(-50%, 80%)';
                break;
            case 'left':
                arrow.style.left = '-2px';
                arrow.style.top = `${10 + i * OFFSET_STEP}px`;
                arrow.style.transform = 'translate(-100%, -50%)';
                break;
            case 'right':
                arrow.style.right = '-2px';
                arrow.style.top = `${10 + i * OFFSET_STEP}px`;
                arrow.style.transform = 'translate(100%, -50%)';
                break;
        }
    });
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
        players: {}
    };

    // Random starting positions for blocks
    let blockColors = ['blue', 'red', 'yellow'];
    let possibleStartPositions = [
        { x: 1, y: 2 },   // Top-left
        { x: 2, y: 8 },   // Middle-left
        { x: 1, y: 14 }   // Bottom-left
      ];
    // Shuffle the start positions
    possibleStartPositions = shuffleArray(possibleStartPositions);

    blockColors.forEach((color, index) => {
        newGameState.blocks[color] = {
            x: possibleStartPositions[index].x,
            y: possibleStartPositions[index].y,
            color: color
        };
    });

    let possibleEndPositions = [
        { x: 16, y: 3 },  // Top-right
        { x: 15, y: 9 },  // Middle-right
        { x: 16, y: 15 }  // Bottom-right
      ];;
    // Shuffle the slot positions
    possibleEndPositions = shuffleArray(possibleEndPositions);

    blockColors.forEach((color, index) => {
        newGameState.slots[color] = {
            x: possibleEndPositions[index].x,
            y: possibleEndPositions[index].y,
            color: color
        };
    });

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

function _createThisPlayerAvatar() {
    let thisPlayerContainer = document.getElementById('player1-container');
    thisPlayerContainer.innerHTML = `
        <div class="row" id="${thisPlayerID}-container">
            <div class="col-12" id="${thisPlayerID}-content">
                <h3 id="${thisPlayerID}-name">You</h3>
            </div>
        </div>
        <div class="row" id="${thisPlayerID}-avatar-container">
            <div class="col-12" id="${thisPlayerID}-avatar-content">
                <div class="person" id="player1"></div>
            </div>
        </div>
    `;

//     <div class="row" id="${thisPlayerID}-selection-container">
//     <div class="col-12" id="${thisPlayerID}-selection-content">
//         <select class="form-select" id="${thisPlayerID}-block-select" required>
//             <option value="" disabled selected>Select Block</option>
//             <option value="blue">Blue</option>
//             <option value="red">Red</option>
//             <option value="yellow">Yellow</option>
//         </select>
//         <br>
//         <select class="form-select" id="${thisPlayerID}-direction-select" required>
//             <option value="" disabled selected>Select Direction</option>
//             <option value="up">Up</option>
//             <option value="down">Down</option>
//             <option value="left">Left</option>
//             <option value="right">Right</option>
//         </select>
//     </div>
// </div>
// <div class="row" id="player1-submit-container">
//     <div class="col-12" id="player1-submit-content">
//         <button type="button" class="btn btn-dark" id="submit-selection-button">
//             Submit
//         </button>
//     </div>
// </div>

    // // Setup the submit button event listener
    // submitSelection = document.getElementById('submit-selection-button');
    // submitSelection.addEventListener('click', function () {
    //     // Get selected block and direction
    //     let selectedBlock = document.getElementById(`${thisPlayerID}-block-select`).value;
    //     let selectedDirection = document.getElementById(`${thisPlayerID}-direction-select`).value;

    //     // Check if both are selected
    //     if (selectedBlock && selectedDirection) {
    //         console.log("Selected Block:", selectedBlock);
    //         console.log("Selected Direction:", selectedDirection);

    //         // Update the database with selected block and direction
    //         updateStateDirect(
    //             `players/${thisPlayerID}`,
    //             {
    //                 block: selectedBlock,
    //                 direction: selectedDirection
    //             }
    //         );

    //         addArrowToBlock(selectedBlock, selectedDirection, thisPlayerID);

    //         // Update visual feedback (avatar turns green)
    //         _updatePlayerAvatar(1, 'green');
    //         //messageToPlayer.innerText = 'Selection received... waiting for others.';
    //     } else {
    //         console.log("Both selections are required!");
    //         alert('Please select both a block and a direction.');
    //     }
    // });
}


function _createOtherPlayerAvatar() {
    
    let otherPlayerContainer = document.getElementById('other-player-content');

    let thisPlayerID = getCurrentPlayerId();
    let allPlayerIDs = getCurrentPlayerIds();
    let otherPlayerCountID = 2;
    allPlayerIDs.forEach((player) => {
        if (player == thisPlayerID){} else {
            let columnSize;
            if (allPlayerIDs.length == 5){
                columnSize = 3;
            } else if (allPlayerIDs.length == 4) {
                columnSize = 4;
            } else if (allPlayerIDs.length == 3) {
                columnSize = 6;
            } else {
                columnSize = 12;
            };
            otherPlayerContainer.innerHTML += `
                <div class="col-${columnSize}" id="${player}-container">
                    <div class="row" id="${player}-name-container">
                        <div class="col-12" id="${player}-name-content">
                            <h3 id="${player}-name">Player ${otherPlayerCountID}</h3>
                        </div>
                    </div>
                    <div class="row" id="${player}-avatar-container">
                        <div class="col-12" id="${player}-avatar-content">
                            <div class="person" id="player${otherPlayerCountID}"></div>
                        </div>
                    </div>
                </div>
            `;
            otherPlayerCountID++;
        }
    });
    

};

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
    _setPlayerAvatarCSS();
    _createThisPlayerAvatar();
    _createOtherPlayerAvatar();

    assignAvatarColors();

    GameState = _randomizeGamePlacement();

    let arrivalIndex = getCurrentPlayerArrivalIndex();

    if (arrivalIndex == 1){
        updateStateDirect('blocks', GameState.blocks, 'initalizeBlock');
        updateStateDirect('slots', GameState.slots, 'initalizeBlock');

        Object.values(GameState.slots).forEach(slot => {
            drawSlot(slot);
        });
        
        Object.values(GameState.blocks).forEach(block => {
            drawBlock(block);
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
        }

    } else if(pathNow == "blocks" && (typeChange == 'onChildAdded' ||typeChange == 'onChildChanged')){
        let arrivalIndex = getCurrentPlayerArrivalIndex();
        if(arrivalIndex != 1){
            GameState.blocks[nodeName] = newState;  // update your local GameState
            drawBlock(newState)
        }

    }else if(pathNow == "slots" && (typeChange == 'onChildAdded' ||typeChange == 'onChildChanged')){
        let arrivalIndex = getCurrentPlayerArrivalIndex();
        if(arrivalIndex != 1){
            GameState.slots[nodeName] = newState; // update your local GameState
            drawSlot(newState);
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
