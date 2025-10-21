const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Statische Dateien bereitstellen
app.use(express.static(path.join(__dirname, 'public')));

// Räume und User speichern
const rooms = {};

io.on('connection', (socket) => {
  console.log('Neuer User verbunden:', socket.id);

  // User tritt Raum bei
  socket.on('join-room', (data) => {
    const { roomId, userName } = data;
    socket.join(roomId);
    socket.roomId = roomId;
    socket.userName = userName;

    // Raum initialisieren falls nicht vorhanden
    if (!rooms[roomId]) {
      rooms[roomId] = { users: [], objects: [] };
      console.log(`Neuer Raum erstellt: ${roomId}`);
    }

    // User hinzufügen
    rooms[roomId].users.push({ id: socket.id, name: userName });

    // Aktuelle User-Liste an alle im Raum senden
    io.to(roomId).emit('users-update', rooms[roomId].users);

    // Canvas-State an neuen User senden
    console.log(`Sende ${rooms[roomId].objects.length} Objekte an ${userName}`);
    socket.emit('canvas-state', rooms[roomId].objects);

    console.log(`${userName} ist Raum ${roomId} beigetreten`);
  });

  // Canvas-Objekt hinzugefügt
  socket.on('object-added', (data) => {
    if (socket.roomId && rooms[socket.roomId]) {
      // Prüfe ob Objekt bereits existiert (verhindert Duplikate im Server)
      const exists = rooms[socket.roomId].objects.find(obj => obj.id === data.id);
      if (!exists) {
        rooms[socket.roomId].objects.push(data);
        console.log(`Objekt ${data.id} zu Raum ${socket.roomId} hinzugefügt. Total: ${rooms[socket.roomId].objects.length}`);
      }
      // An ALLE anderen im Raum senden
      socket.to(socket.roomId).emit('object-added', data);
    }
  });

  // Canvas-Objekt verändert
  socket.on('object-modified', (data) => {
    if (socket.roomId && rooms[socket.roomId]) {
      // Update im Server-Speicher
      const objIndex = rooms[socket.roomId].objects.findIndex(obj => obj.id === data.id);
      if (objIndex !== -1) {
        rooms[socket.roomId].objects[objIndex] = data;
      }
      socket.to(socket.roomId).emit('object-modified', data);
    }
  });

  // Canvas-Objekt gelöscht
  socket.on('object-removed', (data) => {
    if (socket.roomId && rooms[socket.roomId]) {
      rooms[socket.roomId].objects = rooms[socket.roomId].objects.filter(
        obj => obj.id !== data.id
      );
      socket.to(socket.roomId).emit('object-removed', data);
    }
  });

  // Canvas geleert
  socket.on('clear-canvas', () => {
    if (socket.roomId && rooms[socket.roomId]) {
      rooms[socket.roomId].objects = [];
      socket.to(socket.roomId).emit('clear-canvas');
      console.log(`Canvas in Raum ${socket.roomId} wurde geleert`);
    }
  });

  // User disconnected
  socket.on('disconnect', () => {
    if (socket.roomId && rooms[socket.roomId]) {
      rooms[socket.roomId].users = rooms[socket.roomId].users.filter(
        user => user.id !== socket.id
      );
      io.to(socket.roomId).emit('users-update', rooms[socket.roomId].users);
      console.log(`${socket.userName} hat Raum ${socket.roomId} verlassen`);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server läuft auf Port ${PORT}`);
});