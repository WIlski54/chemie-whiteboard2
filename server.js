const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Statische Dateien bereitstellen
app.use(express.static(path.join(__dirname, 'public')));

// Räume und User speichern
const rooms = {};

// ========== BILD-UPLOAD ==========
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'public', 'uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.random().toString(36).substr(2, 9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|svg/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb('Error: Nur Bilder erlaubt!');
        }
    }
});

app.post('/upload-image', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    }
    
   const imageUrl = `/uploads/${req.file.filename}`;
    console.log('📤 Bild hochgeladen:', imageUrl);
    res.json({ url: imageUrl });
});

// ========== SOCKET.IO ==========
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
            console.log('Neuer Raum erstellt:', roomId);
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

    // Objekt hinzugefügt
    socket.on('object-added', (objData) => {
        const roomId = socket.roomId;
        if (rooms[roomId]) {
            rooms[roomId].objects.push(objData);
            socket.broadcast.to(roomId).emit('object-added', objData);
            console.log('Objekt hinzugefügt:', objData.id);
        }
    });

    // Objekt modifiziert
    socket.on('object-modified', (objData) => {
        const roomId = socket.roomId;
        if (rooms[roomId]) {
            const index = rooms[roomId].objects.findIndex(o => o.id === objData.id);
            if (index !== -1) {
                rooms[roomId].objects[index] = objData;
            }
            socket.broadcast.to(roomId).emit('object-modified', objData);
        }
    });

    // Objekt entfernt
    socket.on('object-removed', (data) => {
        const roomId = socket.roomId;
        if (rooms[roomId]) {
            rooms[roomId].objects = rooms[roomId].objects.filter(o => o.id !== data.id);
            socket.broadcast.to(roomId).emit('object-removed', data);
        }
    });

    // Canvas leeren
    socket.on('clear-canvas', () => {
        const roomId = socket.roomId;
        if (rooms[roomId]) {
            rooms[roomId].objects = [];
            socket.broadcast.to(roomId).emit('clear-canvas');
            console.log('Canvas geleert in Raum:', roomId);
        }
    });

    // Disconnection
    socket.on('disconnect', () => {
        console.log('User getrennt:', socket.id);
        const roomId = socket.roomId;
        if (roomId && rooms[roomId]) {
            rooms[roomId].users = rooms[roomId].users.filter(u => u.id !== socket.id);
            io.to(roomId).emit('users-update', rooms[roomId].users);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});