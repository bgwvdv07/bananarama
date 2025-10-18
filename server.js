import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const http = createServer(app);
const io = new Server(http);

app.use(express.static("public")); // or use express.static(__dirname) if files are in root

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

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running on :${PORT}`));