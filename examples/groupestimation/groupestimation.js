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

//Instruction
let practiceSessionActive = false;

let practiceCompleted = false;

const instructionSteps = [
    {
        text: "Welcome! In this game, you will team up with two other participants to move blocks into slots. You’ll work together to complete four levels.",

        demo: '', 
    },{
        text: `
    Blocks are the main objects you need to move in this game. This is what a block looks like. 
    
    \nEach block must be pushed into a slot to complete the level.`,
        demo: `
        <div style="
            width: 90px;
            height: 90px;
            background-image: url('./images/block.png');
            background-size: cover;
            image-rendering: pixelated;
            margin: auto;
        " title="Block"></div>
        `
    },
    {
        text: `
        Obstacles can be moved just like blocks. This is what an obstacle looks like. 
        
        \nHowever, you don’t need to move them into slots to complete the level — they’re just in your way. \nIf an obstacle ends up in a slot, nothing happens.
        `,
        demo: `
        <div style="
            width: 60px;
            height: 60px;
            background-image: url('./images/obstacle.png');
            background-size: cover;
            image-rendering: pixelated;
            margin: auto;
        " title="Obstacle"></div>
        `
    },
    {
        text: `
    Slots are the target location for the blocks. 
    
    \nA block disappears when it reaches a slot. 
    
    \nA level is completed when all blocks are in slots.`,
        demo: `
        <div style="
            width: 90px;
            height: 90px;
            border: 5px dashed #3090c7;
            background-color: rgba(0,0,0,0.1);
            box-shadow: 0 0 6px rgba(0, 255, 255, 0.7), inset 0 0 6px rgba(0, 255, 255, 0.3);
            image-rendering: pixelated;
            margin: auto;
        " title="Slot"></div>
        `
    },        
    {
        text: `
        To move a block or obstacle, click one of the white arrows around it. 
        
        \nEach arrow shows a direction you can vote to push the object toward.
        
        \nThe number in the center (e.g., min: 1) tells you how many players must agree on the same direction for the object to move.
        
        \nFor example, the min: 1 block below means your vote alone is enough to move it. \nWhen you hover over a direction arrow, it will highlight.
        `,
        demo: `
        <div id="arrow-demo-container" style="position: relative; width: 100px; height: 100px; margin: auto;">
          <div style="
            width: 120px;
            height: 120px;
            background: url('./images/block.png');
            background-size: cover;
            position: absolute;
            left: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: monospace;
            font-size: 16px;
            font-weight: bold;
            color: white;
            text-shadow: 1px 1px 2px black;
          ">
            min: 1
          </div>
          <div class="triangle up" style="top: 85px; left: 82px;"></div>
          <div class="triangle down" style="top: 5px; left: 82px; position: absolute;"></div>
          <div class="triangle left" style="top: 60px; left: 105px; position: absolute;"></div>
          <div class="triangle right" style="top: 60px; left: 25px; position: absolute;"></div>
        </div>
        `
      },
      {
        text: `
      Some blocks require more than one player to move. This one needs two players to vote the same way.
      
      \nWork together to make the same choice — the block won’t move unless enough players agree.
      `,
      demo: `
      <div id="arrow-demo-container" style="position: relative; width: 100px; height: 100px; margin: auto;">
        <div style="
          width: 120px;
          height: 120px;
          background: url('./images/block.png');
          background-size: cover;
          position: absolute;
          left: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: monospace;
          font-size: 16px;
          font-weight: bold;
          color: white;
          text-shadow: 1px 1px 2px black;
        ">
          min: 2
        </div>
        <div class="triangle up" style="top: 85px; left: 82px;"></div>
        <div class="triangle down" style="top: 5px; left: 82px; position: absolute;"></div>
        <div class="triangle left" style="top: 60px; left: 105px; position: absolute;"></div>
        <div class="triangle right" style="top: 60px; left: 25px; position: absolute;"></div>
      </div>
      `
      },
      {
        text: `
      This block shows min: 3 — that means three players need to agree on the same direction to move it.
      
      \nBut it's not just about having 3 votes total. What matters is net agreement: the number of players voting for a direction must be at least 3 more than the total voting for other directions.
      
      \nFor example, if 4 players vote right and 1 votes left, the net agreement is 3 — so the block moves right!
      `,
      demo: `
      <div id="arrow-demo-container" style="position: relative; width: 100px; height: 100px; margin: auto;">
        <div style="
          width: 120px;
          height: 120px;
          background: url('./images/block.png');
          background-size: cover;
          position: absolute;
          left: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: monospace;
          font-size: 16px;
          font-weight: bold;
          color: white;
          text-shadow: 1px 1px 2px black;
        ">
          min: 3
        </div>
        <div class="triangle up" style="top: 85px; left: 82px;"></div>
        <div class="triangle down" style="top: 5px; left: 82px; position: absolute;"></div>
        <div class="triangle left" style="top: 60px; left: 105px; position: absolute;"></div>
        <div class="triangle right" style="top: 60px; left: 25px; position: absolute;"></div>
      </div>
      `
      },
      {
        text: `
          This is your avatar! You'll use it to interact with blocks and obstacles in the game.
          
          \nWhen you click on a direction you want to push an object toward, your avatar will appear next to that object.
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
        text: `
        Now let's practice! 

        \nTry to move the obstacle away from the slot, and then move the block into the slot.
        
        \nYou will be able to proceed to the next step once you complete this task.`,
        demo: `<div id="practiceBoard" style="
                width: 360px;
                height: 360px;
                background-color: #bcbcbc;
                background-image: 
                    linear-gradient(to right, darkgray 1px, transparent 1px),
                    linear-gradient(to bottom, darkgray 1px, transparent 1px);
                background-size: 45px 45px;
                position: relative;
                display: grid;
                grid-template-columns: repeat(8, 45px);
                grid-template-rows: repeat(8, 45px);
                margin: auto;">
            </div>
        `
        
      },
    {
        text:  `
        Unlike in the practice round, you won't be able to move a block directly in the game.
        
        \nInstead, in each level, you'll go through multiple rounds where you suggest how you want the blocks or obstacles to move.
        
        \nWhen you click an arrow, your suggestion becomes visible to all players — and you'll also see theirs.
    
        \nAfter five seconds, the game checks the suggestions and executes movements only if enough players agree.
      
        \nFor example:
        - A block that requires 2 players will move only if at least 2 players vote for the same direction.
        - A block that requires 3 players will move only if all 3 players agree.
      
        \nIf there isn't enough agreement, the object won't move.
        `,
        demo: ''
    },
    {
        text: `Here’s what could happen during those five seconds. There are three players in this example: playerOne, playerTwo, and playerThree.
        
        \nIn this video, playerTwo and playerThree vote to push a min: 2 block to the left, and playerOne votes to push a min: 1 block in the same direction.
        
        \nDuring the 5 seconds, players can click arrows on different blocks or obstacles to cast their votes — and change them freely. After voting ends, any object with enough agreement moves one step in the direction with the highest net votes.
        
        \nSo here, the min: 2 block and the min: 1 block both move one step to the left.`,        
        demo: `
        <div style="text-align: center;">
            <video width="480" autoplay loop muted playsinline style="border: 2px solid #ccc; border-radius: 8px;">
                <source src="./images/demo.mp4" type="video/mp4">
                Your browser does not support the video tag.
            </video>
        </div>
`

    },
    {
        text: `
        You'll advance to the next level as soon as all blocks are placed into slots. You will be playing all four levels with the same two participants.
        
        \nThe goal of this game is to coordinate and collaborate as effectively as possible to complete each level quickly.
        
       \n The experiment is complete once you finish all four levels.
        
        \nWork together and think strategically to finish as efficiently as possible!
        
        \nEach level has a time limit to keep the game moving. Try to complete the level before time runs out — otherwise, the game will automatically advance you to the next level.
        `        
        ,
        demo: '',
    },
    {
        text: `
        You're all set with the instruction!
        
        \nYou'll now be paired with two other players to complete all four levels together.
        
        \nClick Join Game below when you're ready to start.
        
        \nYou'll have 5 minutes to finish Level 1. Have fun!
        `
        ,
        demo: '',
        showNameEntry: true
    }
];

let currentStep = 0;

function renderInstructionStep() {
    const step = instructionSteps[currentStep];
    document.getElementById('instructionText').innerText = step.text;
    document.getElementById('instructionDemo').innerHTML = step.demo || '';

    document.getElementById('prevInstruction').style.display = currentStep > 0 ? 'inline-block' : 'none';
    // document.getElementById('nextInstruction').style.display = currentStep < instructionSteps.length - 1 ? 'inline-block' : 'none';
    const nextBtn = document.getElementById('nextInstruction');
    if (!practiceSessionActive && currentStep < instructionSteps.length - 1) {
        nextBtn.style.display = 'inline-block';
    } else {
        nextBtn.style.display = 'none';
    }
    document.getElementById('name-entry').style.display = step.showNameEntry ? 'block' : 'none';
}

document.getElementById('prevInstruction').onclick = () => {
    if (currentStep > 0) currentStep--;
    renderInstructionStep();
};

document.getElementById('nextInstruction').onclick = () => {
    if (currentStep < instructionSteps.length - 1) currentStep++;
    if (currentStep === 8) {
            if (!practiceCompleted) {
              practiceSessionActive = true;
              hideNextButton();
              setTimeout(() => {
                initPracticeBoard();
            }, 50);
            } else {
              showNextButton(); // If completed, just show it again
            }
      }
      
    renderInstructionStep();
};

//renderInstructionStep();


function initPracticeBoard() {
    const board = document.getElementById("practiceBoard");
    console.log("Board found?", board);
    console.log("board.childNodes:", board.childNodes);
    console.log("board.children:", board.children);

    if (board.children.length > 0) return;
  
    const CELL_SIZE = 45;
    let practiceBlock = { x: 4, y: 3, color: 'yellow', minVotes: 1 };
    let practiceObstacle = { x: 1, y: 2, id: 'obs1' };
    const slotPos = { x: 1, y: 3 };

    function createSlot(x, y) {
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
      

    function drawPracticeBlock(block, isObstacle) {
        const container = document.getElementById('practiceBoard'); 
        const div = document.createElement('div');
        div.classList.add('block');
        let width;
        let height;
        if(isObstacle){
            width = CELL_SIZE * 2.3;
            height = CELL_SIZE * 2.3;
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
            minText.style.fontSize = '11px';
            minText.style.fontWeight = 'bold';
            minText.style.textShadow = '1px 1px 0 #000';
            minText.style.color = 'white';
            minText.style.marginBottom = '2px';
            minText.style.imageRendering = 'pixelated';
            minText.style.fontFamily = 'monospace'; 
            div.appendChild(minText);
    
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
                addPracticeArrowToBlock(div, dir);
            });
            
    
            div.appendChild(arrow);
        });
    
        container.appendChild(div);
    }

    function addPracticeArrowToBlock(block, dir) {
        // Remove all existing arrows from any block
        document.querySelectorAll('.arrow').forEach(arrow => arrow.remove());
    
        // Clear all directions
        document.querySelectorAll('.block').forEach(b => delete b.dataset.direction);
    
        // Add a new arrow to the selected block
        const arrow = document.createElement('div');
        // arrow.src = './images/player1_arrow.png';
        arrow.classList.add('arrow');
        arrow.style.position = 'absolute';
        arrow.style.pointerEvents = 'none';


        arrow.style.width = '50px';
        arrow.style.height = '50px';
        arrow.style.position = 'absolute';
        arrow.style.pointerEvents = 'none';
        arrow.style.zIndex = '10000';
        arrow.style.transformOrigin = 'center center';
        arrow.style.backgroundImage = `url(./images/player1_arrow.png) `;
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
        finalizePracticeVotes();
    }    
    

    function finalizePracticeVotes() {
        const container = document.getElementById('practiceBoard');
        const blocks = container.querySelectorAll('.block');
        const futurePlans = [];
    
        blocks.forEach(block => {
            const direction = block.dataset.direction; // assume each block stores it on click
    
            const x = parseInt(block.dataset.x);
            const y = parseInt(block.dataset.y);
    
            let targetX = x;
            let targetY = y;
    
            if (direction === 'up') targetY -= 1;
            if (direction === 'down') targetY += 1;
            if (direction === 'left') targetX -= 1;
            if (direction === 'right') targetX += 1;
    
            const size = block.dataset.obstacle === 'true' ? 2 : 3;
    
            futurePlans.push({
                id: block.dataset.color,
                block,
                direction,
                size,
                willMove: true,
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
            }
        });
    }

    function movePracticeBlock(block, direction) {
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
        animateSpriteOnce(clone, 6, 50, 50, 6);

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
    
    
            const existing = block.querySelector('.practice-arrow');
            if (existing) existing.remove();
            block.dataset.direction = '';
    
            container.querySelectorAll('.direction-button').forEach(btn => btn.style.pointerEvents = 'auto');
            console.log("x:", x, "y:", y, "obstacle:", block.dataset.obstacle);
    
            if (block.dataset.obstacle !== "true" && x === 1 && y === 3){
   
                block.style.backgroundImage = "url('./images/slot.png')"; // or a tinted version
                block.style.backgroundSize = 'cover';
                block.style.boxShadow = '0 0 6px gold';
                block.style.border = '2px solid gold';

                block.style.transition = 'opacity 2s';
                block.style.opacity = '0';
                setTimeout(() => {
                    block.remove();
                    if (practiceSessionActive) {
                        showNextButton();
                        cleanupPracticeBoard();
                        practiceSessionActive = false;
                        practiceCompleted = true;  
                    }
                }, 2000);
            }
        }, 500); // match with transition duration
    }
    
    // Setup
    console.log(" Drawing slot...");
    createSlot(slotPos.x, slotPos.y);
    console.log(" Drawing block...");
    drawPracticeBlock(practiceBlock, false);
    console.log(" Drawing obstacle...");
    drawPracticeBlock(practiceObstacle, true);
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

function getNumPlayersFromURL() {
    const params = new URLSearchParams(window.location.search);
    const num = parseInt(params.get("numPlayers"));
    return isNaN(num) ? 5 : Math.max(2, Math.min(num, 5)); // default to 5, clamp between 2–5
}

let GameName = "groupestimation";
let NumPlayers = 3;
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
let listenerPaths = [ 'players', 'blocks', 'slots', 'obs', 'phase', 'moveBlock' ];

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
let currentPhase = null;
let localCountdown = 0;

let currentLevel = 0;

let eventNumber = 0;

const levelPlacements = {
    0: {
        blocks: {
            blue: { x: 7, y: 1, color: 'blue', minVotes: 3 },
            red: { x: 7, y: 5, color: 'red', minVotes: 2},
            yellow: { x: 7, y: 9, color: 'yellow', minVotes: 1 }
        },
        slots: {
            slot0: { x: 1, y: 5 },
            slot1: { x: 14, y: 5 }
        },
        obstacles: {
            obs1: { x: 0, y: 0, id: 'obs1' }
        }
    },
    1: {
        blocks: {
            blue: { x: 7, y: 1, color: 'blue', minVotes: 3 },
            red: { x: 7, y: 5, color: 'red', minVotes: 2},
            yellow: { x: 7, y: 9, color: 'yellow', minVotes: 1 }
        },
        slots: {
            slot0: { x: 1, y: 5 },
            slot1: { x: 14, y: 5 }
        },
        obstacles: {
            obs1: { x: 4, y: 2, id: 'obs1' },
            obs2: { x: 11, y: 2, id: 'obs2' }
        }
    },
    2: {
        blocks: {
            blue: { x: 7, y: 1, color: 'blue', minVotes: 3 },
            red: { x: 7, y: 5, color: 'red', minVotes: 2},
            yellow: { x: 7, y: 9, color: 'yellow', minVotes: 1 }
        },
        slots: {
            slot0: { x: 1, y: 5 },
            slot1: { x: 14, y: 5 }
        },
        obstacles: {
            obs1: { x: 1, y: 2, id: 'obs1' },
            obs2: { x: 3, y: 4, id: 'obs2' },
            obs3: { x: 15, y: 2, id: 'obs3' },
            obs4: { x: 13, y: 4, id: 'obs4' }
        }
    },
    3: {
        blocks: {
            blue: { x: 8, y: 3, color: 'blue', minVotes: 3 },
            red: { x: 6, y: 0, color: 'red', minVotes: 2 },
            yellow: { x: 10, y: 0, color: 'yellow', minVotes: 1 }
        },
        slots: {
            slot0: { x: 1, y: 5 },
            slot1: { x: 14, y: 5 }
        },
        obstacles: {
            obs1: { x: 1, y: 1, id: 'obs1' },
            obs2: { x: 4, y: 4, id: 'obs2' },
            obs3: { x: 4, y: 8, id: 'obs3' },
            obs4: { x: 15, y: 1, id: 'obs4' },
            obs5: { x: 13, y: 4, id: 'obs5' },
            obs6: { x: 12, y: 8, id: 'obs6' }
        }
    },
};

function loadLevel(levelNumber) {
    const config = levelPlacements[levelNumber];
    if (!config) {
        console.warn("No config for level", levelNumber);
        return;
    }

    GameState.blocks = config.blocks;
    GameState.slots = config.slots;
    GameState.obstacles = config.obstacles;

    // let allPlayerIDs = getCurrentPlayerIds();
    // allPlayerIDs.forEach(player => {
    //     newGameState.players[player] = {
    //         selectedBlock: null,
    //         selectedPosition: null
    //     };
    // });
    updateStateDirect('blocks', GameState.blocks, 'initalizeBlock');
    updateStateDirect('slots', GameState.slots, 'initalizeSlots');
    //updateStateDirect('obs', GameState.obstacles, 'initalizeObstacle');

    Object.values(GameState.slots).forEach(slot => {
        drawSlot(slot);
    });
        
    Object.values(GameState.blocks).forEach(block => {
        drawBlock(block, false);
    });

    // Object.values(GameState.obstacles).forEach(obstacles => {
    //     drawBlock(obstacles, true);
    //  });

    if (GameState.obstacles && Object.keys(GameState.obstacles).length > 0) {
        updateStateDirect('obs', GameState.obstacles, 'initializeObstacle');
    
        Object.values(GameState.obstacles).forEach(obstacle => {
            drawBlock(obstacle, true);
        });
    }
    startLevelTimer(levelNumber);
}

function showLevelCompleteMessage(levelNumber, callback) {
    const screen = document.getElementById('levelCompleteScreen');

    // Clear any previous content
    screen.innerHTML = '';

    // Create a new message element
    const message = document.createElement('div');
    message.style.fontSize = '32px';
    message.style.fontWeight = 'bold';
    message.style.color = '#333';
    message.style.padding = '20px';
    message.style.fontFamily = 'monospace';
    message.style.textAlign = 'center';

    if (currentLevel === 4) {
        message.innerHTML = `🎉 You've completed all levels!<br>You will be redirected to Prolific shortly.`;
        screen.appendChild(message);
        screen.style.display = 'flex';

        setTimeout(() => {
            window.location.href = 'https://app.prolific.co/submissions/complete?cc=XXXXXXX'; // Replace with your real code
        }, 3000);
    } else {
        const timeLimitMs = getLevelTimeLimit(levelNumber);
        const timeLimitMin = Math.floor(timeLimitMs / 60000);

        message.innerHTML = `🎉 You've completed Level ${levelNumber}!<br>Loading Level ${levelNumber + 1}...<br><br>⏱ You will have ${timeLimitMin} minutes to complete it.`;
        screen.appendChild(message);
        screen.style.display = 'flex';

        setTimeout(() => {
            screen.style.display = 'none';
            callback(); // Proceed to next level
        }, 3000);
    }
}



function getLevelTimeLimit(levelNumber) {
    if (levelNumber === 0 || levelNumber === 1) {
        return 5 * 60 * 1000; // 3 minutes
    } else if (levelNumber === 2 || levelNumber === 3) {
        return 7 * 60 * 1000; // 5 minutes
    } else {
        return 5 * 60 * 1000; // default fallback
    }
}

let currentLevelTimer = null;

// Helper: start timer for the level
function startLevelTimer(levelNumber) {
    if (currentLevelTimer) {
        clearInterval(currentLevelTimer);
        currentLevelTimer = null;
    }

    const duration = getLevelTimeLimit(levelNumber);
    const startTime = Date.now();

    currentLevelTimer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = duration - elapsed;

        if (remaining <= 0) {
            clearInterval(currentLevelTimer);
            currentLevelTimer = null;

            currentLevel += 1;
            if (currentLevel === 5) {
                showLevelCompleteMessage(currentLevel - 1, () => {}); // Prolific redirect
            } else {
                clearImageContainer();
                showLevelCompleteMessage(currentLevel - 1, () => {
                    loadLevel(currentLevel);
                });
            }
        } else {
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            updateTimerDisplay(minutes, seconds);
        }
    }, 1000);
}

// Helper: updates only the timer line under the turn message
function updateTimerDisplay(min, sec) {
    const timerEl = document.getElementById('levelTimerDisplay');
    timerEl.textContent = `⏱ Time remaining: ${min}:${sec.toString().padStart(2, '0')}`;
}

// Helper: use this in level-completion logic to stop the timer
function stopLevelTimer() {
    if (currentLevelTimer) {
        clearInterval(currentLevelTimer);
        currentLevelTimer = null;
    }
}

let playerName;
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
//let leaveButton = document.getElementById('leaveBtn');

//      Complete Screen
let messageFinish = document.getElementById('messageFinish');


//let turnText = document.getElementById('turnMessage');


//imageContainer.src = images[selectedImages[trialNumber]].path;

// Set up correct instructions
instructionsText.innerHTML = `<p>Welcome! In this game, you will team up with two other participants to move blocks into slots. You’ll work together to complete four levels.</p>`;


//  Game Event Listeners

//      Join Button
joinButton.addEventListener('click', function () {

    playerName = document.getElementById('playerName').value.trim();
    if (!playerName) {
        alert("Please enter your name before proceeding.");
        return;
    }
    /*
    Call the library function to attempt to join a session.
    
    This results in one of the following:
        - starting a session directly
        - starting a waiting room
    */
    joinSession();
});

// //      Leave Button (End Session Button)
// leaveButton.addEventListener('click', function () {
//     /*
//     Call the library function to leave a session.
    
//     This then triggers the local function endSession.
//     */
//     leaveSession();
// });

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
    const arrivalIndex = getCurrentPlayerArrivalIndex(); // 1-based
    const name = document.getElementById('playerName')?.value.trim() || `Player ${arrivalIndex}`;
    const playerId = getCurrentPlayerId();

    updateStateDirect(`players/${playerId}`, {
        color: arrivalIndex,
        name: name
    });

    playerColorMap[playerId] = {
        color: arrivalIndex,
        name: name
    };
}


// function tickPhaseOwner() {
//     if (getCurrentPlayerArrivalIndex() !== 1) return;

//     localCountdown--;

//     if (localCountdown >= 0) {
//         updateStateDirect("phase", {
//             current: currentPhase,
//             timeRemaining: localCountdown
//         });
//     }

//     if (localCountdown === 0) {
//         if (currentPhase === "voting") {
//             //finalizeVotes();
//             startPhase("moving", breakDuration);
//         } else {
//             startPhase("voting", votingDuration);
//         }
//     }
// }

// function startPhase(phaseName, duration) {
//     // currentPhase = { current: phaseName, timeRemaining: duration };
//     currentPhase = phaseName;
//     localCountdown = duration;

//     if (getCurrentPlayerArrivalIndex() === 1) {
//         updateStateDirect("phase", {
//             current: phaseName,
//             timeRemaining: duration
//     });
//     }
// }
function startPhase(phaseName, durationInSeconds) {
    const now = Date.now();
    const endTime = now + durationInSeconds * 1000;

    currentPhase = phaseName;
    localCountdown = durationInSeconds;

    updateStateDirect("phase", {
        current: phaseName,
        endTime: endTime,
        controllerId: getCurrentPlayerId()
    });
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


// function startVotingPhase() {
//     clearTimeout(roundTimer);
//     clearInterval(countdownInterval);

//     let countdown = votingDuration;
//     const turnMessage = document.getElementById('turnMessage');
//     turnMessage.innerText = `Choose which block you want to move in ${countdown} seconds. You can change your vote at any time.`;

//     // Update the countdown every second
//     countdownInterval = setInterval(() => {
//         countdown--;
//         if (countdown > 0) {
//             turnMessage.innerText = `Decide which block you want to move in ${countdown} seconds. You can change your vote at any time.`;
//         }
//     }, 1000);


//     // // Start 15 second timer
//     // roundTimer = setTimeout(() => {
//     //     clearInterval(countdownInterval);
//     //     finalizeVotes();
//     // }, countdown * 1000);
// }

function finalizeVotes() {
    getCurrentPlayerIds().forEach(pid => {
        updateStateDirect(`players/${pid}`, { block: null, direction: null, obstacle: null });
    });

    //hideDirectionButtons();
    //const turnMessage = document.getElementById('turnMessage');
    // turnMessage.innerText = `Moving the blocks now...`;

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

        //arrows.forEach(arrow => arrow.remove());
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

            let x = parseInt(plan.block.dataset.x);
            let y = parseInt(plan.block.dataset.y);
        
            if (plan.direction === 'up') y -= 1;
            if (plan.direction === 'down') y += 1;
            if (plan.direction === 'left') x -= 1;
            if (plan.direction === 'right') x += 1;
        
            x = Math.max(0, Math.min(17, x));
            y = Math.max(0, Math.min(11, y));
        

            updateStateDirect(`moveBlock/${plan.block.dataset.color}`, {
                location: {x, y},
                direction: plan.direction,
                move: true
            });

            console.log(`Pushing moveBlock for ${plan.block.dataset.color}: ${x, y}`);

            
            //moveBlock(plan.block, plan.direction);
        }else{
            updateStateDirect(`moveBlock/${plan.block.dataset.color}`, {
                move: false,
                version: Date.now()
            });

        }
    });

    // setTimeout(() => {
    //     showDirectionButtons();
    //     startVotingPhase();
    // }, breakDuration * 1000);
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

// function getMinRequiredVotes(color) {
//     const minVotesMap = {
//         blue: 1,
//         red: 1,
//         yellow: 1,
//     };
//     return minVotesMap[color] || 1; // default to 1 if undefined
// }


function moveBlock(block, x, y, direction) {
    console.log(`moveBlock called for ${block.dataset.color}, direction: ${x, y}`);

    const color = block.dataset.color;

    // Skip slot locking logic if it's an obstacle
    const isObstacle = block.dataset.obstacle === "true";

    // Don't move if already locked (only applies to non-obstacles)
    if (!isObstacle && lockedBlocks[color]) return;

    // let x = parseInt(block.dataset.x);
    // let y = parseInt(block.dataset.y);

    // if (direction === 'up') y -= 1;
    // if (direction === 'down') y += 1;
    // if (direction === 'left') x -= 1;
    // if (direction === 'right') x += 1;

    // x = Math.max(0, Math.min(17, x));
    // y = Math.max(0, Math.min(11, y));

    block.dataset.x = x;
    block.dataset.y = y;
    const arrows = block.querySelectorAll('.arrow');
    arrows.forEach(arrow => {
        const direction = arrow.dataset.direction;
    
        const offsetMap = {
            up:    { dx: 0, dy: -1 },
            down:  { dx: 0, dy: 1 },
            left:  { dx: -1, dy: 0 },
            right: { dx: 1, dy: 0 }
        };
        const offset = offsetMap[direction];
        if (!offset) return;
    
        const arrowRect = arrow.getBoundingClientRect();
    
        // Create floating clone
        const clone = arrow.cloneNode(true);
        clone.style.position = 'absolute';
        clone.style.pointerEvents = 'none';
        clone.style.left = `${arrowRect.left}px`;
        clone.style.top = `${arrowRect.top}px`;
        clone.style.margin = '0';
        clone.style.transform = 'none';
        clone.style.transition = 'top 0.5s ease, left 0.5s ease';
        document.body.appendChild(clone);
        // Map direction to rotation
        const rotationMap = {
            down: 'rotate(90deg)',
            left: 'rotate(180deg)',
            up: 'rotate(270deg)',
            right: 'rotate(0deg)'
        };

        // Apply rotation to match the direction
        clone.style.transform = rotationMap[direction];
        clone.style.transformOrigin = 'center center';
        if (direction === 'left') {
            clone.style.transform += ' scaleY(-1)';
        }

    
        // Animate clone
        requestAnimationFrame(() => {
            clone.style.left = `${arrowRect.left + offset.dx * CELL_WIDTH}px`;
            clone.style.top = `${arrowRect.top + offset.dy * CELL_HEIGHT}px`;
        });
    
        // Animate sprite
        animateSpriteOnce(clone, 6, 50, 50, 6);
    
        // Clean up
        setTimeout(() => clone.remove(), 1500);
    });
    
    // Remove original static arrows
    block.querySelectorAll('.arrow').forEach(a => a.remove());
    
    const ANIMATION_DURATION = 500; // Match arrow timing


    block.style.transition = `top ${ANIMATION_DURATION}ms ease, left ${ANIMATION_DURATION}ms ease, transform 0.2s`;
    block.style.left = (x * CELL_WIDTH) + 'px';
    block.style.top = (y * CELL_HEIGHT) + 'px';
    
//         // Trigger slight scale effect after moving
//     setTimeout(() => {
//             block.style.transform = 'scale(1)';
//         }, 200);
// ;


    // Only check slot match if it's not an obstacle
    if (!isObstacle) {
        setTimeout(() => {
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

                        if (Object.keys(lockedBlocks).length === 3) {
                            console.log("All blocks locked — advancing level...");
                            currentLevel++;
                            lockedBlocks = {};  
                        
                            showLevelCompleteMessage(currentLevel, () => {
                                clearImageContainer();
                                stopLevelTimer();
                                
                                if (currentLevel != 4){
                                    loadLevel(currentLevel);
                                    startPhase("voting", votingDuration);
                                }
                            });

                            // setTimeout(() => {
                            //     clearImageContainer();
                            //     loadLevel(currentLevel);

                            //     startPhase("voting", votingDuration);
                            // }, 2000);  // Give time for animations
                        }
                    }, 2000);
                    // delete GameState.slots[slotColor];
                    break;
                }
            }
     }, 500); 
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
        minText.style.fontSize = '11px';
        minText.style.fontWeight = 'bold';
        minText.style.textShadow = '1px 1px 0 #000';
        minText.style.color = 'white';
        minText.style.marginBottom = '2px';
        minText.style.imageRendering = 'pixelated';
        minText.style.fontFamily = 'monospace'; 
        div.appendChild(minText);

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
            const playerId = getCurrentPlayerId();
            if (isObstacle) {
                updateStateDirect(`players/${playerId}`, {
                    obstacle: id,
                    block: null, 
                    direction: dir,
                    event: eventNumber,
                    level: currentLevel
                });
            } else {
                updateStateDirect(`players/${playerId}`, {
                    block: id,
                    obstacle: null,
                    direction: dir,
                    event: eventNumber,
                    level: currentLevel
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
    console.log(`[addArrowToBlock] Adding arrow for player ${playerId} to color ${color}`);

    // Get the arrival index to determine the correct image
    const arrivalIndex = playerColorMap[playerId]?.color; // assumes 1-based index
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

    arrow.dataset.rotation = rotationMap[visualPosition[direction]] || 'rotate(0deg)';
    arrow.dataset.playerId = playerId;
    arrow.dataset.direction = direction;
    arrow.style.backgroundPosition = '0px 0px';
    //animateSpriteLoop(arrow, 6, 50, 50, 6);

    block.appendChild(arrow);
    const isObstacle = block.dataset.obstacle === "true";

    // Re-layout all arrows of this direction in the block
    layoutDirectionalArrows(block, direction,isObstacle );
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
                topPx = isObstacle ? 90 : 135; 
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
                leftPx = isObstacle ? 80 : 125; 
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
    });
}


function animateSpriteOnce(arrowDiv, frameCount = 6, frameWidth = 45, frameHeight = 45, fps = 6) {
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
    console.log(`[removeArrowFromPlayer] Removing arrows for player ${playerId}`);

    const arrows = document.querySelectorAll(`.arrow[data-player-id="${playerId}"]`);
    arrows.forEach(arrow => arrow.remove());
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

    // // Initialize player choices
    // let allPlayerIDs = getCurrentPlayerIds();
    // allPlayerIDs.forEach(player => {
    //     newGameState.players[player] = {
    //         selectedBlock: null,
    //         selectedPosition: null
    //     };
    // });

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

function clearImageContainer() {
    const container = document.getElementById('image-container');
    container.innerHTML = '';
}


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



function _createOtherPlayerAvatar() {
    let otherPlayerContainer = document.getElementById('other-player-content');

    const thisPlayerID = getCurrentPlayerId();
    const allPlayerIDs = getCurrentPlayerIds();

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

            const avatarSrc = `./images/player${arrivalIndex}.png`;

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


    GameState = _randomizeGamePlacement();

    let arrivalIndex = getCurrentPlayerArrivalIndex();

    if (arrivalIndex == 1){
        // updateStateDirect('blocks', GameState.blocks, 'initalizeBlock');
        // updateStateDirect('slots', GameState.slots, 'initalizeSlots');
        // updateStateDirect('obs', GameState.obstacles, 'initalizeObstacle');

        // Object.values(GameState.slots).forEach(slot => {
        //     drawSlot(slot);
        // });
        
        // Object.values(GameState.blocks).forEach(block => {
        //     drawBlock(block, false);
        // });

        // Object.values(GameState.obstacles).forEach(obstacles => {
        //     drawBlock(obstacles, true);
        // });

        //setInterval(tickPhaseOwner, 1000); // centralized tick
        startPhase("voting", votingDuration);
        
    }
    loadLevel(currentLevel);

    console.log("Initialized GameState:", GameState);
    //_createOtherPlayerAvatar();
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

        if (playerData.color || playerData.name) {
            playerColorMap[playerId] = {
                color: playerData.color ?? playerColorMap[playerId]?.color,
                name: playerData.name ?? playerColorMap[playerId]?.name
            };
    
            console.log("Player data received:");
            console.log(playerColorMap);

            console.log(Object.keys(playerColorMap).length);

            if (Object.keys(playerColorMap).length === NumPlayers) {
                _createOtherPlayerAvatar();
            }
        }
    
        // 2. Draw the new arrow if both block and direction are selected
        if (playerData.obstacle && playerData.direction) {
            console.log(`playerData.block = ${playerData.block}, playerData.obstacle = ${playerData.obstacle}, direction = ${playerData.direction}`);
            addArrowToBlock(playerData.obstacle, playerData.direction, playerId);
        } else if (playerData.block && playerData.direction) {
            console.log(`playerData.block = ${playerData.block}, playerData.obstacle = ${playerData.obstacle}, direction = ${playerData.direction}`);
            addArrowToBlock(playerData.block, playerData.direction, playerId);
        }
        

    } else if(pathNow == "blocks" && (typeChange == 'onChildAdded' ||typeChange == 'onChildChanged')){
        console.log("Block update received:", nodeName, newState);
        // let arrivalIndex = getCurrentPlayerArrivalIndex();
        // if(arrivalIndex != 1){
        //     GameState.blocks[nodeName] = newState;  // update your local GameState
        //     drawBlock(newState, false)
        // }

    }else if(pathNow == "slots" && (typeChange == 'onChildAdded' ||typeChange == 'onChildChanged')){
        // console.log("Slots update received:", nodeName, newState);
        // let arrivalIndex = getCurrentPlayerArrivalIndex();
        // if(arrivalIndex != 1){
        //     GameState.slots[nodeName] = newState; // update your local GameState
        //     drawSlot(newState);
        // }
    }else if(pathNow == "obs" && (typeChange == 'onChildAdded' ||typeChange == 'onChildChanged')){
        // console.log("received obstacle update");
        // let arrivalIndex = getCurrentPlayerArrivalIndex();
        // if(arrivalIndex != 1){
        //     GameState.obstacles[newState.id] = newState; 
        //     drawBlock(newState, true);
        // }
    } else if (pathNow === 'phase') {
        if (nodeName === 'current') {
            currentPhase = newState;
            if (currentPhase === 'voting') {
                showDirectionButtons();
            } else if (currentPhase === 'moving') {
                hideDirectionButtons();
                const msg = document.getElementById('turnMessage');
                msg.innerText = `Moving the blocks now...`;
                msg.style.textShadow = '1px 1px 0 #000';
                msg.style.imageRendering = 'pixelated';
                msg.style.fontFamily = 'monospace';
            }
        } else if (nodeName === 'endTime') {
            const endTime = newState;
    
            clearInterval(countdownInterval);
    
            countdownInterval = setInterval(() => {
                const timeLeft = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
                localCountdown = timeLeft;
    
                const msg = document.getElementById('turnMessage');
                msg.innerText = (currentPhase === 'voting')
                    ? `Choose which block you want to move in ${timeLeft}s. You can change your vote at any time.`
                    : `Moving the blocks now...`;
                msg.style.textShadow = '1px 1px 0 #000';
                msg.style.imageRendering = 'pixelated';
                msg.style.fontFamily = 'monospace';
    
                // If time is up
                if (timeLeft <= 0) {
                    clearInterval(countdownInterval);
    
                    // Check if this player should take over phase control
                    const myId = getCurrentPlayerId();
                    const sortedIds = getCurrentPlayerIds().sort(); // consistent ordering
                    const fallbackLeader = sortedIds[0]; // always first alphabetically
                    let nextPhase = (currentPhase === 'voting') ? 'moving' : 'voting';
                    // if (nextPhase === 'moving'){

                    //     hideDirectionButtons();
                    //         // const container = document.getElementById('image-container');
                    //         // const blocks = container.querySelectorAll('.block');
                    //         // blocks.forEach(block => {
        
                    //         //     const arrows = block.querySelectorAll('.arrow');
                    //         //     arrows.forEach(arrow => arrow.remove());
                    //         // });

                    // }else{
                    //     showDirectionButtons();
                    // }

                    if (nextPhase === 'moving'){
                        eventNumber++; 
                    }
    
                    if (myId === fallbackLeader) {
                        console.warn("Fallback or primary controller is advancing phase.");
    
                        const nextPhase = (currentPhase === 'voting') ? 'moving' : 'voting';
                        const duration = (nextPhase === 'voting') ? votingDuration : breakDuration;
                        if (nextPhase === 'moving'){
                            finalizeVotes(); 
                        }
    
    
                        startPhase(nextPhase, duration);
                    }
                }
            }, 500);
        }
    } else if (pathNow === 'moveBlock' && 
            (typeChange === 'onChildAdded' || typeChange === 'onChildChanged')) {

        const color = nodeName;
        const blockState = newState;
        console.log("blockState:", blockState);

        if (!blockState) return;
        const block = document.querySelector(`.block[data-color="${color}"]`);
        const arrows = block.querySelectorAll('.arrow');
        if(blockState.move == false){
            arrows.forEach(a => a.remove());
            return;
        }

        if (block) {
            arrows.forEach(a => {
                if (a.dataset.direction !== blockState.direction) a.remove();
            });
            let x = blockState.location.x;
            let y = blockState.location.y;

            setTimeout(() => {
                moveBlock(block, x, y, blockState.direction);
            }, 500);
            
        } else {
            console.warn(`Block not found for ${color}`);
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