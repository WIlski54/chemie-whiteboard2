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
// Struktur: { roomId: { users: [], objects: [], isLocked: false, createdAt: timestamp } }
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

// ========== HELPER FUNCTIONS ==========
function getDashboardData() {
    const roomsData = [];
    
    for (const [roomId, roomData] of Object.entries(rooms)) {
        roomsData.push({
            roomId: roomId,
            userCount: roomData.users.length,
            users: roomData.users.map(u => ({ name: u.name, isTeacher: u.isTeacher || false })),
            objectCount: roomData.objects.length,
            isLocked: roomData.isLocked || false,
            createdAt: roomData.createdAt || Date.now()
        });
    }
    
    return roomsData;
}

function broadcastDashboardUpdate() {
    const dashboardData = getDashboardData();
    io.emit('dashboard-update', dashboardData);
    console.log('📊 Dashboard-Update gesendet an alle Lehrer');
}

// ========== SOCKET.IO ==========
io.on('connection', (socket) => {
    console.log('🟢 Neuer User verbunden:', socket.id);

    // Lehrer tritt Dashboard bei
    socket.on('join-dashboard', (data) => {
        const { userName } = data;
        socket.userName = userName;
        socket.isTeacher = true;
        socket.join('teachers'); // Lehrer in speziellen Raum
        
        console.log(`👨‍🏫 Lehrer ${userName} hat Dashboard betreten`);
        
        // Sende aktuelle Dashboard-Daten
        socket.emit('dashboard-data', getDashboardData());
    });

    // User tritt Raum bei
    socket.on('join-room', (data) => {
        const { roomId, userName, isTeacher, isObserver } = data;
        
        socket.join(roomId);
        socket.roomId = roomId;
        socket.userName = userName;
        socket.isTeacher = isTeacher || false;
        socket.isObserver = isObserver || false;

        // Raum initialisieren falls nicht vorhanden
        if (!rooms[roomId]) {
            rooms[roomId] = { 
                users: [], 
                objects: [], 
                isLocked: false,
                createdAt: Date.now()
            };
            console.log('🆕 Neuer Raum erstellt:', roomId);
        }

        // User hinzufügen
        rooms[roomId].users.push({ 
            id: socket.id, 
            name: userName, 
            isTeacher: socket.isTeacher,
            isObserver: socket.isObserver
        });

        // Aktuelle User-Liste an alle im Raum senden
        io.to(roomId).emit('users-update', rooms[roomId].users);

        // Canvas-State an neuen User senden
        console.log(`📤 Sende ${rooms[roomId].objects.length} Objekte an ${userName}`);
        socket.emit('canvas-state', rooms[roomId].objects);
        
        // Sende Lock-Status
        socket.emit('room-lock-status', { isLocked: rooms[roomId].isLocked });

        console.log(`✅ ${userName} ist Raum ${roomId} beigetreten (Lehrer: ${socket.isTeacher}, Observer: ${socket.isObserver})`);
        
        // Dashboard Update an alle Lehrer
        broadcastDashboardUpdate();
    });

    // Raum sperren/entsperren (nur Lehrer)
    socket.on('toggle-room-lock', (data) => {
        const { roomId, isLocked } = data;
        
        if (!socket.isTeacher) {
            console.log('⛔ Nicht-Lehrer versuchte Raum zu sperren');
            return;
        }
        
        if (rooms[roomId]) {
            rooms[roomId].isLocked = isLocked;
            io.to(roomId).emit('room-lock-status', { isLocked: isLocked });
            console.log(`🔒 Raum ${roomId} ${isLocked ? 'gesperrt' : 'entsperrt'}`);
            broadcastDashboardUpdate();
        }
    });

    // ========== NEU: RAUM LÖSCHEN (NUR LEHRER) ==========
    socket.on('delete-room', (data) => {
        const { roomId } = data;
        
        // Security Check: Nur Lehrer dürfen löschen
        if (!socket.isTeacher) {
            console.log(`⛔ Nicht-Lehrer (Socket: ${socket.id}) versuchte Raum ${roomId} zu löschen.`);
            return;
        }

        if (rooms[roomId]) {
            delete rooms[roomId];
            console.log(`🗑️ Raum ${roomId} wurde von Lehrer ${socket.userName} gelöscht.`);
            
            // Sende ein Update an alle Dashboards, dass der Raum weg ist
            broadcastDashboardUpdate();
        } else {
            console.log(`⚠️ Versuch, nicht-existenten Raum ${roomId} zu löschen.`);
        }
    });
    // ========== ENDE NEUER BLOCK ==========

    // Objekt hinzugefügt
    socket.on('object-added', (objData) => {
        const roomId = socket.roomId;
        if (rooms[roomId]) {
            // Prüfe ob Raum gesperrt und User kein Lehrer
            if (rooms[roomId].isLocked && !socket.isTeacher) {
                console.log('⛔ Raum gesperrt - Objekt nicht hinzugefügt');
                return;
            }
            
            rooms[roomId].objects.push(objData);
            socket.broadcast.to(roomId).emit('object-added', objData);
            console.log('➕ Objekt hinzugefügt:', objData.id);
        }
    });

    // Objekt modifiziert
    socket.on('object-modified', (objData) => {
        const roomId = socket.roomId;
        if (rooms[roomId]) {
            // Prüfe ob Raum gesperrt und User kein Lehrer
            if (rooms[roomId].isLocked && !socket.isTeacher) {
                console.log('⛔ Raum gesperrt - Objekt nicht modifiziert');
                return;
            }
            
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
            // Prüfe ob Raum gesperrt und User kein Lehrer
            if (rooms[roomId].isLocked && !socket.isTeacher) {
                console.log('⛔ Raum gesperrt - Objekt nicht entfernt');
                return;
            }
            
            rooms[roomId].objects = rooms[roomId].objects.filter(o => o.id !== data.id);
            socket.broadcast.to(roomId).emit('object-removed', data);
        }
    });

    // Canvas leeren
    socket.on('clear-canvas', () => {
        const roomId = socket.roomId;
        if (rooms[roomId]) {
            // Nur Lehrer können Canvas leeren
            if (!socket.isTeacher) {
                console.log('⛔ Nicht-Lehrer versuchte Canvas zu leeren');
                return;
            }
            
            rooms[roomId].objects = [];
            socket.broadcast.to(roomId).emit('clear-canvas');
            console.log('🗑️ Canvas geleert in Raum:', roomId);
        }
    });

    // Disconnection
    socket.on('disconnect', () => {
        console.log('🔴 User getrennt:', socket.id);
        const roomId = socket.roomId;
        
        if (roomId && rooms[roomId]) {
            rooms[roomId].users = rooms[roomId].users.filter(u => u.id !== socket.id);
            io.to(roomId).emit('users-update', rooms[roomId].users);
            
            // Wenn Raum leer ist, lösche ihn nach 1 Stunde
            if (rooms[roomId].users.length === 0) {
                console.log(`⏰ Raum ${roomId} ist leer - wird in 1 Stunde gelöscht`);
                setTimeout(() => {
                    if (rooms[roomId] && rooms[roomId].users.length === 0) {
                        delete rooms[roomId];
                        console.log(`🗑️ Leerer Raum ${roomId} wurde gelöscht`);
                        broadcastDashboardUpdate();
                    }
                }, 60 * 60 * 1000); // 1 Stunde
            }
            
            broadcastDashboardUpdate();
        }
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Server läuft auf Port ${PORT}`);
});