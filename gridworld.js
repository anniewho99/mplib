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
  getCurrentPlayerArrivalIndex,getSessionId,anyPlayerTerminatedAbnormally,getSessionError,getWaitRoomInfo
} from "/mplib/src/mplib.js";

// -------------------------------------
//       Graphics handles
// -------------------------------------
let instructionsScreen = document.getElementById('instructionsScreen');
let waitingRoomScreen = document.getElementById('waitingRoomScreen');
let gameScreen = document.getElementById('gameScreen');
let messageWaitingRoom = document.getElementById('messageWaitingRoom');
let messageGame = document.getElementById('messageGame');
let messageFinish = document.getElementById('messageFinish');
let gameContainer = document.querySelector(".game-container");

// -------------------------------------
//       Session configuration
// -------------------------------------
// studyId is the name of the root node we create in the realtime database
const studyId = 'gridworld'; 

// Configuration setting for the session
let sessionConfig = {
    minPlayersNeeded: 2, // Minimum number of players needed; if set to 1, there is no waiting room (unless a countdown has been setup)
    maxPlayersNeeded: 4, // Maximum number of players allowed in a session
    maxParallelSessions: 0, // Maximum number of sessions in parallel (if zero, there are no limit)
    allowReplacements: true, // Allow replacing any players who leave an ongoing session?
    exitDelayWaitingRoom: 0, // Number of countdown seconds before leaving waiting room (if zero, player leaves waiting room immediately)
    maxHoursSession: 0, // Maximum hours where additional players are still allowed to be added to session (if zero, there is no time limit)
    recordData: true // Record all data?  
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
  receiveStateChangeFunction: receiveStateChange,
  removePlayerStateFunction: removePlayerState,
  evaluateUpdateFunction: callback_evaluateUpdate,
};

// List the node names where we place listeners for any changes to the children of these nodes; set to '' if listening to changes for children of the root
let listenerPaths = ['coins', 'players', 'doors'];

// Set the session configuration for MPLIB
initializeMPLIB( sessionConfig , studyId , funList, listenerPaths, verbosity );

// -------------------------------------
//       Game Globals
// -------------------------------------
let offsetY = 1;
let maxCoins = 10;

let mapData = {
  minX: 1,
  maxX: 19,
  minY: 1,
  maxY: 19,
  blockedSpaces: {  },
};

const trapSchedule = {
  1: [1],   // Player 1 trapped in round 1 and 2
  2: [1],
  3: [2],   // Player 2 trapped in round 3 and 4
  4: [2],
}


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
const playerColors = ["blue", "orange", "yellow", "purple"];

const colorMap = {
  "#00ccff": "blue",
  "#9370db": "purple",
  "yellow": "yellow",
  "orange": "orange"
};

function getColorName(colorCode) {
  const normalizedCode = colorCode.trim().toLowerCase();  // Normalize input
  //console.log(`getColorName called with: "${colorCode}", Normalized: "${normalizedCode}"`);

  if(normalizedCode ===  "#00ccff"){
    //console.log('Match found: blue');
    return "blue";
  }else if(normalizedCode === "#9370db"){
    //console.log('Match found: purple');
    return "purple";
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
    case "orange":
      code = "orange";  // Example if stored as a string name
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
let roundTime = 90;  // 90 seconds per round
let breakTime = 5;   // 5-second break between rounds
let roundInterval = null; // To store the round timer interval
let isBreakTime = false; 

let introColor;
let introName;

let currentRound = 0;
let trapTime = 10; 
let trapFlag = false;

let totalRounds = 4;

let trappedIndex = 1;

function startNewRound() {
  console.log("Starting a new round...");
  isBreakTime = false;
  resetCoinsAndDoors();
  document.getElementById('breakOverlay').style.visibility = 'hidden'; 
  //messageGame.innerText = "Round Started! Collect coins!";

  currentRound = currentRound + 1;

  if (currentRound <= totalRounds) {
    roundInterval = setTimeout(endRound, roundTime * 1000);  // End the round after 90 seconds
    setTimeout(() => {
      trapFlag = true;
      console.log("its ok to trap the player now!");
      // Add any additional logic to handle trapping, such as removing doors
  }, trapTime * 1000);
  }else{
    endSession();
  }


}

function endRound() {
  isBreakTime = true;
  //messageGame.innerText = "Round ended. Next round starts in 5 seconds...";

  document.getElementById('roundTitle').innerText = "Round Ended";
  document.getElementById('roundMessage').innerText = `Next round starts in 5 seconds...\nYou are ${introName}, and you can only collect ${introColor} tokens and go through ${introColor} doors.`;

  // Show the overlay
  document.getElementById('breakOverlay').style.visibility = 'visible';
  
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
  let currentCoins = Object.keys(coins);
  currentCoins.forEach(coinKey => {
      let path = `coins/${coinKey}`;
      updateStateDirect(path, null);  // Remove coin from Firebase
  });
  coins = {};  // Clear local coin state

  // Step 2: Move all players to starting position
  Object.keys(players).forEach(playerId => {
      let player = players[playerId];
      let startX = 1;
      let startY = 1;
      console.log(`Moving player ${playerId} to starting position...`);

      // Update player's position to the starting coordinates (1,1)
      let path = `players/${playerId}`;
      let newState = {
          ...player,
          x: startX,
          y: startY,
          oldX: player.x,
          oldY: player.y,
      };
      updateStateDirect(path, newState);
  });

  // Step 3: Place new coins for this player
  // Object.keys(players).forEach(playerId => {
  //     console.log(`Placing new coins for player ${playerId}...`);
  //     placeTokensForPlayer(playerId);  // Place new coins
  // });
  placeTokensForPlayer(playerId);

    let player = players[playerId];
    let path = `players/${playerId}`;
    let newState = {
      ...player,
      isTrapped: false,
    };
    await updateStateDirect(path, newState);

  // Step 4: Reset doors
  console.log("Resetting doors for all subgrids...");
  await shuffleAndRedrawDoors(trappedIndex);
  placeDoorsForAllSubgrids();  // Place new doors
}

async function initRounds() {
  console.log("Initializing Rounds...");

  gameScreen.style.display = 'block';
  document.getElementById('roundTitle').innerText = "Round Starting in 5 seconds.";
  document.getElementById('roundMessage').innerText = `You are ${introName}, and you can only collect ${introColor} tokens and go through ${introColor} doors.`;

  document.getElementById('breakOverlay').style.visibility = 'visible';
  setTimeout(startNewRound, 5000);  // Give players 5 seconds to get ready before the first round
}



// -------------------------------------
//       Event Listeners
// -------------------------------------
// Buttons
let joinButton = document.getElementById('joinBtn');
let leaveButton = document.getElementById('leaveBtn');

// Add event listeners to the buttons
joinButton.addEventListener('click', function () {
    joinSession(); // call the library function to attempt to join a session, this results either in starting a session directly or starting a waiting room
});

leaveButton.addEventListener('click', function () {
    leaveSession(); // call the library function to leave a session. This then triggers the local function endSession
});

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
let arrowUpListener = new KeyPressListener("ArrowUp", () => handleArrowPress(0, -1));
let arrowDownListener = new KeyPressListener("ArrowDown", () => handleArrowPress(0, 1));
let arrowLeftListener = new KeyPressListener("ArrowLeft", () => handleArrowPress(-1, 0));
let arrowRightListener = new KeyPressListener("ArrowRight", () => handleArrowPress(1, 0));

// -------------------------------------
//       Game Specific Code
// -------------------------------------
//Misc Helpers
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
  let player = players[playerId];
  if (!player) return;

  // Step 1: Collect all subgrids currently used by all players
  let allUsedSubgrids = Object.values(players)
    .map(p => (p.currentSubgrid != null) ? p.currentSubgrid - 1 : null)
    .filter(subgrid => subgrid !== null);  // Remove null values (players without assigned subgrids)

  console.log(`All used subgrids by players:`, allUsedSubgrids);

  // Step 2: Filter out subgrids used by other players
  let availableSubgrids = subgridPositions.filter((_, index) => !allUsedSubgrids.includes(index));

  // Retry mechanism
  let transactionSuccess = false;
  let selectedSubgrid;
  let subgridPositionIndex;

  // Step 3: Keep trying until a transaction succeeds
  while (!transactionSuccess && availableSubgrids.length > 0) {
    // Select a new subgrid randomly from the available ones
    let subgridIndex = Math.floor(Math.random() * availableSubgrids.length);
    selectedSubgrid = availableSubgrids[subgridIndex];
    subgridPositionIndex = subgridPositions.indexOf(selectedSubgrid);  // Get the index of the selected subgrid

    console.log(`Attempting to assign subgrid ${subgridPositionIndex} to player ${playerId}`);

    // Step 4: Attempt to assign the selected subgrid using updateStateTransaction
    transactionSuccess = await updateStateTransaction("subgridAssignment", "assignSubgrid", {
        playerId: playerId,
        subgrid: subgridPositionIndex + 1  // Use 1-based index
    });

    if (!transactionSuccess) {
      console.log(`Subgrid ${subgridPositionIndex} assignment failed. Retrying...`);
      // Remove the failed subgrid from availableSubgrids
      availableSubgrids.splice(subgridIndex, 1);
    }
  }

  // If the transaction was not successful after trying all subgrids
  if (!transactionSuccess) {
    console.error("Failed to assign a unique subgrid to the player after all retries.");
    return;
  }

  console.log(`Player ${playerId} successfully assigned to subgrid ${subgridPositionIndex}`);

  // Step 5: Place tokens for the player after the subgrid is successfully assigned
  let selectedSubgridIndex = subgridPositionIndex;  // We already have the subgrid index
  let placedPositions = new Set();  // Track placed positions to avoid overlaps

  console.log(`Placing tokens for player ${playerId} in subgrid ${selectedSubgridIndex}`);

  // Place three coins within the selected subgrid
  for (let i = 0; i < 3;) {
    let x = Math.floor(Math.random() * (selectedSubgrid.xEnd - selectedSubgrid.xStart + 1)) + selectedSubgrid.xStart;
    let y = Math.floor(Math.random() * (selectedSubgrid.yEnd - selectedSubgrid.yStart + 1)) + selectedSubgrid.yStart;
    let positionKey = `${x},${y}`;

    // Ensure the position is not occupied and not already used
    if (!isOccupied(x, y) && !placedPositions.has(positionKey)) {
      let id = `coins/${getKeyString(x, y)}`;
      let newState = { x, y, color: player.color, id: playerId };  // Set coin color to match player

      await updateStateDirect(id, newState);  // Save new state in Firebase
      console.log(`Coin placed at (${x}, ${y}) for player ${playerId}`);

      placedPositions.add(positionKey);  // Mark this position as used
      i++;  // Only increment after successful placement
    }
  }

  // Step 6: Update player's state in Firebase with the assigned subgrid
  let path = `players/${playerId}`;
  let newState = {
      ...player,
      currentSubgrid: subgridPositionIndex + 1,  // Store subgrid index (1-based)
  };
  await updateStateDirect(path, newState);
  console.log(`Player ${playerId} assigned to subgrid ${newState.currentSubgrid}`);
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
    //console.log(`All coins collected for player ${playerId}. Placing a new group.`);

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


async function handleArrowPress(xChange = 0, yChange = 0) {
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

      // if (door) {
      //   console.log(`Found door at (${newX}, ${newY}) with color "${door.color}"`);

      //   if (door.color !== players[playerId].color) {
      //     console.log(`Blocked! Door color "${door.color}" does not match player color "${players[playerId].color}".`);
      //     canMove = false;  // Block movement
      //   } else {
      //     console.log(`Door color matches! Movement allowed.`);
      //   }
      // } else {
      //   console.log(`No door found at position (${newX}, ${newY}). Blocking movement.`);
      //   canMove = false;
      // }
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
          updateStateDirect(path, newState);
          // Handle collection logic, possibly placing new coins
          handleCoinCollection(playerId);
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

    // Broadcast this new player position to the database
    let path = `players/${playerId}`;
    let newState = {
      direction: newDirection,
      oldX: oldX,
      oldY: oldY,
      x: newX,
      y: newY,
      coins: players[playerId].coins,
      isTrapped: players[playerId].isTrapped,
    };
    updateStateDirect(path, newState);
  }
}


async function assignUniqueColor() {
  // Fetch all current players from the Firebase database
  let players = await readState('players');
  let usedColors = new Set();

  // Collect all colors that are currently being used
  if (players !== null) {
    Object.values(players).forEach(player => {
      if (player.color) {
        usedColors.add(player.color);
      }
    });
  }

  // Find the first available color that isn't used
  let availableColor = playerColors.find(color => !usedColors.has(color));
  if (!availableColor) {
    console.error('No available colors left for players!');
    return null;
  }

  return availableColor;
}

// Helper function to determine the correct filter value based on the color
function getFilterForColor(color) {
  switch (color) {
    case 'blue':
      return 'sepia(1) saturate(4000%) hue-rotate(150deg) brightness(1) contrast(2)'; // Blue filter
    case 'orange':
      return 'sepia(1) saturate(5000%) hue-rotate(293deg) brightness(0.9) contrast(1.6)';  // Orange filter
    case 'yellow':
      return 'sepia(1) saturate(4000%) hue-rotate(2deg) brightness(1.2) contrast(1.1)'; // yellow filter
    case 'purple':
      return 'sepia(1) saturate(5000%) hue-rotate(182deg) brightness(0.8) contrast(1.1)'; // Purple filter
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
              const isPlayerTrapped = trapSchedule[currentRound]?.includes(getCurrentPlayerArrivalIndex() % 4);
              if(isPlayerTrapped && trapFlag === true){
                let player = players[playerId];
                let path = `players/${playerId}`;
                let newState = {
                  ...player,
                  isTrapped: true,
                };
                await updateStateDirect(path, newState);
                console.log("time to trap this player");
                console.log(players[playerId]);
                subgridDoors[side].color = "grey";  
                await updateStateDirect(`doors/${subgridIndex}`, subgridDoors);  // Update Firebase

                // Step 2: Update the door visually
                renderDoor(doorX, doorY, "grey", side, subgridIndex); 
                trapFlag = 'used';
                trappedIndex = subgridIndex;
              }else{
                console.log(`Main entry detected at door (${doorX}, ${doorY}). Shuffling doors for subgrid ${subgridIndex}.`);
                await shuffleAndRedrawDoors(subgridIndex);
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

    let doorColors = ['yellow', 'orange', '#00CCFF', '#9370DB'];  // Example colors
    let shuffledColors = shuffle(doorColors);  // Shuffle the colors

    // Update the shuffled doors in Firebase
    const updatedDoors = {};
    doorPositions.forEach((door, index) => {
      updatedDoors[door.side] = {
        x: door.x,
        y: door.y,
        color: getColorName(shuffledColors[index]),
        side: door.side
      };
    });

    // Store the updated doors in Firebase
    await updateStateDirect(`doors/${subgridIndex}`, updatedDoors);

    //console.log(`Doors shuffled for subgrid ${subgridIndex}:`, updatedDoors);

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
    await updateStateDirect(doorPath, doorData);
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

  let doorColors = ['yellow', 'orange', '#00CCFF', '#9370DB'];  // Example colors
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
     await updateStateDirect(`doors/${subgridIndex}`, doorsData);
   }
 
   // Render all doors for this subgrid
   Object.keys(doorsData).forEach(side => {
     const door = doorsData[side];
     renderAndStoreDoor(door.x, door.y, door.color, side, subgridIndex, false);
   });
}

function placeDoorsForAllSubgrids() {
  for (let i = 0; i < subgridPositions.length; i++) {
    placeDoorsForSubgrid(i);  // Initialize doors for all subgrids
  }
}

async function initGame() {
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

    let arrivalIndex = getCurrentPlayerArrivalIndex() % 4;
    let color;

    switch (arrivalIndex) {
        case 1:
            color = "blue";
            break;
        case 2:
            color = "orange";
            break;
        case 3:
            color = "yellow";
            break;
        case 0:
            color = "purple";
            break;
        default:
            color = "gray"; // Fallback color
    }

 
    // Show the player name
    let str = `You are: ${name}`;
    messageGame.innerHTML = str;
    
    const {x, y} = { x: 1, y: 1 }; 

    introColor = color;
    introName = name;
    
    // Broadcast this new player position to the database
    let path = `players/${playerId}`;
    let newState = {
          id: playerId,
          name,
          direction: "right",
          color: color, 
          oldX: x,
          oldY: y,
          x,
          y,
          coins: 0,
          isTrapped: false,
        };
    updateStateDirect(path, newState);

    // // Place first coin
    // placeTokensForPlayer(playerId);
    // placeDoorsForAllSubgrids();
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
  if ((pathNow === "players") && (typeChange == 'onChildAdded')) {
      const addedPlayer = newState; 
      const characterElement = document.createElement("div");
      characterElement.classList.add("Character", "grid-cell");
      characterElement.innerHTML = (`
        <div class="Character_shadow grid-cell"></div>
        <div class="Character_sprite grid-cell"></div>
        <div class="Character_name-container">
          <span class="Character_name"></span>
          <span class="Character_coins">0</span>
        </div>
      `);

      playerElements[addedPlayer.id] = characterElement;

      //Fill in some initial state
      characterElement.querySelector(".Character_name").innerText = addedPlayer.name;
      characterElement.querySelector(".Character_coins").innerText = addedPlayer.coins;
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
      el.querySelector(".Character_name").innerText = characterState.name;
      el.querySelector(".Character_coins").innerText = characterState.coins;
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
    const subgridIndex = nodeName;  // Node name contains the subgrid index

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
      }
    }
  }
}

// Function triggered by a call to "updateStateTransaction" to evaluate if the proposed action is valid
// If "updateStateTransaction" is not called, and all updates are done through "updateStateDirect", there is no 
// need for this function
function evaluateUpdate( path, state, action, actionArgs ) {
  let isAllowed = false;
  let newState = null;

  // .... insert your code to update isAllowed and newState

  let evaluationResult = { isAllowed, newState };
  return evaluationResult;
}

// Function triggered when this client closes the window and the player needs to be removed from the state 
function removePlayerState() {
  // Send a null state to this player in the database, which removes the database entry
  let path = `players/${getCurrentPlayerId()}`;
  let newState = null;
  updateStateDirect( path, newState);
}

// --------------------------------------------------------------------------------------
//   Handle any session change relating to the waiting room or ongoing session 
// --------------------------------------------------------------------------------------

function joinWaitingRoom() {
  /*
      Functionality to invoke when joining a waiting room.

      This function does the following:
          - Get the current player's playerId
          - Determines the number of players needed for the game
          - Creates an appropriate message based on players needed and players in waiting room
          - Displays the waiting room screen
  */

  let playerId = getCurrentPlayerId(); // the playerId for this client
  let numPlayers = getNumberCurrentPlayers(); // the current number of players
  let numNeeded = sessionConfig.minPlayersNeeded - numPlayers;
 
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
      let str2 = `Game will start in ${ secondsLeft } seconds...`;
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
  
  let playerId = getCurrentPlayerId(); // the playerId for this client
  let dateString = timeStr(getPlayerInfo( playerId ).sessionStartedAt);
  let str = `Started game with session id ${getSessionId()} with ${getNumberCurrentPlayers()} players at ${dateString}.`;
  myconsolelog( str );
  
  // Add the event listener for key presses
  //document.addEventListener('keydown', handleKeyDown);

  //let str2 = `You are: Player${getCurrentPlayerArrivalIndex()}`;
  //messageGame.innerHTML = str2;
  await initGame();
  initRounds();
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

  if (err.errorCode == 1) {
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
}

function callback_evaluateUpdate(path, state, action, actionArgs) {
  let isAllowed = true;
  let newState = { ...state };  // Copy the current state to avoid mutation
  let subgridAssignments = newState || {};  // Use the state as the subgridAssignments

  // Add logic to evaluate the update based on the action and state
  switch (action) {
      case "assignSubgrid":
          let playerId = actionArgs.playerId;
          let allUsedSubgrids = Object.values(subgridAssignments); // Get all used subgrids

          // Check if the subgrid is already assigned
          if (allUsedSubgrids.includes(actionArgs.subgrid)) {
              console.log(`Subgrid ${actionArgs.subgrid} is already assigned. Rejecting transaction.`);
              isAllowed = false;  // Subgrid is already assigned, reject the transaction
          } else {
              // Assign the subgrid to the player
              subgridAssignments[playerId] = actionArgs.subgrid;
              newState = subgridAssignments;  // Update the state with new assignments
              console.log(`Assigned subgrid ${actionArgs.subgrid} to player ${playerId}`);
          }
          break;

      // Add more cases for other actions if needed
      default:
          console.error(`Unknown action ${action}. Rejecting transaction.`);
          isAllowed = false;  // Unknown action, reject the transaction
          break;
  }

  return { isAllowed, newState };
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