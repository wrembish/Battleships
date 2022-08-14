document.addEventListener('DOMContentLoaded', () => {
    const userGrid = document.querySelector('.grid-user')
    const computerGrid = document.querySelector('.grid-computer')
    const displayGrid = document.querySelector('.grid-display')
    const ships = document.querySelectorAll('.ship')
    const destroyer = document.querySelector('.destroyer-container')
    const submarine = document.querySelector('.submarine-container')
    const cruiser = document.querySelector('.cruiser-container')
    const battleship = document.querySelector('.battleship-container')
    const carrier = document.querySelector('.carrier-container')
    const startButton = document.querySelector('#start')
    const rotateButton = document.querySelector('#rotate')
    const turnDisplay = document.querySelector('#whose-go')
    const infoDisplay = document.querySelector('#info')
    const setupButtons = document.getElementById('setup-buttons')
    const userSquares = []
    const computerSquares = []
    const width = 10
    let computerAI = [] // Array to track moves the computer decides are more likely to contain a hit
    let computerTrack = []
    let isHorizontal = true
    let isGameOver = false
    let currentPlayer = 'user'
    let playerNum = 0
    let ready = false
    let enemyReady = false
    let allShipsPlaced = false
    let shotFired = -1
    // Ship mousedown event listener variables
    let selectedShipNameWithIndex
    let draggedShip
    let draggedShipLength
    // Player score for hit parts of enemy ships
    let destroyerCount = 0
    let submarineCount = 0
    let cruiserCount = 0
    let battleshipCount = 0
    let carrierCount = 0
    // Enemy score for hit parts of player ships
    let enemyDestroyerCount = 0
    let enemySubmarineCount = 0
    let enemyCruiserCount = 0
    let enemyBattleshipCount = 0
    let enemyCarrierCount = 0

    //Ships
    const shipArray = [
        { name: 'destroyer', directions: [ [0, 1], [0, width] ] },
        { name: 'submarine', directions: [ [0, 1, 2], [0, width, width * 2] ] },
        { name: 'cruiser', directions: [ [0, 1, 2], [0, width, width * 2] ] },
        { name: 'battleship', directions: [ [0, 1, 2, 3], [0, width, width * 2, width * 3] ] },
        { name: 'carrier', directions: [ [0, 1, 2, 3, 4], [0, width, width * 2, width * 3, width * 4] ] },
    ]

    // arrays for the left out of bounds squares and right out of bounds squares
    const leftOOB = []
    for (let i = -1; i < width*width; i += width) leftOOB.push(i)
    const rightOOB = []
    for (let i = width; i < width*width + 1; i+=width)  rightOOB.push(i)

    createBoard(userGrid, userSquares)
    createBoard(computerGrid, computerSquares)

    // Select Player Mode
    if (gameMode === 'singlePlayer') startSinglePlayer()
    else startMultiPlayer()

    // Multiplayer
    function startMultiPlayer() {
        const socket = io()

        // Get your player number
        socket.on('player-number', num => {
            if (num === -1) infoDisplay.innerHTML = 'Sorry, the server is full'
            else {
                playerNum = parseInt(num)
                if(playerNum === 1) currentPlayer = 'enemy'
                
                console.log(playerNum)

                // Get other player status
                socket.emit('check-players')
            }
        })

        // Another player has connected or disconnected
        socket.on('player-connection', num => {
            console.log(`Player number ${num} has connected or disconnected`)
            playerConnectedOrDisconnected(num)
        })

        // On enemy ready
        socket.on('enemy-ready', num => {
            enemyReady = true
            playerReady(num)
            if (ready) playGameMulti(socket)
        })

        // Check player status
        socket.on('check-players', players => {
            players.forEach((p, i) => {
                if (p.connected) playerConnectedOrDisconnected(i)
                if(p.ready) {
                    playerReady(i)
                    if(i !== playerNum) enemyReady = true
                }
            })
        })

        // On Timeout
        socket.on('timeout', () => { infoDisplay.innerHTML = 'You have reached the 10 minutes limit' })

        // Ready button click
        startButton.addEventListener('click', () => {
            if (allShipsPlaced) playGameMulti(socket)
            else infoDisplay.innerHTML = 'Please place all ships'
        })

        // Setup event listener for firing
        computerSquares.forEach(square => {
            square.addEventListener('click', () => {
                if(currentPlayer === 'user' && ready && enemyReady && !isGameOver) {
                    shotFired = square.dataset.id
                    socket.emit('fire', shotFired)
                }
            })
        })

        // On Fire Recieved
        socket.on('fire', id => {
            enemyGo(id)
            const square = userSquares[id]
            socket.emit('fire-reply', square.classList)
            playGameMulti(socket)
        })

        // On Fire Reply Recieved
        socket.on('fire-reply', classList => {
            revealSquare(classList)
            playGameMulti(socket)
        })

        function playerConnectedOrDisconnected(num) {
            let player = `.p${parseInt(num) + 1}`
            document.querySelector(`${player} .connected`).classList.toggle('active') 
            if(parseInt(num) === playerNum) document.querySelector(player).style.fontWeight = 'bold'
        }
    }

    // Single Player
    function startSinglePlayer() {
        shipArray.forEach(ship => { generate(ship) })

        startButton.addEventListener('click', () => {
            if (allShipsPlaced) {
                setupButtons.style.display = 'none'
                playGameSingle()
            }
            else infoDisplay.innerHTML = 'Please place all ships'
        })
    }

    //Create Board
    function createBoard(grid, squares) {
        for (let i = 0; i < width * width; i++) {
            const square = document.createElement('div')
            square.dataset.id = i
            grid.appendChild(square)
            squares.push(square)
        }
    }

    //Draw the computers ships in random locations
    function generate(ship) {
        let randomDirection = Math.floor(Math.random() * ship.directions.length)
        let current = ship.directions[randomDirection]
        if (randomDirection === 0) direction = 1
        if (randomDirection === 1) direction = 10
        let randomStart = Math.abs(Math.floor(Math.random() * computerSquares.length - (ship.directions[0].length * direction)))

        const isTaken = current.some(index => computerSquares[randomStart + index].classList.contains('taken'))
        const isAtRightEdge = current.some(index => (randomStart + index) % width === width - 1)
        const isAtLeftEdge = current.some(index => (randomStart + index) % width === 0)

        if (!isTaken && !isAtRightEdge && !isAtLeftEdge) current.forEach(index => computerSquares[randomStart + index].classList.add('taken', ship.name))

        else generate(ship)
    }

    //Rotate the ships
    function rotate() {
        destroyer.classList.toggle('destroyer-container-vertical')
        submarine.classList.toggle('submarine-container-vertical')
        cruiser.classList.toggle('cruiser-container-vertical')
        battleship.classList.toggle('battleship-container-vertical')
        carrier.classList.toggle('carrier-container-vertical')
        isHorizontal = !isHorizontal
        console.log(isHorizontal)
    }
    rotateButton.addEventListener('click', rotate)

    //move around user ship
    ships.forEach(ship => ship.addEventListener('dragstart', dragStart))
    userSquares.forEach(square => {
        square.addEventListener('dragstart', dragStart)
        square.addEventListener('dragover', dragOver)
        square.addEventListener('dragenter', dragEnter)
        square.addEventListener('dragleave', dragLeave)
        square.addEventListener('drop', dragDrop)
        square.addEventListener('dragend', dragEnd)
    })

    ships.forEach(ship => ship.addEventListener('mousedown', (e) => {
        selectedShipNameWithIndex = e.target.id
        console.log(selectedShipNameWithIndex)
    }))

    function dragStart() {
        draggedShip = this
        draggedShipLength = this.childNodes.length
        console.log(draggedShip)
    }

    function dragOver(e) {
        e.preventDefault()
    }

    function dragEnter(e) {
        e.preventDefault()
    }

    function dragLeave() {
        console.log('drag leave')
    }

    function dragDrop() {
        let shipNameWithLastId = draggedShip.lastChild.id
        let shipClass = shipNameWithLastId.slice(0, -2)
        console.log(shipClass)
        let lastShipIndex = parseInt(shipNameWithLastId.substr(-1))
        let shipLastId = lastShipIndex + parseInt(this.dataset.id)
        console.log(shipLastId)
        const notAllowedHorizontal = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 1, 11, 21, 31, 41, 51, 61, 71, 81, 91, 2, 22, 32, 42, 52, 62, 72, 82, 92, 3, 13, 23, 33, 43, 53, 63, 73, 83, 93]
        const notAllowedVertical = [99, 98, 97, 96, 95, 94, 93, 92, 91, 90, 89, 88, 87, 86, 85, 84, 83, 82, 81, 80, 79, 78, 77, 76, 75, 74, 73, 72, 71, 70, 69, 68, 67, 66, 65, 64, 63, 62, 61, 60]

        let newNotAllowedHorizontal = notAllowedHorizontal.splice(0, 10 * lastShipIndex)
        let newNotAllowedVertical = notAllowedVertical.splice(0, 10 * lastShipIndex)

        selectedShipIndex = parseInt(selectedShipNameWithIndex.substr(-1))

        shipLastId = shipLastId - selectedShipIndex
        console.log(shipLastId)
        const shipsToDrop = []

        if (isHorizontal && !newNotAllowedHorizontal.includes(shipLastId)) {
            for (let i = 0; i < draggedShipLength; i++) {
                let index = parseInt(this.dataset.id) - selectedShipIndex + i
                if(userSquares [index].classList.contains('taken')) return
                let directionClass
                if (i === 0) directionClass = 'start'
                if (i === draggedShipLength - 1) directionClass = 'end'
                shipsToDrop.push({ index : index, direction : directionClass, class : shipClass })
            }

            shipsToDrop.forEach(ship => {
                userSquares[ship.index].classList.add('taken', 'horizontal', ship.direction, ship.class)
            })

            //As long as the index of the ship you are dragging is not in the newNotAllowedVertical array! This means that sometimes if you drag the ship by its
            //index-1 , index-2 and so on, the ship will rebound back to the displayGrid.
        } else if (!isHorizontal && !newNotAllowedVertical.includes(shipLastId)) {
            for (let i = 0; i < draggedShipLength; i++) {
                let index = parseInt(this.dataset.id) - selectedShipIndex + width * i
                if(userSquares [index].classList.contains('taken')) return
                let directionClass
                if (i === 0) directionClass = 'start'
                if (i === draggedShipLength - 1) directionClass = 'end'
                shipsToDrop.push({ index : index, direction : directionClass, class : shipClass })
            }

            shipsToDrop.forEach(ship => {
                userSquares[ship.index].classList.add('taken', 'vertical', ship.direction, ship.class)
            })
        } else return

        displayGrid.removeChild(draggedShip)
        if(!displayGrid.querySelector('.ship')) allShipsPlaced = true
    }

    function dragEnd() {
        console.log('dragend')
    }

    // Game Logic for Multiplayer
    function playGameMulti(socket) {
        setupButtons.style.display = 'none'
        if (isGameOver) return
        if(!ready) {
            socket.emit('player-ready')
            ready = true
            playerReady(playerNum)
        }

        if(enemyReady) {
            if(currentPlayer === 'user') {
                turnDisplay.innerHTML = 'Your Go'
            }
            if(currentPlayer === 'enemy') {
                turnDisplay.innerHTML = 'Enemy\'s Go'
            }
        }
    }

    function playerReady(num) {
        let player = `.p${parseInt(num) + 1}`
        document.querySelector(`${player} .ready`).classList.toggle('active')
    }

    // Game Logic for Single Player
    function playGameSingle() {
        if (isGameOver) return
        if (currentPlayer === 'user') {
            turnDisplay.innerHTML = 'Your Go'
            computerSquares.forEach(square => square.addEventListener('click', function (e) {
                if(currentPlayer === 'user') {
                    shotFired = square.dataset.id
                    revealSquare(square.classList)
                }
            }))
        }
        if (currentPlayer === 'enemy') {
            turnDisplay.innerHTML = 'Computers Go'
            setTimeout(enemyGo, 1000)
        }
    }

    function revealSquare(classList) {
        const enemySquare = computerGrid.querySelector(`div[data-id='${shotFired}']`)
        const obj = Object.values(classList)
        if (enemySquare.classList.contains('miss') || enemySquare.classList.contains('boom')) return
        if (!enemySquare.classList.contains('boom') && currentPlayer === 'user' && !isGameOver) {
            if (obj.includes('destroyer')) destroyerCount++
            if (obj.includes('submarine')) submarineCount++
            if (obj.includes('cruiser')) cruiserCount++
            if (obj.includes('battleship')) battleshipCount++
            if (obj.includes('carrier')) carrierCount++
        }
        if (obj.includes('taken')) {
            enemySquare.classList.add('boom')
        } else {
            enemySquare.classList.add('miss')
        }
        checkForWins()
        currentPlayer = 'enemy'
        if (gameMode === 'singlePlayer') playGameSingle()
    }

    function enemyGo(square) {
        // variable to store the full computer AI object if there are moves in the computerAI array
        let currAI
        if(gameMode === 'singlePlayer') {
            // If the computer hasn't stored any moves in the computerAI array, pick a random move
            if (difficulty === 'Easy' || (computerAI.length === 0 && computerTrack.length === 0)) square = Math.floor(Math.random() * userSquares.length)
            else if(difficulty === 'Hard' && computerAI.length === 0) {
                const i = computerTrack.pop()
                console.log(i)
                if (!leftOOB.includes(i-1)) computerAI.push({ index: i-1, priority: 0, direction: 'left' })
                if (!rightOOB.includes(i+1)) computerAI.push({ index: i+1, priority: 0, direction: 'right' })
                if (i-10 > 0) computerAI.push({ index: i-10, priority: 0, direction: 'up' })
                if (i+10 < 100) computerAI.push({ index: i+10, priority: 0, direction: 'down' })
                computerTrack.push(i)
            }
            if(difficulty !== 'Easy' && computerAI.length !== 0) {
                // find if there is any high priority moves (gives a priority of 1 to same direction momentum)
                for(const i in computerAI) {
                    if(computerAI[i].priority === 1) {
                        square = computerAI[i].index
                        currAI = computerAI[i]
                        break
                    }
                }
                // if the computer didn't find any high priority moves, select one from the computerAI array randomly
                if (!square) {
                    const i = Math.floor(Math.random() * computerAI.length)
                    currAI = computerAI[i]
                    square = computerAI[i].index
                }
            }
        }
        if (!userSquares[square].classList.contains('boom') && !userSquares[square].classList.contains('miss')) {   
            const hit = userSquares[square].classList.contains('taken')
            userSquares[square].classList.add(hit ? 'boom' : 'miss')
            // if the computer gets a hit
            if(hit && gameMode === 'singlePlayer' && difficulty !== 'Easy') {
                if(difficulty === 'Hard') computerTrack.push(square)
                // if the computer isn't tracking any moves yet, add all sqaures around the hit that aren't out of bounds
                if(!currAI) {
                    if (!leftOOB.includes(square-1)) computerAI.push({ index: square-1, priority: 0, direction: 'left' })
                    if (!rightOOB.includes(square+1)) computerAI.push({ index: square+1, priority: 0, direction: 'right' })
                    if (square-10 > 0) computerAI.push({ index: square-10, priority: 0, direction: 'up' })
                    if (square+10 < 100) computerAI.push({ index: square+10, priority: 0, direction: 'down' })
                } else { // otherwise remove the perpendicular directions and the hit move, and then add the next move in that
                        // direction with a high priority
                    let tempAI = computerAI
                    // create a temp array to loop through and reset computerAI to an empty array to only add back desired moves
                    computerAI = []
                    tempAI.forEach(ship => {
                        // keep the opposite direction move from the one that just got a hit
                        if((currAI.direction === 'up' && ship.direction === 'down')
                        || (currAI.direction === 'down' && ship.direction === 'up')
                        || (currAI.direction === 'left' && ship.direction === 'right')
                        || (currAI.direction === 'right' && ship.direction === 'left')) {
                            computerAI.push(ship) 
                            // add the next square in the same direction if it is in bounds and give it priority
                        } else if(currAI.direction ===  ship.direction) {
                            if (currAI.direction === 'up') {
                                if(currAI.index - width >= 0) {
                                    computerAI.push({
                                        index : currAI.index - width,
                                        direction : 'up',
                                        priority : 1
                                    })
                                } else computerTrack.reverse()
                            } else if(currAI.direction === 'down') {
                                if(currAI.index + width < width*width) {
                                    computerAI.push({
                                        index : currAI.index + width,
                                        direction : 'down',
                                        priority : 1
                                    })
                                } else computerTrack.reverse()
                            } else if(currAI.direction === 'left') {
                                if(!leftOOB.includes(currAI.index-1)) {
                                    computerAI.push({
                                        index : currAI.index - 1,
                                        direction : 'left',
                                        priority : 1
                                    })
                                } else computerTrack.reverse()
                            } else if(currAI.direction === 'right') {
                                if(!rightOOB.includes(currAI.index+1)) {
                                    computerAI.push({
                                        index : currAI.index + 1,
                                        direction : 'right',
                                        priority : 1
                                    })
                                } else computerTrack.reverse()
                            }
                        }
                    })
                }
            } else {
                // remove the move if it was a miss
                for(const i in computerAI) {
                    if(computerAI[i] === currAI) {
                        computerAI.splice(i, 1)
                        break
                    }
                }
            }
            console.log('>>>computerAI', computerAI)
            console.log('>>>computerTrack', computerTrack)
            if (userSquares[square].classList.contains('destroyer')) enemyDestroyerCount++
            if (userSquares[square].classList.contains('submarine')) enemySubmarineCount++
            if (userSquares[square].classList.contains('cruiser')) enemyCruiserCount++
            if (userSquares[square].classList.contains('battleship')) enemyBattleshipCount++
            if (userSquares[square].classList.contains('carrier')) enemyCarrierCount++
            checkForWins()
        } else if (gameMode === 'singlePlayer') {
            // when the computer chooses a square that has already been visited, remove it from the
            // computerAI array if present
            if(currAI) {
                for(const i in computerAI) {
                    if(computerAI[i] === currAI) {
                        computerAI.splice(i, 1)
                        break
                    }
                }
            }
            enemyGo() 
        }
        currentPlayer = 'user'
        turnDisplay.innerHTML = 'Your Go'
    }

    function checkForWins() {
        let enemy = 'computer'
        if (gameMode === 'multiPlayer') enemy = 'enemy'
        if (destroyerCount === 2) {
            infoDisplay.innerHTML = `You sunk the ${enemy}'s destroyer`
            destroyerCount = 10
        }
        if (submarineCount === 3) {
            infoDisplay.innerHTML = `You sunk the ${enemy}'s submarine`
            submarineCount = 10
        }
        if (cruiserCount === 3) {
            infoDisplay.innerHTML = `You sunk the ${enemy}'s cruiser`
            cruiserCount = 10
        }
        if (battleshipCount === 4) {
            infoDisplay.innerHTML = `You sunk the ${enemy}'s battleship`
            battleshipCount = 10
        }
        if (carrierCount === 5) {
            infoDisplay.innerHTML = `You sunk the ${enemy}'s carrier`
            carrierCount = 10
        }
        // as soon as the computer sinks the ship it was chasing, clear the computerAI array
        if (enemyDestroyerCount === 2) {
            infoDisplay.innerHTML = `${enemy} sunk your destroyer`
            enemyDestroyerCount = 10
            if(gameMode === 'singlePlayer') {
                computerAI = []
                if (difficulty === 'Hard') computerTrack.splice(computerTrack.length-2)
            }
        }
        if (enemySubmarineCount === 3) {
            infoDisplay.innerHTML = `${enemy} sunk your submarine`
            enemySubmarineCount = 10
            if(gameMode === 'singlePlayer') {
                computerAI = []
                if (difficulty === 'Hard') computerTrack.splice(computerTrack.length-3)
            }
        }
        if (enemyCruiserCount === 3) {
            infoDisplay.innerHTML = `${enemy} sunk your cruiser`
            enemyCruiserCount = 10
            if(gameMode === 'singlePlayer') {
                computerAI = []
                if (difficulty === 'Hard') computerTrack.splice(computerTrack.length-3)
            }
        }
        if (enemyBattleshipCount === 4) {
            infoDisplay.innerHTML = `${enemy} sunk your battleship`
            enemyBattleshipCount = 10
            if(gameMode === 'singlePlayer') {
                computerAI = []
                if (difficulty === 'Hard') computerTrack.splice(computerTrack.length-4)
            }
        }
        if (enemyCarrierCount === 5) {
            infoDisplay.innerHTML = `${enemy} sunk your carrier`
            enemyCarrierCount = 10
            if(gameMode === 'singlePlayer') {
                computerAI = []
                if (difficulty === 'Hard') computerTrack.splice(computerTrack.length-5)
            }
        }
        if ((destroyerCount + submarineCount + cruiserCount + battleshipCount + carrierCount) === 50) {
            infoDisplay.innerHTML = "YOU WIN"
            gameOver()
        }
        if ((enemyDestroyerCount + enemySubmarineCount + enemyCruiserCount + enemyBattleshipCount + enemyCarrierCount) === 50) {
            infoDisplay.innerHTML = `${enemy.toUpperCase()} WINS`
            gameOver()
        }
    }

    function gameOver() {
        isGameOver = true
        startButton.removeEventListener('click', playGameSingle)
    }
})