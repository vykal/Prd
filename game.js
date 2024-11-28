import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref, set, onValue, remove, push } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyB-sXXU2-dWigTrpYp1hnWbDjqqJ2gr0Yw",
    authDomain: "videjo-d0996.firebaseapp.com",
    databaseURL: "https://videjo-d0996-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "videjo-d0996",
    storageBucket: "videjo-d0996.firebasestorage.app",
    messagingSenderId: "175126755237",
    appId: "1:175126755237:web:8cf31d7a4d08f9fb2bda4c",
    measurementId: "G-6Q2BJX1FE5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const canvas = document.getElementById('gameCanvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const playerId = `player_${Math.random().toString(36).substring(2, 9)}`;
const peers = {};
const players = {};
const addedVideoElements = new Set();

// Player object
const player = {
    id: playerId,
    x: Math.random() * (canvas.width - 150),
    y: canvas.height - 150,
    width: 150,
    height: 100,
    dx: 0,
    dy: 0,
    isJumping: false,
    grounded: true
};

// Local video stream setup
const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
const videoElement = document.createElement('video');
videoElement.srcObject = localStream;
videoElement.autoplay = true;
videoElement.muted = true;
videoElement.style.position = "absolute";
videoElement.style.left = `${player.x}px`;
videoElement.style.top = `${player.y}px`;
document.body.appendChild(videoElement);

// Send player data to Firebase
function sendPlayerData() {
    set(ref(db, `players/${playerId}`), {
        ...player,
        streamId: localStream.id
    });
}

// Add video stream to DOM
function addVideoStream(id, stream) {
    if (addedVideoElements.has(id)) return;

    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.style.position = "absolute";
    video.style.width = "150px";
    video.style.height = "100px";
    document.body.appendChild(video);

    addedVideoElements.add(id);
    players[id] = { ...players[id], videoElement: video };
}

// Handle player movement
function movePlayer() {
    player.x += player.dx;

    // Apply gravity
    if (!player.grounded) {
        player.dy += 0.8;
        player.y += player.dy;
    }

    // Collision with ground
    if (player.y + player.height >= canvas.height) {
        player.y = canvas.height - player.height;
        player.dy = 0;
        player.grounded = true;
    }

    // Boundary checks
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

    videoElement.style.left = `${player.x}px`;
    videoElement.style.top = `${player.y}px`;
}

// Listen for other players
onValue(ref(db, 'players'), (snapshot) => {
    const data = snapshot.val() || {};
    Object.keys(data).forEach((id) => {
        if (id === playerId) return;

        if (!peers[id]) {
            connectToNewUser(id);
        }

        if (players[id]) {
            const remotePlayer = players[id];
            remotePlayer.x = data[id].x;
            remotePlayer.y = data[id].y;
            if (remotePlayer.videoElement) {
                remotePlayer.videoElement.style.left = `${remotePlayer.x}px`;
                remotePlayer.videoElement.style.top = `${remotePlayer.y}px`;
            }
        } else {
            players[id] = { ...data[id] };
        }
    });
});

// WebRTC configuration
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

function connectToNewUser(id) {
    const peerConnection = new RTCPeerConnection(config);

    // Add local stream to peer connection
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // Send ICE candidates to Firebase
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            push(ref(db, `signals/${id}`), {
                from: playerId,
                candidate: event.candidate.toJSON(),
            });
        }
    };

    // Handle incoming streams
    peerConnection.ontrack = (event) => {
        const [remoteStream] = event.streams;
        addVideoStream(id, remoteStream);
    };

    // Create offer
    peerConnection.createOffer()
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => {
            push(ref(db, `signals/${id}`), {
                from: playerId,
                offer: peerConnection.localDescription,
            });
        });

    peers[id] = peerConnection;
}

// Handle incoming WebRTC signals
onValue(ref(db, `signals/${playerId}`), (snapshot) => {
    const signals = snapshot.val();
    if (!signals) return;

    Object.keys(signals).forEach(key => {
        const signal = signals[key];
        const { from, offer, answer, candidate } = signal;

        if (!peers[from]) {
            connectToNewUser(from);
        }

        const peerConnection = peers[from];

        if (offer) {
            peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
                .then(() => peerConnection.createAnswer())
                .then(answer => peerConnection.setLocalDescription(answer))
                .then(() => {
                    push(ref(db, `signals/${from}`), {
                        from: playerId,
                        answer: peerConnection.localDescription,
                    });
                });
        }

        if (answer) {
            peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        }

        if (candidate) {
            peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    });
});

// Controls
const leftButton = document.getElementById('left');
const rightButton = document.getElementById('right');
const jumpButton = document.getElementById('jump');

leftButton.addEventListener('mousedown', () => (player.dx = -5));
rightButton.addEventListener('mousedown', () => (player.dx = 5));
window.addEventListener('mouseup', () => (player.dx = 0));

leftButton.addEventListener('touchstart', () => (player.dx = -5));
rightButton.addEventListener('touchstart', () => (player.dx = 5));
window.addEventListener('touchend', () => (player.dx = 0));

jumpButton.addEventListener('mousedown', () => {
    if (player.grounded) {
        player.dy = -15;
        player.grounded = false;
    }
});

jumpButton.addEventListener('touchstart', () => {
    if (player.grounded) {
        player.dy = -15;
        player.grounded = false;
    }
});

// Remove player on disconnect
window.addEventListener('beforeunload', () => {
    remove(ref(db, `players/${playerId}`));
});

// Game loop
function update() {
    movePlayer();
    sendPlayerData();
    requestAnimationFrame(update);
}

update();
