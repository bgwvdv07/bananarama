import express from "express";
import { createServer } from "http";

const app = express();
const http = createServer(app);
const socket = io({
  path: "/api/socketio"
});

app.use(express.static(__dirname));

let players = {};

io.on("connection", socket => {
  console.log("User connected:", socket.id);

  socket.on("chooseRole", role => {
    players[socket.id] = role;
    io.emit("updateRoles", players);
  });

  socket.on("fireRocket", rocket => {
    io.emit("rocketFired", rocket);
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("updateRoles", players);
  });
});

http.listen(3000, () => console.log("Server running on :3000"));
