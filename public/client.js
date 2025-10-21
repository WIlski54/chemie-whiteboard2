// ========== GLOBALE VARIABLEN ==========
let socket;
let canvas;
let currentRoom = null;
let currentUser = null;
let isReceivingUpdate = false;
let skipNextAdd = false;

// Definiere die "virtuelle" Größe deiner Arbeitsfläche
const VIRTUAL_WIDTH = 2400;
const VIRTUAL_HEIGHT = 1600;

// Laborgeräte Liste
const labEquipment = [
    { name: 'Becherglas', file: 'becherglas.png' },
    { name: 'Reagenzglas', file: 'reagenzglas.png' },
    { name: 'Erlenmeyerkolben', file: 'erlenmeyerkolben.png' },
    { name: 'Messzylinder', file: 'messzylinder.png' },
    { name: 'Rundkolben', file: 'rundkolben.png' },
    { name: 'Stehkolben', file: 'stehkolben.png' },
    { name: 'Spitzkolben', file: 'spitzkolben.png' },
    { name: 'Trichter', file: 'trichter.png' },
    { name: 'Tropftrichter', file: 'tropftrichter.png' },
    { name: 'Liebigkühler', file: 'liebigkuehler.png' },
    { name: 'Gasbrenner', file: 'gasbrenner.png' },
    { name: 'Dreifuss', file: 'dreifuss.png' },
    { name: 'Abdampfschale', file: 'abdampfschale.png' },
    { name: 'Bürette', file: 'buerette.png' },
    { name: 'Kolbenprober', file: 'kolbenprober.png' },
    { name: 'Löffel', file: 'loeffel.png' },
    { name: 'Mörser', file: 'moerserschale.png' },
    { name: 'Muffe', file: 'muffe.png' },
    { name: 'Pipette', file: 'pipette.png' },
    { name: 'Pistil', file: 'pistil.png' },
    { name: 'Pneumatik', file: 'pneumatik.png' },
    { name: 'Saugflasche', file: 'saugflasche.png' },
    { name: 'Schutzbrille', file: 'schutzbrille.png' },
    { name: 'Spatel', file: 'spatel.png' },
    { name: 'Spritzflasche', file: 'spritzflasche.png' },
    { name: 'Stativ', file: 'stativ.png' },
    { name: 'Stativklammer', file: 'stativklammer.png' },
    { name: 'Stativring', file: 'stativring.png' },
    { name: 'Stopfen', file: 'stopfen.png' },
    { name: 'Tiegel', file: 'tiegel.png' },
    { name: 'Tiegelzange', file: 'tiegelzange.png' },
    { name: 'Tondreieck', file: 'tondreieck.png' },
    { name: 'Tropftrichter', file: 'tropftrichter.png' },
    { name: 'Uhrglas', file: 'urglas.png' },
    { name: 'Verbrennungslöffel', file: 'verbrennungsloeffel.png' },
    { name: 'Wanne', file: 'wanne.png' },
    { name: 'Wasserstrahlpumpe', file: 'wasserstrahlpumpe.png' }
];

// ========== INITIALISIERUNG ==========
document.addEventListener('DOMContentLoaded', () => {
    initLoginScreen();
});

// ========== LOGIN SCREEN ==========
function initLoginScreen() {
    const tabs = document.querySelectorAll('.tab');
    const form = document.getElementById('login-form');
    const submitBtn = form.querySelector('.btn-primary');
    const infoBox = document.querySelector('.info-box');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const tabType = tab.dataset.tab;
            if (tabType === 'join') {
                submitBtn.textContent = 'Raum beitreten';
                infoBox.innerHTML = '<p>Gib die Raum-ID ein, die du von deinem Lehrer erhalten hast.</p>';
            } else if (tabType === 'teacher') {
                submitBtn.textContent = 'Als Lehrer eintreten';
                infoBox.innerHTML = '<p>🔒 Im Lehrermodus kannst du die Canvas leeren und hast erweiterte Rechte.</p>';
            } else {
                submitBtn.textContent = 'Raum erstellen';
                infoBox.innerHTML = '<p>Als Lehrer erstellst du einen neuen Raum. Du erhältst eine Raum-ID, die du deinen Schülern gibst.</p>';
            }
        });
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const userName = document.getElementById('user-name').value.trim();
        const roomName = document.getElementById('room-name').value.trim();

        if (userName && roomName) {
            joinRoom(userName, roomName);
        }
    });
}

function joinRoom(userName, roomName) {
    currentUser = userName;
    currentRoom = roomName;

    console.log('🟢 Verbinde mit Server und trete Raum bei:', roomName);
    socket = io();
    socket.emit('join-room', { roomId: roomName, userName: userName });

    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('whiteboard-screen').style.display = 'flex';
    document.getElementById('current-room').textContent = roomName;

    initCanvas();
    initToolsPanel();
    initSocketListeners();
    initToolbar(); 
}

// ========== CANVAS ==========
function initCanvas() {
    const canvasEl = document.getElementById('canvas');
    const wrapper = document.querySelector('.canvas-wrapper');
    
    canvasEl.width = wrapper.clientWidth;
    canvasEl.height = wrapper.clientHeight;

    canvas = new fabric.Canvas('canvas', {
        isDrawingMode: false,
        selection: true,
        preserveObjectStacking: true,
        stopContextMenu: true,
        allowTouchScrolling: false 
    });

    console.log('🎨 Canvas initialisiert mit Container-Größe:', wrapper.clientWidth, 'x', wrapper.clientHeight);

    zoomToFit();

    // Panning
    let isPanning = false;
    let lastPanX = 0;
    let lastPanY = 0;

    canvas.on('mouse:down', function (opt) {
        const e = opt.e;
        if (e.altKey || e.button === 1 || (opt.pointer && opt.e.touches && opt.e.touches.length === 2)) {
            isPanning = true;
            canvas.selection = false;
            lastPanX = e.clientX;
            lastPanY = e.clientY;
        }
    });

    canvas.on('mouse:move', function (opt) {
        if (isPanning) {
            const e = opt.e;
            const deltaX = e.clientX - lastPanX;
            const deltaY = e.clientY - lastPanY;
            canvas.relativePan(new fabric.Point(deltaX, deltaY));
            lastPanX = e.clientX;
            lastPanY = e.clientY;
        }
    });

    canvas.on('mouse:up', function () {
        isPanning = false;
        canvas.selection = true;
    });

    // Zooming
    canvas.on('mouse:wheel', function (opt) {
        const delta = opt.e.deltaY;
        let zoom = canvas.getZoom();
        zoom *= 0.999 ** delta;
        if (zoom > 20) zoom = 20;
        if (zoom < 0.05) zoom = 0.05;
        
        canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
        
        opt.e.preventDefault();
        opt.e.stopPropagation();
    });

    // Pinch-to-Zoom
    let lastDistance = 0;

    canvas.on('touch:gesture', function (opt) {
        if (opt.e.touches && opt.e.touches.length === 2) {
            const e = opt.e;
            const p1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            const p2 = { x: e.touches[1].clientX, y: e.touches[1].clientY };
            const distance = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

            if (opt.state === 'start') {
                lastDistance = distance;
            } else if (opt.state === 'update') {
                const zoomDelta = distance / lastDistance;
                let newZoom = canvas.getZoom() * zoomDelta;
                if (newZoom > 20) newZoom = 20;
                if (newZoom < 0.05) newZoom = 0.05;

                canvas.zoomToPoint(canvas.getPointer(e), newZoom);
                lastDistance = distance;
            }
            e.preventDefault();
        }
    });

    window.addEventListener('resize', () => {
        canvasEl.width = wrapper.clientWidth;
        canvasEl.height = wrapper.clientHeight;
        canvas.setDimensions({ width: wrapper.clientWidth, height: wrapper.clientHeight });
        zoomToFit();
    });

    canvas.on('object:added', (e) => {
        if (skipNextAdd) {
            console.log('⏭️ object:added übersprungen (skipNextAdd)');
            skipNextAdd = false;
            return;
        }
        if (!isReceivingUpdate && e.target && e.target.id && !e.target._fromServer) {
            console.log('📤 Sende object-added:', e.target.id);
            socket.emit('object-added', serializeObject(e.target));
        }
    });

    canvas.on('object:modified', (e) => {
        if (!isReceivingUpdate && e.target && e.target.id) {
            console.log('📤 Sende object-modified:', e.target.id);
            socket.emit('object-modified', serializeObject(e.target));
        }
    });

// NEU: Text-Änderungen synchronisieren
    canvas.on('text:changed', (e) => {
        if (!isReceivingUpdate && e.target && e.target.id) {
            console.log('📝 Text geändert, sende Update:', e.target.id);
            socket.emit('object-modified', serializeObject(e.target));
        }
    });



    document.getElementById('clear-btn').addEventListener('click', () => {
        if (confirm('Canvas wirklich leeren?')) {
            canvas.clear();
            zoomToFit();
            socket.emit('clear-canvas');
        }
    });

    document.getElementById('leave-btn').addEventListener('click', () => {
        location.reload();
    });
}

// ========== TOOLBAR FUNKTIONALITÄT ==========
function initToolbar() {
    let currentColor = '#000000';
    
    const colorPicker = document.getElementById('color-picker');
    colorPicker.addEventListener('change', (e) => {
        currentColor = e.target.value;
        console.log('Farbe geändert:', currentColor);
    });
    
    document.getElementById('text-btn').addEventListener('click', () => {
        addTextToCanvas(currentColor);
    });
    
    document.getElementById('arrow-btn').addEventListener('click', () => {
        alert('Pfeil-Tool kommt als nächstes!');
    });
    
    document.getElementById('draw-btn').addEventListener('click', () => {
        alert('Zeichnen-Tool kommt als nächstes!');
    });
}

function addTextToCanvas(color) {
    const text = new fabric.IText('Text hier eingeben...', {
        left: VIRTUAL_WIDTH / 2,
        top: VIRTUAL_HEIGHT / 2,
        fontSize: 24,
        fill: color,
        fontFamily: 'Arial',
        id: 'obj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        selectable: true,
        editable: true
    });
    
    canvas.add(text);
    canvas.setActiveObject(text);
    text.enterEditing();
    canvas.renderAll();
    
    console.log('Text hinzugefügt:', text.id);
}

function zoomToFit() {
    const wrapper = document.querySelector('.canvas-wrapper');
    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;

    const scaleX = width / VIRTUAL_WIDTH;
    const scaleY = height / VIRTUAL_HEIGHT;
    const zoom = Math.min(scaleX, scaleY) * 0.95;

    canvas.setZoom(zoom);

    const panX = (width - (VIRTUAL_WIDTH * zoom)) / 2;
    const panY = (height - (VIRTUAL_HEIGHT * zoom)) / 2;

    canvas.viewportTransform = [zoom, 0, 0, zoom, panX, panY];
    canvas.renderAll();
    console.log('🔎 Zoom to Fit durchgeführt. Zoom:', zoom);
}

// ========== TOOLS ==========
function initToolsPanel() {
    const toolsList = document.getElementById('tools-list');

    labEquipment.forEach(equipment => {
        const toolItem = document.createElement('div');
        toolItem.className = 'tool-item';
        toolItem.innerHTML = `
            <img src="/static/images/${equipment.file}" alt="${equipment.name}">
            <span>${equipment.name}</span>
        `;
        toolItem.addEventListener('click', () => addImageToCanvas(equipment));
        toolsList.appendChild(toolItem);
    });
}

function addImageToCanvas(equipment) {
    const imgPath = `/static/images/${equipment.file}`;
    
    console.log('➕ Füge Bild hinzu:', equipment.name);
    
    fabric.Image.fromURL(imgPath, (img) => {
        img.id = 'obj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        img.scaleToWidth(100);
        
        img.set({
            left: VIRTUAL_WIDTH / 2 - 50,
            top: VIRTUAL_HEIGHT / 2 - 50,
            selectable: true,
            hasControls: true,
            hasBorders: true,
            objectCaching: false
        });

        console.log('✅ Bild geladen, ID:', img.id);
        canvas.add(img);
    }, { crossOrigin: 'anonymous' });
}

// ========== SOCKET LISTENERS ==========
function initSocketListeners() {
    console.log('🔌 Socket Listeners initialisiert');

    socket.on('users-update', (users) => {
        console.log('👥 User-Update:', users);
        const userList = document.getElementById('user-list');
        userList.innerHTML = '';
        users.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            userItem.innerHTML = `<div class="user-status"></div><span>${user.name}</span>`;
            userList.appendChild(userItem);
        });
    });

    socket.on('canvas-state', (objects) => {
        console.log('🔵 Canvas-State empfangen:', objects.length, 'Objekte');
        
        isReceivingUpdate = true;
        canvas.clear();
        
        objects.forEach(objData => {
            console.log('🔄 Lade Objekt:', objData.id, objData.type);
            loadObjectFromServer(objData);
        });
        
        zoomToFit();
        
        setTimeout(() => { 
            console.log('✅ Canvas hat jetzt', canvas.getObjects().length, 'Objekte');
            isReceivingUpdate = false; 
        }, 500);
    });

    socket.on('object-added', (objData) => {
        console.log('📥 object-added empfangen:', objData.id);
        isReceivingUpdate = true;
        loadObjectFromServer(objData);
        setTimeout(() => { isReceivingUpdate = false; }, 100);
    });

    socket.on('object-modified', (objData) => {
        console.log('📥 object-modified empfangen:', objData.id);
        const obj = canvas.getObjects().find(o => o.id === objData.id);
        if (obj) {
            isReceivingUpdate = true;
            
            // Für Text-Objekte auch den Text-Inhalt aktualisieren
            if ((obj.type === 'i-text' || obj.type === 'text') && objData.text !== undefined) {
                obj.set({ text: objData.text });
            }
            
            obj.set({
                left: objData.left,
                top: objData.top,
                scaleX: objData.scaleX,
                scaleY: objData.scaleY,
                angle: objData.angle
            });
            obj.setCoords();
            canvas.renderAll();
            setTimeout(() => { isReceivingUpdate = false; }, 50);
        } else {
            console.warn('⚠️ Objekt nicht gefunden:', objData.id);
        }
    });

    socket.on('object-removed', (data) => {
        console.log('📥 object-removed empfangen:', data.id);
        const obj = canvas.getObjects().find(o => o.id === data.id);
        if (obj) {
            isReceivingUpdate = true;
            canvas.remove(obj);
            setTimeout(() => { isReceivingUpdate = false; }, 50);
        }
    });

    socket.on('clear-canvas', () => {
        console.log('📥 clear-canvas empfangen');
        isReceivingUpdate = true;
        canvas.clear();
        zoomToFit();
        setTimeout(() => { isReceivingUpdate = false; }, 50);
    });
}

// ========== HELPER ==========
function serializeObject(obj) {
    const baseData = {
        id: obj.id,
        type: obj.type,
        left: obj.left,
        top: obj.top,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY,
        angle: obj.angle
    };
    
    // Für Bilder
    if (obj.type === 'image' && obj.getSrc) {
        baseData.src = obj.getSrc();
    }
    
    // Für Text
    if (obj.type === 'i-text' || obj.type === 'text') {
        baseData.text = obj.text;
        baseData.fontSize = obj.fontSize;
        baseData.fill = obj.fill;
        baseData.fontFamily = obj.fontFamily;
    }
    
    return baseData;
}

function loadObjectFromServer(objData) {
    console.log('🔧 loadObjectFromServer aufgerufen für:', objData.id);
    
    const exists = canvas.getObjects().find(o => o.id === objData.id);
    if (exists) {
        console.log('⚠️ Objekt existiert bereits:', objData.id);
        return;
    }

    // Bild laden
    if (objData.type === 'image' && objData.src) {
        console.log('🖼️ Lade Bild von URL:', objData.src);
        skipNextAdd = true;
        
        fabric.Image.fromURL(objData.src, (img) => {
            console.log('✅ Bild geladen:', objData.id);
            img.id = objData.id;
            img._fromServer = true;
            img.set({
                left: objData.left,
                top: objData.top,
                scaleX: objData.scaleX,
                scaleY: objData.scaleY,
                angle: objData.angle,
                selectable: true,
                objectCaching: false
            });
            
            canvas.add(img);
            canvas.renderAll();
            console.log('✅ Objekt zur Canvas hinzugefügt');
            
            delete img._fromServer;
        }, { crossOrigin: 'anonymous' });
    }
    // Text laden
    else if (objData.type === 'i-text' || objData.type === 'text') {
        console.log('📝 Lade Text:', objData.text);
        skipNextAdd = true;
        
        const text = new fabric.IText(objData.text, {
            left: objData.left,
            top: objData.top,
            fontSize: objData.fontSize,
            fill: objData.fill,
            fontFamily: objData.fontFamily,
            scaleX: objData.scaleX,
            scaleY: objData.scaleY,
            angle: objData.angle,
            id: objData.id,
            _fromServer: true,
            selectable: true,
            editable: true
        });
        
        canvas.add(text);
        canvas.renderAll();
        console.log('✅ Text zur Canvas hinzugefügt');
        
        delete text._fromServer;
    }
    else {
        console.warn('⚠️ Ungültiges Objekt:', objData);
    }
}