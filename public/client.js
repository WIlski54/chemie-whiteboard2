// ========== GLOBALE VARIABLEN ==========
let socket;
let canvas;
let currentRoom = null;
let currentUser = null;
let isReceivingUpdate = false;
let skipNextAdd = false;
let isTeacher = false;
let isObserver = false;
let isRoomLocked = false;

const VIRTUAL_WIDTH = 2400;
const VIRTUAL_HEIGHT = 1600;

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
    { name: 'Tiegel', file: 'tiegel.png' }, // <-- HIER WAR DER FEHLER
    { name: 'Tiegelzange', file: 'tiegelzange.png' },
    { name: 'Tondreieck', file: 'tondreieck.png' },
    { name: 'Uhrglas', file: 'urglas.png' },
    { name: 'Verbrennungslöffel', file: 'verbrennungsloeffel.png' },
    { name: 'Wanne', file: 'wanne.png' },
    { name: 'Wasserstrahlpumpe', file: 'wasserstrahlpumpe.png' }
];

// ========== INITIALISIERUNG ==========
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    const teacherFromUrl = urlParams.get('teacher');
    const observerMode = urlParams.get('observer') === 'true';
    
    if (roomFromUrl && teacherFromUrl && observerMode) {
        socket = io();
        joinRoom(teacherFromUrl, roomFromUrl, true, true);
    } else {
        initLoginScreen();
    }
});

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
        const activeTab = document.querySelector('.tab.active').dataset.tab;

        if (userName && roomName) {
            if (activeTab === 'teacher') {
                // Lehrer zum Dashboard
                localStorage.setItem('teacherName', userName);
                window.location.href = `/dashboard.html?teacher=${encodeURIComponent(userName)}`;
            } else {
                joinRoom(userName, roomName, false, false);
            }
        }
    });
}

function joinRoom(userName, roomName, asTeacher = false, asObserver = false) {
    currentUser = userName;
    currentRoom = roomName;
    isTeacher = asTeacher;
    isObserver = asObserver;

    console.log('🟢 Verbinde mit Server und trete Raum bei:', roomName);
    socket = io();
    socket.emit('join-room', { 
        roomId: roomName, 
        userName: userName,
        isTeacher: isTeacher,
        isObserver: isObserver
    });

    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('whiteboard-screen').style.display = 'flex';
    document.getElementById('current-room').textContent = roomName;
    
    if (isObserver) {
        document.getElementById('current-room').innerHTML = `
            ${roomName} <span style="background: #ff9800; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-left: 8px;">👁️ BEOBACHTER</span>
        `;
    }

    initCanvas();
    initToolsPanel();
    initSocketListeners();
    initToolbar();
}

// ========== CANVAS INITIALISIERUNG ==========
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

    // Pan & Zoom
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

    // Canvas Events
    canvas.on('object:added', (e) => {
        if (skipNextAdd) {
            console.log('⏭️ object:added übersprungen (skipNextAdd)');
            skipNextAdd = false;
            return;
        }
        
        if (e.target && e.target.type === 'path') {
            console.log('⏭️ Path in object:added übersprungen - wird in path:created gesendet');
            return;
        }
        
        if (!isReceivingUpdate && e.target && e.target.id && !e.target._fromServer) {
            console.log('📤 Sende object-added:', e.target.id, e.target.type);
            socket.emit('object-added', serializeObject(e.target));
        }
    });

    canvas.on('object:modified', (e) => {
        if (!isReceivingUpdate && e.target && e.target.id) {
            console.log('📤 Sende object-modified:', e.target.id);
            socket.emit('object-modified', serializeObject(e.target));
        }
    });

    canvas.on('text:changed', (e) => {
        if (!isReceivingUpdate && e.target && e.target.id) {
            console.log('📝 Text geändert, sende Update:', e.target.id);
            socket.emit('object-modified', serializeObject(e.target));
        }
    });

    canvas.on('path:created', (e) => {
        const path = e.path;
        path.id = 'obj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        console.log('✏️ Freihand-Pfad erstellt:', path.id);
        
        if (!isReceivingUpdate) {
            console.log('📤 Sende Path manuell:', path.id);
            socket.emit('object-added', serializeObject(path));
        }
    });

    // Button Event Listener
    document.getElementById('clear-btn').addEventListener('click', () => {
        if (!isTeacher) {
            alert('Nur Lehrer können die Canvas leeren!');
            return;
        }
        if (confirm('Canvas wirklich leeren?')) {
            canvas.clear();
            zoomToFit();
            socket.emit('clear-canvas');
        }
    });

    document.getElementById('export-btn').addEventListener('click', () => {
        exportCanvasAsImage();
    });

    document.getElementById('save-json-btn').addEventListener('click', () => {
        saveCanvasAsJSON();
    });

    document.getElementById('load-json-btn').addEventListener('click', () => {
        const input = document.getElementById('load-json-input'); 
        if (input) {
            input.click();
        }
    });

    const jsonUploadInput = document.getElementById('load-json-input'); 
    if (jsonUploadInput) {
        jsonUploadInput.addEventListener('change', loadCanvasFromJSON);
    }

    document.getElementById('leave-btn').addEventListener('click', () => {
        if (confirm('Möchtest du den Raum wirklich verlassen?')) {
            window.location.href = '/'; // Zurück zur Login-Seite
        }
    });

    const imageUploadInput = document.getElementById('image-upload');
    if (imageUploadInput) {
        imageUploadInput.addEventListener('change', handleImageUpload);
    }
    
    // ========== NEU: DELETE-TASTEN-FUNKTION ==========
    window.addEventListener('keydown', (e) => {
        const activeObj = canvas.getActiveObject();

        // 1. Nichts tun, wenn kein Objekt ausgewählt ist
        if (!activeObj) return; 

        // 2. Nichts tun, wenn der Benutzer gerade Text auf der Canvas bearbeitet
        if (activeObj.isEditing) return;

        // 3. Nichts tun, wenn Raum für Schüler gesperrt ist
        if (isRoomLocked && !isTeacher && !isObserver) {
            return; 
        }
        
        // 4. Prüfen auf "Delete" oder "Backspace" Taste
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault(); // Verhindert, dass der Browser bei Backspace zurück navigiert

            // Handle "activeSelection" (Gruppe von mehreren ausgewählten Objekten)
            if (activeObj.type === 'activeSelection') {
                activeObj.forEachObject(obj => {
                    canvas.remove(obj);
                    socket.emit('object-removed', { id: obj.id });
                });
            } else {
                // Handle einzelnes Objekt
                canvas.remove(activeObj);
                socket.emit('object-removed', { id: activeObj.id });
            }
            canvas.discardActiveObject();
            canvas.renderAll();
            console.log('🗑️ Objekt(e) mit Taste gelöscht');
        }
    });
    // ========== ENDE NEUER CODEBLOCK ==========
}

// ========== TOOLBAR INITIALISIERUNG (AKTUALISIERT FÜR "SELECT") ==========
function initToolbar() {
    const toolButtons = document.querySelectorAll('.tool-btn');
    const colorPicker = document.getElementById('color-picker');
    const brushWidthSlider = document.getElementById('brush-width');
    const brushWidthValue = document.getElementById('brush-width-value');
    const fillCheckbox = document.getElementById('fill-checkbox');

    // Helper-Funktion, um den "active" Status zu setzen
    function setActiveTool(activeButton) {
        deactivateAllModes(); // Setzt canvas.selection = true
        toolButtons.forEach(btn => btn.classList.remove('active'));
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }

    // Standard-Tool (Auswählen)
    setActiveTool(null);
    canvas.selection = true;

    // ----- Tool-Buttons (MIT TOGGLE-FUNKTION) -----
    document.getElementById('text-btn').addEventListener('click', (e) => {
        if (isRoomLocked) return; 
        const btn = e.currentTarget;
        if (btn.classList.contains('active')) {
            setActiveTool(null);
        } else {
            setActiveTool(btn);
            addTextToCanvas(colorPicker.value);
        }
    });

    document.getElementById('arrow-btn').addEventListener('click', (e) => {
        if (isRoomLocked) return;
        const btn = e.currentTarget;
        if (btn.classList.contains('active')) {
            setActiveTool(null);
        } else {
            setActiveTool(btn);
            startArrowDrawing(colorPicker.value, parseInt(brushWidthSlider.value));
        }
    });

    document.getElementById('draw-btn').addEventListener('click', (e) => {
        if (isRoomLocked) return;
        const btn = e.currentTarget;
        if (btn.classList.contains('active')) {
            setActiveTool(null);
        } else {
            setActiveTool(btn);
            toggleDrawingMode(colorPicker.value, parseInt(brushWidthSlider.value));
        }
    });

    document.getElementById('rect-btn').addEventListener('click', (e) => {
        if (isRoomLocked) return;
        const btn = e.currentTarget;
        if (btn.classList.contains('active')) {
            setActiveTool(null);
        } else {
            setActiveTool(btn);
            startShapeDrawing('rect', colorPicker.value, parseInt(brushWidthSlider.value), fillCheckbox.checked);
        }
    });

    document.getElementById('circle-btn').addEventListener('click', (e) => {
        if (isRoomLocked) return;
        const btn = e.currentTarget;
        if (btn.classList.contains('active')) {
            setActiveTool(null);
        } else {
            setActiveTool(btn);
            startShapeDrawing('circle', colorPicker.value, parseInt(brushWidthSlider.value), fillCheckbox.checked);
        }
    });
    // ----- ENDE TOOL-BUTTONS -----

    // ----- Tool-Optionen -----
    brushWidthSlider.addEventListener('input', (e) => {
        const width = e.target.value;
        brushWidthValue.textContent = width;
        
        if (canvas.isDrawingMode) {
            canvas.freeDrawingBrush.width = parseInt(width);
        }
    });

    const uploadLabel = document.querySelector('label[for="image-upload"]');
    if (uploadLabel) {
        uploadLabel.addEventListener('click', () => {
            setActiveTool(null);
            canvas.selection = true;
        });
    }

    console.log('✅ Neue Toolbar (mit Toggle) initialisiert');
}

function deactivateAllModes() {
    canvas.isDrawingMode = false;
    canvas.selection = true;
    canvas.off('mouse:down');
    canvas.off('mouse:move');
    canvas.off('mouse:up');
    console.log('✋ Alle Modi deaktiviert (Select-Modus AN)');
}

function toggleDrawingMode(color, width) {
    deactivateAllModes();
    canvas.isDrawingMode = true;
    canvas.freeDrawingBrush.color = color;
    canvas.freeDrawingBrush.width = width;
    console.log('✏️ Freihand-Modus aktiviert:', color, width);
}

function addTextToCanvas(color) {
    deactivateAllModes();
    
    const text = new fabric.IText('Text eingeben', {
        left: 100,
        top: 100,
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
    console.log('📝 Text hinzugefügt:', text.id);
}

function startArrowDrawing(color, width) {
    deactivateAllModes();
    
    let isDrawing = false;
    let startX, startY;
    let tempArrow = null;

    canvas.on('mouse:down', (opt) => {
        isDrawing = true;
        const pointer = canvas.getPointer(opt.e);
        startX = pointer.x;
        startY = pointer.y;
    });

    canvas.on('mouse:move', (opt) => {
        if (!isDrawing) return;
        
        const pointer = canvas.getPointer(opt.e);
        
        if (tempArrow) {
            canvas.remove(tempArrow);
        }
        
        tempArrow = createArrow(startX, startY, pointer.x, pointer.y, color, width);
        tempArrow.selectable = false;
        tempArrow.evented = false;
        canvas.add(tempArrow);
        canvas.renderAll();
    });

    canvas.on('mouse:up', (opt) => {
        if (!isDrawing) return;
        isDrawing = false;
        
        if (tempArrow) {
            canvas.remove(tempArrow);
        }
        
        const pointer = canvas.getPointer(opt.e);
        const finalArrow = createArrow(startX, startY, pointer.x, pointer.y, color, width);
        finalArrow.id = 'obj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        finalArrow.selectable = true;
        finalArrow.evented = true;
        
        canvas.add(finalArrow);
        console.log('➡️ Pfeil erstellt:', finalArrow.id);
        
        deactivateAllModes();
    });

    console.log('➡️ Pfeil-Zeichnen-Modus aktiviert');
}

function createArrow(x1, y1, x2, y2, color, width) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLength = 15;

    const line = new fabric.Line([x1, y1, x2, y2], {
        stroke: color,
        strokeWidth: width,
        selectable: false,
        evented: false
    });

    const triangle = new fabric.Triangle({
        left: x2,
        top: y2,
        width: headLength,
        height: headLength,
        fill: color,
        angle: (angle * 180) / Math.PI + 90,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false
    });

    const group = new fabric.Group([line, triangle], {
        selectable: true,
        hasControls: true
    });

    return group;
}

function startShapeDrawing(shapeType, color, width, filled) {
    deactivateAllModes();
    
    let isDrawing = false;
    let startX, startY;
    let tempShape = null;

    canvas.on('mouse:down', (opt) => {
        isDrawing = true;
        const pointer = canvas.getPointer(opt.e);
        startX = pointer.x;
        startY = pointer.y;
    });

    canvas.on('mouse:move', (opt) => {
        if (!isDrawing) return;
        
        const pointer = canvas.getPointer(opt.e);
        
        if (tempShape) {
            canvas.remove(tempShape);
        }
        
        const shapeWidth = Math.abs(pointer.x - startX);
        const shapeHeight = Math.abs(pointer.y - startY);
        const left = Math.min(startX, pointer.x);
        const top = Math.min(startY, pointer.y);

        if (shapeType === 'rect') {
            tempShape = new fabric.Rect({
                left: left,
                top: top,
                width: shapeWidth,
                height: shapeHeight,
                fill: filled ? color : 'transparent',
                stroke: color,
                strokeWidth: width,
                selectable: false,
                evented: false
            });
        } else if (shapeType === 'circle') {
            const radius = Math.sqrt(Math.pow(shapeWidth, 2) + Math.pow(shapeHeight, 2)) / 2;
            tempShape = new fabric.Circle({
                left: startX,
                top: startY,
                radius: radius,
                fill: filled ? color : 'transparent',
                stroke: color,
                strokeWidth: width,
                originX: 'center',
                originY: 'center',
                selectable: false,
                evented: false
            });
        }
        
        canvas.add(tempShape);
        canvas.renderAll();
    });

    canvas.on('mouse:up', (opt) => {
        if (!isDrawing) return;
        isDrawing = false;
        
        if (tempShape) {
            canvas.remove(tempShape);
        }
        
        const pointer = canvas.getPointer(opt.e);
        const shapeWidth = Math.abs(pointer.x - startX);
        const shapeHeight = Math.abs(pointer.y - startY);
        const left = Math.min(startX, pointer.x);
        const top = Math.min(startY, pointer.y);

        let finalShape;
        
        if (shapeType === 'rect') {
            finalShape = new fabric.Rect({
                left: left,
                top: top,
                width: shapeWidth,
                height: shapeHeight,
                fill: filled ? color : 'transparent',
                stroke: color,
                strokeWidth: width,
                id: 'obj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                selectable: true,
                evented: true
            });
        } else if (shapeType === 'circle') {
            const radius = Math.sqrt(Math.pow(shapeWidth, 2) + Math.pow(shapeHeight, 2)) / 2;
            finalShape = new fabric.Circle({
                left: startX,
                top: startY,
                radius: radius,
                fill: filled ? color : 'transparent',
                stroke: color,
                strokeWidth: width,
                originX: 'center',
                originY: 'center',
                id: 'obj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                selectable: true,
                evented: true
            });
        }
        
        canvas.add(finalShape);
        console.log(`⬜ ${shapeType} erstellt:`, finalShape.id);
        
        deactivateAllModes();
    });

    console.log(`⬜ ${shapeType}-Zeichnen-Modus aktiviert`);
}

// ========== BILD-UPLOAD ==========
function handleImageUpload(e) {
    if (isRoomLocked) return; 
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('Bitte wähle eine Bilddatei!');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        const formData = new FormData();
        formData.append('image', file);

        fetch('/upload-image', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            console.log('✅ Bild hochgeladen:', data.url);
            addUploadedImageToCanvas(data.url);
        })
        .catch(err => {
            console.error('❌ Upload-Fehler:', err);
            alert('Fehler beim Hochladen des Bildes!');
        });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
}

function addUploadedImageToCanvas(url) {
    fabric.Image.fromURL(url, (img) => {
        img.id = 'obj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        img.scaleToWidth(200);
        img.set({ left: 100, top: 100 });
        canvas.add(img);
        canvas.setActiveObject(img);
        console.log('🖼️ Hochgeladenes Bild hinzugefügt:', img.id);
    }, { crossOrigin: 'anonymous' });
}

// ========== ZOOM & EXPORT ==========
function zoomToFit() {
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const scaleX = canvasWidth / VIRTUAL_WIDTH;
    const scaleY = canvasHeight / VIRTUAL_HEIGHT;
    const scale = Math.min(scaleX, scaleY);
    
    canvas.setZoom(scale);
    canvas.setViewportTransform([scale, 0, 0, scale, 0, 0]);
    console.log('🔍 Zoom angepasst:', scale);
}

function exportCanvasAsImage() {
    const dataURL = canvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 2
    });

    const link = document.createElement('a');
    link.download = `chemie-canvas-${Date.now()}.png`;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log('📸 Canvas als Bild exportiert!');
}

function saveCanvasAsJSON() {
    const json = JSON.stringify(canvas.toJSON(['id']));
    const filename = `chemie-canvas-${Date.now()}.json`;
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const blob = new Blob([json], { type: 'application/json' });
    const file = new File([blob], filename, { type: 'application/json' });

    // KORRIGIERTE & VERBESSERTE PRÜFUNG:
    // Wir prüfen jetzt, ob 'navigator.share' existiert UND ob 'navigator.canShare'
    // uns meldet, dass es das Teilen von 'files' unterstützt.
    if (isIOS && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        
        console.log('Versuche iOS Share API (mit Datei-Prüfung)...');
        
        navigator.share({
            files: [file],
            title: 'Canvas speichern',
            text: 'Chemie Whiteboard Canvas'
        })
        .then(() => console.log('💾 Canvas geteilt (iOS)'))
        .catch(err => {
            // Fallback, falls User abbricht oder ein anderer Fehler auftritt
            console.log('Share abgebrochen oder Fehler:', err);
            // Nutze die DataURI-Methode als Fallback, da sie auf iOS stabiler ist
            downloadViaDataURI(json, filename); 
        });
    } else { 
        // Fallback für PCs, Android, oder alte iOS-Versionen
        console.log('Share API nicht unterstützt, verwende Standard-Download (createObjectURL).');
        const link = document.createElement('a');
        link.download = filename;
        link.href = URL.createObjectURL(blob);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        
        console.log('💾 Canvas als JSON gespeichert!');
    }
}

function downloadViaDataURI(content, filename) {
    const dataStr = 'data:application/json;charset=utf-8,' + encodeURIComponent(content);
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataStr;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log('💾 Canvas als JSON gespeichert (Data URI)!');
}

function loadCanvasFromJSON(e) {
    if (isRoomLocked) return; 
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.name.endsWith('.json')) {
        alert('Bitte wähle eine JSON-Datei!');
        return;
    }
    
    const reader = new FileReader();
    
    reader.onload = function(event) {
        try {
            const json = event.target.result;
            
            isReceivingUpdate = true;
            
            canvas.clear();
            canvas.loadFromJSON(json, () => {
                canvas.getObjects().forEach(obj => {
                    if (!obj.id) {
                        obj.id = 'obj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                    }
                    obj.selectable = true;
                    obj.hasControls = true;
                });
                
                canvas.renderAll();
                zoomToFit();
                
                isReceivingUpdate = false;
                
                socket.emit('full-sync', {
                    objects: canvas.getObjects().map(obj => serializeObject(obj))
                });
                
                console.log('✅ Canvas aus JSON geladen und synchronisiert!');
            });
        } catch (error) {
            console.error('❌ Fehler beim Laden der JSON-Datei:', error);
            alert('Fehler beim Laden der Datei!');
            isReceivingUpdate = false;
        }
    };
    
    reader.readAsText(file);
    e.target.value = '';
}

// ========== LABORGERÄTE PANEL ==========
function initToolsPanel() {
    const container = document.getElementById('tools-list'); 
    if (!container) {
        console.error('❌ Tools-Panel-Container (#tools-list) nicht gefunden!');
        return;
    }

    labEquipment.forEach(equipment => {
        const card = document.createElement('div');
        card.className = 'tool-item'; 
        card.innerHTML = `
            <img src="/images/${equipment.file}" alt="${equipment.name}">
            <span>${equipment.name}</span>
        `;
        card.addEventListener('click', () => addImageToCanvas(equipment));
        container.appendChild(card);
    });
}

function addImageToCanvas(equipment) {
    if (isRoomLocked) return; 
    const imgURL = `/images/${equipment.file}`;
    
    fabric.Image.fromURL(imgURL, (img) => {
        img.id = 'obj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        img.scaleToWidth(100);
        img.set({ left: 100, top: 100 });
        canvas.add(img);
        canvas.setActiveObject(img);
        console.log('🧪 Laborgerät hinzugefügt:', equipment.name, img.id);
    }, { crossOrigin: 'anonymous' });
}

// ========== SOCKET LISTENERS ==========
function initSocketListeners() {
    socket.on('canvas-state', (data) => {
        console.log('🔄 Erhalte Canvas-Zustand vom Server');
        isReceivingUpdate = true;
        
        canvas.clear();
        
        if (Array.isArray(data) && data.length > 0) {
            data.forEach(objData => {
                loadObjectFromServer(objData);
            });
        }
        
        setTimeout(() => {
            isReceivingUpdate = false;
            console.log('✅ Canvas-Zustand geladen');
        }, 100);
    });

    socket.on('object-added', (objData) => {
        if (isReceivingUpdate) {
            console.log('⏭️ Überspringe object-added (isReceivingUpdate aktiv)');
            return;
        }
        
        console.log('📥 Erhalte object-added:', objData.id, objData.type);
        isReceivingUpdate = true;
        loadObjectFromServer(objData);
        
        setTimeout(() => {
            isReceivingUpdate = false;
        }, 50);
    });

    socket.on('object-modified', (objData) => {
        console.log('📥 Erhalte object-modified:', objData.id);
        isReceivingUpdate = true;
        
        const obj = canvas.getObjects().find(o => o.id === objData.id);
        if (obj) {
            obj.set({
                left: objData.left,
                top: objData.top,
                scaleX: objData.scaleX,
                scaleY: objData.scaleY,
                angle: objData.angle
            });
            
            if (objData.type === 'i-text' || objData.type === 'text') {
                obj.set({ text: objData.text });
            }
            
            canvas.renderAll();
            console.log('✅ Objekt aktualisiert:', objData.id);
        }
        
        setTimeout(() => {
            isReceivingUpdate = false;
        }, 50);
    });

    socket.on('object-removed', (data) => {
        console.log('📥 Erhalte object-removed:', data.id);
        const obj = canvas.getObjects().find(o => o.id === data.id);
        if (obj) {
            canvas.remove(obj);
            console.log('✅ Objekt entfernt:', data.id);
        }
    });

    socket.on('clear-canvas', () => {
        console.log('🧹 Canvas geleert (vom Server)');
        canvas.clear();
        zoomToFit();
    });

    socket.on('room-lock-status', (data) => {
        console.log('🔒 Raum-Sperrstatus:', data.isLocked);
        handleRoomLockStatus(data.isLocked);
    });
    
    socket.on('users-update', (users) => {
        console.log('👥 User-Liste aktualisiert:', users);
        updateUserList(users);
    });
}

// ========== HINZUGEFÜGT: User-Liste UI Update ==========
function updateUserList(users) {
    const userListContainer = document.getElementById('user-list');
    if (!userListContainer) return;

    userListContainer.innerHTML = ''; 

    users.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item'; 
        userItem.innerHTML = `
            <div class="user-status"></div>
            <span>${user.name} ${user.isTeacher ? ' (Lehrer)' : ''} ${user.isObserver ? ' (👁️)' : ''}</span>
        `;
        userListContainer.appendChild(userItem);
    });
}


// ========== OBJEKT SERIALISIERUNG ==========
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

    if (obj.type === 'image') {
        baseData.src = obj.getSrc();
    } else if (obj.type === 'i-text' || obj.type === 'text') {
        baseData.text = obj.text;
        baseData.fontSize = obj.fontSize;
        baseData.fill = obj.fill;
        baseData.fontFamily = obj.fontFamily;
    } else if (obj.type === 'path') {
        baseData.pathData = obj.toObject(['path', 'stroke', 'strokeWidth', 'fill']);
    } else if (obj.type === 'rect') {
        baseData.width = obj.width;
        baseData.height = obj.height;
        baseData.fill = obj.fill;
        baseData.stroke = obj.stroke;
        baseData.strokeWidth = obj.strokeWidth;
    } else if (obj.type === 'circle') {
        baseData.radius = obj.radius;
        baseData.fill = obj.fill;
        baseData.stroke = obj.stroke;
        baseData.strokeWidth = obj.strokeWidth;
    } else if (obj.type === 'group') {
        baseData.objects = obj.getObjects().map(o => ({
            type: o.type,
            left: o.left,
            top: o.top,
            stroke: o.stroke,
            strokeWidth: o.strokeWidth,
            fill: o.fill,
            angle: o.angle,
            originX: o.originX,
            originY: o.originY,
            x1: o.x1,
            y1: o.y1,
            x2: o.x2,
            y2: o.y2,
            width: o.width,
            height: o.height
        }));
    }
    
    return baseData;
}

function loadObjectFromServer(objData) {
    console.log('🔧 loadObjectFromServer aufgerufen für:', objData.id, objData.type);
    
    const exists = canvas.getObjects().find(o => o.id === objData.id);
    if (exists) {
        console.log('⚠️ Objekt existiert bereits:', objData.id);
        return;
    }

    if (objData.type === 'image' && objData.src) {
        console.log('🖼️ Lade Bild von URL:', objData.src);
        skipNextAdd = true;
        
        fabric.Image.fromURL(objData.src, (img) => {
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
            delete img._fromServer;
        }, { crossOrigin: 'anonymous' });
    }
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
        delete text._fromServer;
    }
    else if (objData.type === 'path' && objData.pathData) {
        console.log('✏️ Lade Freihand-Pfad:', objData.id);
        skipNextAdd = true;
        
        fabric.Path.fromObject(objData.pathData, (path) => {
            path.set({
                left: objData.left,
                top: objData.top,
                scaleX: objData.scaleX,
                scaleY: objData.scaleY,
                angle: objData.angle,
                id: objData.id,
                _fromServer: true,
                selectable: true
            });
            
            canvas.add(path);
            canvas.renderAll();
            console.log('✅ Freihand-Pfad hinzugefügt');
            delete path._fromServer;
        });
    }
    else if (objData.type === 'rect') {
        console.log('⬜ Lade Rechteck:', objData.id);
        skipNextAdd = true;
        
        const rect = new fabric.Rect({
            left: objData.left,
            top: objData.top,
            width: objData.width,
            height: objData.height,
            fill: objData.fill,
            stroke: objData.stroke,
            strokeWidth: objData.strokeWidth,
            scaleX: objData.scaleX,
            scaleY: objData.scaleY,
            angle: objData.angle,
            id: objData.id,
            _fromServer: true,
            selectable: true
        });
        
        canvas.add(rect);
        canvas.renderAll();
        delete rect._fromServer;
    }
    else if (objData.type === 'circle') {
        console.log('⭕ Lade Kreis:', objData.id);
        skipNextAdd = true;
        
        const circle = new fabric.Circle({
            left: objData.left,
            top: objData.top,
            radius: objData.radius,
            fill: objData.fill,
            stroke: objData.stroke,
            strokeWidth: objData.strokeWidth,
            scaleX: objData.scaleX,
            scaleY: objData.scaleY,
            angle: objData.angle,
            id: objData.id,
            _fromServer: true,
            selectable: true
        });
        
        canvas.add(circle);
        canvas.renderAll();
        delete circle._fromServer;
    }
    else if (objData.type === 'group' && objData.objects) {
        console.log('➡️ Lade Pfeil (Group):', objData.id);
        skipNextAdd = true;
        
        const objects = objData.objects.map(o => {
            if (o.type === 'line') {
                return new fabric.Line([o.x1, o.y1, o.x2, o.y2], {
                    stroke: o.stroke,
                    strokeWidth: o.strokeWidth,
                    left: o.left,
                    top: o.top
                });
            } else if (o.type === 'triangle') {
                return new fabric.Triangle({
                    left: o.left,
                    top: o.top,
                    width: o.width,
                    height: o.height,
                    fill: o.fill,
                    angle: o.angle,
                    originX: o.originX,
                    originY: o.originY
                });
            }
        });
        
        const group = new fabric.Group(objects, {
            left: objData.left,
            top: objData.top,
            scaleX: objData.scaleX,
            scaleY: objData.scaleY,
            angle: objData.angle,
            id: objData.id,
            _fromServer: true,
            selectable: true
        });
        
        canvas.add(group);
        canvas.renderAll();
        delete group._fromServer;
    }
    else {
        console.warn('⚠️ Ungültiges Objekt:', objData);
    }
}

// ========== RAUM-SPERR-FUNKTIONALITÄT (AKTUALISIERT) ==========
function handleRoomLockStatus(isLocked) {
    isRoomLocked = isLocked;
    const whiteboardScreen = document.getElementById('whiteboard-screen');
    const warningEl = document.querySelector('.lock-warning');
    
    if (isTeacher || isObserver) return; // Lehrer/Observer sind nicht betroffen
    
    if (isLocked) {
        // UI sperren
        whiteboardScreen.classList.add('ui-locked');
        
        // Canvas-Interaktion stoppen
        canvas.selection = false;
        canvas.isDrawingMode = false;
        canvas.forEachObject(obj => {
            obj.selectable = false;
            obj.evented = false;
        });

        // Warnmeldung anzeigen
        if (!warningEl) {
            const warning = document.createElement('div');
            warning.className = 'lock-warning';
            warning.innerHTML = '🔒 Raum wurde gesperrt';
            document.body.appendChild(warning);
        }
        console.log('🔒 Canvas gesperrt');

    } else {
        // UI entsperren
        whiteboardScreen.classList.remove('ui-locked');
        
        // Canvas-Interaktion erlauben
        canvas.selection = true;
        canvas.forEachObject(obj => {
            obj.selectable = true;
            obj.evented = true;
        });

        // Warnmeldung entfernen
        if (warningEl) {
            warningEl.style.opacity = '0';
            setTimeout(() => warningEl.remove(), 500);
        }
        console.log('🔓 Canvas entsperrt');
    }
    canvas.renderAll();
}