// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' } // restrict in production
});

io.on('connection', socket => {
  // create room
  socket.on('create-room', (cb) => {
    const roomId = uuidv4();
    socket.join(roomId);
    cb({ roomId });
  });

  // join room
  socket.on('join-room', (roomId, cb) => {
    const room = io.sockets.adapter.rooms.get(roomId);
    const members = room ? room.size : 0;
    if (!room || members === 0) {
      cb({ ok: false, error: 'room-not-found' });
      return;
    }
    socket.join(roomId);
    // notify the other peer(s) that someone joined
    socket.to(roomId).emit('peer-joined');
    cb({ ok: true });
  });

  // relay offer/answer/candidate
  socket.on('signal', ({ roomId, description, candidate }) => {
    socket.to(roomId).emit('signal', { description, candidate });
  });

  socket.on('disconnecting', () => {
    // let room mates know
    const rooms = [...socket.rooms].filter(r => r !== socket.id);
    rooms.forEach(r => socket.to(r).emit('peer-left'));
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Signaling server listening on ${PORT}`));
