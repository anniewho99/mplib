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

import { executeLeaderAgent } from "./leaderAgent.js";
import { executeFollowerAgent } from "./followerAgent.js";
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

//Instruction
let practiceSessionActive = false;

let practiceCompleted = false;

let playerName = generateRandomName();
const instructionSteps = [
  {
      text: `Welcome! In this game, your goal is to work with one other participant and one robot to move all the blocks into the slots as quickly as possible across four levels.\n
      Below is a video showing what the game looks like.\n
      We'll explain everything step by step.\n
      \n Note: To ensure data quality, participants should only take part once. If this game looks familiar or you believe you have completed a similar version before, please exit the study. Unfortunately, repeated participation cannot be compensated.`,

      demo: `
      <div style="text-align: center;">
          <video width="480" autoplay loop muted playsinline style="border: 2px solid #ccc; border-radius: 8px;">
              <source src="./images/demoNoComm.mp4" type="video/mp4">
              Your browser does not support the video tag.
          </video>
      </div>
`
  },
  {
      text: `
      This is your avatar, and your player name is ${playerName}.
    `,
      demo: `
        <div style="
          display: flex; 
          align-items: center; 
          justify-content: center; 
          height: 80px; 
          margin: auto;">
          <img src="./images/player1.png" alt="Your Avatar" 
               style="width: 80px; height: 80px; image-rendering: pixelated;">
        </div>
      `
    },  
  {
      text: `Here's a block on the board. You'll see arrow buttons on it — click one to choose the direction you want to push the block. The number '1' means that only one person is needed to move this block. `,
      demo: `<div id="practiceBoard" style="
              width: 360px;
              height: 360px;
              background-color: #bcbcbc;
              background-image: 
                  linear-gradient(to right, darkgray 1px, transparent 1px),
                  linear-gradient(to bottom, darkgray 1px, transparent 1px);
              background-size: 40px 40px;
              position: relative;
              display: grid;
              grid-template-columns: repeat(8, 40px);
              grid-template-rows: repeat(8, 40px);
              margin: auto;">
          </div>
      `
    },
  {
      text: `This is a slot. All blocks need to be pushed into slots like this one to complete a level.
      `,
      demo: `<div id="practiceBoard" style="
              width: 360px;
              height: 360px;
              background-color: #bcbcbc;
              background-image: 
                  linear-gradient(to right, darkgray 1px, transparent 1px),
                  linear-gradient(to bottom, darkgray 1px, transparent 1px);
              background-size: 40px 40px;
              position: relative;
              display: grid;
              grid-template-columns: repeat(8, 40px);
              grid-template-rows: repeat(8, 40px);
              margin: auto;">
          </div>
      `
  },    
  {
      text: `In the game, there's a timer that counts down every five seconds. During that time, you can choose a direction to push an object, and you can change your choice whenver you want. Once the time runs out, your choice will be executed.\nKeep an eye on the timer below — it shows how much time you have left to make your move. \nNow let's try pushing a block into a slot! 
      `,
      demo: `<div id="practiceBoard" style="
              width: 360px;
              height: 360px;
              background-color: #bcbcbc;
              background-image: 
                  linear-gradient(to right, darkgray 1px, transparent 1px),
                  linear-gradient(to bottom, darkgray 1px, transparent 1px);
              background-size: 40px 40px;
              position: relative;
              display: grid;
              grid-template-columns: repeat(8, 40px);
              grid-template-rows: repeat(8, 40px);
              margin: auto;">
          </div>
             <div id="practiceTimer" style="text-align:center; font-size:18px; margin-top:10px; color:black;"></div>`
    },      
    {
      text: `In addition to blocks and slots, there are also walls — the brown areas on the board. You can’t move them, but you can move around them. Let’s try to get the block into a slot while avoiding the wall! `,
      demo: `<div id="practiceBoard" style="
              width: 360px;
              height: 360px;
              background-color: #bcbcbc;
              background-image: 
                  linear-gradient(to right, darkgray 1px, transparent 1px),
                  linear-gradient(to bottom, darkgray 1px, transparent 1px);
              background-size: 40px 40px;
              position: relative;
              display: grid;
              grid-template-columns: repeat(8, 40px);
              grid-template-rows: repeat(8, 40px);
              margin: auto;">
          </div>
             <div id="practiceTimer" style="text-align:center; font-size:18px; margin-top:10px; color:black;"></div>`
    },  
    {
      text: `There are also obstacles that are movable — the black object on the left is an obstacle. Obstacles always require only one person to move. Let’s start by pushing the obstacle out of the way, and then push the block into the slot.`,
      demo: `<div id="practiceBoard" style="
              width: 360px;
              height: 360px;
              background-color: #bcbcbc;
              background-image: 
                  linear-gradient(to right, darkgray 1px, transparent 1px),
                  linear-gradient(to bottom, darkgray 1px, transparent 1px);
              background-size: 40px 40px;
              position: relative;
              display: grid;
              grid-template-columns: repeat(8, 40px);
              grid-template-rows: repeat(8, 40px);
              margin: auto;">
          </div>
             <div id="practiceTimer" style="text-align:center; font-size:18px; margin-top:10px; color:black;"></div>`
    },   
    {
      text: `Some blocks require two players to move—like this one. During the actual game, you won’t be able to see the other player’s choice until the countdown has finished. However, during the tutorial, you will be shown the other player’s choice. In this case, another player has already chosen to move the block to the left. Try coordinating with them to move this two-player block into the slot.`,
      demo: `<div id="practiceBoard" style="
              width: 360px;
              height: 360px;
              background-color: #bcbcbc;
              background-image: 
                  linear-gradient(to right, darkgray 1px, transparent 1px),
                  linear-gradient(to bottom, darkgray 1px, transparent 1px);
              background-size: 40px 40px;
              position: relative;
              display: grid;
              grid-template-columns: repeat(8, 40px);
              grid-template-rows: repeat(8, 40px);
              margin: auto;">
          </div>
             <div id="practiceTimer" style="text-align:center; font-size:18px; margin-top:10px; color:black;"></div>`
    },     
    {
      text: `Finally, there is also a block that requires three players to coordinate in order to move it. One player has already decided to push the block to the left. Another is still deciding — they initially chose to push it down but are now switching to the left as well. Remember, you can change your choice between different blocks and directions in the five seconds countdown. Try coordinating with them to move this 3 block into the slot.`,
      demo: `<div id="practiceBoard" style="
              width: 360px;
              height: 360px;
              background-color: #bcbcbc;
              background-image: 
                  linear-gradient(to right, darkgray 1px, transparent 1px),
                  linear-gradient(to bottom, darkgray 1px, transparent 1px);
              background-size: 40px 40px;
              position: relative;
              display: grid;
              grid-template-columns: repeat(8, 40px);
              grid-template-rows: repeat(8, 40px);
              margin: auto;">
          </div>
             <div id="practiceTimer" style="text-align:center; font-size:18px; margin-top:10px; color:black;"></div>`
    },   
    {
      text: `
        These are your teammates. One has a pink avatar, and the other is a robot player.
      `,
      demo: `
        <div style="
          display: flex; 
          align-items: center; 
          justify-content: center; 
          gap: 40px;
          height: 80px; 
          margin: auto;">
          <img src="./images/player2.png" alt="Player 2" 
               style="width: 80px; height: 80px; image-rendering: pixelated;">
          <img src="./images/robot.png" alt="Robot Player" 
               style="width: 80px; height: 80px; image-rendering: pixelated;">
        </div>
      `
  },
  {
          text: `
            Great job finishing the practice session! You will now be paired with one other participant and one robot to finish four levels together.\n
            Here's a quick recap before you join the real game:\n
            • Use arrow buttons to choose a direction you want to push a block or obstacle.\n
            • Some blocks need teamwork — look for the "2" or "3" labels to know how many players are required.\n
            • You'll have 5 seconds to vote, and your last choice will be carried out when the timer ends.\n
            • You can change your vote during the countdown — don't be afraid to coordinate!\n\n
            Your name is ${playerName}.\n
            You will have five minutes to finish Level 1. Have fun! \n
            Press Join Game when you are ready.
          `,
          demo: `
            <div style="
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              margin-top: 10px;
            ">
              <img src="./images/player1.png" alt="Your Avatar"
                style="width: 80px; height: 80px; image-rendering: pixelated; margin-bottom: 10px;">
              <div style="font-size: 18px; font-weight: bold;">
                ${playerName}
              </div>
            </div>
          `,
        
          showNameEntry: true
  }
];

let currentStep = 0;

const params = new URLSearchParams(window.location.search);
if (params.has("skipinstruction")) {
  currentStep = 9;
}


function renderInstructionStep() {
  const step = instructionSteps[currentStep];
  document.getElementById('instructionText').innerText = step.text;
  document.getElementById('instructionDemo').innerHTML = step.demo || '';

  // document.getElementById('prevInstruction').style.display = currentStep > 0 ? 'inline-block' : 'none';
  // document.getElementById('nextInstruction').style.display = currentStep < instructionSteps.length - 1 ? 'inline-block' : 'none';
  const nextBtn = document.getElementById('nextInstruction');
  if (!practiceSessionActive && currentStep < instructionSteps.length - 1) {
      nextBtn.style.display = 'inline-block';
  } else {
      nextBtn.style.display = 'none';
  }
  document.getElementById('name-entry').style.display = step.showNameEntry ? 'block' : 'none';
}

// document.getElementById('prevInstruction').onclick = () => {
//     if (currentStep > 0) currentStep--;
//     renderInstructionStep();
// };

document.getElementById('nextInstruction').onclick = () => {
  if (currentStep < instructionSteps.length - 1) currentStep++;
  if (currentStep === 2) {
      practiceSessionActive = true;
      hideNextButton();
      setTimeout(() => {
        drawPracticeBlock({ x: 4, y: 3, color: 'yellow', minVotes: 1 }, false);
      }, 50);
    }
  if(currentStep === 3){
      cleanupPracticeBoard();
      setTimeout(() => createPracticeSlot(2, 3), 50);
  }

  if (currentStep === 4) {
      cleanupPracticeBoard();
      setTimeout(() => {
      hideNextButton();
        createPracticeSlot(1, 3);
        drawPracticeBlock({ x: 4, y: 3, color: 'yellow', minVotes: 1 }, false);
        startPracticePhaseCycle();
      }, 50); 
    }

    if (currentStep === 5) {
      // Stop countdown updates
      clearInterval(practiceTimerInterval);
      practiceTimerInterval = null;

      if (practiceRestartTimeout) {
        clearTimeout(practiceRestartTimeout);
        practiceRestartTimeout = null;
    }


      // Clear the visible timer
      const timerEl = document.getElementById('practiceTimer');
      if (timerEl) timerEl.innerText = '';

      let practiceBlock = { x: 4, y: 2, color: 'yellow', minVotes: 1 };
      let practiceObstacle = { x: 2, y: 1, id: 'obs1' };
      cleanupPracticeBoard();
      setTimeout(() => {
      hideNextButton();
        createPracticeSlot(1, 3);
        drawPracticeBlock(practiceBlock, false);
        drawPracticeBlock(practiceObstacle, true, true);
        startPracticePhaseCycle();
      }, 50); 
    }

    if (currentStep === 6) {
      // Stop countdown updates
      clearInterval(practiceTimerInterval);
      practiceTimerInterval = null;

      // Clear the visible timer
      const timerEl = document.getElementById('practiceTimer');
      if (timerEl) timerEl.innerText = '';

      let practiceBlock = { x: 3, y: 3, color: 'yellow', minVotes: 1 };
      let practiceObstacle = { x: 1, y: 2, id: 'obs1' };
      cleanupPracticeBoard();
      setTimeout(() => {
      hideNextButton();
        createPracticeSlot(1, 3);
        drawPracticeBlock(practiceBlock, false);
        drawPracticeBlock(practiceObstacle, true);
        startPracticePhaseCycle();
      }, 50); 
    }

    if (currentStep === 7) {
      // Stop countdown updates
      clearInterval(practiceTimerInterval);
      practiceTimerInterval = null;

      if (practiceRestartTimeout) {
        clearTimeout(practiceRestartTimeout);
        practiceRestartTimeout = null;
    }


      // Clear the visible timer
      const timerEl = document.getElementById('practiceTimer');
      if (timerEl) timerEl.innerText = '';

      let practiceBlock = { x: 2, y: 3, color: 'red', minVotes: 2 };
      let practiceObstacle = { x: 0, y: 2, id: 'obs1' };
      let practiceObstacleTwo = { x: 6, y: 6, id: 'obs2' };
      cleanupPracticeBoard();
      setTimeout(() => {
      hideNextButton();
        createPracticeSlot(1, 3);
        drawPracticeBlock(practiceBlock, false);
        drawPracticeBlock(practiceObstacle, true);
        drawPracticeBlock(practiceObstacleTwo, true, true);
        startPracticePhaseCycle();
      }, 50); 
    }

    if (currentStep === 8) {
      // Stop countdown updates
      clearInterval(practiceTimerInterval);
      practiceTimerInterval = null;

      if (practiceRestartTimeout) {
        clearTimeout(practiceRestartTimeout);
        practiceRestartTimeout = null;
    }


      // Clear the visible timer
      const timerEl = document.getElementById('practiceTimer');
      if (timerEl) timerEl.innerText = '';

      let practiceBlock = { x: 2, y: 3, color: 'blue', minVotes: 3 };
      let practiceObstacle = { x: 0, y: 1, id: 'obs1' };
      let practiceObstacleTwo = { x: 5, y: 0, id: 'obs2' };
      cleanupPracticeBoard();
      setTimeout(() => {
      hideNextButton();
        createPracticeSlot(1, 3);
        drawPracticeBlock(practiceBlock, false);
        drawPracticeBlock(practiceObstacle, true);
        drawPracticeBlock(practiceObstacleTwo, true, true);
        startPracticePhaseCycle();
      }, 50); 
    }
    
  renderInstructionStep();
};

// renderInstructionStep();

document.getElementById('consentProceed').addEventListener('click', function () {
  const consentChecked = document.getElementById('consentcheckbox').checked;

  if (consentChecked) {
    document.getElementById('consentScreen').style.display = 'none';
    document.getElementById('instructionsScreen').style.display = 'block';
    renderInstructionStep(); // call your actual instruction-starting function here
  } else {
    alert("Please check the box to confirm your consent before proceeding.");
  }
});

function generateRandomName() {
  const firstWords = [
      'Ace', 'Zen', 'Max', 'Sky', 'Lux', 'Jay', 'Sam', 'Rio',
      'Ash', 'Kit', 'Tao', 'Bea', 'Neo', 'Sol', 'Kai'
    ];
    
  const secondWords = [
      'Fox', 'Cat', 'Owl', 'Bee', 'Bat', 'Dog', 'Ant', 'Yak',
      'Frog', 'Lynx', 'Cub', 'Rat', 'Pup', 'Hog', 'Bug'
    ];

  const first = firstWords[Math.floor(Math.random() * firstWords.length)];
  const second = secondWords[Math.floor(Math.random() * secondWords.length)];

  return `${first} ${second}`;
}

let practiceTimerInterval = null;

let practiceRestartTimeout = null;
  
function startPracticePhaseCycle() {
    const timerEl = document.getElementById('practiceTimer');
    if (!timerEl) return;
  
    // Cancel both interval AND pending restart
    if (practiceTimerInterval) {
      clearInterval(practiceTimerInterval);
      practiceTimerInterval = null;
    }
    if (practiceRestartTimeout) {
      clearTimeout(practiceRestartTimeout);
      practiceRestartTimeout = null;
    }
  
    let countdown = 5;
    timerEl.innerText = `Choose a direction to move an object – ${countdown}s remaining...`;
    showDirectionButtons();
  
    practiceTimerInterval = setInterval(() => {
      countdown--;
  
      if (countdown > 0) {

        if(currentStep == 7){
          const blockEl = document.querySelector('.block:not([data-obstacle="true"])');
          addPracticeArrowToBlock(blockEl, "left", 2);
      }
      if(currentStep == 8){
          const blockEl = document.querySelector('.block:not([data-obstacle="true"])');
          addPracticeArrowToBlock(blockEl, "left", 2);
          if(countdown > 3){
              addPracticeArrowToBlock(blockEl, "down", 3);
          }else{
              addPracticeArrowToBlock(blockEl, "left", 3);
          }
      }
        timerEl.innerText = `Choose a direction to move an object – ${countdown}s remaining...`;
        return;
      }
  
      clearInterval(practiceTimerInterval);
      practiceTimerInterval = null;
  
      timerEl.innerText = `Moving...`;
      finalizePracticeVotes();
      hideDirectionButtons();
  
      practiceRestartTimeout = setTimeout(() => {
        practiceRestartTimeout = null;
        startPracticePhaseCycle();
      }, 1500);
    }, 1000);
  }


function createPracticeSlot(x, y) {
  const board = document.getElementById("practiceBoard");
  const div = document.createElement("div");
  div.style.gridColumnStart = x + 1;
  div.style.gridRowStart = y + 1;
  div.style.gridColumnEnd = `span 3`;
  div.style.gridRowEnd = `span 3`;
  div.style.border = '4px dashed #3090c7';
  div.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
  div.style.boxShadow = '0 0 6px rgba(0, 255, 255, 0.7), inset 0 0 6px rgba(0, 255, 255, 0.3)';
  board.appendChild(div);
}

function drawPracticeBlock(block, isObstacle, immovable) {
  const CELL_SIZE = 40;
  const container = document.getElementById('practiceBoard'); 
  const div = document.createElement('div');
  div.classList.add('block');
  let width;
  let height;
  if(isObstacle){
      if(immovable){
          width = CELL_SIZE * 2;
          height = CELL_SIZE * 2;
      }else{
          width = CELL_SIZE * 2.3;
          height = CELL_SIZE * 2.3;
      }

  }else{
      width = CELL_SIZE * 3;
      height = CELL_SIZE * 3;
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
  div.style.left = (block.x * CELL_SIZE) + 'px';
  div.style.top = (block.y * CELL_SIZE) + 'px';
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

  if (isObstacle) {
      div.style.backgroundImage = immovable
        ? "url('./images/wall.png')"  // immovable obstacle → wall texture
        : "url('./images/obstacle.png')";   
        div.style.filter = 'none';                          // movable obstacle
    } else {
      div.style.backgroundImage = "url('./images/block.png')";         // normal block
    }


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
      minText.innerText = `${minRequired}`;
      minText.style.fontSize = '36px';
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
      if(!immovable){
          // div.style.backgroundColor = '#555'; // dark gray
          // div.style.borderRadius = '50%';
          const minText = document.createElement('div');
          minText.innerText = `1`;
          minText.style.fontSize = '24px';
          minText.style.fontWeight = 'bold';
          minText.style.textShadow = '1px 1px 0 #000';
          minText.style.color = 'white';
          minText.style.marginBottom = '2px';
          minText.style.imageRendering = 'pixelated';
          minText.style.fontFamily = 'monospace'; 
          div.appendChild(minText);

      }


  }

  const visualPosition = {
      up:    { top: '82%', left: '50%', transform: 'translate(-50%, -50%)' },
      down:  { top: '18%', left: '50%', transform: 'translate(-50%, -50%)' },
      left:  { top: '50%', left: '82%', transform: 'translate(-50%, -50%)' },
      right: { top: '50%', left: '18%', transform: 'translate(-50%, -50%)' }
  };
  
  const obstaclePosition = {
      up:    { top: '70%', left: '50%', transform: 'translate(-50%, -50%)' },
      down:  { top: '30%', left: '50%', transform: 'translate(-50%, -50%)' },
      left:  { top: '50%', left: '75%', transform: 'translate(-50%, -50%)' },
      right: { top: '50%', left: '25%', transform: 'translate(-50%, -50%)' }
  };
  
  if (isObstacle && immovable) {           // NEW
      container.appendChild(div);                  // NEW
      return;                                      // NEW
    }
  
  const directions = ['up', 'right', 'down', 'left'];
  directions.forEach(dir => {
      const arrow = document.createElement('div');
      arrow.classList.add('triangle', dir, 'direction-button');
      const pos = isObstacle ? obstaclePosition[dir] : visualPosition[dir];
      arrow.style.position = 'absolute';
      arrow.style.top = pos.top;
      arrow.style.left = pos.left;
      arrow.style.transform = pos.transform;
      arrow.dataset.direction = dir;
      arrow.dataset.targetId = id;
      arrow.dataset.isObstacle = isObstacle;
      if (isObstacle) {

              switch (dir) {
                  case 'up':
                      arrow.style.borderWidth = '12px 15px 16px 15px';
                      break;
                  case 'down':
                      arrow.style.borderWidth = '16px 15px 12px 15px';
                      break;
                  case 'left':
                      arrow.style.borderWidth = '15px 15px 15px 12px';
                      break;
                  case 'right':
                      arrow.style.borderWidth = '15px 12px 15px 15px';
                      break;
              }

          
      }
      

      arrow.addEventListener('click', () => {
          addPracticeArrowToBlock(div, dir, 1);
      });
      

      div.appendChild(arrow);
  });

  container.appendChild(div);
}

function addPracticeArrowToBlock(block, dir, whichPerson) {
  // Remove all existing arrows from any block
  document.querySelectorAll(`.arrow[data-player="${whichPerson}"]`).forEach(arrow => arrow.remove());

  // Clear all directions
  document.querySelectorAll('.block').forEach(b => delete b.dataset.direction);

  // Add a new arrow to the selected block
  const arrow = document.createElement('div');
  // arrow.src = './images/player1_arrow.png';
  arrow.classList.add('arrow');
  arrow.style.position = 'absolute';
  arrow.style.pointerEvents = 'none';
  arrow.dataset.player = whichPerson;


  arrow.style.width = '50px';
  arrow.style.height = '50px';
  arrow.style.position = 'absolute';
  arrow.style.pointerEvents = 'none';
  arrow.style.zIndex = '10000';
  arrow.style.transformOrigin = 'center center';
  if(whichPerson == 1){
      arrow.style.backgroundImage = `url(./images/player1_arrow.png) `;
  }else if(whichPerson == 2){
      arrow.style.backgroundImage = `url(./images/player2_arrow.png) `;
  }else if(whichPerson == 3){
      arrow.style.backgroundImage = `url(./images/robot_arrow.png) `;
  }
  arrow.style.backgroundRepeat = 'no-repeat';
  arrow.style.backgroundSize = `${6 * 50}px 50px`;
  arrow.style.imageRendering = 'pixelated';

  // Rotate based on direction
  const rotationMap = {
      up: 'rotate(90deg)',
      right: 'rotate(180deg)',
      down: 'rotate(270deg)',
      left: 'rotate(0deg)'
  };
  const visualPosition = {
      up: 'down',
      down: 'up',
      left: 'right',
      right: 'left'
  };

  arrow.dataset.rotation = rotationMap[visualPosition[dir]] || 'rotate(0deg)';
  arrow.dataset.direction = dir;
  arrow.style.backgroundPosition = '0px 0px';
  block.dataset.direction = dir;
  //animateSpriteLoop(arrow, 6, 50, 50, 6);

  block.appendChild(arrow);
  const isObstacle = block.dataset.obstacle === "true";

  // Re-layout all arrows of this direction in the block
  layoutDirectionalArrows(block, dir,isObstacle);
  if(currentStep < 4){
      finalizePracticeVotes();
  }
}    

function finalizePracticeVotes() {
  const container = document.getElementById('practiceBoard');
  const blocks = container.querySelectorAll('.block');
  const futurePlans = [];

  blocks.forEach(block => {
      const direction = block.dataset.direction; // assume each block stores it on click

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

  });

  // Collision detection
  for (let i = 0; i < futurePlans.length; i++) {
      for (let j = i + 1; j < futurePlans.length; j++) {
          const a = futurePlans[i];
          const b = futurePlans[j];

          const overlap = a.futureCoords.some(posA =>
              b.futureCoords.some(posB => posA.x === posB.x && posA.y === posB.y)
          );

          if (overlap) {
              a.willMove = false;
              b.willMove = false;
              console.log(`Collision between ${a.id} and ${b.id}`);
          }
      }
  }

  // Move if allowed
  futurePlans.forEach(plan => {
      if (plan.willMove) {
          movePracticeBlock(plan.block, plan.direction);
      }else{
          plan.block.querySelectorAll('.arrow').forEach(arrow => arrow.remove());
      }
  });
}

function movePracticeBlock(block, direction) {
  const CELL_SIZE = 40;
  const container = document.getElementById('practiceBoard');

  // Disable all direction buttons
  container.querySelectorAll('.direction-button').forEach(btn => btn.style.pointerEvents = 'none');

  const arrow = block.querySelector('.arrow');
  if (!arrow) return;

  const arrowRect = arrow.getBoundingClientRect();
  const clone = arrow.cloneNode(true);
  clone.classList.add('arrow-clone');
  clone.style.position = 'absolute';
  clone.style.pointerEvents = 'none';
  clone.style.transform = 'none';
  clone.style.left = `${arrowRect.left}px`;
  clone.style.top = `${arrowRect.top}px`;
  clone.style.margin = '0';
  clone.style.transition = 'top 0.5s ease, left 0.5s ease';
  clone.style.zIndex = '10000';

  // Apply rotation
  const rotationMap = {
      down: 'rotate(90deg)',
      left: 'rotate(180deg)',
      up: 'rotate(270deg)',
      right: 'rotate(0deg)'
  };
  clone.style.transform = rotationMap[direction];
  clone.style.transformOrigin = 'center center';
  if (direction === 'left') {
      clone.style.transform += ' scaleY(-1)';
  }

  document.body.appendChild(clone);

  const offsetMap = {
      up:    { dx: 0, dy: -1 },
      down:  { dx: 0, dy: 1 },
      left:  { dx: -1, dy: 0 },
      right: { dx: 1, dy: 0 }
  };
  const offset = offsetMap[direction];

  // Force reflow before triggering transition
  clone.offsetWidth;

  // Animate clone
  requestAnimationFrame(() => {
      clone.style.left = `${arrowRect.left + offset.dx * CELL_WIDTH}px`;
      clone.style.top = `${arrowRect.top + offset.dy * CELL_HEIGHT}px`;
  });

  // Optional: animate sprite
  animateSpriteOnce(clone, 6, 50, 50, 12);

  let x = parseInt(block.dataset.x);
  let y = parseInt(block.dataset.y);

  if (direction === 'up') y -= 1;
  if (direction === 'down') y += 1;
  if (direction === 'left') x -= 1;
  if (direction === 'right') x += 1;

  x = Math.max(0, Math.min(7, x));
  y = Math.max(0, Math.min(7, y));

  block.dataset.x = x;
  block.dataset.y = y;
  block.style.transition = 'top 0.5s ease, left 0.5s ease';
  block.style.left = `${x * CELL_SIZE}px`;
  block.style.top = `${y * CELL_SIZE}px`;

  // Move block after animation
  setTimeout(() => {
      document.body.removeChild(clone);

      const existing = block.querySelector('.arrow');
      if (existing) existing.remove();
      block.dataset.direction = '';

      container.querySelectorAll('.direction-button').forEach(btn => btn.style.pointerEvents = 'auto');
      console.log("x:", x, "y:", y, "obstacle:", block.dataset.obstacle);

      if(currentStep === 2){
          practiceSessionActive = false;
          showNextButton();
      }

      if (block.dataset.obstacle !== "true" && x === 1 && y === 3){

          block.style.backgroundImage = "url('./images/slot.png')"; // or a tinted version
          block.style.backgroundSize = 'cover';
          block.style.boxShadow = '0 0 6px gold';
          block.style.border = '2px solid gold';

          block.style.transition = 'opacity 0.5s';
          block.style.opacity = '0';
          setTimeout(() => {
              block.remove();

              document.getElementById("practiceTimer").style.color = "transparent";
              showNextButton();
          }, 500);
      }
  }, 500); // match with transition duration
}

function hideNextButton() {
  const btn = document.getElementById('nextInstruction');
  if (btn) {
    btn.style.display = 'none'; // or use btn.classList.add('hidden') if your CSS handles it
  } else {
    console.warn('Could not find #nextInstruction');
  }
}


function showNextButton() {
  const btn = document.getElementById('nextInstruction');
  if (btn) {
    btn.style.display = 'inline-block'; // or 'inline-block' depending on your layout
  }
}


function cleanupPracticeBoard() {
  const board = document.getElementById('practiceBoard');
  if (board) board.innerHTML = '';
}


//  Conatant Game Variables

let GameName = "followerRVTwo";
let NumPlayers = 2;
let MinPlayers = NumPlayers;
let MaxPlayers = NumPlayers;
let MaxSessions = 0;
let PlayerReplacement = false;
let LeaveWaitingRoomTime = 3;
let MinPlayerTimeout = 0;
let MaxSessionTime = 0;
let SaveData = true;

let playerId;

// ---- Phase Controller Lease ----
const PHASE_LEASE_MS  = 4000;  // lease lasts ~4s
const PHASE_TICK_MS   = 1000;  // renew/advance check cadence
const PHASE_DRIFT_MS  = 1200;  // drift tolerance

let iAmController     = false;
let leaseTimer        = null;
// ---- Controller/Tx hardening ----
let txBackoffMs = 0;                 // grows on failures, resets on success

// (optional but highly recommended) surface silent crashes
window.onerror = (m, s, l, c, e) => console.error('[GLOBAL ERROR]', m, s, l, c, e);
window.onunhandledrejection = (ev) => console.error('[UNHANDLED REJECTION]', ev?.reason || ev);

let currentPhaseSnap  = null;  // last phase object we saw
const lastMoveVersion = {};    // per-color applied move version


let arrivalIndex;

const CELL_WIDTH = 40;
const CELL_HEIGHT = 40;

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
let listenerPaths = [ 'players', 'blocks', 'slots', 'obs', 'phase', 'level', 'votes', 'moves'];

//  Initialize the Game Session with all Configs
initializeMPLIB( sessionConfig , studyId , funList, listenerPaths, verbosity );


//forcing a rebuild
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
// let currentPhase = null;
// let localCountdown = 0;

let currentLevel = 0;

//let eventNumber = 0;

let currentVoteCache = {}; 

let completedLevel = false;

let assigendCondition;

// function getForcedConditionFromURL() {
//   const cond = new URLSearchParams(window.location.search).get('cond');
//   const allowed = new Set(['abcd', 'cdab', 'bcda', 'dabc']);
//   return allowed.has(cond) ? cond : null;
// }

assigendCondition ='abcd';

console.log('assigned condition is', assigendCondition);

// function applyCondition(cond) {
//   assigendCondition = cond;
//   console.log('assigned condition is', assigendCondition);
//   if (cond === 'abcd') levelPlacements = abcd;
//   else if (cond === 'cdab') levelPlacements = cdab;
//   else if (cond === 'bcda') levelPlacements = bcda;
//   else if (cond === 'dabc') levelPlacements = dabc;
//   else levelPlacements = null;
// }

//const forced = getForcedConditionFromURL();


//abcd levelPlacements
const abcd = {
  0: {
      blocks: {
          blue: { x: 10, y: 10, color: 'blue', minVotes: 3 },
          red: { x: 8, y: 1, color: 'red', minVotes: 2},
          yellow: { x: 1, y: 10, color: 'yellow', minVotes: 1 }
      },
      slots: {
          slot0: { x: 3, y: 6 },
          slot1: { x: 16, y: 6 }
      },
      obstacles: {
          obs0:{x:9,y:5,id:'obs0', immovable:true},
          obs1:{x:9,y:7,id:'obs1', immovable:true},
          obs2:{x:6,y:5,id:'obs2'},
          obs3:{x:12,y:5,id:'obs3'},
      }
  },
  1: {
      blocks: {
          blue: { x: 12, y: 10, color: 'blue', minVotes: 3 },
          red: { x: 9, y: 1, color: 'red', minVotes: 2},
          yellow: { x: 2, y: 10, color: 'yellow', minVotes: 1 }
      },
      slots: {
          slot0: { x: 3, y: 4 },
          slot1: { x: 15, y: 4 }
      },
      obstacles: {
          obs0: { x: 6, y: 6, id: 'obs0', immovable: true  },
          obs1: { x: 8, y: 4, id: 'obs1', immovable: true},
          obs2: { x: 12, y: 5, id: 'obs2', immovable: true  },
          obs3: { x: 10, y: 7, id: 'obs3', immovable: true},
          obs4: { x: 14, y: 7, id: 'obs4', immovable: true },
          obs5: { x: 3, y: 1, id: 'obs5'},
          obs6: { x: 3, y: 7, id: 'obs6'},
          obs7: { x: 10, y: 10, id: 'obs7'}
      }
  },
  2: {
      blocks: {
          blue: { x: 16, y: 9, color: 'blue', minVotes: 3 },
          red: { x: 6, y: 1, color: 'red', minVotes: 2},
          yellow: { x: 6, y: 9, color: 'yellow', minVotes: 1 }
      },
      slots: {
          slot0: { x: 1, y: 6 },
          slot1: { x: 9, y: 5 }
      },
      obstacles: {
          obs0: { x: 3, y: 10, id: 'obs0', immovable: true  },
          obs1: { x: 13, y: 6, id: 'obs1', immovable: true},
          obs2: { x: 2, y: 3, id: 'obs2'},
          obs3: { x: 6, y: 6, id: 'obs3'},
          obs4: { x: 10, y: 9, id: 'obs4'}
      }
  },
  3: {
      blocks: {
          blue: { x: 9, y: 4, color: 'blue', minVotes: 3 },
          red: { x: 7, y: 1, color: 'red', minVotes: 2 },
          yellow: { x: 11, y: 1, color: 'yellow', minVotes: 1 }
      },
      slots: {
          slot0: { x: 3, y: 5 },
          slot1: { x: 14, y: 5 }
      },
      obstacles: {
          obs0: { x: 6, y: 4, id: 'obs0', immovable: true  },
          obs1: { x: 3, y: 2, id: 'obs1', immovable: true},
          obs3: { x: 6, y: 8, id: 'obs3'},
          obs4: { x: 15, y: 1, id: 'obs4' },
          obs2: { x: 12, y: 4, id: 'obs2', immovable: true  },
          obs5: { x: 12, y: 8, id: 'obs5'}
      }
  },
};
//cdab
const cdab = {
  0: {
      blocks: {
        //blue: { x: 16, y: 9, color: 'blue', minVotes: 3 },
        red: { x: 6, y: 1, color: 'red', minVotes: 2},
        yellow: { x: 6, y: 9, color: 'yellow', minVotes: 1 }
    },
    slots: {
        slot0: { x: 1, y: 6 },
        slot1: { x: 9, y: 5 }
    },
    obstacles: {
        obs0: { x: 3, y: 10, id: 'obs0', immovable: true  },
        obs1: { x: 13, y: 6, id: 'obs1', immovable: true},
        obs2: { x: 2, y: 3, id: 'obs2'},
        obs3: { x: 6, y: 6, id: 'obs3'},
        obs4: { x: 10, y: 9, id: 'obs4'}
    }
  },
  1:{
        blocks: {
          //blue: { x: 9, y: 4, color: 'blue', minVotes: 3 },
          red: { x: 7, y: 1, color: 'red', minVotes: 2 },
          yellow: { x: 11, y: 1, color: 'yellow', minVotes: 1 }
      },
      slots: {
          slot0: { x: 3, y: 5 },
          slot1: { x: 14, y: 5 }
      },
      obstacles: {
          obs0: { x: 6, y: 4, id: 'obs0', immovable: true  },
          obs1: { x: 3, y: 2, id: 'obs1', immovable: true},
          obs3: { x: 6, y: 8, id: 'obs3'},
          obs4: { x: 15, y: 1, id: 'obs4' },
          obs2: { x: 12, y: 4, id: 'obs2', immovable: true  },
          obs5: { x: 12, y: 8, id: 'obs5'}
      }
  }, 
  2: {
          blocks: {
              //blue: { x: 10, y: 10, color: 'blue', minVotes: 3 },
              red: { x: 8, y: 1, color: 'red', minVotes: 2},
              yellow: { x: 1, y: 10, color: 'yellow', minVotes: 1 }
          },
          slots: {
              slot0: { x: 3, y: 6 },
              slot1: { x: 16, y: 6 }
          },
          obstacles: {
              obs0:{x:9,y:5,id:'obs0', immovable:true},
              obs1:{x:9,y:7,id:'obs1', immovable:true},
              obs2:{x:6,y:5,id:'obs2'},
              obs3:{x:12,y:5,id:'obs3'},
          }
    },
  3: {
    blocks: {
        //blue: { x: 12, y: 10, color: 'blue', minVotes: 3 },
        red: { x: 9, y: 1, color: 'red', minVotes: 2},
        yellow: { x: 2, y: 10, color: 'yellow', minVotes: 1 }
    },
    slots: {
        slot0: { x: 3, y: 4 },
        slot1: { x: 15, y: 4 }
    },
    obstacles: {
        obs0: { x: 6, y: 6, id: 'obs0', immovable: true  },
        obs1: { x: 8, y: 4, id: 'obs1', immovable: true},
        obs2: { x: 12, y: 5, id: 'obs2', immovable: true  },
        obs3: { x: 10, y: 7, id: 'obs3', immovable: true},
        obs4: { x: 14, y: 7, id: 'obs4', immovable: true },
        obs5: { x: 3, y: 1, id: 'obs5'},
        obs6: { x: 3, y: 7, id: 'obs6'},
        obs7: { x: 10, y: 10, id: 'obs7'}
    }
 },
};

// // //bcda
const bcda = {
  0: {
    blocks: {
        blue: { x: 12, y: 10, color: 'blue', minVotes: 3 },
        red: { x: 9, y: 1, color: 'red', minVotes: 2},
        yellow: { x: 2, y: 10, color: 'yellow', minVotes: 1 }
    },
    slots: {
        slot0: { x: 3, y: 4 },
        slot1: { x: 15, y: 4 }
    },
    obstacles: {
        obs0: { x: 6, y: 6, id: 'obs0', immovable: true  },
        obs1: { x: 8, y: 4, id: 'obs1', immovable: true},
        obs2: { x: 12, y: 5, id: 'obs2', immovable: true  },
        obs3: { x: 10, y: 7, id: 'obs3', immovable: true},
        obs4: { x: 14, y: 7, id: 'obs4', immovable: true },
        obs5: { x: 3, y: 1, id: 'obs5'},
        obs6: { x: 3, y: 7, id: 'obs6'},
        obs7: { x: 10, y: 10, id: 'obs7'}
    }
 },
  1: {
    blocks: {
        blue: { x: 16, y: 9, color: 'blue', minVotes: 3 },
        red: { x: 6, y: 1, color: 'red', minVotes: 2},
        yellow: { x: 6, y: 9, color: 'yellow', minVotes: 1 }
    },
    slots: {
        slot0: { x: 1, y: 6 },
        slot1: { x: 9, y: 5 }
    },
    obstacles: {
        obs0: { x: 3, y: 10, id: 'obs0', immovable: true  },
        obs1: { x: 13, y: 6, id: 'obs1', immovable: true},
        obs2: { x: 2, y: 3, id: 'obs2'},
        obs3: { x: 6, y: 6, id: 'obs3'},
        obs4: { x: 10, y: 9, id: 'obs4'}
    }
},
  2: {
    blocks: {
        blue: { x: 9, y: 4, color: 'blue', minVotes: 3 },
        red: { x: 7, y: 1, color: 'red', minVotes: 2 },
        yellow: { x: 11, y: 1, color: 'yellow', minVotes: 1 }
    },
    slots: {
        slot0: { x: 3, y: 5 },
        slot1: { x: 14, y: 5 }
    },
    obstacles: {
        obs0: { x: 6, y: 4, id: 'obs0', immovable: true  },
        obs1: { x: 3, y: 2, id: 'obs1', immovable: true},
        obs3: { x: 6, y: 8, id: 'obs3'},
        obs4: { x: 15, y: 1, id: 'obs4' },
        obs2: { x: 12, y: 4, id: 'obs2', immovable: true  },
        obs5: { x: 12, y: 8, id: 'obs5'}
    }
},
  3: {
    blocks: {
        blue: { x: 10, y: 10, color: 'blue', minVotes: 3 },
        red: { x: 8, y: 1, color: 'red', minVotes: 2},
        yellow: { x: 1, y: 10, color: 'yellow', minVotes: 1 }
    },
    slots: {
        slot0: { x: 3, y: 6 },
        slot1: { x: 16, y: 6 }
    },
    obstacles: {
        obs0:{x:9,y:5,id:'obs0', immovable:true},
        obs1:{x:9,y:7,id:'obs1', immovable:true},
        obs2:{x:6,y:5,id:'obs2'},
        obs3:{x:12,y:5,id:'obs3'},
    }
},
};

// //dabc
const dabc = {
  0: {
    blocks: {
        blue: { x: 9, y: 4, color: 'blue', minVotes: 3 },
        red: { x: 7, y: 1, color: 'red', minVotes: 2 },
        yellow: { x: 11, y: 1, color: 'yellow', minVotes: 1 }
    },
    slots: {
        slot0: { x: 3, y: 5 },
        slot1: { x: 14, y: 5 }
    },
    obstacles: {
        obs0: { x: 6, y: 4, id: 'obs0', immovable: true  },
        obs1: { x: 3, y: 2, id: 'obs1', immovable: true},
        obs3: { x: 6, y: 8, id: 'obs3'},
        obs4: { x: 15, y: 1, id: 'obs4' },
        obs2: { x: 12, y: 4, id: 'obs2', immovable: true  },
        obs5: { x: 12, y: 8, id: 'obs5'}
    }
},
  1:  {
    blocks: {
        blue: { x: 10, y: 10, color: 'blue', minVotes: 3 },
        red: { x: 8, y: 1, color: 'red', minVotes: 2},
        yellow: { x: 1, y: 10, color: 'yellow', minVotes: 1 }
    },
    slots: {
        slot0: { x: 3, y: 6 },
        slot1: { x: 16, y: 6 }
    },
    obstacles: {
        obs0:{x:9,y:5,id:'obs0', immovable:true},
        obs1:{x:9,y:7,id:'obs1', immovable:true},
        obs2:{x:6,y:5,id:'obs2'},
        obs3:{x:12,y:5,id:'obs3'},
    }
},
  2: {
    blocks: {
        blue: { x: 12, y: 10, color: 'blue', minVotes: 3 },
        red: { x: 9, y: 1, color: 'red', minVotes: 2},
        yellow: { x: 2, y: 10, color: 'yellow', minVotes: 1 }
    },
    slots: {
        slot0: { x: 3, y: 4 },
        slot1: { x: 15, y: 4 }
    },
    obstacles: {
        obs0: { x: 6, y: 6, id: 'obs0', immovable: true  },
        obs1: { x: 8, y: 4, id: 'obs1', immovable: true},
        obs2: { x: 12, y: 5, id: 'obs2', immovable: true  },
        obs3: { x: 10, y: 7, id: 'obs3', immovable: true},
        obs4: { x: 14, y: 7, id: 'obs4', immovable: true },
        obs5: { x: 3, y: 1, id: 'obs5'},
        obs6: { x: 3, y: 7, id: 'obs6'},
        obs7: { x: 10, y: 10, id: 'obs7'}
    }
 },
  3:{
    blocks: {
        blue: { x: 16, y: 9, color: 'blue', minVotes: 3 },
        red: { x: 6, y: 1, color: 'red', minVotes: 2},
        yellow: { x: 6, y: 9, color: 'yellow', minVotes: 1 }
    },
    slots: {
        slot0: { x: 1, y: 6 },
        slot1: { x: 9, y: 5 }
    },
    obstacles: {
        obs0: { x: 3, y: 10, id: 'obs0', immovable: true  },
        obs1: { x: 13, y: 6, id: 'obs1', immovable: true},
        obs2: { x: 2, y: 3, id: 'obs2'},
        obs3: { x: 6, y: 6, id: 'obs3'},
        obs4: { x: 10, y: 9, id: 'obs4'}
    }
},
};


// applyCondition(forced);

let levelPlacements = abcd;
//cdab
// const levelPlacements = {
//   0: {
//     blocks: {
//         red: { x: 4, y: 6, color: 'red', minVotes: 2},
//         yellow: { x: 1, y: 10, color: 'yellow', minVotes: 1 }
//     },
//     slots: {
//         slot0: { x: 6, y: 1 }
//     },
//     obstacles: {
//       obs0:{x:5,y:4,id:'obs0', immovable:true},
//       obs1:{x:7,y:6,id:'obs1', immovable:true},
//       obs2:{x:10,y:6,id:'obs2', immovable:true},
//       obs3:{x:13,y:6,id:'obs3', immovable:true},
//       obs4:{x:2,y:3,id:'obs4'},
//       obs5:{x:2,y:6,id:'obs5'},
//     }
// },
//   1: {
//     blocks: {
//         red: { x: 4, y: 6, color: 'red', minVotes: 2 },
//         yellow: { x: 1, y: 10, color: 'yellow', minVotes: 1 }
//     },
//     slots: {
//       slot0: { x: 6, y: 1 }
//     },
//     obstacles: {
//       obs0:{x:5,y:4,id:'obs0', immovable:true},
//       obs1:{x:7,y:6,id:'obs1', immovable:true},
//       obs2:{x:10,y:6,id:'obs2', immovable:true},
//       obs3:{x:13,y:6,id:'obs3', immovable:true},
//       obs4:{x:2,y:3,id:'obs4'},
//       obs5:{x:2,y:6,id:'obs5'},
//     }
// },
// //   2: {
// //           blocks: {
// //               blue: { x: 10, y: 10, color: 'blue', minVotes: 3 },
// //               red: { x: 8, y: 1, color: 'red', minVotes: 2},
// //               yellow: { x: 1, y: 10, color: 'yellow', minVotes: 1 }
// //           },
// //           slots: {
// //               slot0: { x: 3, y: 6 },
// //               slot1: { x: 16, y: 6 }
// //           },
// //           obstacles: {
// //               obs0:{x:9,y:5,id:'obs0', immovable:true},
// //               obs1:{x:9,y:7,id:'obs1', immovable:true},
// //               obs2:{x:6,y:5,id:'obs2'},
// //               obs3:{x:12,y:5,id:'obs3'},
// //           }
// //     },
// //   3: {
// //     blocks: {
// //         blue: { x: 12, y: 10, color: 'blue', minVotes: 3 },
// //         red: { x: 9, y: 1, color: 'red', minVotes: 2},
// //         yellow: { x: 2, y: 10, color: 'yellow', minVotes: 1 }
// //     },
// //     slots: {
// //         slot0: { x: 3, y: 4 },
// //         slot1: { x: 15, y: 4 }
// //     },
// //     obstacles: {
// //         obs0: { x: 6, y: 6, id: 'obs0', immovable: true  },
// //         obs1: { x: 8, y: 4, id: 'obs1', immovable: true},
// //         obs2: { x: 12, y: 5, id: 'obs2', immovable: true  },
// //         obs3: { x: 10, y: 7, id: 'obs3', immovable: true},
// //         obs4: { x: 14, y: 7, id: 'obs4', immovable: true },
// //         obs5: { x: 3, y: 1, id: 'obs5'},
// //         obs6: { x: 3, y: 7, id: 'obs6'},
// //         obs7: { x: 10, y: 10, id: 'obs7'}
// //     }
// //  },
// };

// // //bcda
// const levelPlacements = {
//   0: {
//     blocks: {
//         blue: { x: 12, y: 10, color: 'blue', minVotes: 3 },
//         red: { x: 9, y: 1, color: 'red', minVotes: 2},
//         yellow: { x: 2, y: 10, color: 'yellow', minVotes: 1 }
//     },
//     slots: {
//         slot0: { x: 3, y: 4 },
//         slot1: { x: 15, y: 4 }
//     },
//     obstacles: {
//         obs0: { x: 6, y: 6, id: 'obs0', immovable: true  },
//         obs1: { x: 8, y: 4, id: 'obs1', immovable: true},
//         obs2: { x: 12, y: 5, id: 'obs2', immovable: true  },
//         obs3: { x: 10, y: 7, id: 'obs3', immovable: true},
//         obs4: { x: 14, y: 7, id: 'obs4', immovable: true },
//         obs5: { x: 3, y: 1, id: 'obs5'},
//         obs6: { x: 3, y: 7, id: 'obs6'},
//         obs7: { x: 10, y: 10, id: 'obs7'}
//     }
//  },
//   1: {
//     blocks: {
//         blue: { x: 16, y: 9, color: 'blue', minVotes: 3 },
//         red: { x: 6, y: 1, color: 'red', minVotes: 2},
//         yellow: { x: 6, y: 9, color: 'yellow', minVotes: 1 }
//     },
//     slots: {
//         slot0: { x: 1, y: 6 },
//         slot1: { x: 9, y: 5 }
//     },
//     obstacles: {
//         obs0: { x: 3, y: 10, id: 'obs0', immovable: true  },
//         obs1: { x: 13, y: 6, id: 'obs1', immovable: true},
//         obs2: { x: 2, y: 3, id: 'obs2'},
//         obs3: { x: 6, y: 6, id: 'obs3'},
//         obs4: { x: 10, y: 9, id: 'obs4'}
//     }
// },
//   2: {
//     blocks: {
//         blue: { x: 9, y: 4, color: 'blue', minVotes: 3 },
//         red: { x: 7, y: 1, color: 'red', minVotes: 2 },
//         yellow: { x: 11, y: 1, color: 'yellow', minVotes: 1 }
//     },
//     slots: {
//         slot0: { x: 3, y: 5 },
//         slot1: { x: 14, y: 5 }
//     },
//     obstacles: {
//         obs0: { x: 6, y: 4, id: 'obs0', immovable: true  },
//         obs1: { x: 3, y: 2, id: 'obs1', immovable: true},
//         obs3: { x: 6, y: 8, id: 'obs3'},
//         obs4: { x: 15, y: 1, id: 'obs4' },
//         obs2: { x: 12, y: 4, id: 'obs2', immovable: true  },
//         obs5: { x: 12, y: 8, id: 'obs5'}
//     }
// },
//   3: {
//     blocks: {
//         blue: { x: 10, y: 10, color: 'blue', minVotes: 3 },
//         red: { x: 8, y: 1, color: 'red', minVotes: 2},
//         yellow: { x: 1, y: 10, color: 'yellow', minVotes: 1 }
//     },
//     slots: {
//         slot0: { x: 3, y: 6 },
//         slot1: { x: 16, y: 6 }
//     },
//     obstacles: {
//         obs0:{x:9,y:5,id:'obs0', immovable:true},
//         obs1:{x:9,y:7,id:'obs1', immovable:true},
//         obs2:{x:6,y:5,id:'obs2'},
//         obs3:{x:12,y:5,id:'obs3'},
//     }
// },
// };


// //dabc
// const levelPlacements = {
//   0: {
//     blocks: {
//         blue: { x: 9, y: 4, color: 'blue', minVotes: 3 },
//         red: { x: 7, y: 1, color: 'red', minVotes: 2 },
//         yellow: { x: 11, y: 1, color: 'yellow', minVotes: 1 }
//     },
//     slots: {
//         slot0: { x: 3, y: 5 },
//         slot1: { x: 14, y: 5 }
//     },
//     obstacles: {
//         obs0: { x: 6, y: 4, id: 'obs0', immovable: true  },
//         obs1: { x: 3, y: 2, id: 'obs1', immovable: true},
//         obs3: { x: 6, y: 8, id: 'obs3'},
//         obs4: { x: 15, y: 1, id: 'obs4' },
//         obs2: { x: 12, y: 4, id: 'obs2', immovable: true  },
//         obs5: { x: 12, y: 8, id: 'obs5'}
//     }
// },
//   1:  {
//     blocks: {
//         blue: { x: 10, y: 10, color: 'blue', minVotes: 3 },
//         red: { x: 8, y: 1, color: 'red', minVotes: 2},
//         yellow: { x: 1, y: 10, color: 'yellow', minVotes: 1 }
//     },
//     slots: {
//         slot0: { x: 3, y: 6 },
//         slot1: { x: 16, y: 6 }
//     },
//     obstacles: {
//         obs0:{x:9,y:5,id:'obs0', immovable:true},
//         obs1:{x:9,y:7,id:'obs1', immovable:true},
//         obs2:{x:6,y:5,id:'obs2'},
//         obs3:{x:12,y:5,id:'obs3'},
//     }
// },
//   2: {
//     blocks: {
//         blue: { x: 12, y: 10, color: 'blue', minVotes: 3 },
//         red: { x: 9, y: 1, color: 'red', minVotes: 2},
//         yellow: { x: 2, y: 10, color: 'yellow', minVotes: 1 }
//     },
//     slots: {
//         slot0: { x: 3, y: 4 },
//         slot1: { x: 15, y: 4 }
//     },
//     obstacles: {
//         obs0: { x: 6, y: 6, id: 'obs0', immovable: true  },
//         obs1: { x: 8, y: 4, id: 'obs1', immovable: true},
//         obs2: { x: 12, y: 5, id: 'obs2', immovable: true  },
//         obs3: { x: 10, y: 7, id: 'obs3', immovable: true},
//         obs4: { x: 14, y: 7, id: 'obs4', immovable: true },
//         obs5: { x: 3, y: 1, id: 'obs5'},
//         obs6: { x: 3, y: 7, id: 'obs6'},
//         obs7: { x: 10, y: 10, id: 'obs7'}
//     }
//  },
//   3:{
//     blocks: {
//         blue: { x: 16, y: 9, color: 'blue', minVotes: 3 },
//         red: { x: 6, y: 1, color: 'red', minVotes: 2},
//         yellow: { x: 6, y: 9, color: 'yellow', minVotes: 1 }
//     },
//     slots: {
//         slot0: { x: 1, y: 6 },
//         slot1: { x: 9, y: 5 }
//     },
//     obstacles: {
//         obs0: { x: 3, y: 10, id: 'obs0', immovable: true  },
//         obs1: { x: 13, y: 6, id: 'obs1', immovable: true},
//         obs2: { x: 2, y: 3, id: 'obs2'},
//         obs3: { x: 6, y: 6, id: 'obs3'},
//         obs4: { x: 10, y: 9, id: 'obs4'}
//     }
// },
// };

function initializeLevel(levelNumber) {
  const config = levelPlacements[levelNumber];
  if (!config) return;
  
  // Clear previous state
  GameState.blocks = {};
  GameState.obstacles = {};
  GameState.slots = config.slots;
  
  // Initialize blocks with location property
  Object.entries(config.blocks).forEach(([id, blockConfig]) => {
    GameState.blocks[id] = {
      location: { x: blockConfig.x, y: blockConfig.y },
      color: blockConfig.color,
      minVotes: blockConfig.minVotes,
      locked: false
    };
  });
  
  // Initialize obstacles
  Object.entries(config.obstacles || {}).forEach(([id, obsConfig]) => {
    GameState.obstacles[id] = {
      location: { x: obsConfig.x, y: obsConfig.y },
      immovable: obsConfig.immovable || false
    };
  });
  
  // Write to Firebase
  updateStateDirect('blocks', GameState.blocks, 'initialize blocks');
  updateStateDirect('obs', GameState.obstacles, 'initialize obstacles');
  updateStateDirect('slots', GameState.slots, 'initialize slots');
  
  // Render
  drawPerimeterWalls();
  Object.values(GameState.slots).forEach(slot => drawSlot(slot));
  Object.entries(GameState.blocks).forEach(([id, block]) => {
    drawBlock({ ...block, x: block.location.x, y: block.location.y, color: id }, false);
  });
  Object.entries(GameState.obstacles).forEach(([id, obs]) => {
    drawBlock({ ...obs, x: obs.location.x, y: obs.location.y, id }, true);
  });
}

function getTeammates() {
  const myId = getCurrentPlayerId();
  const teammates = [];

  for (const [id, info] of Object.entries(playerColorMap)) {
    if (id !== myId) {
      teammates.push({ id, name: info.name, color: info.color });
    }
  }

  return teammates;
}

function showFinishScreenWithQuestions(teammates) {
  document.getElementById('levelCompleteScreen').style.display = 'none';
  document.getElementById('gameScreen').style.display = 'none';
  const container = document.getElementById("teammate-questions");
  container.innerHTML = "";

  teammates.forEach(teammate => {
    const id = teammate.id;
    const name = teammate.name;
    const color = teammate.color;

    const block = document.createElement("div");
    block.className = "teammate-block";
    const isRobot = color === 3; // Robot always has color 3
    const avatarSrc = isRobot ? './images/robot.png' : `./images/player${color}.png`; 
    block.innerHTML = `
    <div style="border: 2px solid #999; border-radius: 12px; padding: 15px; margin-bottom: 20px;">
      <div style="text-align: center; margin-bottom: 10px;">
      <img src="${avatarSrc}" class="avatar-icon" alt="Player Icon" style="width: 50px; height: 50px; display: block; margin: 0 auto;">
      <div><strong>${name}</strong></div>
      </div>
  
      <label><strong>This player is a good teammate.</strong></label>
      <div style="margin-bottom: 10px;">
        <span>Completely disagree</span>
        ${[1,2,3,4,5,6,7].map(v => `<label><input type="radio" name="collab-${id}" value="${v}"></label>`).join('')}
        <span>Completely agree</span>
      </div>

      <label><strong>This player and I were a team.</strong></label>
      <div style="margin-bottom: 10px;">
        <span>Completely disagree</span>
        ${[1,2,3,4,5,6,7].map(v => `<label><input type="radio" name="team-${id}" value="${v}"></label>`).join('')}
        <span>Completely agree</span>
      </div>

      <label><strong>This player was competent.</strong></label>
      <div style="margin-bottom: 10px;">
        <span>Completely disagree</span>
        ${[1,2,3,4,5,6,7].map(v => `<label><input type="radio" name="competent-${id}" value="${v}"></label>`).join('')}
        <span>Completely agree</span>
      </div>

      <label><strong>I understood this player's intentions.</strong></label>
      <div style="margin-bottom: 10px;">
        <span>Completely disagree</span>
        ${[1,2,3,4,5,6,7].map(v => `<label><input type="radio" name="intentionthem-${id}" value="${v}"></label>`).join('')}
        <span>Completely agree</span>
      </div>

      <label><strong>This player understood my intentions.</strong></label>
      <div style="margin-bottom: 10px;">
        <span>Completely disagree</span>
        ${[1,2,3,4,5,6,7].map(v => `<label><input type="radio" name="intentionmy-${id}" value="${v}"></label>`).join('')}
        <span>Completely agree</span>
      </div>

      <label><strong>This player was easy to play with.</strong></label>
      <div style="margin-bottom: 10px;">
        <span>Completely disagree</span>
        ${[1,2,3,4,5,6,7].map(v => `<label><input type="radio" name="easy-${id}" value="${v}"></label>`).join('')}
        <span>Completely agree</span>
      </div>

      <label><strong>This player was fun to play with.</strong></label>
      <div style="margin-bottom: 10px;">
        <span>Completely disagree</span>
        ${[1,2,3,4,5,6,7].map(v => `<label><input type="radio" name="fun-${id}" value="${v}"></label>`).join('')}
        <span>Completely agree</span>
      </div>

      <label><strong>This player and I had a similar playing style.</strong></label>
      <div style="margin-bottom: 10px;">
        <span>Completely disagree</span>
        ${[1,2,3,4,5,6,7].map(v => `<label><input type="radio" name="similar-${id}" value="${v}"></label>`).join('')}
        <span>Completely agree</span>
      </div>

      <label><strong>This player was human-like.</strong></label>
      <div style="margin-bottom: 10px;">
        <span>Completely disagree</span>
        ${[1,2,3,4,5,6,7].map(v => `<label><input type="radio" name="human-${id}" value="${v}"></label>`).join('')}
        <span>Completely agree</span>
      </div>
  
      <label><strong>How would you describe this teammate? (minimum 20 characters)</strong></label><br>
      <textarea id="desc-${id}" class="form-control" rows="3" style="width: 100%; max-width: 500px; margin-top: 5px;"></textarea>
    </div>
  `;
    
  
    container.appendChild(block);
  });

  //Create and append the submit button
  const form = document.getElementById("postTrialForm");

  const submitButton = document.createElement("button");
  submitButton.className = "button";
  submitButton.textContent = "Submit";
  submitButton.type = "button"; // important: prevent accidental submit
  submitButton.onclick = submitPostTrial;
  
  form.appendChild(submitButton);

  container.appendChild(submitButton);

  document.getElementById("finishScreen").style.display = "block";
}


function submitPostTrial() {
  const myId = getCurrentPlayerId();

  // Simple validation
  const satisfactionEl = document.querySelector('input[name="satisfaction"]:checked');
  const satisfaction = satisfactionEl ? satisfactionEl.value : null;

  const difficultyEl = document.querySelector('input[name="difficulty"]:checked');
  const difficulty = difficultyEl ? difficultyEl.value : null;

  const contributionEl = document.querySelector('input[name="contribution"]:checked');
  const contribution = contributionEl ? contributionEl.value : null;

  if (!satisfaction || !difficulty || !contribution) {
      alert("Please answer all general questions before submitting.");
      return;
  }

  const teammateResponses = {};
  let incompleteTeammate = false;

  Object.entries(playerColorMap).forEach(([pid, data]) => {
      if (pid === myId) return;

      const collabEl = document.querySelector(`input[name="collab-${pid}"]:checked`);
      const collab = collabEl ? collabEl.value : null;

      const teamEl = document.querySelector(`input[name="team-${pid}"]:checked`);
      const team =  teamEl ?  teamEl.value : null;

      const competentEl = document.querySelector(`input[name="competent-${pid}"]:checked`);
      const competent = competentEl ? competentEl.value : null;

      const intentionthemEl = document.querySelector(`input[name="intentionthem-${pid}"]:checked`);
      const intentionthem = intentionthemEl ? intentionthemEl.value : null;

      const intentionmyEl = document.querySelector(`input[name="intentionmy-${pid}"]:checked`);
      const intentionmy = intentionmyEl ? intentionmyEl.value : null;

      const easyEl = document.querySelector(`input[name="easy-${pid}"]:checked`);
      const easy = easyEl ? easyEl.value : null;

      const funEl = document.querySelector(`input[name="fun-${pid}"]:checked`);
      const fun = funEl ? funEl.value : null;

      const similarEl = document.querySelector(`input[name="similar-${pid}"]:checked`);
      const similar = similarEl ? similarEl.value : null;

      const humanEl = document.querySelector(`input[name="human-${pid}"]:checked`);
      const human = humanEl ? humanEl.value : null;

      const desc = document.getElementById(`desc-${pid}`).value.trim();

      if (!collab || !human || !team || !competent || !intentionthem || !intentionmy || !easy || !fun || !similar || desc.length < 20) {
          incompleteTeammate = true;
      }
      

      teammateResponses[pid] = {
          completed: completedLevel,
          collaborative: collab,
          asATeam: team,
          isCompetent: competent,
          intentioThem: intentionthem,
          intentionMy: intentionmy,
          easyToWork: easy,
          funToPlay: fun,
          similatToMe:  similar,
          humanlike: human,
          description: desc
      };
  });

  if (incompleteTeammate) {
      alert('Please answer all questions about your teammates. Each description must be at least 20 characters.');
      return;
  }
  
  const dataToSave = {
      satisfaction,
      difficulty,
      contribution,
      teammates: teammateResponses
  };

  updateStateDirect(`players/${myId}`, dataToSave, 'postTrial');

  const container = document.getElementById('messageFinish');
  container.innerHTML = `<p> Thank you! Your responses have been recorded.<br>Redirecting to Prolific...</p>`;

  setTimeout(() => {
      window.location.href = 'https://app.prolific.com/submissions/complete?cc=C71S2AXW'; // Replace with your code
      endSession();
  }, 3000);
}

function showLevelCompleteMessage(levelNumber, callback) {
  const screen = document.getElementById('levelCompleteScreen');

  // Clear any previous content
  screen.innerHTML = '';

  // Create a new message element
  const message = document.createElement('div');
  if(currentLevel < 3){
      message.style.fontSize = '20px';
      message.style.fontWeight = 'bold';
      message.style.color = '#333';
      message.style.padding = '10px';

  }else{
      message.style.fontSize = '32px';
      message.style.fontWeight = 'bold';
      message.style.color = '#333';
      message.style.padding = '20px';
  }

  message.style.fontFamily = 'monospace';
  message.style.textAlign = 'center';

  if (currentLevel === 3) {
      message.innerHTML = `🎉 You've completed all levels!<br>You will be redirected to a post-trial questionnaire.`;
      screen.appendChild(message);
      screen.style.display = 'flex';

      setTimeout(() => {
          const teammates = getTeammates();
          showFinishScreenWithQuestions(teammates);
          //window.location.href = 'https://app.prolific.co/submissions/complete?cc=XXXXXXX'; // Replace with your real code
      }, 3000);
  } else {
      
      // Header based on completion status
      let finished = completedLevel;
      let headerText = completedLevel
        ? `🎉 You've completed Level ${levelNumber + 1}!`
        : `Time is up on Level ${levelNumber + 1}.`;
      
      // Reset the flag for the next round
      completedLevel = false;
      
      // Full message with header and questionnaire
      message.innerHTML = `
        ${headerText}<br>
        Before moving on to Level ${levelNumber + 2}, please answer a few quick questions about your experience.<br><br>
      
        <div>
          <label><strong>1. How satisfied are you with the gameplay in the last level?<span style="color: red">*</span></strong></label><br>
          <span>Not at all</span>
          ${[1,2,3,4,5,6,7].map(v => `<label><input type="radio" name="satisfaction" value="${v}"></label>`).join('')}
          <span>Very satisfied</span>
        </div><br>
      
        <div>
          <label><strong>2. How difficult was the task in the last level?<span style="color: red">*</span></strong></label><br>
          <span>Not difficult at all</span>
          ${[1,2,3,4,5,6,7].map(v => `<label><input type="radio" name="difficulty" value="${v}"></label>`).join('')}
          <span>Extremely difficult</span>
        </div><br>
      
        <div>
          <label><strong>3. Did you feel like you contributed to the outcome?<span style="color: red">*</span></strong></label><br>
          <span>Not at all</span>
          ${[1,2,3,4,5,6,7].map(v => `<label><input type="radio" name="contribution" value="${v}"></label>`).join('')}
          <span>A lot</span>
        </div><br>
      
        <p id="feedbackTimer" style="font-size: 14px; text-align: right; color: gray;"></p>
      `;
      
      screen.appendChild(message);
      screen.style.display = 'flex';

      document.getElementById("levelIndicator").textContent = `Level ${levelNumber + 2} of 4`;
      
      const submitBtn = document.createElement('button');
      submitBtn.className = 'button';
      submitBtn.textContent = 'Submit';
      submitBtn.onclick = () => submitBetweenLevel(levelNumber, finished);
      screen.appendChild(submitBtn);
      
  }
}

function submitBetweenLevel(levelNumber, finished) {
  const satisfaction = document.querySelector('input[name="satisfaction"]:checked')?.value || null;
  const difficulty   = document.querySelector('input[name="difficulty"]:checked')?.value || null;
  const contribution = document.querySelector('input[name="contribution"]:checked')?.value || null;
  if (!satisfaction || !difficulty || !contribution) {
    alert('Please answer all questions before submitting.');
    return;
  }

  const myId = getCurrentPlayerId();
  const submitBtn = document.getElementById('levelQSubmitBtn');
  if (submitBtn) {
    submitBtn.disabled = true;          // prevent double submit
    submitBtn.style.display = 'none';   // hide it
  }

  // Save my answers (client profile, non-authoritative)
  updateStateDirect(`players/${myId}`, {
    level: levelNumber,
    completed: finished,   // keep your existing schema
    satisfaction, difficulty, contribution
  }, 'levelQ');

  // Mark me done in the authoritative level node
  try {
    updateStateTransaction('level', 'markDone', {});
  } catch (e) {
    console.warn('markDone failed:', e);
  }
  lastRenderKey = '';
  if (window.currentPhaseSnap) renderPhase(window.currentPhaseSnap);
  updateStateTransaction('level', 'advance', {});

  const screen = document.getElementById('levelCompleteScreen');
  if (screen) {
    screen.innerHTML = ''; // clear previous content

    const wrapper = document.createElement('div');
    wrapper.className = 'levelQ-waiting';

    const title = document.createElement('h2');
    title.className = 'levelQ-title';
    title.textContent = 'Thanks! Waiting for other players to finish…';

    const msg = document.createElement('div');
    msg.className = 'levelQ-wait-msg';
    // optional: your snapshot listener can fill this with "X/Y completed"

    wrapper.appendChild(title);
    wrapper.appendChild(msg);
    screen.appendChild(wrapper);

    // accessibility: announce updates
    screen.setAttribute('aria-live', 'polite');
  }
}



function getLevelTimeLimit(levelNumber) {
  if (levelNumber === 0) {
      return 5 * 60 * 1000; // 5 minutes
  } else if (levelNumber === 2 || levelNumber === 1) {
      return 5 * 60  * 1000; // 5 minutes
  } else {
      return 5 * 60  * 1000; // default fallback
  }
}

function drawPerimeterWalls() {
  const container = document.getElementById('image-container');
  const W = container.clientWidth;
  const H = container.clientHeight;
  const WALL_THICKNESS = 18; // thin 15 px wall

  const strips = [
    { top: 0, left: 0, width: W, height: WALL_THICKNESS },                 // top
    { top: H - WALL_THICKNESS, left: 0, width: W, height: WALL_THICKNESS },// bottom
    { top: 0, left: 0, width: WALL_THICKNESS, height: H },                 // left
    { top: 0, left: W - WALL_THICKNESS, width: WALL_THICKNESS, height: H } // right
  ];

  strips.forEach(cfg => {
    const d = document.createElement('div');
    d.className = 'wall-strip';
    d.style.top = `${cfg.top}px`;
    d.style.left = `${cfg.left}px`;
    d.style.width = `${cfg.width}px`;
    d.style.height = `${cfg.height}px`;
    container.appendChild(d);
  });
}


// --- Event-driven version ---
function startLevelTimerUIFromAuthority(startAt) {
  const currentEvent = currentPhaseSnap?.eventNumber || currentLevelSnap?.eventNumber || 0;
  const current = Math.max(0, Math.min(currentEvent - startAt, MAX_EVENTS_PER_LEVEL));

  updateTimerDisplay(current);
}

// --- New display helper ---
function updateTimerDisplay(current) {
  const timerEl = document.getElementById('levelTimerDisplay');
  timerEl.textContent = `🕹️ Round ${current} of ${MAX_EVENTS_PER_LEVEL}`;
}

console.log("Game Starting...", thisPlayerID);

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

//      Complete Screen
let messageFinish = document.getElementById('messageFinish');


// Set up correct instructions
instructionsText.innerHTML = `Welcome! In this game, your goal is to work with two other players to move all the blocks into the slots as quickly as possible across four levels.\n
      Below is a video showing what the game looks like.\n
      We'll explain everything step by step.\n
      \n Note: To ensure data quality, participants should only take part once. If this game looks familiar or you believe you have completed a similar version before, please exit the study. Unfortunately, repeated participation cannot be compensated.`;


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


// Robot configuration - can be overridden by URL parameters
// Example: ?robot=leader or ?robot=follower or ?robot=none
const urlParams = new URLSearchParams(window.location.search);
const robotParam = urlParams.get('robot'); // 'leader', 'follower', or 'none'

const ROBOT_CONFIG = {
  enabled: robotParam !== 'none',                           // Disable with ?robot=none
  type: 'follower',  // Default to leader, use ?robot=follower for follower
  name: 'roboPlayer'
};

console.log('🤖 Robot Config:', ROBOT_CONFIG, '(from URL param:', robotParam || 'default (leader)', ')');

// function shouldCreateRobot() {
//   // Only create robot if:
//   // 1. Robot is enabled
//   // 2. We have exactly 2 human players
//   // 3. This browser is player 1 (host)
//   if (!ROBOT_CONFIG.enabled) return false;
  
//   const myArrival = getCurrentPlayerArrivalIndex();
//   const numPlayers = getNumberCurrentPlayers();
  
//   // Player 1's browser creates the robot when player 2 joins
//   return (myArrival === 1 && numPlayers === 2);
// }

function isRobotPlayer(playerId) {
  return playerId && playerId.startsWith('robo');
}

let robotPlayerId = `robot`;

function createRobotPlayer() {
  console.log(' Creating robot player...');
  
  // Generate a robot player ID
  const robotId = `robot`;
  robotPlayerId = robotId;
  
  // // Add robot to playerColorMap
  // playerColorMap[robotId] = {
  //     color: 3,  // Robot always gets color 3
  //     name: ROBOT_CONFIG.name
  // };
  
  // Write robot data to Firebase
  updateStateDirect(`players/${robotId}`, {
      name: ROBOT_CONFIG.name,
      isRobot: true
  }, 'create robot player');
  
  console.log(' Robot player created:', robotId);
  
  return robotId;
}

// Global variable to track robot timeout
let robotActionTimeout = null;

// Schedule the robot to vote
function scheduleRobotAction() {
    // Clear any existing timeout
    if (robotActionTimeout) {
        clearTimeout(robotActionTimeout);
        robotActionTimeout = null;
    }
    
    // Only schedule if robot exists and this browser created it
    if (!ROBOT_CONFIG.enabled || !robotPlayerId) {
        console.log(' Robot not enabled or not created, skipping');
        return;
    }
    
    // Only the browser that created the robot should run its logic
    //const myArrival = getCurrentPlayerArrivalIndexStable();
    if (!iAmController) {
        console.log(' Not controller, not running robot logic');
        return;
    }
    
    console.log(' Scheduling robot action...');
    
    // Delay based on agent type
    const delay = ROBOT_CONFIG.type === 'leader' ? 50 : 4200;
    
    robotActionTimeout = setTimeout(() => {
        executeRobotAction();
    }, delay);
}

// Execute the robot's voting logic
function executeRobotAction() {
    console.log(' Executing robot action, type:', ROBOT_CONFIG.type);
    
    if (!robotPlayerId) {
        console.error(' No robot player ID!');
        return;
    }
    
    // Create a castVote function specifically for the robot
    const robotCastVote = (targetId, direction, isObstacle) => {
        console.log(' Robot voting:', { targetId, direction, isObstacle });
        
        const currentEvent = currentPhaseSnap?.eventNumber || 0;
        console.log(' Robot Casting vote for event:', currentEvent);
        
        const voteData = {
          targetId,
          direction,
          isObstacle,
          timestamp: Date.now(),
          level: currentLevel,
          condition: assigendCondition
        };
        
        // Write to centralized votes location
        updateStateDirect(
          `votes/${currentEvent}/${robotPlayerId}`, 
          voteData, 
          'player vote'
        );
    };
    
   try {
        if (ROBOT_CONFIG.type === 'leader') {
            console.log('🤖 Running LEADER agent');
            console.log('currentGameState', GameState);
            executeLeaderAgent(GameState, robotCastVote);
        } else if (ROBOT_CONFIG.type === 'follower') {
            console.log('🤖 Running FOLLOWER agent');
            executeFollowerAgent(GameState, robotCastVote, getAllPlayerIdsWithRobot, isRobotPlayer);
        } else {
            console.error('❌ Unknown robot type:', ROBOT_CONFIG.type);
        }
    } catch (error) {
        console.error('❌ ROBOT CRASHED:', error);
        console.error('Stack trace:', error.stack);
        console.error('GameState at crash:', GameState);
        // Robot stays alive - will try again next round
    }
}

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

let countdownInterval = null;

let lastRenderKey = '';  // helps avoid duplicate setIntervals

let lastphase = false;

let phaseStarttime;

let lastRobotScheduledKey = '';  

function renderPhase(p) {
const msg = document.getElementById('turnMessage');
if (!msg) return; // DOM may have been rebuilt

const phase   = p?.current;
const endTime = p?.endTime || 0;

if(!lastphase){
  phaseStarttime = Date.now();
  lastphase = 'voting';
}

if(lastphase != phase){
  lastphase = phase;
  if (phase == 'voting'){
    phaseStarttime = Date.now();
  }
}

// Toggle inputs strictly from phase
if (phase === 'voting') { 
  showDirectionButtons(); } 
  else { 
    hideDirectionButtons();
    removeAllCloneArrows();
  }


// Avoid stacking intervals: derive a render key from authoritative state
const key = `${phase}|${endTime}`;
if (lastRenderKey === key && countdownInterval) return;  // already rendering this state
lastRenderKey = key;

if (phase === 'voting' && lastRobotScheduledKey !== key) {
  lastRobotScheduledKey = key;
  scheduleRobotAction();
}

if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }

const tick = () => {
  const timeLeft = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
  msg.innerText = (phase === 'voting')
    ? `Choose which block/obstacle you want to move in ${timeLeft}s. You can change your choice at any time.`
    : `Moving the objects now...`;
  msg.style.textShadow = '1px 1px 0 #000';
  msg.style.imageRendering = 'pixelated';
  msg.style.fontFamily = 'monospace';

  // Local watchdog: if we ever show "moving" with 0s for >1.5s,
  // force a full re-render from the current snapshot to break stale UI.
  if (phase === 'moving' && timeLeft <= 0) {
    // debounce so we don't thrash
    if (!renderPhase.__watchdogArmed) {
      renderPhase.__watchdogArmed = true;
      setTimeout(() => {
        renderPhase.__watchdogArmed = false;
        // Re-render from the snapshot (authoritative)
        if (window.currentPhaseSnap) renderPhase(window.currentPhaseSnap);
      }, 1500);
    }
  }
};

tick(); // immediate draw
countdownInterval = setInterval(tick, 500);
}

function seedLevelIfNeeded() {
  //const now = Date.now();
  updateStateTransaction('level', 'seed', {  });
}  

function removeAllCloneArrows() {
  document.querySelectorAll('.arrow-clone').forEach(clone => {
    clone.remove();
  });
}

let playerColorMap = {}; 


function assignAvatarColors() {
  const arrivalIndex = getCurrentPlayerArrivalIndex(); // 1-based
  //const name = document.getElementById('playerName')?.value.trim() || `Player ${arrivalIndex}`;
  const playerId = getCurrentPlayerId();

  updateStateDirect(`players/${playerId}`, {
      name: playerName
  }, 'update player name');

  playerColorMap[playerId] = {
      color: 1,
      name: playerName
  };
  const allPlayerIds = getAllPlayerIdsWithRobot().sort(); 
  const robotId = allPlayerIds.find(id => isRobotPlayer(id));
  const humanIds = allPlayerIds.filter(id => !isRobotPlayer(id) && id !== playerId);

  let index = 2;
  humanIds.forEach((id, i) => {
      if (id !== playerId) {
          playerColorMap[id] = { name: "", color: index };
          index++;
      }
  });

  if (robotId) {
    playerColorMap[robotId] = { 
        name: ROBOT_CONFIG.name || "RoboPlayer", 
        color: 3  
    };
}
  _createThisPlayerAvatar(); 
}

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

function isInsidePlayable(x, y) {
  const min = 1; // leave 1-tile wall ring
  const maxX = 17;
  const maxY = 12;
  return x >= min && x <= maxX && y >= min && y <= maxY;
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

function animateEntityMove(entityId, moveData) {
  const { location, direction, moved } = moveData;
  
  const block = document.querySelector(`.block[data-color="${entityId}"]`);
  if (!block) return;

  const isObstacle = block.dataset.obstacle === "true";
  if (isObstacle) {
    if (GameState.obstacles[entityId]) {
      GameState.obstacles[entityId].location = location;
    }
  } else {
    if (GameState.blocks[entityId]) {
      GameState.blocks[entityId].location = location;
    }
  }
  // Update dataset
  block.dataset.x = location.x;
  block.dataset.y = location.y;
  
  if (!moved) {
    // Just remove arrows
    block.querySelectorAll('.arrow').forEach(a => a.remove());
    return;
  }
  
  // Animate arrows flying
  const arrows = block.querySelectorAll(`.arrow[data-direction="${direction}"]`);
  arrows.forEach(arrow => {
    const arrowRect = arrow.getBoundingClientRect();
    const clone = arrow.cloneNode(true);
    clone.style.pointerEvents = 'none';
    
    clone.style.position = 'absolute';
    clone.style.left = `${arrowRect.left}px`;
    clone.style.top = `${arrowRect.top}px`;
    clone.style.margin = '0';
    clone.style.transform = 'none';
    clone.style.transition = 'top 0.5s ease, left 0.5s ease';
    
    document.body.appendChild(clone);
    
    const offsetMap = {
      up: [0, -1],
      down: [0, 1],
      left: [-1, 0],
      right: [1, 0]
    };
    const [dx, dy] = offsetMap[direction];

    const rotationMap = {
      down: 'rotate(90deg)',
      left: 'rotate(180deg)',
      up: 'rotate(270deg)',
      right: 'rotate(0deg)'
  };

    clone.style.transform = rotationMap[direction];
    clone.style.transformOrigin = 'center center';
    if (direction === 'left') {
        clone.style.transform += ' scaleY(-1)';
    }

    requestAnimationFrame(() => {
      clone.style.left = `${arrowRect.left + dx * CELL_WIDTH}px`;
      clone.style.top = `${arrowRect.top + dy * CELL_HEIGHT}px`;
    });
    animateSpriteOnce(clone, 6, 50, 50, 12);
    setTimeout(() => clone.remove(), 500);
  });
  
  // Remove original arrows
  block.querySelectorAll('.arrow').forEach(a => a.remove());
  
  // Animate block
  block.style.transition = 'top 0.5s ease, left 0.5s ease';
  block.style.left = `${location.x * CELL_WIDTH}px`;
  block.style.top = `${location.y * CELL_HEIGHT}px`;
  
  // Check for slot match after animation
  setTimeout(() => {
    checkSlotMatch(entityId, location);
  }, 500);
}


function checkSlotMatch(blockId, location) {
  const block = document.querySelector(`.block[data-color="${blockId}"]`);
  if (!block || block.dataset.obstacle === "true") return;
  
  for (let slotId in GameState.slots) {
    const slot = GameState.slots[slotId];
    if (slot && slot.x === location.x && slot.y === location.y) {
      console.log(`Block ${blockId} reached slot at (${location.x}, ${location.y})`);
      
      // Mark as locked
      updateStateDirect(`blocks/${blockId}/locked`, true, 'lock block');
      
      // Animate out
      block.style.transition = 'opacity 0.5s';
      block.style.opacity = '0';
      
      setTimeout(() => {
        block.remove();
        delete GameState.blocks[blockId];
        
        // Check if all blocks locked
        const allLocked = Object.values(GameState.blocks).every(b => b.locked);
        if (allLocked) {
          console.log("All blocks locked!");
          completedLevel = true;
          clearImageContainer();
          if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
          }
          updateStateTransaction('level', 'toSurvey', { reason: 'cleared' });
        }
      }, 500);
      
      break;
    }
  }
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
  if(isObstacle && block.immovable){
      width = CELL_WIDTH * 2;
      height = CELL_HEIGHT * 2;
  }else if(isObstacle && !block.immovable){
      width = CELL_WIDTH * 2.3;
      height = CELL_HEIGHT * 2.3;
  }
  else{
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

  if (isObstacle && block.immovable) div.dataset.immovable = "true"; 

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

  if (isObstacle) {
      const isImmovable = !!block.immovable; // true if obstacle can't move
      div.style.backgroundImage = isImmovable
        ? "url('./images/wall.png')"  // immovable obstacle → wall texture
        : "url('./images/obstacle.png')";   
        div.style.filter = 'none';                          // movable obstacle
    } else {
      div.style.backgroundImage = "url('./images/block.png')";         // normal block
    }


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
      minText.innerText = `${minRequired}`;
      minText.style.fontSize = '36px';
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

      if (block.immovable) {
          
        }else{
          const minText = document.createElement('div');
          minText.innerText = `1`;
          minText.style.fontSize = '24px';
          minText.style.fontWeight = 'bold';
          minText.style.textShadow = '1px 1px 0 #000';
          minText.style.color = 'white';
          minText.style.marginBottom = '2px';
          minText.style.imageRendering = 'pixelated';
          minText.style.fontFamily = 'monospace'; 
          div.appendChild(minText);
        }

  }

  const visualPosition = {
      up:    { top: '82%', left: '50%', transform: 'translate(-50%, -50%)' },
      down:  { top: '18%', left: '50%', transform: 'translate(-50%, -50%)' },
      left:  { top: '50%', left: '82%', transform: 'translate(-50%, -50%)' },
      right: { top: '50%', left: '18%', transform: 'translate(-50%, -50%)' }
  };
  
  const obstaclePosition = {
      up:    { top: '70%', left: '50%', transform: 'translate(-50%, -50%)' },
      down:  { top: '30%', left: '50%', transform: 'translate(-50%, -50%)' },
      left:  { top: '50%', left: '75%', transform: 'translate(-50%, -50%)' },
      right: { top: '50%', left: '25%', transform: 'translate(-50%, -50%)' }
  };

  if (isObstacle && block.immovable) {           // NEW
      container.appendChild(div);                  // NEW
      return;                                      // NEW
    }
  
  
  const directions = ['up', 'right', 'down', 'left'];
  directions.forEach(dir => {
      const arrow = document.createElement('div');
      arrow.classList.add('triangle', dir, 'direction-button');
      const pos = isObstacle ? obstaclePosition[dir] : visualPosition[dir];
      arrow.style.position = 'absolute';
      arrow.style.top = pos.top;
      arrow.style.left = pos.left;
      arrow.style.transform = pos.transform;
      arrow.dataset.direction = dir;
      arrow.dataset.targetId = id;
      arrow.dataset.isObstacle = isObstacle;
      if (isObstacle) {
          switch (dir) {
              case 'up':
                  arrow.style.borderWidth = '12px 15px 16px 15px';
                  break;
              case 'down':
                  arrow.style.borderWidth = '16px 15px 12px 15px';
                  break;
              case 'left':
                  arrow.style.borderWidth = '15px 15px 15px 12px';
                  break;
              case 'right':
                  arrow.style.borderWidth = '15px 12px 15px 15px';
                  break;
          }
      }
      

      arrow.addEventListener('click', () => {
          castVote(id, dir, isObstacle);
      });
      

      div.appendChild(arrow);
  });

  container.appendChild(div);
}

function castVote(targetId, direction, isObstacle) {
  const playerId = getCurrentPlayerId();
  const currentEvent = currentLevelSnap?.eventNumber || 0;

  console.log(' Casting vote for event:', currentEvent);
  
  const voteData = {
    targetId,
    direction,
    isObstacle,
    timestamp: Date.now(),
    level: currentLevel,
    condition: assigendCondition
  };
  
  // Write to centralized votes location
  updateStateDirect(
    `votes/${currentEvent}/${playerId}`, 
    voteData, 
    'player vote'
  );
}

function computeMovesFromVotes(blocksState, obstaclesState, votesForEvent) {
  const moves = {};
  
  // Collect all entities (blocks + movable obstacles)
  const entities = {};
  
  // Add blocks
  Object.entries(blocksState || {}).forEach(([id, block]) => {
    if (!block.locked) {
      entities[id] = {
        id,
        location: block.location,
        color: block.color,
        minVotes: block.minVotes || 1,
        size: 3,
        isObstacle: false
      };
    }
  });
  
  // Add movable obstacles
  Object.entries(obstaclesState || {}).forEach(([id, obs]) => {
    if (!obs.immovable) {
      entities[id] = {
        id,
        location: obs.location,
        minVotes: 1,
        size: 2,
        isObstacle: true
      };
    }
  });
  
  // Compute intended moves
  const plans = [];
  
  Object.values(entities).forEach(entity => {
    const votes = votesForEvent[entity.id] || { up: 0, down: 0, left: 0, right: 0 };
    const majorityDir = getMajorityDirection(votes, entity.minVotes);
    
    const currentLoc = entity.location;
    let nextLoc = { ...currentLoc };
    
    if (majorityDir) {
      const offsets = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
      const [dx, dy] = offsets[majorityDir];
      nextLoc = { x: currentLoc.x + dx, y: currentLoc.y + dy };
    }
    
    // Check bounds
    const inBounds = isInsidePlayable(nextLoc.x, nextLoc.y);
    const willMove = majorityDir && inBounds;
    
    plans.push({
      id: entity.id,
      currentLoc,
      nextLoc: willMove ? nextLoc : currentLoc,
      direction: majorityDir,
      willMove,
      size: entity.size,
      isObstacle: entity.isObstacle,
      cells: getOccupiedCells(
        willMove ? nextLoc.x : currentLoc.x,
        willMove ? nextLoc.y : currentLoc.y,
        entity.size
      )
    });
  });
  
  // Collision detection
  for (let i = 0; i < plans.length; i++) {
    for (let j = i + 1; j < plans.length; j++) {
      const a = plans[i];
      const b = plans[j];
      
      const overlap = a.cells.some(cellA =>
        b.cells.some(cellB => cellA.x === cellB.x && cellA.y === cellB.y)
      );
      
      if (overlap) {
        a.willMove = false;
        a.nextLoc = a.currentLoc;
        b.willMove = false;
        b.nextLoc = b.currentLoc;
      }
    }
  }
  
  // Build moves result
  plans.forEach(plan => {
    moves[plan.id] = {
      location: plan.nextLoc,
      direction: plan.willMove ? plan.direction : null,
      moved: plan.willMove,
      version: Date.now()
    };
  });
  
  return moves;
}

function renderVoteArrow(playerId, voteData) {
  if (!voteData) return;
  
  const { targetId, direction } = voteData;
  
  // Remove old arrow from this player
  document.querySelectorAll(`.arrow[data-player-id="${playerId}"]`).forEach(el => el.remove());
  
  // Find target block/obstacle
  const block = document.querySelector(`.block[data-color="${targetId}"]`);
  if (!block) return;
  
  // Add new arrow
  const colorIndex = playerColorMap[playerId]?.color;
  const imgSrc = (colorIndex === 3)
        ? `./images/robot_arrow.png`
        : `./images/player${colorIndex}_arrow.png`;
  
  const arrow = document.createElement('div');
  arrow.classList.add('arrow');
  arrow.style.width = '50px';
  arrow.style.height = '50px';
  arrow.style.position = 'absolute';
  arrow.style.pointerEvents = 'none';
  arrow.style.zIndex = '10000';
  arrow.style.backgroundImage = `url(${imgSrc})`;
  arrow.style.backgroundRepeat = 'no-repeat';
  arrow.style.backgroundSize = `${6 * 50}px 50px`;
  arrow.style.imageRendering = 'pixelated';
  
  arrow.dataset.playerId = playerId;
  arrow.dataset.direction = direction;
  
  const rotationMap = {
    up: 'rotate(90deg)',
    right: 'rotate(180deg)',
    down: 'rotate(270deg)',
    left: 'rotate(0deg)'
  };

  const visualPosition = {
    up: 'down',
    down: 'up',
    left: 'right',
    right: 'left'
};
  //arrow.style.transform = rotationMap[direction] || 'rotate(0deg)';
  arrow.dataset.rotation = rotationMap[visualPosition[direction]] || 'rotate(0deg)';
  arrow.dataset.playerId = playerId;
  arrow.dataset.direction = direction;
  arrow.style.backgroundPosition = '0px 0px';
  block.appendChild(arrow);
  
  // Layout arrows
  const isObstacle = block.dataset.obstacle === "true";
  layoutDirectionalArrows(block, direction, isObstacle);

}

function spawnFloatingArrowClone(arrow, block, color, direction) {
  //const direction = arrow.dataset.direction;
  if (!direction) return;
  const playerId = arrow.dataset.playerId;
  if (!playerId) return;

  // Remove any existing clone from this player first
  document.querySelectorAll(`.arrow-clone[data-source-player-id="${playerId}"]`).forEach(clone => {
    clone.remove();
  });


  const arrowRect = arrow.getBoundingClientRect();

  const clone = arrow.cloneNode(true);
  clone.classList.add('arrow-clone');   // IMPORTANT
  clone.dataset.sourceColor = color;   
  clone.dataset.sourcePlayerId = arrow.dataset.playerId;
  clone.dataset.sourceDirection = direction;
  clone.style.position = 'fixed'; // viewport coords, safest
  clone.style.pointerEvents = 'none';
  clone.style.left = `${arrowRect.left}px`;
  clone.style.top = `${arrowRect.top}px`;
  clone.style.margin = '0';
  clone.style.zIndex = 2147483647;

  // IMPORTANT: reset transform from layout; we reapply direction cleanly
  clone.style.transform = 'none';
  clone.style.transition = 'opacity 150ms linear';

  // Match direction visually (your existing mapping)
  const rotationMap = {
    down: 'rotate(90deg)',
    left: 'rotate(180deg)',
    up: 'rotate(270deg)',
    right: 'rotate(0deg)'
  };

  clone.style.transform = rotationMap[direction] || 'none';
  clone.style.transformOrigin = 'center center';

  if (direction === 'left') {
    clone.style.transform += ' scaleY(-1)';
  }

  document.body.appendChild(clone);

}



function layoutDirectionalArrows(block, direction, isObstacle) {
  const arrows = Array.from(block.querySelectorAll(`.arrow[data-direction="${direction}"]`));
  const OFFSET_STEP = 30;

  const rotation = arrow => arrow.dataset.rotation || 'rotate(0deg)';
  const visualPosition = {
      up: 'down',
      down: 'up',
      left: 'right',
      right: 'left'
  };

  arrows.forEach((arrow, i) => {
      let topPx = 0;
      let leftPx = 0;
      let transform = rotation(arrow);

      switch (visualPosition[direction]) {
          case 'up':
              topPx = 0;
              leftPx = i * OFFSET_STEP;
              transform += ' translate(-90%, -10%)';
              break;

          case 'down':
              topPx = (isObstacle ? 90 : 135) - 10; 
              leftPx = i * OFFSET_STEP;
              transform += ' translate(5%, -10%)';
              break;

          case 'left':
              topPx = 15 + i * OFFSET_STEP;
              leftPx = 5;
              transform += ' translate(-100%, -50%)';
              break;

          case 'right':
              topPx = i * OFFSET_STEP;
              leftPx = (isObstacle ? 80 : 125) - 10; 
              transform += ' translate(-5%, -10%) scaleY(-1)';
              break;
      }

      arrow.style.top = `${topPx}px`;
      arrow.style.left = `${leftPx}px`;
      arrow.style.right = '';
      arrow.style.bottom = '';
      arrow.style.transform = transform;

      // Optional: Save px values for later animation use
      arrow.dataset.topPx = topPx;
      arrow.dataset.leftPx = leftPx;
      const targetId = block.dataset.color;
      spawnFloatingArrowClone(arrow, block, targetId, direction);
  });
}

function animateSpriteOnce(arrowDiv, frameCount = 6, frameWidth = 40, frameHeight = 40, fps = 12) {
  let currentFrame = 0;

  function step() {
      const xOffset = -currentFrame * frameWidth;
      arrowDiv.style.backgroundPosition = `${xOffset}px 0px`;

      currentFrame++;
      if (currentFrame < frameCount) {
          setTimeout(step, 1000 / fps);
      }
  }

  step();
}

function removeArrowFromPlayer(playerId) {
  console.log(`[removeArrowFromPlayer] Removing arrows for player ${playerId}`);

  const arrows = document.querySelectorAll(`.arrow[data-player-id="${playerId}"]`);
  arrows.forEach(arrow => arrow.remove());

  document.querySelectorAll(
    `.arrow-clone[data-source-player-id="${playerId}"]`
  ).forEach(c => c.remove());
}


function _setPlayerAvatarCSS() {
  /*
      Update Player N's avatar if they have made an estimate
  */

  console.log("setting CSS");
  // Get element responsible for player avatar colors
  let root = document.querySelector(":root");
  console.log("Root", root);
  let allPlayerIDs = getAllPlayerIdsWithRobot();
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

function clearImageContainer() {
  const container = document.getElementById('image-container');
  container.innerHTML = '';
}

function _createThisPlayerAvatar() {
  const container = document.getElementById('player1-container');
  const imgSrc = `./images/player1.png`;

  container.innerHTML = `
      <div class="row" id="${playerId}-container">
          <div class="col-12" id="${playerId}-content">
              <h3 id="${playerId}-name" style="font-size: 16px;">${playerName} (You)</h3>
          </div>
      </div>
      <div class="row" id="${playerId}-avatar-container">
          <div class="col-12" id="${playerId}-avatar-content">
              <img src="${imgSrc}" class="player-avatar" style="width: 50px; height: 50px;"/>
          </div>
      </div>
  `;
}


function getAllPlayerIdsWithRobot() {
  const humanIds = getCurrentPlayerIds();
  
  // If robot exists, add it to the list
  if (ROBOT_CONFIG.enabled) {
      console.log("robot id is", humanIds);
      console.log("robot id is", humanIds);
      return [...humanIds, robotPlayerId];
  }
  console.log("robot id is not here", robotPlayerId);
  return humanIds;
}

function _createOtherPlayerAvatar() {
  let otherPlayerContainer = document.getElementById('other-player-content');

  const thisPlayerID = getCurrentPlayerId();
  const allPlayerIDs = getAllPlayerIdsWithRobot();
  console.log("player ids are", allPlayerIDs);

  otherPlayerContainer.innerHTML = ''; // Clear any existing avatars

  allPlayerIDs.forEach((playerId) => {
      if (playerId !== thisPlayerID) {
          const playerData = playerColorMap[playerId] || {};
          const arrivalIndex = playerData.color;
          const playerName = playerData.name;

          const columnSize = {
              5: 3,
              4: 4,
              3: 6
          }[allPlayerIDs.length] || 12;

          const avatarSrc = (arrivalIndex === 3) 
          ? `./images/robot.png` 
          : `./images/player${arrivalIndex}.png`;

          otherPlayerContainer.innerHTML += `
              <div class="col-${columnSize}" id="${playerId}-container">
                  <div class="row" id="${playerId}-name-container">
                      <div class="col-12" id="${playerId}-name-content">
                          <h3 id="${playerId}-name" style="font-size: 16px;">${playerName}</h3>
                      </div>
                  </div>
                  <div class="row" id="${playerId}-avatar-container">
                      <div class="col-12" id="${playerId}-avatar-content">
                          <img src="${avatarSrc}" class="player-avatar" style="width: 50px; height: 50px;">
                      </div>
                  </div>
              </div>
          `;
      }
  });
}

function newGame() {

  clearTimeout(waitingTimer);
  // Initialize a game
  //let whoStarts;
  practiceTimerInterval = null;
  if((getCurrentPlayerArrivalIndex() == 1) && (ROBOT_CONFIG.enabled)){
    createRobotPlayer();
  }
  assignAvatarColors();
  _setPlayerAvatarCSS();
  _createThisPlayerAvatar();


  (async () => {
      try {
        // Claim or create the controller lease atomically.
        await updateStateTransaction('phase', 'lease', {
          currentEvent: 0  //  Initialize with event 0
      });
    
        // OPTIONAL: If the phase node was just created (version 0, no current),
        // advance transactionally into the first voting round.
        // Rely on your phase snapshot; if you don't have one yet, a small delay lets
        // your receiveStateChange populate currentPhaseSnap.
        setTimeout(async () => {
          const v = (currentPhaseSnap && typeof currentPhaseSnap.version === 'number') ? currentPhaseSnap.version : 0;
          const hasCurrent = !!(currentPhaseSnap && currentPhaseSnap.current);
          if (!hasCurrent) {
            await updateStateTransaction('phase', 'advance', {
              expectVersion: v,
              nextPhase: 'voting',
              durationMs: votingDuration * 1000,
              eventNumber: 0 
            });
          }
        }, 200);
      } catch (e) {
        console.error('[phase bootstrap failed]', e);
      }
    })();
    
    

  console.log("Initialized GameState:", GameState);
  startLeaseHeartbeat();
  seedLevelIfNeeded();
  //setInterval(levelControllerTick, 500);
}


// --------------------------------------------------------------------------------------
//   Handle Events triggered by MPLIB
//   These callback functions are required, but the contents can be empty and left inconsequential  
//   (note: all timestamps are server-side expressed in milliseconds since the Unix Epoch)
// --------------------------------------------------------------------------------------
// Function to receive state changes from Firebase
function receiveStateChange(pathNow, nodeName, newState, typeChange ) {

  if (pathNow == "players" && (typeChange == 'onChildAdded' ||typeChange == 'onChildChanged')) {
      const playerId = nodeName; // nodeName is the player ID
      const playerData = newState; // newState contains { selectedBlock, selectedDirection }

      if (playerData.name) {
          const isRobot = playerData.isRobot === true || playerId.startsWith('robot');
          playerColorMap[playerId] = {
            color: playerColorMap[playerId]?.color ?? (isRobot ? 3 : null), // Robot gets color 4
            name: playerData.name
        };
      
        console.log("Player data received:", playerId, isRobot ? "🤖 (ROBOT)" : "👤 (HUMAN)");
        console.log(playerColorMap);
      
          // Check if all players have names
          const allHaveNames = Object.values(playerColorMap)
              .filter(p => p && typeof p.name === 'string')
              .length === 3;
      
          if (allHaveNames) {
              _createOtherPlayerAvatar();
          }
      }        
      

  } else if (pathNow.startsWith('votes')) {
    
    const eventNum = parseInt(nodeName); 
    const votesForEvent = newState;        
    console.log("current event number is", eventNum);
    const currentEvent = currentPhaseSnap?.eventNumber || 0; 
    console.log("Event number online is", currentEvent);
    console.log("currentVote is", votesForEvent);
    
  if (eventNum === currentEvent) {
    // CORRECT - Clear and rebuild from complete data
    currentVoteCache = {};
    
    Object.entries(votesForEvent || {}).forEach(([playerId, voteData]) => {
        const targetId = voteData.targetId;
        const direction = voteData.direction;
        
        if (!currentVoteCache[targetId]) {
            currentVoteCache[targetId] = { up: 0, down: 0, left: 0, right: 0 };
        }
        currentVoteCache[targetId][direction]++;
        
        renderVoteArrow(playerId, voteData);
    });
    
    console.log(' Vote cache:', currentVoteCache);
  }
  return;
  } if (pathNow === 'moves') {
    const eventNum = parseInt(nodeName);  // nodeName is the event number!
    const movesForEvent = newState;        // newState has ALL moves for this event
    
    console.log("Moves received for event", eventNum);
    console.log("move is ", movesForEvent);
    
    if (currentPhaseSnap?.current === 'moving') {
        // Iterate through all entity moves for this event
        Object.entries(movesForEvent || {}).forEach(([entityId, moveData]) => {
            console.log("Animating move for entity", entityId, moveData);
            animateEntityMove(entityId, moveData);
        });
    }
    return;
}else if(pathNow == "blocks" && (typeChange == 'onChildAdded' ||typeChange == 'onChildChanged')){
      console.log("Block update received:", nodeName, newState);
      const blockId = nodeName;
      const blockData = newState;
      
      // Update local state
      GameState.blocks[blockId] = blockData;
      
  }else if(pathNow == "slots" && (typeChange == 'onChildAdded' ||typeChange == 'onChildChanged')){
      // console.log("Slots update received:", nodeName, newState);

  }else if(pathNow == "obs" && (typeChange == 'onChildAdded' ||typeChange == 'onChildChanged')){
      const obsId = nodeName;
      const obsData = newState;
      
      GameState.obstacles[obsId] = obsData;

  } else if (pathNow === 'phase') {
      // Update snapshot for any child under /phase
      currentPhaseSnap = currentPhaseSnap || {};
      if (nodeName === 'current')      currentPhaseSnap.current = newState;
      if (nodeName === 'endTime')      currentPhaseSnap.endTime = newState;
      if (nodeName === 'controllerId') currentPhaseSnap.controllerId = newState;
      if (nodeName === 'leaseUntil')   currentPhaseSnap.leaseUntil = newState;
      if (nodeName === 'version')      currentPhaseSnap.version = newState;
    
      // Render (this replaces the old endTime countdown block)
      renderPhase(currentPhaseSnap);
  }else if (pathNow === 'level') {
          currentLevelSnap = currentLevelSnap || {};
          if (nodeName === 'index')       currentLevelSnap.index = newState;
          if (nodeName === 'state')       currentLevelSnap.state = newState;
          if (nodeName === 'startAt')     currentLevelSnap.startAt = newState;
          if (nodeName === 'endAt')       currentLevelSnap.endAt = newState;
          if (nodeName === 'reason')      currentLevelSnap.reason = newState;
          if (nodeName === 'surveyDone')  currentLevelSnap.surveyDone = newState;
          
          console.log("level snap update");
          console.log(currentLevelSnap);
          const stateChanged = currentLevelSnap.state !== _lastLevelState;
          const endAtChanged = currentLevelSnap.endAt !== _lastLevelEndAt;

          if (nodeName === 'eventNumber') {
            //eventNumber = newState;  // Update global eventNumber
            currentLevelSnap.eventNumber = newState;
            currentPhaseSnap.eventNumber = newState; 
            
            // Update UI timer
            if (currentLevelSnap.startAt !== undefined) {
              const current = Math.max(0, Math.min(currentLevelSnap.eventNumber - currentLevelSnap.startAt, MAX_EVENTS_PER_LEVEL));
              updateTimerDisplay(current);
            }
          }
        
          // Only render when state flips, or (while in play) endAt updates
          if (stateChanged || (currentLevelSnap.state === 'play' && endAtChanged)) {
            _lastLevelState = currentLevelSnap.state;
            _lastLevelEndAt = currentLevelSnap.endAt;
            renderLevelFromAuthority(currentLevelSnap);
          }
        }
}


let _lastLevelState = null;
let _lastLevelEndAt = null;

let currentLevelSnap = null;

let _lastLevelRenderKey = '';

function renderLevelFromAuthority(L) {
if (!L) return;

currentLevel = L.index;

const key = `${L.state}|${L.endAt}`;
const changed = (_lastLevelRenderKey !== key);

if (L.state === 'play') {
  if (changed) {
     const screen = document.getElementById('levelCompleteScreen');
     if (screen) screen.style.display = 'none';
    _lastLevelRenderKey = key;
    clearImageContainer();
    initializeLevel(L.index);

    console.log('level rendered for', L.index);
    startLevelTimerUIFromAuthority(L.startAt, L.endAt);
  }
} else if (L.state === 'survey') {
  console.log('showing questionnaire for', L.index);
  console.log(L);
  if (changed) {
    _lastLevelRenderKey = key;
    showLevelCompleteMessage(L.index, () => {});
  }
}
}

// const LEVEL_LEASE_MS = 4000, LEVEL_DRIFT_MS = 1500;
const MAX_EVENTS_PER_LEVEL = 40; 

// NEW: one heartbeat, started once
let leaseHeartbeatId = null;


function startLeaseHeartbeat() {
  if (leaseHeartbeatId) return;
  leaseHeartbeatId = setInterval(() => {
    const p = currentPhaseSnap;
    if (canIBeController(p)) {
      renewLease();
      maybeAdvancePhase();
    } else {
      iAmController = false;
    }
  }, PHASE_TICK_MS);
}

function canIBeController(p) {
  const me = getCurrentPlayerId();
  const now = Date.now();
  return !p || !p.leaseUntil || now > (p.leaseUntil - PHASE_DRIFT_MS) || p.controllerId === me;
}

async function renewLease() {
  try {

    const currentEvent = currentLevelSnap?.eventNumber || 0;
    await updateStateTransaction('phase', 'lease', {
      currentEvent  
  })
    iAmController = true;
    // success → clear any prior backoff
    if (txBackoffMs) {
      console.log('[LEASE OK] clearing backoff');
      txBackoffMs = 0;
    }
  } catch (e) {
    iAmController = false;
    // exponential backoff to avoid hammering when evaluator denies
    txBackoffMs = Math.min((txBackoffMs || 500) * 2, 8000);
    console.warn('[LEASE ERROR] backing off', txBackoffMs, 'ms', e);
  }
}


async function maybeAdvancePhase() {
  const p = currentPhaseSnap;
  if (!p || !iAmController) return;
  
  // Don't advance phase if level is in survey or ended state
  if (currentLevelSnap?.state === 'survey' || currentLevelSnap?.state === 'ended') {
    console.log('[PHASE SKIP] Level is in survey/ended state, not advancing phase');
    return;
  }

  try {
    const expectVersion = Number(p.version || 0);

    if (p.current === 'voting') {
      console.log('[ADVANCE] voting → moving', { expectVersion });
      const currentEvent = currentLevelSnap?.eventNumber || 0;
      // 1. Advance phase to "moving"
      const res = await updateStateTransaction('phase', 'advance', {
        expectVersion,
        nextPhase: 'moving',
        durationMs: 3200,
        eventNumber: currentEvent 
      });

      if (res) {
        // 2. Get current votes
        const currentEvent = currentLevelSnap?.eventNumber || 0;
        console.log('Using authoritative event number:', currentEvent);
        
        // 3. Compute moves (this writes to /moves/{eventNumber})
        await computeAndWriteMoves(currentEvent);
        
        // 4. Increment event counter
        await updateStateTransaction('level', 'incrementEvent', {});
        currentVoteCache = {};
        console.log('Cleared vote cache');
        
        // 5. Clear votes for next round
        await updateStateDirect(`votes/${currentEvent}`, null, 'clear votes');
      }
      
    } else if (p.current === 'moving') {
      console.log('[ADVANCE] moving → voting', { expectVersion });
      
      // Check if level should end BEFORE advancing phase
      const currentEvent = currentLevelSnap?.eventNumber || 0; 
      if (currentEvent >= currentLevelSnap.endAt) {
        console.log('[LEVEL END] Time limit reached, going to survey');
        if (countdownInterval) {
          clearInterval(countdownInterval);
          countdownInterval = null;
        }
        // Don't return early - let the transaction complete
        await updateStateTransaction('level', 'toSurvey', { reason: 'time' });
        // Phase will stay in 'moving' but that's OK since we're going to survey
        return;
      }
      
      // Normal case: advance back to voting for next round
      await updateStateTransaction('phase', 'advance', {
        expectVersion,
        nextPhase: 'voting',
        durationMs: votingDuration * 1000,
        eventNumber: currentEvent
      });
    }

    if (txBackoffMs) {
      console.log('[ADVANCE OK] clearing backoff');
      txBackoffMs = 0;
    }

  } catch (e) {
    txBackoffMs = Math.min((txBackoffMs || 500) * 2, 8000);
    console.warn('[ADVANCE ERROR] backing off', txBackoffMs, 'ms', e);
  }
}


// ---- Helpers ----
function n(x, d = 0) { const v = Number(x); return Number.isFinite(v) ? v : d; }

function evaluateUpdate(path, state, action, args) {
let isAllowed = false;
let newState  = null;
const now     = Date.now();

// -------------- PHASE transactional logic --------------
if (path === 'phase') {
  const me = getCurrentPlayerId();
  const p  = state || {};  // existing server state (may be {} on first write)

  const current     = p.current ?? null;
  const endTime     = n(p.endTime, 0);
  const controller  = p.controllerId ?? null;
  const leaseUntil  = n(p.leaseUntil, 0);
  const version     = n(p.version, 0);

  if (action === 'lease') {
    const { currentEvent } = args || {}; 
    // Allow if: phase missing, or lease expired/expiring (with drift), or I already hold it.
    const leaseOk = !state || (now > (leaseUntil - PHASE_DRIFT_MS)) || (controller === me);
    if (leaseOk) {
      newState = {
        current:      current || 'voting',
        endTime:      endTime  || (now + votingDuration * 1000),
        controllerId: me,
        leaseUntil:   now + PHASE_LEASE_MS,
        version,      // DO NOT bump version on lease
        eventNumber: currentEvent !== undefined ? currentEvent : (state?.eventNumber || 0)
      };
      isAllowed = true;
    }
  }

  if (action === 'advance') {
    const { expectVersion, nextPhase, durationMs, eventNumber: passedEventNum} = args || {};
    const expV       = n(expectVersion, version);
    const holderOk   = (controller === me);
    // be forgiving: permit nudge if lease only just expired within drift
    const leaseValid = now <= (leaseUntil + PHASE_DRIFT_MS);
    const phaseOk    = (nextPhase === 'moving' || nextPhase === 'voting');
    // bootstrap (0,0) or exact match
    const versionOk  = (version === expV) || (version === 0 && expV === 0);

    const timeOk = now >= endTime; 

    if (holderOk && leaseValid && phaseOk && versionOk && timeOk) {
      newState = {
        current:      nextPhase,
        endTime:      now + n(durationMs, 1500),
        controllerId: controller || me,
        leaseUntil:   now + PHASE_LEASE_MS,   // renew lease on advance
        version:      version + 1,             // ONLY bump on advance
        eventNumber: passedEventNum !== undefined ? passedEventNum : (state?.eventNumber || 0)
      };
      isAllowed = true;
    }
  }

  // Debug tracer so "Transaction failed" isn't opaque
  if (!isAllowed) {
    console.warn('[TX DENIED]', { action, args, now, state: { current, endTime, controller, leaseUntil, version } });
  } else {
    console.log('[TX OK]', { action, newState });
  }
  return { isAllowed, newState };
// inside evaluateUpdate(...) just after your phase block
}else if (path === 'level') {
  const me  = getCurrentPlayerId();
  const L   = state || {};
  //const now = Date.now();

  const index      = Number.isFinite(L.index) ? L.index : 0;
  const stateName  = L.state || null;
  const endAt      = Number(L.endAt || 0);
  const controller = L.controllerId || null;
  const leaseUntil = Number(L.leaseUntil || 0);
  const surveyDone = L.surveyDone || {};

  if (action === 'seed') {
    if (!state) {
      //const startAt = eventNumber;
      return {
        isAllowed: true,
        newState: {
          index: 0,
          state: 'play',
          startAt: 0,
          endAt: MAX_EVENTS_PER_LEVEL,
          reason: null,
          controllerId: null,
          leaseUntil: 0,
          surveyDone: {}
        }
      };
    }
    return { isAllowed: false, newState: null };
  }

  if (action === 'incrementEvent') {
    if (stateName === 'play') {
      const eventNum = Number(L.eventNumber || 0);
      return {
        isAllowed: true,
        newState: { ...L, eventNumber: eventNum + 1 }
      };
    }
    return { isAllowed: false, newState: null };
  }

  if (action === 'toSurvey') {
      const validReason =
        (args?.reason === 'time' || args?.reason === 'cleared') ? args.reason : 'time';
    
      if (stateName === 'play') {
        console.log("toSurvey is called");
        return {
          isAllowed: true,
          newState: { ...L, state: 'survey', reason: validReason, surveyDone: {} }
        };
      }
    
      // optional: idempotent no-op if already in survey
      if (stateName === 'survey') {
      console.log("we are just in Survey");
        return { isAllowed: true, newState: L };
      }
    
      return { isAllowed: false, newState: null };
  }
    

  if (action === 'markDone') {
    if (stateName === 'survey') {
      return {
        isAllowed: true,
        newState: { ...L, surveyDone: { ...surveyDone, [me]: true } }
      };
    }
    return { isAllowed: false, newState: null };
  }

  if (action === 'advance') {
    if (stateName === 'survey') {
      const ids = Object.keys(playerColorMap || {}).slice(0, NumPlayers);
      const allDone = ids.length > 0 && ids.every(id => !!surveyDone[id]);
      if (!allDone) return { isAllowed: false, newState: null };

      const nextIndex = index + 1;
      if (nextIndex >= 4) {
        return { isAllowed: true, newState: { ...L, index: 4, state: 'ended' } };
      } else {
        const t0 = L.eventNumber || 0;;
        return {
          isAllowed: true,
          newState: {
            ...L,
            index: nextIndex,
            state: 'play',
            startAt: t0,
            endAt: t0 + MAX_EVENTS_PER_LEVEL,
            reason: null,
            surveyDone: {}
          }
        };
      }
    }
    return { isAllowed: false, newState: null };
  }

  return { isAllowed: false, newState: null };
}else if (path === 'moves') {
  if (action === 'compute') {
    const { blocksState, obstaclesState, votesForEvent } = args || {};
    
    // Only controller can compute moves
    const phaseState = args.phaseState || {};
    const me = getCurrentPlayerId();
    if (phaseState.controllerId !== me) {
      return { isAllowed: false, newState: null };
    }
    
    const computedMoves = computeMovesFromVotes(blocksState, obstaclesState, votesForEvent);
    
    return {
      isAllowed: true,
      newState: computedMoves
    };
  }
  return { isAllowed: false, newState: null };
}

  if (!isAllowed) {
    console.warn('[TX DENIED level]', { action, args, now, state });
  } else {
    console.log('[TX OK level]', { action, newState });
  }
  return { isAllowed, newState };


}

async function computeAndWriteMoves(eventNum) {
  // This function reads current state and writes moves
  // It should ONLY be called by the controller
  
  // In a real implementation, you'd need to read from Firebase
  // For now, we'll use the local state (this is a limitation)
  
  const votes = currentVoteCache;  // Read from `votes/${eventNum}`
  
  // Compute moves
  const moves = computeMovesFromVotes(
    GameState.blocks,
    GameState.obstacles,
    votes
  );
  
  // Write each move
  for (const [entityId, moveData] of Object.entries(moves)) {
    await updateStateDirect(
      `moves/${eventNum}/${entityId}`,
      moveData,
      'computed move'
    );
  }
  console.log("computing moves");
}

// Function triggered when this client closes the window and the player needs to be removed from the state 
function removePlayerState( playerId ) {

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
  messageWaitingRoom.innerText = " The session has timed out. You have been disconnected from the session. We couldn't find a match for you with other participants at this time. Please close this window. Thank you for your understanding.";

  alert("The session has timed out. You have been disconnected from the session. Please close the current window. ");
  // Redirect or log the player out if necessary
  // window.location.href = 'exit_page.html'; // Example of redirection
  leaveSession();
  
}

function joinWaitingRoom() {
  /*
      Functionality to invoke when joining a waiting room.

      This function does the following:
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
    //document.getElementById('waitingTimeDisplay').innerText = `Waiting time: ${minutes}m ${seconds}s`;
  }, 1000)

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
  //startVotingPhase();
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

  // if ( anyPlayerTerminatedAbnormally()) {
  //     // Another player closed their window or were disconnected prematurely
  //     messageFinish.innerHTML = `<p>Session ended abnormally because the other player closed their window or was disconnected</p>`;
      
  // } else 
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