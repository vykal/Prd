import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref, set, onValue, remove } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// Firebase konfigurácie
const firebaseConfig1 = {
  apiKey: "AIzaSyACWLI7L0zhZk7RFQyEXlOyQjtMPF-MgDw",
  authDomain: "hrav-1a742.firebaseapp.com",
  databaseURL: "https://hrav-1a742-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "hrav-1a742",
  storageBucket: "hrav-1a742.firebasestorage.app",
  messagingSenderId: "1093772001619",
  appId: "1:1093772001619:web:97d8e6dd9d5cd28da761a6",
  measurementId: "G-GFVZ6ZD5RE"
};
const firebaseConfig2 = {
  apiKey: "AIzaSyB-sXXU2-dWigTrpYp1hnWbDjqqJ2gr0Yw",
  authDomain: "videjo-d0996.firebaseapp.com",
  databaseURL: "https://videjo-d0996-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "videjo-d0996",
  storageBucket: "videjo-d0996.firebasestorage.app",
  messagingSenderId: "175126755237",
  appId: "1:175126755237:web:8cf31d7a4d08f9fb2bda4c",
  measurementId: "G-6Q2BJX1FE5"
};

const app1 = initializeApp(firebaseConfig1, "app1");
const app2 = initializeApp(firebaseConfig2, "app2");

const db1 = getDatabase(app1);
const db2 = getDatabase(app2);

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Generovanie unikátneho ID pre hráča
const playerId = `player_${Math.random().toString(36).substring(2, 9)}`;
const player = {
  id: playerId,
  x: Math.random() * (canvas.width - 50),
  y: canvas.height - 150,
  width: 150,
  height: 100,
  dx: 0,
  dy: 0,
  videoElement: null,
  isJumping: false,
  grounded: true
};

const players = {};
const peers = {};
const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

// Video stream získanie
const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
player.videoElement = createVideoElement(localStream, player.id);
document.body.appendChild(player.videoElement);

function createVideoElement(stream, id) {
  const video = document.createElement("video");
  video.srcObject = stream;
  video.autoplay = true;
  video.muted = true;
  video.style.position = "absolute";
  video.dataset.userId = id;
  return video;
}

// Ovládanie hráča
document.getElementById("left").addEventListener("mousedown", () => (player.dx = -5));
document.getElementById("right").addEventListener("mousedown", () => (player.dx = 5));
document.getElementById("jump").addEventListener("mousedown", () => {
  if (player.grounded) {
    player.dy = -15;
    player.grounded = false;
  }
});
document.addEventListener("mouseup", () => (player.dx = 0));

// Firebase komunikácia
set(ref(db1, `players/${player.id}`), player);
window.addEventListener("beforeunload", () => remove(ref(db1, `players/${player.id}`)));

// Aktualizácia pozícií hráčov
onValue(ref(db1, "players"), (snapshot) => {
  const data = snapshot.val();
  if (!data) return;
  Object.keys(data).forEach((id) => {
    if (!players[id] && id !== player.id) {
      players[id] = data[id];
      const remoteVideo = createVideoElement(null, id);
      players[id].videoElement = remoteVideo;
      document.body.appendChild(remoteVideo);
    }
    Object.assign(players[id], data[id]);
  });
});

// Hlavný update cyklus
function update() {
  player.x += player.dx;
  player.dy += 0.8;
  player.y += player.dy;

  if (player.y + player.height >= canvas.height) {
    player.y = canvas.height - player.height;
    player.dy = 0;
    player.grounded = true;
  }

  if (player.x < 0) player.x = 0;
  if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

  set(ref(db1, `players/${player.id}`), player);

  drawPlayers();
  requestAnimationFrame(update);
}

// Kreslenie hráčov
function drawPlayers() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  Object.values(players).forEach((p) => {
    if (p.videoElement) {
      p.videoElement.style.left = `${p.x}px`;
      p.videoElement.style.top = `${p.y}px`;
    }
  });
}

update();
