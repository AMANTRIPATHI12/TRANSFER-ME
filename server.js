// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', socket => {
  console.log('socket connected', socket.id);

  // legacy create-room kept for compatibility (but client now does join-room normally)
  socket.on('create-room', (cb) => {
    const roomId = uuidv4();
    socket.join(roomId);
    console.log(`${socket.id} created room ${roomId}`);
    if (cb) cb({ roomId });
  });

  // join-room: always join (don't reject). Notify others that someone joined.
  socket.on('join-room', (roomId, cb) => {
    try {
      socket.join(roomId);
      const room = io.sockets.adapter.rooms.get(roomId);
      const members = room ? room.size : 0;
      console.log(`${socket.id} joined ${roomId} (members=${members})`);
      // notify the other peer(s) that someone joined
      socket.to(roomId).emit('peer-joined', { id: socket.id });
      if (cb) cb({ ok: true, members });
    } catch (err) {
      console.error('join-room error', err);
      if (cb) cb({ ok: false, error: err.message });
    }
  });

  // relay signaling messages to everyone else in the room
  socket.on('signal', ({ roomId, data }) => {
    // data can be { description } or { candidate }
    socket.to(roomId).emit('signal', data);
  });

  socket.on('disconnecting', () => {
    const rooms = [...socket.rooms].filter(r => r !== socket.id);
    rooms.forEach(r => {
      socket.to(r).emit('peer-left', { id: socket.id });
      console.log(`${socket.id} leaving room ${r}`);
    });
  });

  socket.on('disconnect', () => {
    console.log('socket disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Signaling server listening on ${PORT}`));
