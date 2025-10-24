// ========== DASHBOARD.JS ==========
let socket;
let teacherName = '';

document.addEventListener('DOMContentLoaded', () => {
    // Hole Lehrernamen aus URL-Parameter oder localStorage
    const urlParams = new URLSearchParams(window.location.search);
    teacherName = urlParams.get('teacher') || localStorage.getItem('teacherName') || 'Lehrer';
    
    document.getElementById('teacher-name').textContent = teacherName;
    
    // Socket.io verbinden
    socket = io();
    
    // Join Dashboard
    socket.emit('join-dashboard', { userName: teacherName });
    
    initDashboard();
    initSocketListeners();
});

function initDashboard() {
    // Refresh Button
    document.getElementById('refresh-btn').addEventListener('click', () => {
        socket.emit('join-dashboard', { userName: teacherName });
    });
    
    // Logout Button
    document.getElementById('logout-btn').addEventListener('click', () => {
        if (confirm('Dashboard wirklich verlassen?')) {
            localStorage.removeItem('teacherName');
            window.location.href = '/';
        }
    });

    // NEU: Globaler Lock-Button
    document.getElementById('lock-all-btn').addEventListener('click', () => {
        const btn = document.getElementById('lock-all-btn');
        
        // Prüfe die aktuelle Klasse, um die gewünschte Aktion zu bestimmen
        // .btn-lock (orange) bedeutet "Aktion: Sperren"
        // .btn-unlock (grün) bedeutet "Aktion: Entsperren"
        const shouldLock = btn.classList.contains('btn-lock');
        
        socket.emit('toggle-lock-all-rooms', { lock: shouldLock });
    });
}

function initSocketListeners() {
    // Initial Dashboard-Daten
    socket.on('dashboard-data', (rooms) => {
        console.log('📊 Dashboard-Daten empfangen:', rooms);
        updateDashboard(rooms);
    });
    
    // Live-Updates
    socket.on('dashboard-update', (rooms) => {
        console.log('🔄 Dashboard-Update empfangen:', rooms);
        updateDashboard(rooms);
    });
}

function updateDashboard(rooms) {
    // Statistiken aktualisieren
    const totalRooms = rooms.length;
    const totalUsers = rooms.reduce((sum, room) => sum + room.userCount, 0);
    const totalObjects = rooms.reduce((sum, room) => sum + room.objectCount, 0);
    
    document.getElementById('total-rooms').textContent = totalRooms;
    document.getElementById('total-users').textContent = totalUsers;
    document.getElementById('total-objects').textContent = totalObjects;
    
    // Räume anzeigen
    const roomsContainer = document.getElementById('rooms-container');
    const noRoomsMessage = document.getElementById('no-rooms-message');
    
    if (rooms.length === 0) {
        roomsContainer.innerHTML = '';
        noRoomsMessage.classList.add('show');
    } else {
        noRoomsMessage.classList.remove('show');
        renderRooms(rooms);
    }

    // NEU: Globalen Lock-Button-Zustand aktualisieren
    const lockAllBtn = document.getElementById('lock-all-btn');
    if (lockAllBtn) {
        // Prüfe, ob ALLE Räume (sofern welche da sind) bereits gesperrt sind
        const allLocked = rooms.length > 0 && rooms.every(room => room.isLocked);
        
        if (allLocked) {
            // Alle sind gesperrt -> Biete "Entsperren" an
            lockAllBtn.textContent = '🔓 Alle Räume entsperren';
            lockAllBtn.classList.remove('btn-lock');
            lockAllBtn.classList.add('btn-unlock');
        } else {
            // Mindestens ein Raum ist offen -> Biete "Sperren" an
            lockAllBtn.textContent = '🔒 Alle Räume sperren';
            lockAllBtn.classList.remove('btn-unlock');
            lockAllBtn.classList.add('btn-lock');
        }
    }
}

function renderRooms(rooms) {
    const roomsContainer = document.getElementById('rooms-container');
    
    // Sortiere Räume nach Erstellungsdatum (neueste zuerst)
    rooms.sort((a, b) => b.createdAt - a.createdAt);
    
    roomsContainer.innerHTML = rooms.map(room => {
        const isLocked = room.isLocked;
        const lockIcon = isLocked ? '🔒' : '🔓';
        const lockClass = isLocked ? 'locked' : 'unlocked';
        const lockText = isLocked ? 'Gesperrt' : 'Offen';
        const lockBtnText = isLocked ? '🔓 Entsperren' : '🔒 Sperren';
        const lockBtnClass = isLocked ? 'btn-unlock' : 'btn-lock';
        
        const usersHTML = room.users.map(user => {
            const teacherClass = user.isTeacher ? 'teacher' : '';
            const teacherIcon = user.isTeacher ? '👨‍🏫 ' : '';
            return `
                <div class="user-badge ${teacherClass}">
                    <div class="user-status"></div>
                    ${teacherIcon}${user.name}
                </div>
            `;
        }).join('');
        
        return `
            <div class="room-card ${isLocked ? 'locked' : ''}">
                <div class="room-header">
                    <div>
                        <h3 class="room-title">🏫 ${room.roomId}</h3>
                        <span class="room-id">ID: ${room.roomId}</span>
                    </div>
                    <span class="lock-badge ${lockClass}">
                        ${lockIcon} ${lockText}
                    </span>
                </div>
                
                <div class="room-stats">
                    <div class="room-stat">
                        <span class="room-stat-icon">👥</span>
                        <span class="room-stat-value">${room.userCount}</span>
                        <span>Nutzer</span>
                    </div>
                    <div class="room-stat">
                        <span class="room-stat-icon">🎨</span>
                        <span class="room-stat-value">${room.objectCount}</span>
                        <span>Objekte</span>
                    </div>
                </div>
                
                <div class="room-users">
                    <h4 class="room-users-title">Aktive Nutzer:</h4>
                    <div class="users-list">
                        ${usersHTML || '<span style="color: #999; font-size: 13px;">Keine Nutzer</span>'}
                    </div>
                </div>
                
                <div class="room-actions">
                    <button class="btn-action btn-enter" onclick="enterRoom('${room.roomId}')">
                        👁️ Betreten
                    </button>
                    <button class="btn-action ${lockBtnClass}" onclick="toggleRoomLock('${room.roomId}', ${!isLocked})">
                        ${lockBtnText}
                    </button>
                    <button class="btn-action btn-delete" onclick="deleteRoom('${room.roomId}')">
                        🗑️ Löschen
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function enterRoom(roomId) {
    console.log('🚪 Betrete Raum:', roomId);
    // Speichere Lehrernamen für Rückkehr
    localStorage.setItem('teacherName', teacherName);
    // Öffne Raum als Observer
    window.location.href = `/?room=${roomId}&teacher=${encodeURIComponent(teacherName)}&observer=true`;
}

function toggleRoomLock(roomId, shouldLock) {
    console.log(`${shouldLock ? '🔒' : '🔓'} ${shouldLock ? 'Sperre' : 'Entsperre'} Raum:`, roomId);
    socket.emit('toggle-room-lock', { roomId: roomId, isLocked: shouldLock });
}

function deleteRoom(roomId) {
    // Doppelte Sicherheitsabfrage, da dies endgültig ist
    const confirmation = prompt(`Bist du sicher, dass du den Raum "${roomId}" endgültig löschen möchtest? Tippe zum Bestätigen "${roomId}" ein:`);
    
    if (confirmation === roomId) {
        console.log(`🗑️ Sende Lösch-Anfrage für Raum: ${roomId}`);
        socket.emit('delete-room', { roomId: roomId });
    } else if (confirmation !== null) { // (null bedeutet "Abbrechen")
        alert('Löschen abgebrochen. Der eingegebene Name stimmte nicht überein.');
    }
}