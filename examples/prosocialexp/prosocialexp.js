// --------------------------------------------------------------------------------------
//    Code to demonstrate how MPLIB can be used to program a gridworld game
//    where players collect tokens.
// --------------------------------------------------------------------------------------

/* 

Graphics borrowed from: https://www.youtube.com/watch?v=xhURh2RDzzg&list=PLfO8lBNeR6KJiOQx1an2Le96DmcP3Ggqe&index=1

Issues:
* Collision detection is primitive: players can still move through each other. A transaction will needed to create foolproof collision detection 
* Name generation can collide

*/

// -------------------------------------
// Importing functions and variables from 
// the Firebase MultiPlayer library
// -------------------------------------
import {
  initializeMPLIB,
  joinSession,
  leaveSession,
  updateStateDirect,
  updateStateTransaction,  
  hasControl,
  readState,
  getCurrentPlayerId, getCurrentPlayerIds, getAllPlayerIds, getPlayerInfo,getNumberCurrentPlayers,getNumberAllPlayers,
  getCurrentPlayerArrivalIndex, getCurrentPlayerArrivalIndexStable, getSessionId,getSessionError,getWaitRoomInfo
} from "/mplib/src/mplib.js";

// -------------------------------------
//       Graphics handles
// -------------------------------------
let instructionsScreen = document.getElementById('instructionsScreen');
let waitingRoomScreen = document.getElementById('waitingRoomScreen');
let gameScreen = document.getElementById('gameScreen');
let messageWaitingRoom = document.getElementById('messageWaitingRoom');
// let messageGame = document.getElementById('messageGame');
let messageFinish = document.getElementById('messageFinish');
let gameContainer = document.querySelector(".game-container");

// -------------------------------------
//       Session configuration
// -------------------------------------
// studyId is the name of the root node we create in the realtime database
const studyId = 'prosocial'; 

// Configuration setting for the session
let sessionConfig = {
    minPlayersNeeded: 2, // Minimum number of players needed; if set to 1, there is no waiting room (unless a countdown has been setup)
    maxPlayersNeeded: 2, // Maximum number of players allowed in a session
    maxParallelSessions: 0, // Maximum number of sessions in parallel (if zero, there are no limit)
    allowReplacements: false, // Allow replacing any players who leave an ongoing session?
    exitDelayWaitingRoom: 0, // Number of countdown seconds before leaving waiting room (if zero, player leaves waiting room immediately)
    maxHoursSession: 0, // Maximum hours where additional players are still allowed to be added to session (if zero, there is no time limit)
    recordData: true, // Record all data?  
};
const verbosity = 2;

// Allow URL parameters to update these default parameters
updateConfigFromUrl( sessionConfig );

// List names of the callback functions that are used in this code (so MPLIB knows which functions to trigger)
let funList = { 
  sessionChangeFunction: {
      joinedWaitingRoom: joinWaitingRoom,
      updateWaitingRoom: updateWaitingRoom,
      startSession: startSession,
      updateOngoingSession: updateOngoingSession,
      endSession: endSession
  },
  evaluateUpdateFunction: evaluateUpdate,
  receiveStateChangeFunction: receiveStateChange,
  removePlayerStateFunction: removePlayerState
};

// List the node names where we place listeners for any changes to the children of these nodes; set to '' if listening to changes for children of the root
let listenerPaths = ['coins', 'players', 'doors', 'subgridAssignment', 'condition', 'trappedPlayer', 'colorAssignment', 'playerSequenceAssignment'];

// Set the session configuration for MPLIB
initializeMPLIB( sessionConfig , studyId , funList, listenerPaths, verbosity );

const paramsHRI = new URLSearchParams(window.location.search);
const writeToTryoutData = paramsHRI.get('noinstruction');

if(writeToTryoutData){
  document.getElementById("consentDiv").style.display = "none";
  document.getElementById("instructionsScreen").style.display = "block";
  document.getElementById("joinBtn").style.display = "inline-block";
}

// -------------------------------------
//       Game Globals
// -------------------------------------
document.getElementById("consentProceed").addEventListener("click", () => {
  const consentCheckbox = document.getElementById("consentcheckbox");
  
  if (consentCheckbox.checked) {
      // Hide consent screen and show instructions screen
      document.getElementById("consentDiv").style.display = "none";
      document.getElementById("instructionsScreen").style.display = "block";
      
      // Optionally set full-screen mode if required
      document.documentElement.requestFullscreen();
  } else {
      alert("Please check the consent box to proceed.");
  }
});

// Instructions for each step
let instructionStep = 0;
const instructions = [
  "You’ll use the arrow keys to move your character around the grid. Let's start by placing you as the orange character on the top left corner!",
  "You are now the orange character in the top left corner of the grid, which has four rooms separated by walls and doors",
  "Each room has doors in different colors, and you can only pass through doors that match your color. Try passing through the orange door to enter a room! Once you enter a room, the door colors will shuffle.",
  "Now, let's practice entering another room. In the lower right room, the green door has disappeared. In situations like this, if you enter the room through the door matching your color, the doors will shuffle, and the green door will reappear.",
  "Next, let’s collect some tokens. You can only collect tokens that match your color. Ready to try collecting tokens? Go ahead and collect the three orange coins in the lower left room.",
  "There are other players in the game, ranging from one to three additional participants. In this example, there is one other player: the green player, located in the top right corner. This player’s objective is to collect the green coins in the top right room.",
  "Here, we’re demonstrating what another player might do. Keep in mind that when you start the game, you’ll be playing with real human participants. "
]

document.getElementById("nextBtn").addEventListener("click", () => {
  if (instructionStep < instructions.length) {
    document.getElementById("instructionsMessage").textContent = instructions[instructionStep];
    handleInstructionStep(instructionStep);
    if(instructionStep !== 2 && instructionStep !== 3){
      instructionStep++;
    }

  } else {
    // Hide the Next button and show the Join button at the end of instructions
    document.getElementById("nextBtn").style.display = "none";
    document.getElementById("joinBtn").style.display = "inline-block";
    document.getElementById("instructionsMessage").textContent = "Practice complete! You'll now be assigned a new player avatar with a unique color. Click 'Join Game' to enter the waiting room and be paired with one other player. You will play four rounds of game, each round of game lasts 2 minutes and 30 seconds. ";
  }
});


function handleInstructionStep(step) {
  switch (step) {
    case 1:
      renderPracticeGrid(); // Initialize grid without player, doors, or coins
      placePracticePlayer();
      placePracticeDoors();
      break;
    case 2:
      removePracticePlayer();
      EnablePlacePracticePlayer();
      document.getElementById("nextBtn").style.visibility = "hidden";
      break;
    case 3:
      setLowerRightGreenDoorGray(); 
      document.getElementById("nextBtn").style.visibility = "hidden";
      break;
    case 4:
      placePracticeCoins();  
      document.getElementById("nextBtn").style.visibility = "hidden";
      break;
    case 5:
      placeYellowPlayer();
      placeYellowTokens();
      break;
    case 6:
      moveYellowPlayer(yellowDirection);
      document.getElementById("nextBtn").style.visibility = "hidden";
  }
}

function placeYellowPlayer() {
  const yellowPlayer = { x: GRID_WIDTH - 1, y: 0, color: "#61c96f" };
  updatePlayerPosition(yellowPlayer, "yellow"); // Pass "yellow" to use the yellow sprite
  return yellowPlayer;
}

function updatePlayerPosition(player, color) {
  const container = document.getElementById("practiceGameContainer");

  // Remove previous player position if any
  document.querySelectorAll(`.player-${color}`).forEach(el => el.remove());

  // Create a new player element
  const playerElement = document.createElement("div");
  playerElement.classList.add(`practice-${color}-player`, "practice-player"); // Add the color-specific class
  playerElement.style.top = `${player.y * CELL_SIZE}px`;
  playerElement.style.left = `${player.x * CELL_SIZE}px`;

  container.appendChild(playerElement);
}

function placePracticePlayer() {
  const practicePlayer = { x: 0, y: 0, color: "blue" };
  updatePracticePlayerPosition(practicePlayer);
  const playerElement = document.createElement("div");
  playerElement.classList.add("practice-player");
  playerElement.style.top = `${practicePlayer.y * CELL_SIZE}px`;
  playerElement.style.left = `${practicePlayer.x * CELL_SIZE}px`;
  document.getElementById("practiceGameContainer").appendChild(playerElement);
}

function removePracticePlayer() {
  document.querySelectorAll(".practice-player").forEach(el => el.remove());
}


function EnablePlacePracticePlayer() {
  const practicePlayer = { x: 0, y: 0, color: "blue" };
  updatePracticePlayerPosition(practicePlayer);
  let collectedTokens = 0;
  let totalPracticeTokens = 3

  function handlePracticeMovement(event) {
    movePracticePlayer(event, practicePlayer);  // Update player position based on keys
    if (checkForTokenCollection(practicePlayer)) {
      collectedTokens++;
      if (collectedTokens >= totalPracticeTokens) {
        // End practice mode when all tokens are collected
        document.removeEventListener("keydown", handlePracticeMovement);
        instructionStep = 5;
        document.getElementById("nextBtn").style.visibility = "visible";
      }
    }
  }
  // Bind movement handling to keydown event for practice mode
  document.addEventListener("keydown", handlePracticeMovement);
}

const GRID_WIDTH = 15;
const GRID_HEIGHT = 13;
const CELL_SIZE = 32;

const SUBGRIDS = [
    { start: [2, 2], end: [4, 4] },
    { start: [2, 8], end: [4, 10] },
    { start: [10, 2], end: [12, 4] },
    { start: [10, 8], end: [12, 10] }
];

const insideSubgrids = [
  { startX: 2, startY: 2, endX: 4, endY: 4 },   // Top-left subgrid area
  { startX: 2, startY: 8, endX: 4, endY: 10 },  // Bottom-left subgrid area
  { startX: 10, startY: 2, endX: 12, endY: 4 }, // Top-right subgrid area
  { startX: 10, startY: 8, endX: 12, endY: 10 } // Bottom-right subgrid area
];

const doorColors = ["#6ba2d1", "orange", "#61c96f", "purple"];

let blueDoorPositions = [];

function renderPracticeGrid() {
  document.getElementById("practiceGameContainer").style.display = "block";
  const container = document.getElementById("practiceGameContainer");
  container.innerHTML = "";

  // Set container dimensions based on the grid size
  container.style.width = `${GRID_WIDTH * CELL_SIZE}px`;
  container.style.height = `${GRID_HEIGHT * CELL_SIZE}px`;
  container.style.backgroundColor = "#d3d3d3"; // Light grey background
  container.style.position = "relative"; // To position subgrid outlines accurately

  // Create the main 15x13 grid with cell borders
  for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
          const cell = document.createElement("div");
          cell.classList.add("practice-cell");
          cell.style.width = `${CELL_SIZE}px`;
          cell.style.height = `${CELL_SIZE}px`;
          cell.style.position = "absolute";
          cell.style.left = `${x * CELL_SIZE}px`;
          cell.style.top = `${y * CELL_SIZE}px`;
          cell.style.border = "0.1px solid white"; // White lines between cells
          container.appendChild(cell);
      }
  }

  // Overlay subgrid outlines
  SUBGRIDS.forEach(subgrid => {
      const outline = document.createElement("div");
      outline.classList.add("subgrid-outline");

      // Calculate the position and dimensions for each subgrid outline
      outline.style.position = "absolute";
      outline.style.top = `${subgrid.start[1] * CELL_SIZE}px`;
      outline.style.left = `${subgrid.start[0] * CELL_SIZE}px`;
      outline.style.width = `${(subgrid.end[0] - subgrid.start[0] + 1) * CELL_SIZE}px`; // 3 cells wide
      outline.style.height = `${(subgrid.end[1] - subgrid.start[1] + 1) * CELL_SIZE}px`; // 3 cells tall
      outline.style.border = "2.5px solid darkgrey"; // Outline color and thickness
      container.appendChild(outline);
  });
}

function setLowerRightGreenDoorGray() {
  // Lower right grid's green door (subgrid 3)
  const lowerRightSubgridIndex = 3;

  // Find the green door for the lower right subgrid
  const greenDoor = document.querySelector(`.practice-door[data-subgrid-index="${lowerRightSubgridIndex}"][data-color="#61c96f"]`);

  if (greenDoor) {
    greenDoor.style.backgroundColor = "gray";
    greenDoor.setAttribute("data-color", "gray");
    console.log("Lower right grid's green door set to gray.");
  }
}



function placePracticeDoors() {
  const container = document.getElementById("practiceGameContainer");

  SUBGRIDS.forEach((subgrid, subgridIndex) => {
    const doorPositions = [
      { x: subgrid.start[0], y: (subgrid.start[1] + subgrid.end[1]) / 2, side: "left" },    // Left side
      { x: subgrid.end[0] + 1, y: (subgrid.start[1] + subgrid.end[1]) / 2, side: "right" },     // Right side
      { x: (subgrid.start[0] + subgrid.end[0]) / 2, y: subgrid.start[1], side: "top" },     // Top side
      { x: (subgrid.start[0] + subgrid.end[0]) / 2, y: subgrid.end[1] + 1, side: "bottom" }     // Bottom side
    ];

    doorPositions.forEach(pos => {
      const door = document.createElement("div");
      door.classList.add("practice-door");
      door.setAttribute("data-subgrid-index", subgridIndex);

      // Door orientation and dimensions
      if (pos.side === "left" || pos.side === "right") {
        door.style.width = "5px";
        door.style.height = "32px";  // Vertical doors
      } else {
        door.style.width = "32px";
        door.style.height = "5px";   // Horizontal doors
      }

      // Door color based on position and define entry/exit points
      switch (pos.side) {
        case "left":
          door.style.backgroundColor = "orange";
          allEntryPoints[subgridIndex] = [{ x: pos.x, y: pos.y }]; 
          allExitPoints[subgridIndex] = [{ x: pos.x - 1, y: pos.y }]; 
          door.setAttribute("data-color", "orange");
          break;
        case "right":
          door.style.backgroundColor = "#6ba2d1";
          door.setAttribute("data-color", "#6ba2d1");
          break;
        case "top":
          door.style.backgroundColor = "#61c96f";
          door.setAttribute("data-color","#61c96f");
          break;
        case "bottom":
          door.style.backgroundColor = "purple";
          door.setAttribute("data-color", "purple");
          break;
      }

      // Apply positions with slight offsets for centering
      door.style.top = `${pos.y * 32 + (pos.side === "top" ? -2 : (pos.side === "bottom" ? -2.5 : 0))}px`;
      door.style.left = `${pos.x * 32 + (pos.side === "left" ? -2 : (pos.side === "right" ? -2.5 : 0))}px`;
      container.appendChild(door);
    });
  });
}


// Place three coins inside the subgrid
function placePracticeCoins() {
  const container = document.getElementById("practiceGameContainer");
  const coinPositions = [{ x: 2, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 9 }];

  coinPositions.forEach(pos => {
    const coin = document.createElement("div");
    coin.classList.add("practice-coin");
    coin.style.top = `${pos.y * 32 + 4}px`;
    coin.style.left = `${pos.x * 32 + 4}px`;
    container.appendChild(coin);
  });
}

// Update the player's position visually
function updatePracticePlayerPosition(player) {
  const container = document.getElementById("practiceGameContainer");

  // Remove the previous player position if any
  document.querySelectorAll(".practice-player").forEach(el => el.remove());

  // Create a new player element
  const playerElement = document.createElement("div");
  playerElement.classList.add("practice-player");
  playerElement.style.top = `${player.y * 32}px`;
  playerElement.style.left = `${player.x * 32}px`;
  container.appendChild(playerElement);
}

// Arrays to store entry and exit points for each subgrid
let allEntryPoints = [];
let allExitPoints = [];

// Calculate entry and exit points for a specific subgrid based on the blue door's position and side
function calculateEntryExitPointsForSubgrid(subgridIndex, blueDoorPos, side) {
  // Calculate entry point for the blue door

  // Calculate exit point based on the side of the blue door
  let exitPoint;
  let entryPoint;
  switch (side) {
    case "left":
      entryPoint = { x: blueDoorPos.x , y: blueDoorPos.y };
      exitPoint = { x: blueDoorPos.x - 1, y: blueDoorPos.y };
      break;
    case "right":
      entryPoint = { x: blueDoorPos.x - 1, y: blueDoorPos.y };
      exitPoint = { x: blueDoorPos.x, y: blueDoorPos.y };
      break;
    case "top":
      entryPoint = { x: blueDoorPos.x, y: blueDoorPos.y };
      exitPoint = { x: blueDoorPos.x, y: blueDoorPos.y - 1 };
      break;
    case "bottom":
      entryPoint = { x: blueDoorPos.x, y: blueDoorPos.y - 1};
      exitPoint = { x: blueDoorPos.x, y: blueDoorPos.y };
      break;
  }

  // Store entry and exit points for the specific subgrid
  allEntryPoints[subgridIndex] = [entryPoint];
  allExitPoints[subgridIndex] = [exitPoint];
}

// Shuffle doors for a specific subgrid, update the entry and exit points for that subgrid only
function shuffleDoors(subgridIndex) {
  // Clear existing doors in the container
  console.log("door shuffled");
  document.querySelectorAll(`.practice-door[data-subgrid-index="${subgridIndex}"]`).forEach(door => door.remove());
  // Shuffle door colors
  const shuffledColors = [...doorColors].sort(() => Math.random() - 0.5);

  // Define door positions for the subgrid
  const doorPositions = [
    { side: "left", position: { x: SUBGRIDS[subgridIndex].start[0], y: (SUBGRIDS[subgridIndex].start[1] + SUBGRIDS[subgridIndex].end[1]) / 2 } },
    { side: "right", position: { x: SUBGRIDS[subgridIndex].end[0] + 1, y: (SUBGRIDS[subgridIndex].start[1] + SUBGRIDS[subgridIndex].end[1]) / 2 } },
    { side: "top", position: { x: (SUBGRIDS[subgridIndex].start[0] + SUBGRIDS[subgridIndex].end[0]) / 2, y: SUBGRIDS[subgridIndex].start[1]} },
    { side: "bottom", position: { x: (SUBGRIDS[subgridIndex].start[0] + SUBGRIDS[subgridIndex].end[0]) / 2, y: SUBGRIDS[subgridIndex].end[1] + 1 } }
  ];

  // Loop through the door positions and assign colors
  doorPositions.forEach((door, index) => {
    const color = shuffledColors[index];

    // Create a door element and style it
    const doorElement = document.createElement("div");
    doorElement.classList.add("practice-door");
    doorElement.style.backgroundColor = color;
    doorElement.setAttribute("data-color", color);
    doorElement.setAttribute("data-subgrid-index", subgridIndex);

    // Door dimensions based on orientation
    if (door.side === "left" || door.side === "right") {
      doorElement.style.width = "5px";
      doorElement.style.height = "32px"; // Vertical doors
    } else {
      doorElement.style.width = "32px";
      doorElement.style.height = "5px"; // Horizontal doors
    }

    // Apply position with slight offsets for centering
    doorElement.style.top = `${door.position.y * 32 + (door.side === "top" ? -2 : (door.side === "bottom" ? -2.5 : 0))}px`;
    doorElement.style.left = `${door.position.x * 32 + (door.side === "left" ? -2 : (door.side === "right" ? -2.5 : 0))}px`;

    // Add the door to the container
    document.getElementById("practiceGameContainer").appendChild(doorElement);

    // Update entry and exit points if the door is blue
    if (color === "orange") {
      blueDoorPositions[subgridIndex] = door.position;
      calculateEntryExitPointsForSubgrid(subgridIndex, door.position, door.side);
    }
  });
}

// Update movePracticePlayer to use allEntryPoints and allExitPoints
function movePracticePlayer(event, player) {
  let oldX = player.x;
  let oldY = player.y;
  let newX = player.x;
  let newY = player.y;

  // Determine the new position based on arrow key input
  switch (event.key) {
    case "ArrowUp": newY = Math.max(0, player.y - 1); break;
    case "ArrowDown": newY = Math.min(GRID_HEIGHT - 1, player.y + 1); break;
    case "ArrowLeft": newX = Math.max(0, player.x - 1); break;
    case "ArrowRight": newX = Math.min(GRID_WIDTH - 1, player.x + 1); break;
  }

  console.log(`Attempting to move to: (${newX}, ${newY})`);

  // Check if the player is trying to enter a subgrid from any valid blue door
  const isEnteringFromDoor = allEntryPoints.some(points => points.some(point => newX === point.x && newY === point.y));

  // Identify which subgrid the player is entering
  const subgridIndex = SUBGRIDS.findIndex(subgrid =>
    newX >= subgrid.start[0] && newX <= subgrid.end[0] &&
    newY >= subgrid.start[1] && newY <= subgrid.end[1]
  );

  if (isEnteringFromDoor && subgridIndex !== -1 && instructionStep === 2) {
    console.log(`Entering from door at: (${newX}, ${newY})`);
    instructionStep = 3;
    document.getElementById("nextBtn").style.visibility = "visible";
  }

  if (isEnteringFromDoor && subgridIndex === 3 && instructionStep === 3) {
    console.log(`Entering from door at subgrid 3`);
    instructionStep = 4;
    document.getElementById("nextBtn").style.visibility = "visible";
  }

  // Check if the player is within any of the subgrid areas
  const isInsideSubgrid = insideSubgrids.some(subgrid =>
    oldX >= subgrid.startX && oldX <= subgrid.endX &&
    oldY >= subgrid.startY && oldY <= subgrid.endY
  );

  if (isEnteringFromDoor && subgridIndex !== -1 && !isInsideSubgrid) {
    shuffleDoors(subgridIndex);
  }


  const isMovingWithinSubgrid = insideSubgrids.some(subgrid =>
    newX >= subgrid.startX && newX <= subgrid.endX &&
    newY >= subgrid.startY && newY <= subgrid.endY
  );

  const isExitingThroughDoor = allExitPoints.some(points => points.some(point => newX === point.x && newY === point.y));

  const isAttemptingInvalidEntry = !isInsideSubgrid && isMovingWithinSubgrid && !isEnteringFromDoor;
  const isAttemptingInvalidExit = isInsideSubgrid && !isMovingWithinSubgrid && !isExitingThroughDoor;

  if (isAttemptingInvalidEntry) {
    console.log(`Blocked entry attempt to subgrid at position: (${newX}, ${newY})`);
  } else if (isAttemptingInvalidExit) {
    console.log(`Blocked exit attempt from subgrid at position: (${newX}, ${newY})`);
  } else {
    // Allow movement if the conditions are met
    console.log(`Move allowed to position: (${newX}, ${newY})`);
    player.x = newX;
    player.y = newY;
    updatePracticePlayerPosition(player);
  }
}



// Check if player collects a token
function checkForTokenCollection(player) {
  const coins = document.querySelectorAll(".practice-coin");
  for (let coin of coins) {
    const coinX = Math.round(parseInt(coin.style.left) / 32);
    const coinY = Math.round(parseInt(coin.style.top) / 32);

    console.log(`Checking coin at (${coinX}, ${coinY}) against player at (${player.x}, ${player.y})`);


    // Check if player's position matches the coin's position
    if (player.x === coinX && player.y === coinY) {
      coin.remove(); // Remove collected coin
      console.log(`Collected coin at (${coinX}, ${coinY})`);
      return true;
    }
  }
  return false;
}

let yellowDirection;

const yellowPaths = {
  Left: [[13, 0], [12, 0], [11, 0], [10, 0], [9, 0], [9, 1], [9, 2], [9, 3], [10, 3], [11, 3], [12, 3]],
  Right: [[13, 0], [13, 1], [13, 2], [13, 3],[12, 3], [11, 3], [10, 3]],
  Up: [[13, 0], [12, 0], [11, 0], [11, 1], [11, 2], [11, 3], [11, 4]],
  Down: [[13, 0], [13, 1], [13, 2], [13, 3], [13, 4], [13, 5], [12, 5], [11, 5], [11, 4], [11, 3], [11, 2]]
};

function getYellowDoorInTopRightSubgrid() {
  const yellowDoor = document.querySelector(`.practice-door[data-subgrid-index="2"][data-color="#61c96f"]`);
  return yellowDoor ? { x: parseInt(yellowDoor.style.left) / 32, y: parseInt(yellowDoor.style.top) / 32 } : null;
}

function placeYellowTokens() {
  const yellowDoorPos = getYellowDoorInTopRightSubgrid();

  if (!yellowDoorPos) return;

  const container = document.getElementById("practiceGameContainer");
  const tokenPositions = [];
  const yPos = Math.floor(Number(yellowDoorPos.y));


  if (yPos === SUBGRIDS[2].start[1] - 1 || yPos === SUBGRIDS[2].end[1]) {
    if(yPos === SUBGRIDS[2].start[1] - 1 ){
      yellowDirection = "Up";
    }else{
      yellowDirection = "Down";
    }
        // Left or right door: place tokens in the middle row
    tokenPositions.push({ x: yellowDoorPos.x, y: SUBGRIDS[2].start[1] });
    tokenPositions.push({ x: yellowDoorPos.x, y: SUBGRIDS[2].start[1] + 1 });
    tokenPositions.push({ x: yellowDoorPos.x, y: SUBGRIDS[2].start[1] + 2 });
  } else {
    // Left or right door: place tokens in the middle row
    if(Math.floor(yellowDoorPos.x) === SUBGRIDS[2].end[0] ){
      yellowDirection = "Right";
    }else{
      yellowDirection = "Left";
    }
    tokenPositions.push({ x: SUBGRIDS[2].start[0], y: yellowDoorPos.y });
    tokenPositions.push({ x: SUBGRIDS[2].start[0] + 1, y: yellowDoorPos.y });
    tokenPositions.push({ x: SUBGRIDS[2].start[0] + 2, y: yellowDoorPos.y });
  }

  tokenPositions.forEach(pos => {
    const coin = document.createElement("div");
    coin.classList.add("practice-coin-yellow");
    coin.style.top = `${pos.y * 32 + 4}px`;
    coin.style.left = `${pos.x * 32 + 4}px`;
    container.appendChild(coin);
  });
}

function moveYellowPlayer(direction) {
  const path = yellowPaths[direction]; // Get the path based on the direction
  let step = 0;

  const yellowPlayerElement = document.querySelector('.practice-yellow-player');

  // Function to move to the next step in the path
  function moveStep() {
    if (step < path.length) {
      const [x, y] = path[step];

      // Update the yellow player's position
      yellowPlayerElement.style.left = `${x * 32}px`;
      yellowPlayerElement.style.top = `${y * 32}px`;
      if(direction === "Up" && x == 11 && y == 2){
        shuffleDoors(2);
      }else if(direction === "Down" && x == 11 && y == 4){
        shuffleDoors(2);

      }else if(direction === "Left" && x == 10 && y == 3){
        shuffleDoors(2);
      }else if(direction === "Right" && x == 10 && y == 1){

        shuffleDoors(2);
      }

      const coins = document.querySelectorAll(".practice-coin-yellow");
      for (let coin of coins) {
        const coinX = Math.round(parseInt(coin.style.left) / 32);
        const coinY = Math.round(parseInt(coin.style.top) / 32);
    
        console.log(`Checking coin at (${coinX}, ${coinY}) against player at (${x}, ${y})`);
    
    
        // Check if player's position matches the coin's position
        if (x === coinX && y === coinY) {
          coin.remove(); // Remove collected coin
          console.log(`Collected coin at (${coinX}, ${coinY})`);
          return true;
        }
      }

      step++; // Move to the next step in the path

      if(step == path.length - 1){
        document.getElementById("nextBtn").style.visibility = "visible";
      }
    } else {
      // Stop the interval when the path is complete
      clearInterval(movementInterval);
    }
  }

  // Start moving along the path with a 300ms interval (adjust as needed)
  const movementInterval = setInterval(moveStep, 300);
}




let offsetY = 1;

let mapData = {
  minX: 1,
  maxX: 19,
  minY: 1,
  maxY: 19,
  blockedSpaces: {  },
};

let trapSchedule = {};

let sequenceObject = {};
let colorObject = {};

let roundCounter = 1;

let subgridPositions = [
  { xStart: 3, xEnd: 5, yStart: 3, yEnd: 5 },
  { xStart: 9, xEnd: 11, yStart: 3, yEnd: 5 },
  { xStart: 15, xEnd: 17, yStart: 3, yEnd: 5 },
  { xStart: 3, xEnd: 5, yStart: 9, yEnd: 11 },
  { xStart: 15, xEnd: 17, yStart: 9, yEnd: 11 },
  { xStart: 3, xEnd: 5, yStart: 15, yEnd: 17 },
  { xStart: 9, xEnd: 11, yStart: 15, yEnd: 17 },
  { xStart: 15, xEnd: 17, yStart: 15, yEnd: 17 },
];

// const initialGrid = [
//   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0],
//   [0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0],
//   [0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0],
//   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
//   [0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
//   [0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
//   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   [0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0],
//   [0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0],
//   [0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0],
//   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
// ];


const initialGrid = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0],
  [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  [0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0],
  [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  [0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0],
  [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  [0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
];

let robotX = 0;
let robotY = 0;

let exitPointAdded = false;

let isPathBeingFollowed = false; 

const easystar = new EasyStar.js();

let currentIndex = 0;

let timeToSave = false;

function updateGridWalkability(state, subgridIndex) {
  let walkableGrid;

  if (state === "transition") {
    // Use the initial grid for the transition state
    walkableGrid = initialGrid;
  } else if (state === "collection" && subgridIndex !== null) {
    // Clone the initial grid as the base
    walkableGrid = JSON.parse(JSON.stringify(initialGrid));

    // Overlay the subGrid template on the target subgrid
    const subGrid = [
      [1, 1, 0, 1, 1],
      [1, 0, 0, 0, 1],
      [0, 0, 0, 0, 0],
      [1, 0, 0, 0, 1],
      [1, 1, 0, 1, 1],
    ];

    const subgrid = subgridPositions[subgridIndex];
    const { xStart, yStart } = subgrid;

    for (let x = 0; x < subGrid.length; x++) {
      for (let y = 0; y < subGrid[x].length; y++) {
        // Calculate corresponding position in the main grid
        const gridX = xStart - 2 + x; // Offset by -1 for 0-based indexing
        const gridY = yStart - 2 + y;

        // Ensure within bounds of the main grid
        if (
          gridX >= 0 &&
          gridX < walkableGrid[0].length &&
          gridY >= 0 &&
          gridY < walkableGrid.length
        ) {
          walkableGrid[gridY][gridX] = subGrid[y][x];
        }
      }
    }
  }

  console.log(`The grid is like:`, walkableGrid);

  // Update EasyStar grid
  easystar.setGrid(walkableGrid);
}


function getRobotDoorSide(subgridIndex) {
  // Find the door for the given subgridIndex
  const door = robotDoors.find(door => door.subgridIndex === subgridIndex);

  if (!door) {
    console.log(`No robot door found for subgrid ${subgridIndex}`);
    return null;
  }

  return door.side; 
}

function getRobotDoorEntryPoint(subgridIndex) {
  // Find the side of the robot door for the given subgridIndex
  const side = getRobotDoorSide(subgridIndex);
  if (!side) {
    console.log(`Could not determine the side for subgrid ${subgridIndex}`);
    return null;
  }

  // Get the subgrid boundaries
  const subgrid = subgridPositions[subgridIndex];
  const { xStart, yStart } = subgrid;

  let entryPoint = {};

  // Calculate the entry point based on the side
  switch (side) {
    case "top":
      entryPoint = { x: xStart, y: yStart - 2 }; // Top entry point
      break;

    case "left":
      entryPoint = { x: xStart - 2, y: yStart }; // Left entry point
      break;

    case "right":
      entryPoint = { x: xStart + 2, y: yStart }; // Right entry point
      break;

    case "bottom":
      entryPoint = { x: xStart, y: yStart + 2 }; // Bottom entry point
      break;

    default:
      console.log("Invalid side:", side);
      return null;
  }

  return entryPoint;
}


function startRobotMovement() {
  // Run the movement loop every 500ms
  movementInterval = setInterval(() => {
    if (isPathBeingFollowed && currentPath.length > 0 && currentStep < currentPath.length) {
      // Get the next position in the path
      const { x: nextX, y: nextY } = currentPath[currentStep] || { x: robotX, y: robotY };

      // Calculate movement deltas
      const xChange = nextX - robotX;
      const yChange = nextY - robotY;

      // Use handleArrowPress to update the robot's position
      handleArrowPress(xChange, yChange, "robotPlayer");

      // Update global robot position
      robotX = nextX;
      robotY = nextY;

      //console.log(`Robot moved to (${robotX}, ${robotY})`);

      currentStep++;

      // If the path is complete
      if (currentStep >= currentPath.length) {
        isPathBeingFollowed = false; // Path completed
        if(timeToSave === true && currentIndex == 0){
          robotState = 'savingOne';
        }
        handleStateChange(); // Trigger the next state
      }
    }else if (!isPathBeingFollowed && robotX == 0 && robotY == 0) {
      // If no path is currently being followed, trigger a state change
      console.log("No path being followed. Triggering state change...");
      handleStateChange();
    }
  }, 500); // Move every 500ms
}


function handleStateChange() {
  if (isPathBeingFollowed) {
    return; // Don't process a new state if a path is being followed
  }
  if (robotState === "transition") {
    updateGridWalkability("transition", robotSubgrid - 1);
    // Transition state: move to the nearest door of the current subgrid
    const nearestDoor = getRobotDoorEntryPoint(robotSubgrid - 1);

    moveToTarget(nearestDoor, "collection");
    exitPointAdded = false;
    if(robotCoinPositions.length > 0){
      oldRobotCoinPositions = robotCoinPositions;
      robotCoinPositions = [];
    }
    oldRobotSugrid = robotSubgrid;
    updateGridWalkability("collection", robotSubgrid - 1);
  } else if (robotState === "collection") {
    // Collection state: process all tokens in the current subgrid
    if (currentIndex < 4) {

      console.log("current index is", currentIndex);
      console.log("current target is", oldRobotCoinPositions[currentIndex].x - 1, oldRobotCoinPositions[currentIndex].y - 1);

      if(currentIndex + 1 == 4){
        robotState = "transition";
        moveToTarget({ x: oldRobotCoinPositions[currentIndex].x, y: oldRobotCoinPositions[currentIndex].y }, "transition");
        currentIndex = 0;
      }else{
        // Move to the first token in the list
        moveToTarget({ x: oldRobotCoinPositions[currentIndex].x - 1, y: oldRobotCoinPositions[currentIndex].y - 1 }, "collection");
        currentIndex++;
      }

      if(!exitPointAdded && currentIndex == 3){
          const exitPoint = getRobotDoorEntryPoint(oldRobotSugrid - 1);
          oldRobotCoinPositions.push({ x: exitPoint.x, y: exitPoint.y });
          exitPointAdded = true; 
          console.log("Added exit point to oldRobotCoinPositions:", exitPoint);

      }
      console.log("Current oldRobotCoinPositions:", JSON.stringify(oldRobotCoinPositions));

    }
  }else if(robotState == 'savingOne'){
    updateGridWalkability("transition", trappedIndex);
    // Transition state: move to the nearest door of the current subgrid
    const nearestDoor = getRobotDoorEntryPoint(trappedIndex);
    let robotDoorSide = getRobotDoorSide(trappedIndex);
    switch (robotDoorSide) {
      case "bottom":
        nearestDoor.y -= 1;
        break;
    
      case "left":
        nearestDoor.x += 1;
        break;
    
      case "right":
        nearestDoor.x -= 1;
        break;
    
      case "top":
        nearestDoor.y += 1;
        break;
    
      default:
        console.log("Unknown door side:", nearestDoor.side);
        break;
    }
    moveToTarget({ x: nearestDoor.x, y: nearestDoor.y }, "savingTwo");
    robotState = "savingTwo";
    exitPointAdded = false;
    timeToSave = 'blue';
    oldRobotSugrid = robotSubgrid;
    updateGridWalkability("collection", trappedIndex);
  }else if(robotState == "savingTwo"){
      const exitPoint = getRobotDoorEntryPoint(trappedIndex);
      moveToTarget({ x: exitPoint.x, y: exitPoint.y }, "transition");

  }
}

function moveToTarget(target, nextState) {
  console.log("current robot position is", robotX, robotY);
  console.log("moving to", target.x, target.y);
  
  easystar.findPath(robotX, robotY, target.x, target.y, function (path) {
    if (!path || path.length === 0) {
      console.log("Path not found!");
    } else {
      console.log("Path updated:", path);
      currentPath = path; // Update the current path
      currentStep = 0; // Reset the step counter
      isPathBeingFollowed = true; 
      robotState = nextState; // Transition to the next state
    }
  });

  easystar.calculate(); // Trigger EasyStar's pathfinding
}

let door_movements = [];
let forbidden_moves = [];

// Directions for movement: up, down, left, right
const DIRECTIONS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

for (let grid of subgridPositions) {  // Use subgridPositions instead of GRIDS
    let top_middle = [grid['xStart'], grid['yStart'] + 1];
    let bottom_middle = [grid['xEnd'], grid['yEnd'] - 1];
    let left_middle = [grid['xStart'] + 1, grid['yStart']];
    let right_middle = [grid['xEnd'] - 1, grid['yEnd']];

    // Top middle entering and exiting
    door_movements.push([[top_middle[0] - 1, top_middle[1]], top_middle]);  // Entering
    door_movements.push([top_middle, [top_middle[0] - 1, top_middle[1]]]);  // Exiting

    // Bottom middle entering and exiting
    door_movements.push([[bottom_middle[0] + 1, bottom_middle[1]], bottom_middle]);  // Entering
    door_movements.push([bottom_middle, [bottom_middle[0] + 1, bottom_middle[1]]]);  // Exiting

    // Left middle entering and exiting
    door_movements.push([[left_middle[0], left_middle[1] - 1], left_middle]);  // Entering
    door_movements.push([left_middle, [left_middle[0], left_middle[1] - 1]]);  // Exiting

    // Right middle entering and exiting
    door_movements.push([[right_middle[0], right_middle[1] + 1], right_middle]);  // Entering
    door_movements.push([right_middle, [right_middle[0], right_middle[1] + 1]]);  // Exiting
}

// Populate forbidden_moves
subgridPositions.forEach(grid => {  // Use subgridPositions instead of GRIDS
    let corners = [
        [grid.xStart, grid.yStart],
        [grid.xStart, grid.yEnd],
        [grid.xEnd, grid.yStart],
        [grid.xEnd, grid.yEnd]
    ];

    corners.forEach(corner => {
        DIRECTIONS.forEach(direction => {
            let next_pos = [corner[0] + direction[0], corner[1] + direction[1]];
            if (next_pos[0] < grid.xStart || next_pos[0] > grid.xEnd || 
                next_pos[1] < grid.yStart || next_pos[1] > grid.yEnd) {
                forbidden_moves.push([[corner[0], corner[1]], next_pos].toString());
                forbidden_moves.push([next_pos, [corner[0], corner[1]]].toString());
            }
        });
    });
});

// Deduplicate forbidden moves
forbidden_moves = Array.from(new Set(forbidden_moves));

// Options for Player Colors... these are in the same order as our sprite sheet
//const playerColors = ["blue", "red", "yellow", "purple"];

// const colorMap = {
//   "#00ccff": "blue",
//   "#9370db": "purple",
//   "yellow": "yellow",
//   "orange": "orange"
// };

function getColorName(colorCode) {
  const normalizedCode = colorCode.trim().toLowerCase();  // Normalize input
  console.log(`getColorName called with: "${colorCode}", Normalized: "${normalizedCode}"`);

  if(normalizedCode ===  "#00ccff"){
    //console.log('Match found: blue');
    return "blue";
  }else if(normalizedCode === "#9370db"){
    //console.log('Match found: purple');
    return "purple";
  }else if(normalizedCode === "#ff746c"){
    //console.log('Match found: purple');
    return "red";
  }else{
    return colorCode; 
  }
}

// Normalize and match the name back to the color code
function getColorCode(colorName) {
  const normalizedName = colorName.trim().toLowerCase();  // Normalize input
  //console.log(`getColorCode called with: "${colorName}", Normalized: "${normalizedName}"`);

  // Match the color name to the code using the colorMap
  let code;
  switch (normalizedName) {
    case "blue":
      code = "#00ccff";
      break;
    case "purple":
      code = "#9370db";
      break;
    case "yellow":
      code = "yellow";  // Example if stored as a string name
      break;
    case "red":
      code = "#ff746c";  // Example if stored as a string name
      break;
    default:
      code = colorName;  // Return original name if no match found
  }

  //console.log(`Result for getColorCode: ${code}`);
  return code;
}

let playerId;
let playerRef;
let players = {};
let playerElements = {};
let coins = {};
let coinElements = {};
let hasEnded = false;
let roundTime = 150;  // 90 seconds per round
let breakTime = 10;   // 5-second break between rounds
let roundInterval = null; // To store the round timer interval
let isBreakTime = false; 
let timeLeft = roundTime;
let timerInterval;

let introColor;
let introName;

let currentRound = 0;
let trapTime = 50; 
let trapFlag = false;

let totalRounds = 4;

let trappedIndex = 1;

let trappedPlayer;

let arrivalIndex;

let playerSequence = 'test';

let robotHere = true;

let robotId  = 'robotPlayer';

let robotColor = 'test';

let robotSubgrid;

let oldRobotSugrid;

let robotCoinPositions = []; 

let oldRobotCoinPositions = [];

let robotDoors = [];

let movementInterval = null; // Store the interval ID
let currentPath = []; // Store the robot's current path
let currentStep = 0; 

let robotState = "transition";

function getPlayerStartingPosition() {
  //const playerColor = introColor; // Get the player's color

  // Define starting positions based on color
  const startingPositions = {
    4: { x: mapData.minX, y: mapData.minY },          // Top-left for blue
    3: { x: mapData.maxX, y: mapData.minY },           // Top-right for red
    2: { x: mapData.minX, y: mapData.maxY },        // Bottom-left for yellow
    1: { x: mapData.maxX, y: mapData.maxY }         // Bottom-right for purple
  };

  // Return the starting position based on the player's color
  return startingPositions[arrivalIndex] || { x: mapData.minX, y: mapData.minY }; // Default to blue if color is not recognized
}

// Function to start the round timer
function startRoundTimer() {
  timeLeft = roundTime; // Reset the time left at the beginning of each round
  updateTimerDisplay(timeLeft); // Initial display update

  // Clear any existing timer interval to avoid duplicates
  if (timerInterval) clearInterval(timerInterval);

  // Start a new timer interval
  timerInterval = setInterval(() => {
    timeLeft--; // Decrease the time left by 1 second
    updateTimerDisplay(timeLeft);

    if (timeLeft <= 0) {
      clearInterval(timerInterval); // Stop the timer when time is up
    }
  }, 1000); // Update every second
}

// Function to update the timer display
function updateTimerDisplay(seconds) {
  const timerElement = document.getElementById("round-timer");
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  timerElement.textContent = `Time Left For This Round: ${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function startNewRound() {
  console.log("Starting a new round...");
  isBreakTime = false;
  resetCoinsAndDoors();
  document.getElementById('breakOverlay').style.visibility = 'hidden'; 
  //messageGame.innerText = "Round Started! Collect coins!";

  currentRound = currentRound + 1;
  trapFlag  = false;

  if(currentRound == 1 && robotHere && arrivalIndex == 1){
    startRobotMovement();
  }

  if (currentRound <= totalRounds) {
    roundInterval = setTimeout(endRound, roundTime * 1000);  // End the round after 90 seconds
    setTimeout(() => {
      trapFlag = true;
      console.log("its ok to trap the player now!");
      // Add any additional logic to handle trapping, such as removing doors
  }, trapTime * 1000);
  }else{
    //endSession();
  }


}

function endRound() {
  isBreakTime = true;
  if(currentRound + 1 > totalRounds){
    document.querySelector('.player-info-panel').style.display = 'none';
    document.querySelector('.timer-container').style.display = 'none';
    leaveSession();
    return;
  }
  document.querySelector('.player-info-panel').style.display = 'none';
  document.querySelector('.timer-container').style.display = 'none';
  //messageGame.innerText = "Round ended. Next round starts in 5 seconds...";

  document.getElementById('roundTitle').innerText = "Round Ended";
  //document.getElementById('roundMessage').innerText = `Next round starts in 5 seconds...\nYou are ${introName}, and you can only collect ${introColor} tokens and go through ${introColor} doors.`;

  const spritePositions = {
    blue: '0px 0px',      // Adjust these values based on your sprite sheet
    yellow: '0px -48px',  // Example position for yellow
    purple: '0px -80px',     // Example position for red
    red: '0px -16px'    // Example position for green
  };

  const avatarPosition = spritePositions[introColor.toLowerCase()];

  const avatarDiv = document.createElement('div');
  avatarDiv.classList.add('player-avatar');
  avatarDiv.style.background = `url('./images/characters.png') no-repeat ${avatarPosition}`;
  avatarDiv.style.width = '16px'; // Adjust to match your sprite size
  avatarDiv.style.height = '16px';
  avatarDiv.style.display = 'inline-block'; // Ensure the avatar is displayed inline

  const roundMessage = document.getElementById('roundMessage');
  roundMessage.innerHTML = ''; // Clear previous content

    // Create the first part of the text
  const textBeforeAvatar = document.createElement('span');
  textBeforeAvatar.innerText = `You are ${introName} `; // Space added after the name

  //textBeforeAvatar.innerText = `You are `; // Space added after the name

  // Create the second part of the text
  const textAfterAvatar = document.createElement('span');
  textAfterAvatar.innerText = `, and you can only collect ${introColor} tokens and go through ${introColor} doors.`;

  if (currentRound >= 1) {
    const roundCompletionMessage = document.createElement('p');
    roundCompletionMessage.innerText = `This completes round ${currentRound} of 4. Waiting 10 seconds before starting the next round.`;
    roundMessage.appendChild(roundCompletionMessage);
  }

  // Append the text and avatar in order
  roundMessage.appendChild(textBeforeAvatar);
  roundMessage.appendChild(avatarDiv);
  roundMessage.appendChild(textAfterAvatar);


  // Show the overlay
  document.getElementById('breakOverlay').style.visibility = 'visible';

  if(currentRound >= 1){
    breakTime = 10;
  }

  updateStateDirect("subgridAssignment", null, 'remove Grid for new Round');
  
  // Start a 5-second break
  setTimeout(() => {
      //messageGame.innerText = "New Round Starting!";
      startNewRound();  // Start the new round after 5 seconds
  }, breakTime * 1000);
}

async function resetCoinsAndDoors() {
  console.log("Resetting coins, doors, and player positions for a new round...");

  // Step 1: Remove all current coins
  console.log("Removing all current coins...");
   // Fetch all current coins
  let allCoins = await readState('coins');

  // Iterate over all coins and remove those that belong to the current player
  for (let coinKey in allCoins) {
    if (allCoins[coinKey].id === playerId) {
      let coinPath = `coins/${coinKey}`;
      await updateStateDirect(coinPath, null, 'removeCoinForNewRound');  // Remove only coins with the matching player ID
    }
  }
  
  coins = {};  // Clear local coin state

  // // Step 2: Move all players to starting position

  let player = players[playerId];
  const { x, y } = getPlayerStartingPosition();

  let startX = x;
  let startY = y;
  console.log(`Moving player ${playerId} to starting position...`);

  // Update player's position to the starting coordinates (1,1)

  placeTokensForPlayer(playerId);

  if(arrivalIndex == 1 && currentRound < 3){
    if(robotHere){
      for (let coinKey in allCoins) {
        if (allCoins[coinKey].id === robotId) {
          let coinPath = `coins/${coinKey}`;
          await updateStateDirect(coinPath, null, 'removeCoinForNewRound');  // Remove only coins with the matching player ID
        }
      }

      let path = `players/${robotId}`;
      let newState = {
        x: 1,
        y: 1,
        oldX: robotX,
        oldY: robotY,
        coins: 0,
        isTrapped: false,
        roundNumber: currentRound,
      };
      updateStateDirect(path, newState, 'resetPlayerState');
      timeToSave = false; 
      console.log("reset for new round", timeToSave);
      updateStateDirect(`timeToSave`, timeToSave, 'reset for new round'); 

      robotX = 0;
      robotY = 0;
      currentStep = 0; 
      currentPath = [];
      currentIndex = 0;
      oldRobotCoinPositions = [];
      robotState = 'transition';
      isPathBeingFollowed = false;
      placeTokensForPlayer(robotId);
    }
  }

  if(currentRound > 2 && robotHere){
    robotHere = false;
    for (let coinKey in allCoins) {
      if (allCoins[coinKey].id === robotId) {
        let coinPath = `coins/${coinKey}`;
        await updateStateDirect(coinPath, null, 'removeCoinForNewRound');  // Remove only coins with the matching player ID
      }
    }
    robotX = 0;
    robotY = 0;
    currentStep = 0; 
    currentPath = [];
    currentIndex = 0;
    oldRobotCoinPositions = [];
    robotState = 'transition';
    isPathBeingFollowed = true;

    let path = `players/${robotId}`;
    let newState = null;
    updateStateDirect( path, newState, 'removePlayer');
  }

    // let player = players[playerId];
    let path = `players/${playerId}`;
    let newState = {
      ...player,
      x: startX,
      y: startY,
      oldX: player.x,
      oldY: player.y,
      coins: 0,
      isTrapped: false,
      roundNumber: currentRound,
    };
    await updateStateDirect(path, newState, 'resetPlayerState');

  // Step 4: Reset doors
  console.log("Resetting doors for all subgrids...");

  if(arrivalIndex ===1){
    await shuffleAndRedrawDoors(trappedIndex);
    placeDoorsForAllSubgrids(); 
  }
  trappedPlayer = null; // Place new doors
  if(currentRound > 1){
    await updateStateDirect("subgridAssignment/trapped", null, 'remove trappedGrid for new Round');
    await updateStateDirect("trappedPlayer", null, 'remove trapped Player for new Round');
  }
  fetchAndPopulatePlayerInfo();
  startRoundTimer(); 
  document.querySelector('.player-info-panel').style.display = 'block';
  document.querySelector('.timer-container').style.display = 'block';

}

async function initRounds() {
  console.log("Initializing Rounds...");

  gameScreen.style.display = 'block';
  document.getElementById('roundTitle').innerText = "Current Round will start soon!";
  //document.getElementById('roundMessage').innerText = `You are ${introName}, and you can only collect ${introColor} tokens and go through ${introColor} doors.`;

  const spritePositions = {
    blue: '0px 0px',      // Adjust these values based on your sprite sheet
    yellow: '0px -48px',  // Example position for yellow
    purple: '0px -80px',     // Example position for red
    red: '0px -16px'    // Example position for green
  };

  const avatarPosition = spritePositions[introColor.toLowerCase()];

  const avatarDiv = document.createElement('div');
  avatarDiv.classList.add('player-avatar');
  avatarDiv.style.background = `url('./images/characters.png') no-repeat ${avatarPosition}`;
  avatarDiv.style.width = '16px'; // Adjust to match your sprite size
  avatarDiv.style.height = '16px';
  avatarDiv.style.display = 'inline-block'; // Ensure the avatar is displayed inline

  const roundMessage = document.getElementById('roundMessage');
  roundMessage.innerHTML = ''; // Clear previous content

    // Create the first part of the text
  const textBeforeAvatar = document.createElement('span');
  textBeforeAvatar.innerText = `You are ${introName} `; // Space added after the name
  //textBeforeAvatar.innerText = `You are `; 
  // Create the second part of the text
  const textAfterAvatar = document.createElement('span');
  textAfterAvatar.innerText = `, and you can only collect ${introColor} tokens and go through ${introColor} doors.`;

  // Append the text and avatar in order
  roundMessage.appendChild(textBeforeAvatar);
  roundMessage.appendChild(avatarDiv);
  roundMessage.appendChild(textAfterAvatar);

  // if (robotHere) {
  //   const spritePositions = {
  //     blue: '0px 0px',      // Adjust these values based on your sprite sheet
  //     yellow: '0px -80px',  // Example position for yellow
  //     purple: '0px -300px',     // Example position for red
  //     red: '0px -60px'    // Example position for green
  //   };
  
  //   const robotAvatarPosition = spritePositions[robotColor.toLowerCase()];
  //   // Create the robot avatar
  //   const robotAvatarDiv = document.createElement('div');
  //   robotAvatarDiv.classList.add('player-avatar', 'robot-avatar'); // Use a different class for robot avatar
  //   robotAvatarDiv.style.background = `url('./images/robot.png') no-repeat ${robotAvatarPosition}`; // Robot sprite sheet
  //   robotAvatarDiv.style.width = '16px'; // Match size to player avatar
  //   robotAvatarDiv.style.height = '16px';
  //   robotAvatarDiv.style.display = 'inline-block';

  //   const robotMessageBefore = document.createElement('span');
  //   robotMessageBefore.innerText = `A robot will also join the game. It looks like this `;

  //   // Create the robot message
  //   const robotMessage = document.createElement('span');
  //   robotMessage.innerText = ` The robot collects ${robotColor} tokens and goes through ${robotColor} doors. `;
  
  //   // Append the robot's avatar and message
  //   roundMessage.appendChild(robotMessageBefore);
  //   roundMessage.appendChild(robotAvatarDiv);
  //   roundMessage.appendChild(robotMessage);
  // }


  document.getElementById('breakOverlay').style.visibility = 'visible';
  setTimeout(startNewRound, 5000);  // Give players 5 seconds to get ready before the first round
}



// -------------------------------------
//       Event Listeners
// -------------------------------------
// Buttons
let joinButton = document.getElementById('joinBtn');
// let leaveButton = document.getElementById('leaveBtn');

// Add event listeners to the buttons
joinButton.addEventListener('click', function () {
    joinSession(); // call the library function to attempt to join a session, this results either in starting a session directly or starting a waiting room
});

// leaveButton.addEventListener('click', function () {
//     leaveSession(); // call the library function to leave a session. This then triggers the local function endSession
// });

class KeyPressListener {
  constructor(keyCode, callback) {
    this.keyCode = keyCode;
    this.callback = callback;
    this.keydownFunction = this.keydownFunction.bind(this);
    this.keyupFunction = this.keyupFunction.bind(this);

    document.addEventListener("keydown", this.keydownFunction);
    document.addEventListener("keyup", this.keyupFunction);
  }

  keydownFunction(event) {
    if (event.code === this.keyCode && activeKey === null) {
      activeKey = this.keyCode;
      this.callback();
    }
  }

  keyupFunction(event) {
    if (event.code === this.keyCode) {
      activeKey = null;
    }
  }

  unbind() {
    document.removeEventListener("keydown", this.keydownFunction);
    document.removeEventListener("keyup", this.keyupFunction);
  }
}

let activeKey = null;
  
// Declare the key listeners and store them in variables
let arrowUpListener;
let arrowDownListener;
let arrowLeftListener;
let arrowRightListener;

// -------------------------------------
//       Game Specific Code
// -------------------------------------
//Misc Helpers
// Function to fetch all player data and update the player list
async function fetchAndPopulatePlayerInfo() {
  try {
    // Assume you have a readState function that fetches all players' data from Firebase
    const allPlayersData = await readState('players');

    // Get the current player's ID and data
    const currentPlayerId = getCurrentPlayerId();
    const currentPlayerData = allPlayersData[currentPlayerId];
    const introColor = currentPlayerData.color; // Get the color for the current player

    // Create the intro message
    const introMessage = `You can only collect ${introColor} tokens and go through ${introColor} doors\n        `;

    // Update the player info panel with the message
    updatePlayerList(Object.keys(allPlayersData).map(playerId => {
      const player = allPlayersData[playerId];
      return {
        id: playerId,
        name: player.name || `Player ${playerId}`,
        color: player.color,
        coins: player.coins || 0
      };
    }), introMessage);

  } catch (error) {
    console.error('Failed to fetch player data:', error);
  }
}

// Updated updatePlayerList function to accept an intro message
function updatePlayerList(players, introMessage) {
  const playerList = document.getElementById('player-list');
  playerList.innerHTML = ''; // Clear the current list

  // Add the intro message at the top of the player list
  const introMessageElement = document.createElement('div');
  introMessageElement.classList.add('intro-message');
  introMessageElement.textContent = introMessage;
  playerList.appendChild(introMessageElement);

  // Get the current player's ID
  const currentPlayerId = getCurrentPlayerId();

  players.forEach(player => {
    // Create a list item for each player
    const playerItem = document.createElement('li');
    playerItem.classList.add('player-item');

    // Create avatar
    const avatarContainer = document.createElement('div');
    avatarContainer.classList.add('player-avatar-container');

    const avatar = document.createElement('div');
    avatar.classList.add('player-avatar', 'Character_sprite');
    // avatar.style.backgroundPositionY = getPlayerBackgroundPosition(player.color);
        // Check if the player is a robot
    if (player.id === 'robotPlayer') {
      avatar.classList.add('robot-sprite', 'display-board-robot'); // Add the robot sprite class
      avatar.style.backgroundPositionY = getRobotBackgroundPosition(player.color);
    } else {
      avatar.style.backgroundPositionY = getPlayerBackgroundPosition(player.color);
    }
    avatarContainer.appendChild(avatar);
    playerItem.appendChild(avatarContainer);

    // Create player name
    const playerName = document.createElement('span');
    playerName.classList.add('player-name');
    playerName.textContent = player.name;

    // Add "(You)" and color only for the current player
    if (player.id === currentPlayerId) {
      const youLabel = document.createElement('span');
      youLabel.classList.add('you-label');
      youLabel.textContent = ' (You)';
      playerName.style.color = introColor; // Set color only for the current player
      playerName.appendChild(youLabel);
    }

    playerItem.appendChild(playerName);

    // Create coin count
    const playerCoins = document.createElement('span');
    playerCoins.classList.add('player-coins');
    playerCoins.textContent = `Coins: ${player.coins}`;
    playerItem.appendChild(playerCoins);

    // Add player item to the list
    playerList.appendChild(playerItem);
  });
}


// Helper function to get the background position for each color
function getPlayerBackgroundPosition(color) {
  switch (color) {
    case 'red': return '-16px';
    case 'blue': return '0px';
    case 'yellow': return '-48px';
    case 'purple': return '-80px';
    // Add more colors if needed
    default: return '0px';
  }
}

function getRobotBackgroundPosition(color) {
  const colorMap = {
    blue: '0px',
    red: '-60px',
    yellow: '-180px',
    purple: '-300px',
  };
  return colorMap[color] || '0px'; // Default to blue if color is not found
}

function randomFromArray(array) {
  return array[Math.floor(Math.random() * array.length)];
}
function getKeyString(x, y) {
  return `${x}x${y}`;
}

// Function to get the first key for a given value
function getFirstKeyForValue(object, valueToMatch) {
  for (let key in object) {
    if (object[key] === valueToMatch) {
      return key; // Return immediately when the first match is found
    }
  }
  return null; // Return null if no match is found
}

function createName() {
  const prefix = randomFromArray([
    "COOL","SUPER","HIP","SMUG","COOL","SILKY","GOOD","SAFE","DEAR","DAMP","WARM","RICH","LONG","DARK","SOFT","BUFF","DOPE",
  ]);
  const animal = randomFromArray([
    "BEAR","DOG","CAT","FOX","LAMB","LION","BOAR","GOAT","VOLE","SEAL","PUMA","MULE","BULL","BIRD","BUG",
  ]);
  return `${prefix} ${animal}`;
}

function isOccupied(x,y) {

  const blockedNextSpace = mapData.blockedSpaces[getKeyString(x, y)];
  return (
    blockedNextSpace ||
    x > mapData.maxX ||
    x < mapData.minX ||
    y > mapData.maxY ||
    y < mapData.minY
  )
}

async function placeTokensForPlayer(playerId) {
  let retries = 5;
  let delay = 100; // Delay between retries in milliseconds

  while (retries > 0) {
    try {
      // Pre-fetch current subgrid assignments, ensure fallback to {}
      let subgridAssignments = await readState('subgridAssignment') || {};
      console.log('Current subgridAssignments:', subgridAssignments);

      // Find the first available subgrid
      let chosenSubgrid = getRandomAvailableSubgrid(subgridAssignments);
      if (!chosenSubgrid) {
        console.error("No available subgrid for assignment.");
        return;
      }

      // Proceed with the transaction
      const transactionSuccess = await updateStateTransaction('subgridAssignment', 'assignSubgrid', {
        playerId: playerId,
        subgrid: chosenSubgrid, // Pass the chosen subgrid directly
      });

      if (transactionSuccess) {
        console.log(`Player ${playerId} successfully assigned to subgrid ${chosenSubgrid}`);
        await placeTokensInSubgrid(playerId, chosenSubgrid);
        if(robotHere){
          if(playerId == 'robotPlayer'){
            robotSubgrid = chosenSubgrid;
          }
        }
        return; //  Exit loop on success
      } else {
        console.warn(`Transaction failed for player ${playerId}, retrying...`);
      }
    } catch (error) {
      console.error(`Error during transaction for player ${playerId}:`, error);
    }

    retries--;
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay *= 2; // Exponential backoff
  }

  console.error(`Failed to assign subgrid to player ${playerId} after retries.`);
}

async function placeTokensInSubgrid(playerId, subgridId) {
  let selectedSubgrid = subgridPositions[subgridId - 1];  // Get the selected subgrid
  let placedPositions = new Set();  // Track placed positions to avoid overlaps

  console.log(`Placing tokens for player ${playerId} in subgrid ${subgridId}`);

  // Place three coins within the selected subgrid
  for (let i = 0; i < 3;) {
    let x = Math.floor(Math.random() * (selectedSubgrid.xEnd - selectedSubgrid.xStart + 1)) + selectedSubgrid.xStart;
    let y = Math.floor(Math.random() * (selectedSubgrid.yEnd - selectedSubgrid.yStart + 1)) + selectedSubgrid.yStart;
    let positionKey = `${x},${y}`;

    // Ensure the position is not occupied and not already used
    if (!isOccupied(x, y) && !placedPositions.has(positionKey)) {
      let id = `coins/${getKeyString(x, y)}`;
      let newState = { x, y, color: players[playerId].color, id: playerId };  // Set coin color to match player

      await updateStateDirect(id, newState, 'placeCoin');  // Save new state in Firebase
      console.log(`Coin placed at (${x}, ${y}) for player ${playerId}`);
      if (playerId === "robotPlayer") {
        robotCoinPositions.push({ x, y });
      }

      placedPositions.add(positionKey);  // Mark this position as used
      i++;  // Only increment after successful placement
    }
  }
}

async function handleCoinCollection(playerId) {
  let player = players[playerId];
  if (!player) return;

  // Fetch the current state of all coins from Firebase
  let currentCoins = await readState('coins');

  // Filter coins associated with the player by their color
  let playerCoins = Object.keys(currentCoins || {}).filter(
    (key) => currentCoins[key] && currentCoins[key].id === playerId
  );

  // Check if all coins for this player are removed
  if (playerCoins.length === 0) {
    // Log that all coins are collected
    console.log(`All coins collected for player ${playerId}. Placing a new group.`);

    // Place a new group of three coins
    await placeTokensForPlayer(playerId);
  }
}

async function getCoinData(key) {
  // Fetch the coin data from the correct path
  let coinData = await readState(`coins/${key}`);

  // // Log the retrieved data to ensure it's correct
  // console.log(`Retrieved Coin Data for ${key}:`, coinData);

  // Return the coin data, ensuring it's an object
  return coinData || {};
}


async function handleArrowPress(xChange = 0, yChange = 0, playerId) {
  const oldX = players[playerId].x;
  const oldY = players[playerId].y;
  const newX = oldX + xChange;
  const newY = oldY + yChange;
  let newDirection = players[playerId].direction;

  const move = [[oldX, oldY], [newX, newY]].toString();
  let canMove = true;

  if (forbidden_moves.includes(move)) {
    //console.log(`Blocked: This is a forbidden (wall) move.`);
    canMove = false;
  } else {
    // Step 2: Check if it's a valid door movement
    const isDoorMovement = door_movements.some(
      allowedMove => allowedMove.toString() === move
    );

    if (isDoorMovement) {
      //console.log(`Detected a door movement. Checking door color...`);

      // Retrieve the door data from Firebase
      canMove = await getDoorAtPosition(newX, newY, players[playerId].color, playerId);
    } else {
      //console.log(`This is not a door movement. Movement allowed.`);
    }
  }
  
  if (
    newX >= 1 &&
    newX <= mapData.maxX &&
    newY >= 1 &&
    newY <= mapData.maxY && canMove
  ) {
    // Move to the next space
    if (xChange === 1) newDirection = "right";
    if (xChange === -1) newDirection = "left";

    // Generate the key to access the coin object
    const key = getKeyString(newX, newY);

    // Retrieve the coin data
    getCoinData(key).then((coin) => {
      // // Log the coin object to verify its structure
      //console.log(`Coin Object:`, coin);

      // Check if the coin object has a color property
      if (coin && coin.color) {
        // Log the colors for debugging
        //console.log(`Coin Color: ${coin.color}, Player Color: ${players[playerId].color}`);

        // Check if the coin's color matches the player's color
        if (coin.color.trim() === players[playerId].color.trim()) {
          // Update the player's coin count only if colors match
          players[playerId].coins = players[playerId].coins + 1;

          // Correct path to remove the coin from the state
          let path = `coins/${key}`;
          let newState = null;
          updateStateDirect(path, newState, 'removeCoin');
          // Handle collection logic, possibly placing new coins
          handleCoinCollection(playerId);
          fetchAndPopulatePlayerInfo();
        } else {
          // Log the failed attempt to collect a mismatched coin
          // console.log(`Player ${playerId} tried to collect a coin of different color.`);
        }
      } else {
        // console.log(`The coin does not have a color property or it is undefined.`);
      }
    }).catch((error) => {
      // console.log(`Error retrieving coin data for ${key}:`, error);
    });

    let player = players[playerId];

    // Broadcast this new player position to the database
    let path = `players/${playerId}`;
    let newState = {
      ...player,
      direction: newDirection,
      oldX: oldX,
      oldY: oldY,
      x: newX,
      y: newY,
      coins: players[playerId].coins,
      roundNumber: currentRound,
      color: players[playerId].color,
    };
    updateStateDirect(path, newState, 'playerMovement');
  }
}

// Helper function to determine the correct filter value based on the color
function getFilterForColor(color) {
  switch (color) {
    case 'blue':
      return 'sepia(1) saturate(4000%) hue-rotate(160deg) brightness(0.7) contrast(2)'; // Blue filter
    case 'red':
      return 'sepia(1) saturate(5000%) hue-rotate(293deg) brightness(0.7) contrast(1.9)';  // Red filter
    case 'yellow':
      return 'sepia(1) saturate(4000%) hue-rotate(2deg) brightness(1.2) contrast(1.1)'; // yellow filter
    case 'purple':
      return 'sepia(1) saturate(27000%) hue-rotate(183deg) brightness(0.6) contrast(2.3)';  // Filter for #8563e0
  }
}

function shuffle(array) {
  let currentIndex = array.length, randomIndex;

  // While there remain elements to shuffle
  while (currentIndex !== 0) {
    // Pick a remaining element
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // Swap it with the current element
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }

  return array;
}

async function getDoorAtPosition(x, y, playerColor, playerId) {
  try {
    const doorsData = await readState("doors");  // Fetch doors data from Firebase
    //console.log("Retrieved doors data:", doorsData);

    // Iterate over each subgrid and door to find the matching door or adjacent door
    for (let subgridIndex in doorsData) {
      const subgridDoors = doorsData[subgridIndex];

      for (let side in subgridDoors) {
        const door = subgridDoors[side];
        const doorColor = door.color;
        const { x: doorX, y: doorY } = door;

        // Debug log: Displaying the door details and side
        //console.log(`Checking door at (${doorX}, ${doorY}) on side "${side}" against player position (${x}, ${y})`);

        // Check matching position based on side
        let isMatch = false;
        let isMainEntry = false;

        switch (side) {
          case "left":
            isMatch = (doorX === x && doorY === y) || (doorX - 1 === x && doorY === y);
            isMainEntry = (doorX === x && doorY === y);
            //console.log(`Left door match: ${isMatch}`);
            break;
          case "right":
            isMatch = (doorX === x && doorY === y) || (doorX + 1 === x && doorY === y);
            isMainEntry = (doorX === x && doorY === y);
            //console.log(`Right door match: ${isMatch}`);
            break;
          case "top":
            isMatch = (doorX === x && doorY === y) || (doorX === x && doorY - 1 === y);
            isMainEntry = (doorX === x && doorY === y);
            //console.log(`Top door match: ${isMatch}`);
            break;
          case "bottom":
            isMatch = (doorX === x && doorY === y) || (doorX === x && doorY + 1 === y);
            isMainEntry = (doorX === x && doorY === y);
            //console.log(`Bottom door match: ${isMatch}`);
            break;
        }

        if (isMatch) {
          //console.log(`Match found! Door at (${doorX}, ${doorY}) with color "${doorColor}"`);

          if (doorColor === playerColor) {
            console.log(`Player color matches the door color! Player can pass.`);

            // If it's a main entry, shuffle the doors
            if (isMainEntry) {

              const isPlayerTrapped = trapSchedule[currentRound]?.includes(playerSequence);
              if(isPlayerTrapped && trapFlag === true && playerId != 'robotPlayer'){
                let player = players[playerId];
                let path = `players/${playerId}`;
                let newState = {
                  ...player,
                  isTrapped: true,
                };
                await updateStateDirect(path, newState, 'trappedPlayer');
                console.log("time to trap this player");
                console.log(players[playerId]);
                subgridDoors[side].color = "grey";  
                await updateStateDirect(`doors/${subgridIndex}`, subgridDoors, 'trappedDoor');  // Update Firebase

                // Step 2: Update the door visually
                renderDoor(doorX, doorY, "grey", side, subgridIndex); 
                trapFlag = 'used';
                trappedIndex = subgridIndex;
                trappedPlayer = playerId;

                let Trappath = `trappedPlayer`;
                let TrappedState = playerId;
                await updateStateDirect(Trappath, TrappedState, 'trappedPlayer');
                let updateIndex = Number(trappedIndex) + 1;
                await updateStateDirect('subgridAssignment/trapped', updateIndex ,'trappedRoom');

                console.log(`Subgrid ${subgridIndex + 1} is now marked as trapped.`);

              }else{
                console.log(`Main entry detected at door (${doorX}, ${doorY}). Shuffling doors for subgrid ${subgridIndex}.`);
                if(trappedPlayer === null && trapFlag === true){
                  trappedIndex = await readState("subgridAssignment/trapped");
                  trappedIndex = Number(trappedIndex) - 1;
                  trappedPlayer = await readState('trappedPlayer');
                  if(trappedPlayer !== null){
                    trapFlag = 'used';
                  }
                }
                if (Number(subgridIndex) ===  Number(trappedIndex) && trapFlag === 'used' && trappedPlayer != null) {

                  let stillTrapped = await readState('trappedPlayer');
                  if(stillTrapped != null){
                    console.log(`Conditions met for freeing subgrid ${subgridIndex + 1}.`);
                    //let subgridAssignments = await readState('subgridAssignment');
                    // delete subgridAssignments['trapped'];
                    // Use update() if you want to update a specific field
                    await updateStateDirect(`players/${trappedPlayer}`, {
                    isTrapped: false, roundNumber: currentRound,
                    }, 'freePlayer');
                    await updateStateDirect("subgridAssignment/trapped", null, 'remove trappedGrid');
                    await updateStateDirect("trappedPlayer", null, 'remove trapped Player');
                    console.log(`Deleted 'trapped' entry from subgridAssignment.`);

                  }
                  trapFlag = false;
                  }
                  if (playerId === "robotPlayer") {
                    // Always shuffle when the robot enters any subgrid
                    console.log(`Robot entered subgrid ${subgridIndex}. Shuffling doors.`);
                    await shuffleAndRedrawDoors(subgridIndex);
                  } else {
                    // For other players
                    if (Number(subgridIndex) !== robotSubgrid - 1 && Number(subgridIndex) !== oldRobotSugrid - 1) {
                      // Shuffle doors for all subgrids except the robot's subgrid
                      console.log(`Player ${playerId} entered subgrid ${subgridIndex}. Shuffling doors.`);
                      await shuffleAndRedrawDoors(subgridIndex);
                    } else {
                      // Do not shuffle doors if a player enters the robot's subgrid
                      console.log(`Player ${playerId} entered the robot's subgrid ${subgridIndex}. No shuffling.`);
                    }
                  }
              }

            }

            return true;  // Return the matching door if color matches
          } else {
            console.log(`Player color "${playerColor}" does not match door color "${doorColor}". Access denied.`);
            return null;  // Player color doesn't match the door color
          }
        }
      }
    }
  } catch (error) {
    console.error("Error fetching door data from Firebase:", error);
  }

  return null; 
}

async function shuffleAndRedrawDoors(subgridIndex) {
  try {
    const subgrid = subgridPositions[subgridIndex];
    const doorPositions = [
      { x: (subgrid.xStart + subgrid.xEnd) / 2, y: subgrid.yStart, side: 'top' },
      { x: (subgrid.xStart + subgrid.xEnd) / 2, y: subgrid.yEnd, side: 'bottom' },
      { x: subgrid.xStart, y: (subgrid.yStart + subgrid.yEnd) / 2, side: 'left' },
      { x: subgrid.xEnd, y: (subgrid.yStart + subgrid.yEnd) / 2, side: 'right' }
    ];

    let doorColors = ['yellow', '#FF746C', '#00CCFF', '#9370DB'];  // Example colors
    let shuffledColors = shuffle(doorColors);  // Shuffle the colors
    const updatedDoors = {};

    if(robotHere && timeToSave === "blue" && Number(subgridIndex) == trappedIndex){
      const robotDoor = robotDoors.find(door => door.subgridIndex === Number(subgridIndex));

      if (!robotDoor) {
        console.error(`No robot door found for subgrid ${subgridIndex}`);
        return;
      }

      // Determine the hex code for the robotColor
      const robotColorHex = getColorCode(robotColor);

      doorColors = doorColors.filter(color => color.toLowerCase() !== robotColorHex.toLowerCase());

      // Shuffle the remaining colors
      const shuffledColors = shuffle(doorColors);

      let shuffledIndex = 0; // Use a separate index for shuffledColors

      doorPositions.forEach((door) => {
        if (door.side === robotDoor.side) {
          // Place the robot door with the robotColor
          updatedDoors[door.side] = {
            x: door.x,
            y: door.y,
            color: robotColor, // Use robotColor directly
            side: door.side
          };
        } else {
          // Assign shuffled colors to the remaining doors
          updatedDoors[door.side] = {
            x: door.x,
            y: door.y,
            color: getColorName(shuffledColors[shuffledIndex]), // Get the next color from shuffledColors
            side: door.side
          };
          shuffledIndex++; // Increment the shuffled color index
        }
      });

      await updateStateDirect(`doors/${subgridIndex}`, updatedDoors, 'shuffleDoor');
      subgridIndex = Number(subgridIndex);


    }else{
              // Update the shuffled doors in Firebase
        doorPositions.forEach((door, index) => {
          updatedDoors[door.side] = {
            x: door.x,
            y: door.y,
            color: getColorName(shuffledColors[index]),
            side: door.side
          };
        });

        // Store the updated doors in Firebase
        await updateStateDirect(`doors/${subgridIndex}`, updatedDoors, 'shuffleDoor');
        subgridIndex = Number(subgridIndex);

    }


    // Redraw the shuffled doors on the grid
    redrawDoors(subgridIndex, updatedDoors);
  } catch (error) {
    console.error(`Error shuffling doors for subgrid ${subgridIndex}:`, error);
  }
}

function redrawDoors(subgridIndex, doorsData) {
  // Remove existing doors for the subgrid
  document.querySelectorAll(`.Door[data-subgrid="${subgridIndex}"]`).forEach(door => door.remove());

  // Draw new doors based on the updated door data
  for (let side in doorsData) {
    const door = doorsData[side];
    renderDoor(door.x, door.y, getColorCode(door.color), side, subgridIndex);
  }
}

function renderDoor(x, y, color, side, subgridIndex) {
  const doorElement = document.createElement("div");
  doorElement.classList.add("Door");
  doorElement.dataset.subgrid = subgridIndex;  // Tag the door with its subgrid

  // Set door background color
  doorElement.style.backgroundColor = color;

  // Adjust door position with appropriate offsets based on side
  let left = 16 * (x - 1) + "px";
  let top = 16 * (y - 1) + "px";

  if (side === 'top' || side === 'bottom') {
    doorElement.style.width = '18px';
    doorElement.style.height = '4px';
    left = 16 * (x - 1) - 1 + "px";
    if (side === 'top') top = 16 * (y - 1) - 1 + "px";
    else top = 16 * (y - 1) + 13 + "px";
  } else {
    doorElement.style.width = '4px';
    doorElement.style.height = '18px';
    top = 16 * (y - 1) - 1 + "px";
    if (side === 'left') left = 16 * (x - 1) - 1 + "px";
    else left = 16 * (x - 1) + 13 + "px";
  }

  // Apply the calculated positions
  doorElement.style.transform = `translate3d(${left}, ${top}, 0)`;

  // Append the door to the game container
  document.querySelector(".game-container").appendChild(doorElement);
}

// Function to render a door and optionally store it in Firebase
async function renderAndStoreDoor(x, y, color, side, subgridIndex, shouldStore = true) {
  const doorElement = document.createElement("div");
  doorElement.classList.add("Door");

  // Set door background color
  const colorCode = getColorCode(color);
  doorElement.style.backgroundColor = colorCode;

  // Adjust door position with appropriate offsets based on side
  let left = 16 * (x - 1) + "px";
  let top = 16 * (y - 1) + "px";

  if (side === 'top' || side === 'bottom') {
    doorElement.style.width = '18px';
    doorElement.style.height = '4px';
    left = 16 * (x - 1) - 1 + "px";
    top = (side === 'top') ? 16 * (y - 1) - 1 + "px" : 16 * (y - 1) + 13 + "px";
  } else if (side === 'left' || side === 'right') {
    doorElement.style.width = '4px';
    doorElement.style.height = '18px';
    top = 16 * (y - 1) - 1 + "px";
    left = (side === 'left') ? 16 * (x - 1) - 1 + "px" : 16 * (x - 1) + 13 + "px";
  }

  doorElement.style.transform = `translate3d(${left}, ${top}, 0)`;

  // Append the door to the game container
  document.querySelector(".game-container").appendChild(doorElement);

  // Store the door data in Firebase if necessary
  if (shouldStore) {
    let doorPath = `doors/${subgridIndex}`;
    let doorData = await readState(doorPath) || {};  // Read existing doors, or initialize

    doorColor = getColorName(colorCode);

    //console.log(`getColorName called with: "${colorCode}", Normalized: "${normalizedCode}"`);

    // Add the new door data for the specified side
    doorData[side] = { x, y,  doorColor, side };

    // Store the door in Firebase
    await updateStateDirect(doorPath, doorData ,'storeDoor');
  }
}

// Modified function to place doors around each subgrid
async function placeDoorsForSubgrid(subgridIndex) {
  const subgrid = subgridPositions[subgridIndex];

  const doorPositions = [
    { x: (subgrid.xStart + subgrid.xEnd) / 2, y: subgrid.yStart, side: 'top' },    // Top Door
    { x: (subgrid.xStart + subgrid.xEnd) / 2, y: subgrid.yEnd, side: 'bottom' },   // Bottom Door
    { x: subgrid.xStart, y: (subgrid.yStart + subgrid.yEnd) / 2, side: 'left' },   // Left Door
    { x: subgrid.xEnd, y: (subgrid.yStart + subgrid.yEnd) / 2, side: 'right' }     // Right Door
  ];

  let doorColors = ['yellow', '#FF746C', '#00CCFF', '#9370DB'];  // Example colors
  let shuffledColors = shuffle(doorColors);

   // Check if the doors are already stored in Firebase
  let doorsData = await readState(`doors/${subgridIndex}`);

   if (!doorsData) {
     // Store new doors if none exist yet 
     doorsData = {};
     doorPositions.forEach((door, index) => {
       doorsData[door.side] = {
         x: door.x,
         y: door.y,
         color: getColorName(shuffledColors[index]),
         side: door.side
       };
     });
     await updateStateDirect(`doors/${subgridIndex}`, doorsData, 'storeDoor');
   }
 
   // Render all doors for this subgrid
   Object.keys(doorsData).forEach(side => {
     const door = doorsData[side];
     renderAndStoreDoor(door.x, door.y, door.color, side, subgridIndex, false);

    //  if (door.color === robotColor) {
    //   robotDoors.push({ subgridIndex, x: door.x, y: door.y, side: door.side });
    //   console.log("robot doors are:");
    //   console.log(robotDoors);
    // }
   });
}

function placeDoorsForAllSubgrids() {
  for (let i = 0; i < subgridPositions.length; i++) {
    placeDoorsForSubgrid(i);  // Initialize doors for all subgrids
  }
}

async function initGame() {
    clearTimeout(waitingTimer);
    // Get the id of this player
    playerId = getCurrentPlayerId();

    // Read the current state under 'players' and get a list of all current player names (not their ids)
    let pathState = 'players';
    let players = await readState( pathState ); 
    let playerNames = [];
    if (players !== null) {
       playerNames = Object.values(players).map(player => player.name);
    }
    
    // Select a name that has not been used before
    let name;
    do {
        name = createName(); 
    } while (playerNames.includes( name ));

    // let color = await assignUniqueColor(); // Get a unique color for the player
    // if (!color) return; // Exit if no color is available

    arrivalIndex = getCurrentPlayerArrivalIndex() % 4;
    let color= 'test';

    if (arrivalIndex === 1) {
      // Define possible trap schedules
      const trapSchedules = [
        { 1: [1], 2: [1], 3: [2], 4: [2] },  // First trap schedule
        { 1: [1], 2: [2], 3: [2], 4: [1] },  // Second trap schedule
        { 1: [1], 2: [2], 3: [1], 4: [2] }   // Third trap schedule
      ];
  
      // Randomly select one of the trap schedules
      const randomIndex = Math.floor(Math.random() * trapSchedules.length);
      let initTrapSchedule = trapSchedules[randomIndex];

      const numPlayers = sessionConfig.minPlayersNeeded;

      const availableColors = ["blue", "red", "yellow", "purple"];
      const shuffledColors = availableColors.sort(() => Math.random() - 0.5).slice(0, numPlayers);
      const playerIDs = Array.from({ length: numPlayers }, (_, i) => i + 1);
      const shuffledPlayerIDs = playerIDs.sort(() => Math.random() - 0.5);

      color = shuffledColors[arrivalIndex - 1];
      playerSequence = shuffledPlayerIDs[arrivalIndex - 1];

      introColor = color;
      introName = name;

      const playerSequenceObject = {};
      shuffledPlayerIDs.forEach((id, index) => {
        playerSequenceObject[index] = id;
      });

      const colorSequenceObject = {};
      shuffledColors.forEach((color, index) => {
        colorSequenceObject[index] = color;
      });

  
      // Update the trap schedule to Firebase
      let path = `condition`;
      updateStateDirect(path, initTrapSchedule,'storeCondition');
      console.log("Trap schedule set and updated to Firebase:",initTrapSchedule);

      path = `playerSequenceAssignment`;
      updateStateDirect(path, playerSequenceObject,'storePlayerSequence');
      console.log("Player sequence sent to Firebase:", playerSequenceObject);

      path = `colorAssignment`;
      updateStateDirect(path, colorSequenceObject,'storeColorSequence');
      console.log("Color sequence updated to Firebase:", colorSequenceObject);

      if(robotHere){


        easystar.setGrid(initialGrid);
        
        easystar.setAcceptableTiles([0]);


        const {x, y} = { x: 1, y: 1 }; 

        let robotname = 'robot1';
        const aiColor = availableColors.find(color => !shuffledColors.includes(color));
        robotColor = aiColor;
        // Broadcast this new player position to the database
        let path = `players/${robotId}`;
        let newState = {
              id: robotId,
              name: robotname,
              direction: "right",
              color: aiColor, 
              oldX: x,
              oldY: y,
              x,
              y,
              coins: 0,
              isTrapped: false,
              roundNumber: currentRound,
              sequence: numPlayers + 1,
            };
        updateStateDirect(path, newState , 'initRobotPlayer');
    
      }

    }

 
    // // Show the player name
    // let str = `You are: ${name}`;
    // messageGame.innerHTML = str;
    
    const {x, y} = { x: 1, y: 1 }; 

    introName = name;
    
    // Broadcast this new player position to the database
    let path = `players/${playerId}`;
    let newState = {
          id: playerId,
          name: name,
          direction: "right",
          color: color, 
          oldX: x,
          oldY: y,
          x,
          y,
          coins: 0,
          isTrapped: false,
          roundNumber: currentRound,
          sequence: playerSequence,
        };
    updateStateDirect(path, newState , 'initPlayer');

    arrowUpListener = new KeyPressListener("ArrowUp", () => handleArrowPress(0, -1, playerId));
    arrowDownListener = new KeyPressListener("ArrowDown", () => handleArrowPress(0, 1, playerId));
    arrowLeftListener = new KeyPressListener("ArrowLeft", () => handleArrowPress(-1, 0, playerId));
    arrowRightListener = new KeyPressListener("ArrowRight", () => handleArrowPress(1, 0 , playerId));

    // // Place first coin
    // placeTokensForPlayer(playerId);
    // placeDoorsForAllSubgrids();
}

let trapScheduleReady = false;
let playerColorReady = false;
let playerSequenceReady = false;

let gameStart = true;

// Function to check if all data is ready
function checkAllDataReady() {
  if (trapScheduleReady && playerColorReady && playerSequenceReady && gameStart) {
    console.log("All data received. Proceeding to initRounds...");
    gameStart = false;
    initRounds(); 
  }
}

// --------------------------------------------------------------------------------------
//   Handle state change events triggered by MPLIB
// --------------------------------------------------------------------------------------

// Function to receive state changes from Firebase (broadcast by other players)
function receiveStateChange(pathNow,nodeName, newState, typeChange ) {
  // typeChange can be the following:
  //  'onChildChanged'
  //  'onChildAdded'
  //  'onChildRemoved'

  // Adding a player
  if ((pathNow === "players") && (typeChange == 'onChildAdded') && (newState.id != null)) {
    // if(arrivalIndex != 1){
    //   if(addedPlayer.id  === "robotPlayer"){
    //     robotColor = addedPlayer.color;
    //   }
    // }
      const addedPlayer = newState; 
      const characterElement = document.createElement("div");
      characterElement.classList.add("Character", "grid-cell");
      const isRobot = addedPlayer.id  === "robotPlayer"; 
      characterElement.innerHTML = (`
        <div class="Character_shadow grid-cell"></div>
        <div class="Character_sprite grid-cell ${isRobot ? "robot-sprite" : ""}"></div>
      `);

    //   <div class="Character_name-container">
    //   <span class="Character_name"></span>
    //   <span class="Character_coins">0</span>
    // </div>
      playerElements[addedPlayer.id] = characterElement;

      //Fill in some initial state
      // characterElement.querySelector(".Character_name").innerText = addedPlayer.name;
      // characterElement.querySelector(".Character_coins").innerText = addedPlayer.coins;
      characterElement.setAttribute("data-color", addedPlayer.color);
      characterElement.setAttribute("data-direction", addedPlayer.direction);
      const left = 16 * (addedPlayer.x-1) + "px";
      const top = 16 * (addedPlayer.y-1) - offsetY + "px";
      characterElement.style.transform = `translate3d(${left}, ${top}, 0)`;
      gameContainer.appendChild(characterElement);

      // Update local game state
      let newRef = getKeyString(addedPlayer.x, addedPlayer.y);
      mapData.blockedSpaces[ newRef ] = addedPlayer.id;

      players[ addedPlayer.id ] = addedPlayer;
  }

  // A change in a player that already exists
  if ((pathNow === "players") && (typeChange == 'onChildChanged')) {
      const changedPlayer = newState;
      const characterState = changedPlayer;
      let el = playerElements[changedPlayer.id];
      // Now update the DOM
      // el.querySelector(".Character_name").innerText = characterState.name;
      // el.querySelector(".Character_coins").innerText = characterState.coins;
      el.setAttribute("data-color", characterState.color);
      el.setAttribute("data-direction", characterState.direction);
      const left = 16 * (characterState.x-1) + "px";
      const top = 16 * (characterState.y-1) - offsetY + "px";
      el.style.transform = `translate3d(${left}, ${top}, 0)`;

      // Update local game state
      if ((characterState.x != characterState.oldX) || (characterState.y != characterState.oldY)) {
          let newRef = getKeyString(characterState.x, characterState.y);
          mapData.blockedSpaces[newRef] = changedPlayer.id;

          let oldRef = getKeyString(characterState.oldX, characterState.oldY);
          delete mapData.blockedSpaces[oldRef];
      }

      players[ changedPlayer.id ] = changedPlayer;
  }

  // Removing a player
  if ((pathNow === "players") && (typeChange == 'onChildRemoved')) {
      const removedPlayerId = nodeName;
      gameContainer.removeChild(playerElements[removedPlayerId]);
      delete playerElements[removedPlayerId];

      // Remove player from local game state
      let firstMatchingKey = getFirstKeyForValue(mapData.blockedSpaces, removedPlayerId);
      delete mapData.blockedSpaces[firstMatchingKey];

      delete players[removedPlayerId];
  }


  // Adding a coin
  if ((pathNow === "coins") && (typeChange == 'onChildAdded')) {
      const coin = newState;
      const key = nodeName;
      coins[key] = true;

      // Create the DOM Element
      const coinElement = document.createElement("div");
      coinElement.classList.add("Coin", "grid-cell");
      coinElement.innerHTML = `
        <div class="Coin_shadow grid-cell"></div>
        <div class="Coin_sprite grid-cell" style="filter: ${getFilterForColor(coin.color)};"></div>
      `;

      // Position the Element
      const left = 16 * (coin.x-1) + "px";
      const top = 16 * (coin.y-1) - offsetY + "px";
      coinElement.style.transform = `translate3d(${left}, ${top}, 0)`;

      // Keep a reference for removal later and add to DOM
      coinElements[key] = coinElement;
      gameContainer.appendChild(coinElement);
  }

  // Removing a coin
  if ((pathNow === "coins") && (typeChange == 'onChildRemoved')) {
      const key = nodeName;
      delete coins[key];
      gameContainer.removeChild( coinElements[key] );
      delete coinElements[key];
  }

  if (pathNow.startsWith("doors")) {
    const subgridIndex = Number(nodeName);  // Node name contains the subgrid index

    //console.log(`Updating doors for subgrid ${subgridIndex}`, newState);

    // Loop over the doors stored under this subgrid
    for (const side in newState) {
      if (newState.hasOwnProperty(side)) {
        const doorData = newState[side];

        //console.log(`Rendering door for ${side}:`, doorData);

        // Render the door for each side of the subgrid
        if (typeChange === 'onChildAdded' || typeChange === 'onChildChanged') {
          renderAndStoreDoor(
            doorData.x,
            doorData.y,
            doorData.color,
            side,
            subgridIndex,
            false  // Don't store again during rendering
          );
        }

        if (typeChange === 'onChildAdded' || typeChange === 'onChildChanged'){
          if (doorData.color === robotColor && robotHere) {
        
            // Check if a door for this subgrid already exists in robotDoors
            const existingDoorIndex = robotDoors.findIndex(
              door => door.subgridIndex === subgridIndex
            );
  
            if (existingDoorIndex !== -1) {
              // Replace the existing door
              console.log(`Replacing robot door for subgrid ${subgridIndex}`);
              robotDoors[existingDoorIndex] = {
                subgridIndex,
                side
              };
            } else {
              // Add a new robot door
              console.log(`Adding new robot door for subgrid ${subgridIndex}`);
              robotDoors.push({
                subgridIndex,
                side
              });
            }
            console.log('robot doors are:', robotDoors);
          }

        }

      }
    }
  }

  if (pathNow === 'subgridAssignment') {
    console.log('Updated subgrid assignments:', newState);
    const playerId = nodeName; 

    if(playerId === "trapped"){
      trappedIndex = Number(newState) - 1; 
      console.log('Trapped player is in subgridIndex:', trappedIndex);
      if(arrivalIndex == 1 && timeToSave === false){
        setTimeout(() => {
          timeToSave = true; 
          console.log("Time to save the trapped player", timeToSave);
        }, 5000);
      }
    }

    if(playerId === "robotPlayer" && (typeChange == 'onChildAdded' ||typeChange == 'onChildChanged')){
      robotSubgrid = Number(newState);
    }

  }

  if (pathNow === 'condition') {
    console.log('Updated trap schedule:', newState);
    const playerID = newState[0]; // Assume `newState` is an array with a single trapped player ID

    // Assign the current roundCounter as the round key
    trapSchedule[roundCounter] = [playerID];
  
    console.log(`Round ${roundCounter}: Player ${playerID} trapped`);
  
    // Increment the roundCounter for the next update
    roundCounter++;
  
    console.log('Updated trap schedule:', trapSchedule);

    if(Object.entries(trapSchedule).length == 4){
      trapScheduleReady = true; // Mark trapSchedule as ready
      checkAllDataReady();
    }

  }

  if (pathNow === 'colorAssignment') {
    console.log('New color assignment:', newState);
    const newKey = Object.keys(colorObject).length + 1; // Determine the next key
    colorObject[newKey] = newState;
    console.log('Updated colorObject:', colorObject);

    if(Object.entries(colorObject).length= sessionConfig.minPlayersNeeded && arrivalIndex != 1){
      introColor = colorObject[arrivalIndex];
      let path = `players/${playerId}`;

      // Update only the color property
      let updatedColorState = {
        color: introColor
      };
  
      // Call the update function with the updated color
      updateStateDirect(path, updatedColorState, 'updatePlayerColor');

      playerColorReady = true; // Mark playerColor as ready
      checkAllDataReady(); 
      
    }

    if(Object.entries(colorObject).length= sessionConfig.minPlayersNeeded && arrivalIndex == 1){
      playerColorReady = true; 
      checkAllDataReady(); 
    }
  }

  if (pathNow === 'playerSequenceAssignment') {
    console.log('New sequence assignment:', newState);
    // playerSequenceArray.push(newState);
    // console.log('Updated sequence assignment:', playerSequenceArray);

    const newKey = Object.keys(sequenceObject).length + 1; // Determine the next key
    sequenceObject[newKey] = newState;
    console.log('Updated sequenceObject:', sequenceObject);

    if(Object.entries(sequenceObject).length = sessionConfig.minPlayersNeeded && arrivalIndex != 1){
      playerSequence = sequenceObject[arrivalIndex];
      let path = `players/${playerId}`;

      // Update only the color property
      let updatedSequenceState = {
        sequence: playerSequence
      };
  
      // Call the update function with the updated color
      updateStateDirect(path, updatedSequenceState, 'updatePlayerColor');
      playerSequenceReady = true; // Mark playerSequence as ready
      checkAllDataReady();
      
    }

    if(Object.entries(sequenceObject).length= sessionConfig.minPlayersNeeded && arrivalIndex == 1){
      playerSequenceReady = true; 
      checkAllDataReady(); 
    }
  }

  if(pathNow === "trappedPlayer" && (typeChange == 'onChildAdded' ||typeChange == 'onChildChanged')){
    // trappedPlayer = newState;
    console.log('trappedPlayer is:', newState);
  }

}

// Function triggered by a call to "updateStateTransaction" to evaluate if the proposed action is valid
// If "updateStateTransaction" is not called, and all updates are done through "updateStateDirect", there is no 
// need for this function
function evaluateUpdate(path, state, action, actionArgs) {
  console.log(`evaluateUpdate called with path: ${path}, state:`, state, `action: ${action}, actionArgs:`, actionArgs);
  let isAllowed = false;
  let newState = null;

  if (action === "assignSubgrid") {
    const { playerId, subgrid } = actionArgs;

    // Initialize subgridAssignments if it doesn't exist yet
    let subgridAssignments = state || {}; // Ensure state is an object

    let chosenSubgrid = subgrid;
    if (subgrid === null) {
      console.log(`No specific subgrid provided. Choosing the first available subgrid.`);
      chosenSubgrid = getRandomAvailableSubgrid(subgridAssignments);
    }

    if (chosenSubgrid === null) {
      console.error("No available subgrid for assignment.");
    } else if (!Object.values(subgridAssignments).includes(chosenSubgrid)) {
      // The chosen subgrid is available, proceed with assignment
      subgridAssignments[playerId] = chosenSubgrid;

      // Update the state with the new assignments
      newState = subgridAssignments;
      isAllowed = true;
      console.log(`Assigned subgrid ${chosenSubgrid} to player ${playerId}`);
    } else {
      console.warn(`Conflict: Subgrid ${chosenSubgrid} is already assigned.`);
    }
  }

  return { isAllowed, newState };
}

function getRandomAvailableSubgrid(subgridAssignments) {
  // Get total number of subgrids based on subgridPositions length
  const totalSubgrids = subgridPositions.length;

  // Determine available subgrids
  const availableSubgrids = Array.from({ length: totalSubgrids }, (_, i) => i + 1)
    .filter(subgrid => !Object.values(subgridAssignments).includes(subgrid));

  // Randomly select one of the available subgrids
  if (availableSubgrids.length > 0) {
    const randomIndex = Math.floor(Math.random() * availableSubgrids.length);
    return availableSubgrids[randomIndex];
  }

  // Return null if no subgrids are available
  return null;
}



// Function triggered when this client closes the window and the player needs to be removed from the state 
function removePlayerState() {
  // Send a null state to this player in the database, which removes the database entry
  let path = `players/${getCurrentPlayerId()}`;
  let newState = null;
  updateStateDirect( path, newState, 'removePlayer');
}

// --------------------------------------------------------------------------------------
//   Handle any session change relating to the waiting room or ongoing session 
// --------------------------------------------------------------------------------------

const MAX_WAITING_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds

let waitingTimer;

// Start the waiting timer
function startWaitingTimer() {
  const timeoutId = setTimeout(() => {
    endSessionDueToTimeout();
  }, MAX_WAITING_TIME);

  // Clear the timeout if the player joins the game before 5 minutes
  return timeoutId;
}

// End session and show a timeout message
function endSessionDueToTimeout() {
  // Display a message or navigate to an exit screen
  //alert("The session has timed out. Please try joining again later.");
  messageWaitingRoom.innerText = " The session has timed out. You have been disconnected from the session. We couldn't find a match for you with other participants at this time. Please close this window. You'll receive a partial compensation for your time. Thank you for your understanding.";

  alert("The session has timed out. You have been disconnected from the session. Please close the current window. ");
  // Redirect or log the player out if necessary
  // window.location.href = 'exit_page.html'; // Example of redirection
  leaveSession();
  
}

function joinWaitingRoom() {
  /*
      Functionality to invoke when joining a waiting room.

      This function does the following:
          - Get the current player's playerId
          - Determines the number of players needed for the game
          - Creates an appropriate message based on players needed and players in waiting room
          - Displays the waiting room screen
  */
  waitingTimer = startWaitingTimer();
  let waitingTime = 0; // Initialize waiting time in seconds
  const waitingTimerInterval = setInterval(() => {
    waitingTime++;
    const minutes = Math.floor(waitingTime / 60);
    const seconds = waitingTime % 60;
    document.getElementById('waitingTimeDisplay').innerText = `Waiting time: ${minutes}m ${seconds}s`;
  }, 1000)

  let playerId = getCurrentPlayerId(); // the playerId for this client
  let numPlayers = getNumberCurrentPlayers(); // the current number of players
  let numNeeded = sessionConfig.minPlayersNeeded - numPlayers;
 
  let str2 = `We are waiting for ${ numNeeded } additional ${ numPlayers > 1 ? 'players' : 'player' }... Once you join the game, you'll be playing alongside other players. Remember, your goal is to collect coins that match your color. Each player has their own character and will be collecting coins of a different color.`;
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
          - Checks the status of the waiting room through the getWaitRoomInfo() function
              - If the flag doCountDown is true, then the game will start after a countdown
              - otherwise continue waiting
          - Displays a 'game will start' message if appropriate
  */
 
  // switch screens from instruction to waiting room
  instructionsScreen.style.display = 'none';
  waitingRoomScreen.style.display = 'block';

  // Waiting Room is full and we can start game
  let [ doCountDown , secondsLeft ] = getWaitRoomInfo();
  if (doCountDown) {
      let str2 = `Game will start in ${ secondsLeft } seconds... Once you join the game, you'll be playing alongside two other players. Remember, your goal is to collect coins that match your color.`;
      messageWaitingRoom.innerText = str2;
  } else { // Still waiting for more players, update wait count
      let numPlayers = getNumberCurrentPlayers(); // the current number of players
      let numNeeded = sessionConfig.minPlayersNeeded - numPlayers; // Number of players still needed (in case the player is currently in a waiting room)
      
      let str2 = `Waiting for ${ numNeeded } additional ${ numPlayers > 1 ? 'players' : 'player' }...`;
      messageWaitingRoom.innerText = str2;
  }
}

async function startSession() {

  let numPlayers = getNumberCurrentPlayers();
  
  if (numPlayers < sessionConfig.minPlayersNeeded) {
    console.log("Not enough players to start the game.");
    return;  // Exit the function early if there are not enough players
  }

  /*
      Funtionality to invoke when starting a session.

      This function does the following:
          - Displays the game screen
          - Display the scene
          - Logs the start of the game with the session ID and timestamp
          - Start an event listener for key presses that control the avatar
          - Add client player (this user) avatar
          - Tell the client which player they are
          - Starts a new game
  */

  instructionsScreen.style.display = 'none';
  waitingRoomScreen.style.display = 'none';
  gameScreen.style.display = 'none';
  
  let playerId = getCurrentPlayerId(); // the playerId for this client getCurrentPlayerArrivalIndex()
  let dateString = timeStr(getPlayerInfo( playerId ).sessionStartedAt);
  let str = `Started game with session id ${getSessionId()} with ${getNumberCurrentPlayers()} players at ${dateString}.`;
  myconsolelog( str );
  
  // Add the event listener for key presses
  //document.addEventListener('keydown', handleKeyDown);

  //let str2 = `You are: Player${getCurrentPlayerArrivalIndex()}`;
  //messageGame.innerHTML = str2;
  await initGame();
  //initRounds();
}

function updateOngoingSession() {
  /*
      Functionality to invoke when updating an ongoing session.

      This function is currently empty.
  */
}

function endSession() {
  /*
      Function invoked by MPLIB when ending a session. Do *not* call this function yourself (use leaveSession for this purpose)

      This function does the following:
          - Displays the finish screen (hides all other divs)
          - Hide and disable the scene
          - Remove the keypress event listener
          - Checks if any players terminated their session abnormally
              - If so, an "abnormal termination" message is created
              - If not, then the session completed normally
          - Displays a message based on the termination status [normal, abnormal]
  */
  instructionsScreen.style.display = 'none';
  waitingRoomScreen.style.display = 'none';
  gameScreen.style.display = 'none';
  finishScreen.style.display = 'block';

  // Remove the key listeners
  arrowUpListener.unbind();
  arrowDownListener.unbind();
  arrowLeftListener.unbind();
  arrowRightListener.unbind();

  // Set a flag
  hasEnded = true;

  let err = getSessionError();

  let roundAt = currentRound;

  currentRound = 5;

  const messageFinish = document.getElementById('messageFinish');

  if (err.errorCode == 1) {
      // No sessions available
      messageFinish.innerHTML = `<p>Session ended abnormally because there are no available sessions to join</p>`;
  } else if (err.errorCode==2) {
      // This client was disconnected (e.g. internet connectivity issues) 
      messageFinish.innerHTML = `<p>Session ended abnormally because you are experiencing internet connectivity issues</p>`;
  } else if (err.errorCode==3) {
      // This client is using an incompatible browser
      messageFinish.innerHTML = `<p>Session ended abnormally because you are using the Edge browser which is incompatible with this experiment. Please use Chrome or Firefox</p>`;
  }else if(roundAt == totalRounds){
    document.getElementById('questionnaireForm').style.display = 'block';
    document.getElementById('messageFinish').innerText = "Thank you for playing! Please complete the questionnaire below. Questions marked with an asterisk (*) are required.";

    document.getElementById('submitQuestionnaire').addEventListener('click', () => {
      // Collect form data
      const prolificID = document.getElementById('prolificID').value.trim();
      const strategy = document.getElementById('strategy').value.trim();
      const gameView = document.querySelector('input[name="gameView"]:checked')?.value;
      const generalGameView = document.querySelector('input[name="generalGameView"]:checked')?.value;
      const noticedStuckPlayer = document.querySelector('input[name="noticedStuckPlayer"]:checked')?.value;
      const helpedStuckPlayer = document.querySelector('input[name="helpedStuckPlayer"]:checked')?.value;
      const reasonHelped = document.getElementById('reasonHelped').value.trim();
      const reasonNotHelped = document.getElementById('reasonNotHelped').value.trim();
      const helpfulnessRating = document.querySelector('input[name="helpfulnessRating"]:checked')?.value;
      const observedHelp = document.querySelector('input[name="observedHelp"]:checked')?.value;
      const selfHelpfulness = document.querySelector('input[name="selfHelpfulness"]:checked')?.value;
      const suggestions = document.getElementById('suggestions').value.trim();
    
    
      // Check if all required fields are filled
      if (
        !prolificID || !strategy || !gameView || !generalGameView || !noticedStuckPlayer ||
        !helpedStuckPlayer || !reasonHelped || !reasonNotHelped ||
        !helpfulnessRating || !observedHelp || !selfHelpfulness
      ) {
        alert("Please fill out all required fields before submitting the questionnaire.");
        return; // Prevent form submission
      }
    
      // Create an object with the responses
      let questionnaireResponses = {
        prolificID,
        strategy,
        gameView,
        generalGameView,
        noticedStuckPlayer,
        helpedStuckPlayer,
        reasonHelped,
        reasonNotHelped,
        helpfulnessRating, 
        observedHelp,
        selfHelpfulness, 
        suggestions
      };
    
      // Path to update the player's data
      let path = `players/${playerId}`;
    
      // Update the player's state with the responses
      let newState = {
        responses: questionnaireResponses
      };
    
      updateStateDirect(path, newState, 'endQuestions'); // Function to update state in your database
    
      // Optionally, you can display a thank you message or hide the questionnaire
      document.getElementById('messageFinish').innerText = "Thank you for completing the questionnaire! You will be redirected to Prolific's completion page.";
      document.getElementById('questionnaireForm').style.display = 'none';

      setTimeout(() => {
        window.location.href = "https://app.prolific.com/submissions/complete?cc=C8MVAKZS";
      }, 3000); // 3-second delay before redirecting
    });
    
  }else if (roundAt < totalRounds){
      messageFinish.innerHTML = `<p>The session ended unexpectedly. We apologize for the inconvenience. Please close the window.</p>`;
  }
}

// -------------------------------------------------------------------------------------
//       Handle events triggered by MPLIB related to changes in the game state
// -------------------------------------------------------------------------------------


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

// Takes the URL parameters to update the session configuration
function updateConfigFromUrl( sessionConfig ) {
  const url = window.location.href;
  const urlParams = new URL(url).searchParams;

  for (let key in sessionConfig) {
      if (urlParams.has(key)) {
          const value = urlParams.get(key);

          let newValue;
          if (!isNaN(value)) {
              newValue = Number(value);
          }
          else if (value === 'true' || value === 'false') {
              newValue = (value === 'true');
          }
          // if not a number or boolean, treat it as a string
          else {
              newValue = value;              
          }
          sessionConfig[key] = newValue;
          myconsolelog( `URL parameters update session parameter ${key} to value ${newValue}`);
      }
  }
}

function removePrefix(str, prefix) {
  if (str.startsWith(prefix)) {
    return str.substring(prefix.length);
  }
  return str;
}