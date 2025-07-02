let activeBubble = null;

function highlightBubble(bubbleEl) {
  document.querySelectorAll('.bubble').forEach(b => b.classList.remove('active'));
  if (bubbleEl) bubbleEl.classList.add('active');
}


function findValidBubblePosition(parent, bubbleWidth = 220, bubbleHeight = 100) {
  const idealDistance = 250;
  const spacingBuffer = 40;
  const maxAttempts = 120;
  const angleIncrement = 15;

  const viewBiasX = camX + window.innerWidth / 2 / zoom;
  const viewBiasY = camY + window.innerHeight / 2 / zoom;

  let bestScore = -Infinity;
  let bestPosition = null;

  let radius = idealDistance;
  let angle = 0;

  for (let attempts = 0; attempts < maxAttempts; attempts++) {
    const rad = (angle / 180) * Math.PI;
    const testX = parent.x + Math.cos(rad) * radius;
    const testY = parent.y + Math.sin(rad) * radius;

    let tooClose = false;
    let repulsion = 0;

    for (const b of bubbles) {
      const dx = b.x - testX;
      const dy = b.y - testY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < bubbleWidth + spacingBuffer) {
        tooClose = true;
        break;
      }

      repulsion += 1 / (dist * dist); // inverse square repulsion
    }

    if (!tooClose) {
      const biasDx = viewBiasX - testX;
      const biasDy = viewBiasY - testY;
      const biasScore = -(biasDx * biasDx + biasDy * biasDy); // closer to center = better

      const totalScore = -repulsion + biasScore;
      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestPosition = { x: testX, y: testY };
      }
    }

    angle += angleIncrement;
    if (angle >= 360) {
      angle = 0;
      radius += 50;
    }
  }

  if (bestPosition) return bestPosition;

  // Last-ditch fallback far off
  return {
    x: parent.x + 600 + Math.random() * 300,
    y: parent.y + 600 + Math.random() * 300
  };
}



const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.continuous = true;
recognition.interimResults = false;
recognition.lang = 'en-US';

const canvas = document.getElementById('connections');
const ctx = canvas.getContext('2d');
const bubbles = [];

const connections = [];
let lastSpokenIntent = null;
let pendingConnectionFrom = null;
let selectedBubble = null;
let isConnectMode = false;

let camX = 0, camY = 0, zoom = 1;
let isPanning = false;
let panStart = {}, camStart = {};



canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  isAutoPanning = false; // 💥 interrupt auto-pan
  isPanning = true;
  panStart = { x: e.clientX, y: e.clientY };
  camStart = { x: camX, y: camY };
});

window.addEventListener('mouseup', () => isPanning = false);
window.addEventListener('mousemove', (e) => {
  if (!isPanning) return;
  const dx = (e.clientX - panStart.x) / zoom;
  const dy = (e.clientY - panStart.y) / zoom;
  camX = camStart.x - dx;
  camY = camStart.y - dy;
});
window.addEventListener('wheel', (e) => {
  const scale = -e.deltaY * 0.001;
  const prevZoom = zoom;
  zoom = Math.min(Math.max(zoom * (1 + scale), 0.3), 3);

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const wx = (mx / prevZoom) + camX;
  const wy = (my / prevZoom) + camY;
  camX = wx - (mx / zoom);
  camY = wy - (my / zoom);
});

recognition.onresult = (e) => {
  const last = e.results.length - 1;
  const raw = e.results[last][0].transcript.trim();
  const text = raw.toLowerCase();

  if (handleTriggers(text)) return;

  let transcript = raw;

  if (lastSpokenIntent === 'question' && transcript.toLowerCase().startsWith("question ")) {
    transcript = transcript.slice(9).trim();
  }

  transcript = transcript.charAt(0).toUpperCase() + transcript.slice(1);

  if (lastSpokenIntent === 'question' && !transcript.endsWith('?')) {
    transcript += '?';
  }

  if (handleTriggers(text)) return;

  let x, y;
  if (pendingConnectionFrom) {
    const pos = findValidBubblePosition(pendingConnectionFrom);
    x = pos.x;
    y = pos.y;
  } else {
const canvasWidth = window.innerWidth - 280; // again, sidebar width

x = camX + Math.random() * (canvasWidth - 100); // buffer for bubble width
y = camY + Math.random() * (window.innerHeight - 100);
  }

  const bubble = document.createElement('div');
  bubble.style.position = 'absolute'; // ✅ REQUIRED

  const data = { el: bubble, x, y, dragging: false, locked: false, visible: true, order: null, type: lastSpokenIntent ||'idea' };
  bubble.className = `bubble ${data.type}`;
  const textSpan = document.createElement('span');
textSpan.className = 'bubble-text';
textSpan.textContent = transcript;
bubble.appendChild(textSpan);
data.textEl = textSpan;

  
  const idLabel = document.createElement('div');
idLabel.className = 'bubble-id-label';
bubble.appendChild(idLabel);
data.idLabel = idLabel;

  bubble.style.opacity = 0;
  updateSidebar();
  document.body.appendChild(bubble);

  

  bubble.addEventListener('dblclick', () => {
    const input = prompt("Set playback order number or type 'edit' or 'delete':");
    if (input === 'delete') {
      document.body.removeChild(bubble);
      const index = bubbles.indexOf(data);
      if (index > -1) bubbles.splice(index, 1);
      for (let i = connections.length - 1; i >= 0; i--) {
        if (connections[i].from === data || connections[i].to === data) {
          connections.splice(i, 1);
        }
      }
      return;
    } else if (input === 'edit') {
const newText = prompt("New text:", data.textEl.textContent);
if (newText) {
  data.textEl.textContent = newText.charAt(0).toUpperCase() + newText.slice(1);
}

      return;
      
    } else if (input === 'type') {
  const newType = prompt("Enter type: idea, task, question, blocker, note", data.type);
  const allowed = ['idea', 'task', 'question', 'blocker', 'note'];
  if (allowed.includes(newType)) {
    data.type = newType;
    bubble.className = `bubble ${newType}`;
    saveSnapshot();
  } else {
    alert("Invalid type");
  }
  return;
}
else {
      data.order = parseInt(input);
      bubble.classList.add('locked');
    }
  });
  updateSidebar();

  bubble.addEventListener('click', () => {
    if (isConnectMode) {
      if (!selectedBubble) {
        selectedBubble = data;
        bubble.style.outline = '2px solid yellow';
      } else {
        connections.push({ from: selectedBubble, to: data, label: '' });

        selectedBubble.el.style.outline = '';
        selectedBubble = null;
      }
    }
  });

  enableDragging(bubble, data);
  enableBubbleInteractions(bubble, data);

bubbles.push(data);
lastSpokenIntent = null;



  updateSidebar();
  updateBubbleIds();
  updateSidebar();


  if (pendingConnectionFrom) {
    setTimeout(() => {
      connections.push({ from: pendingConnectionFrom, to: data });
      pendingConnectionFrom = null;
      bubble.style.opacity = 1;
    }, 300);
  } else {
    bubble.style.opacity = 1;
  }
};

function handleTriggers(text) {
  if (text.includes('clear')) {
    document.querySelectorAll('.bubble').forEach(b => b.remove());
    bubbles.length = 0;
    connections.length = 0;
    return true;
  }

  if (text.includes('connect mode')) {
    isConnectMode = !isConnectMode;
    selectedBubble = null;
    alert(`Connect mode ${isConnectMode ? 'enabled' : 'disabled'}`);
    return true;
  }

  if (text.startsWith('question ')) {
    lastSpokenIntent = 'question';
    return false; // allow bubble creation to proceed
  }

  return false;
}


function speakText(text) {
  if (!window.speechSynthesis) {
    console.warn("Speech Synthesis not supported");
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1; // Adjust rate if needed
  utterance.pitch = 1;
  utterance.lang = 'en-US';
  window.speechSynthesis.speak(utterance);
}


let playbackActive = false;
let playbackPaused = false;
let playbackIndex = 0;
let orderedPlayback = [];

function playBubblesInOrder() {
  playbackActive = true;
  playbackPaused = false;

  // Hide all first
  bubbles.forEach(b => {
    b.visible = false;
    b.el.style.display = 'none';
    b.el.style.opacity = 0;
  });

  // Sort
  orderedPlayback = bubbles
    .map((b, i) => ({ ...b, _tempOrder: typeof b.order === 'number' ? b.order : i }))
    .sort((a, b) => a._tempOrder - b._tempOrder);

  playbackIndex = 0;
  playNextBubble();
}

function playNextBubble() {
  if (!playbackActive || playbackPaused || playbackIndex >= orderedPlayback.length) return;

  const b = orderedPlayback[playbackIndex++];

  b.visible = true;
  b.el.style.display = 'block';
  b.el.style.opacity = 1;
  highlightBubble(b.el);
  speakText(b.textEl?.textContent || '');

  panToTarget(b.x - window.innerWidth / 2 / zoom, b.y - window.innerHeight / 2 / zoom);

  setTimeout(() => {
    if (!playbackPaused) {
      playNextBubble();
    }
  }, 3000);
}

let isAutoPanning = false;

function panToTarget(x, y, duration = 600) {
  isAutoPanning = true;
  const startX = camX;
  const startY = camY;
  const dx = x - camX;
  const dy = y - camY;
  const startTime = performance.now();

  function animateFrame(time) {
    if (!isAutoPanning) return; // cancel if interrupted

    const t = Math.min((time - startTime) / duration, 1);
    camX = startX + dx * t;
    camY = startY + dy * t;

    if (t < 1) {
      requestAnimationFrame(animateFrame);
    } else {
      isAutoPanning = false;
    }
  }

  requestAnimationFrame(animateFrame);
}




const clickLayer = document.getElementById('clickLayer');
const clickCtx = clickLayer.getContext('2d');

clickLayer.addEventListener('click', e => {
  const rect = clickLayer.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  for (const conn of connections) {
    if (conn._clickPath && clickCtx.isPointInStroke(conn._clickPath, x, y)) {
      const newLabel = prompt("Label this connection:", conn.label || '');
      if (newLabel !== null) {
        conn.label = newLabel;
        saveSnapshot();
      }
      break;
    }
  }
});



function animate() {
canvas.width = window.innerWidth - 280; // 👈 sidebar width
canvas.height = window.innerHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(0,0,0)';
  ctx.lineWidth = 3;
  connections.forEach(conn => {
    if (!conn.from.visible || !conn.to.visible) return;

    let fromX = (conn.from.x - camX) * zoom + conn.from.el.offsetWidth / 2;
    let fromY = (conn.from.y - camY) * zoom + conn.from.el.offsetHeight / 2;
    let toX = (conn.to.x - camX) * zoom + conn.to.el.offsetWidth / 2;
    let toY = (conn.to.y - camY) * zoom + conn.to.el.offsetHeight / 2;

    const midX1 = fromX + (toX - fromX) * 0.25;
    const midY1 = fromY - 50 * zoom;
    const midX2 = toX - (toX - fromX) * 0.25;
    const midY2 = toY - 50 * zoom;

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.bezierCurveTo(midX1, midY1, midX2, midY2, toX, toY);
    ctx.stroke();
    ctx.font = '14px sans-serif';
ctx.fillStyle = 'black';
ctx.textAlign = 'center';

connections.forEach(conn => {
  if (!conn.from.visible || !conn.to.visible) return;

  let fromX = (conn.from.x - camX) * zoom + conn.from.el.offsetWidth / 2;
  let fromY = (conn.from.y - camY) * zoom + conn.from.el.offsetHeight / 2;
  let toX = (conn.to.x - camX) * zoom + conn.to.el.offsetWidth / 2;
  let toY = (conn.to.y - camY) * zoom + conn.to.el.offsetHeight / 2;

  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2 - 10 * zoom;

  ctx.fillText(conn.label || '', midX, midY);
});

  });

clickLayer.width = window.innerWidth - 280;
clickLayer.height = window.innerHeight;

clickCtx.clearRect(0, 0, clickLayer.width, clickLayer.height);
clickCtx.lineWidth = 10;
clickCtx.strokeStyle = 'rgba(0,0,0,0)'; // invisible but clickable

connections.forEach((conn, i) => {
  if (!conn.from.visible || !conn.to.visible) return;

  let fromX = (conn.from.x - camX) * zoom + conn.from.el.offsetWidth / 2;
  let fromY = (conn.from.y - camY) * zoom + conn.from.el.offsetHeight / 2;
  let toX = (conn.to.x - camX) * zoom + conn.to.el.offsetWidth / 2;
  let toY = (conn.to.y - camY) * zoom + conn.to.el.offsetHeight / 2;

  const midX1 = fromX + (toX - fromX) * 0.25;
  const midY1 = fromY - 50 * zoom;
  const midX2 = toX - (toX - fromX) * 0.25;
  const midY2 = toY - 50 * zoom;

  clickCtx.beginPath();
  clickCtx.moveTo(fromX, fromY);
  clickCtx.bezierCurveTo(midX1, midY1, midX2, midY2, toX, toY);
  clickCtx.stroke();

  conn._clickPath = new Path2D();
  conn._clickPath.moveTo(fromX, fromY);
  conn._clickPath.bezierCurveTo(midX1, midY1, midX2, midY2, toX, toY);
});


  bubbles.forEach(b => {
    if (!b.visible) return;
    b.el.style.left = `${(b.x - camX) * zoom}px`;
    b.el.style.top = `${(b.y - camY) * zoom}px`;
    b.el.style.transform = `scale(${zoom})`;
  });
  requestAnimationFrame(animate);
}

function enableDragging(el, data) {
  let isDragging = false, offsetX = 0, offsetY = 0;

  el.addEventListener('mousedown', e => {
    if (data.locked) return;
    isDragging = true;
    data.dragging = true;
    offsetX = e.clientX / zoom - data.x + camX;
    offsetY = e.clientY / zoom - data.y + camY;
  });

  document.addEventListener('mousemove', e => {
    if (!isDragging) return;
    data.x = (e.clientX / zoom - offsetX) + camX;
    data.y = (e.clientY / zoom - offsetY) + camY;
  });

document.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    data.dragging = false;
    saveSnapshot();
  }
});

}

recognition.onend = () => recognition.start();
recognition.onerror = e => console.error("Speech error:", e.error);
recognition.start();
animate();

let undoStack = [];
let redoStack = [];

function getStateSnapshot() {
  return JSON.stringify({
    bubbles: bubbles.map(b => ({
      text: b.el.innerText,
      x: b.x,
      y: b.y,
      locked: b.locked,
      order: b.order,
      type: b.type
    })),
    connections: connections.map(conn => ({
      from: bubbles.indexOf(conn.from),
      to: bubbles.indexOf(conn.to)
    }))
  });
}

function restoreStateFromSnapshot(snapshot) {
  const state = JSON.parse(snapshot);
  document.querySelectorAll('.bubble').forEach(b => b.remove());
  bubbles.length = 0;
  connections.length = 0;

  state.bubbles.forEach(b => {
    const bubble = document.createElement('div');
        const data = {
      el: bubble,
      x: b.x,
      y: b.y,
      locked: b.locked,
      order: b.order,
      dragging: false,
      visible: true,
      type: b.type || 'idea'
    };
    bubble.className = `bubble ${data.type}`;
const textSpan = document.createElement('span');
textSpan.className = 'bubble-text';
textSpan.textContent = b.text;
bubble.appendChild(textSpan);
data.textEl = textSpan;

    bubble.style.position = 'absolute'; // ✅ REQUIRED

    bubble.style.opacity = 1;
    document.body.appendChild(bubble);
    const idLabel = document.createElement('div');
idLabel.className = 'bubble-id-label';
bubble.appendChild(idLabel);
data.idLabel = idLabel;




    if (b.order !== null) bubble.classList.add('locked');

bubble.addEventListener('dblclick', () => {
  const input = prompt("Set playback order number or type 'edit', 'delete', or 'type':");

  if (input === 'delete') {
    document.body.removeChild(bubble);
    const index = bubbles.indexOf(data);
    if (index > -1) bubbles.splice(index, 1);
    for (let i = connections.length - 1; i >= 0; i--) {
      if (connections[i].from === data || connections[i].to === data) {
        connections.splice(i, 1);
      }
    }
    saveSnapshot();
    return;

  } else if (input === 'edit') {
const newText = prompt("New text:", data.textEl.textContent);
if (newText) {
  data.textEl.textContent = newText.charAt(0).toUpperCase() + newText.slice(1);


      saveSnapshot();
      updateSidebar();
    }
    return;

  } else if (input === 'type') {
    const newType = prompt("Enter type: idea, task, question, blocker, note", data.type);
    const allowed = ['idea', 'task', 'question', 'blocker', 'note'];
    if (allowed.includes(newType)) {
      data.type = newType;
      bubble.className = `bubble ${newType}`;
      saveSnapshot();
      updateSidebar();
    } else {
      alert("Invalid type");
    }
    return;

  } else {
    data.order = parseInt(input);
    bubble.classList.add('locked');
    saveSnapshot();
  }
});
updateSidebar();


    bubble.addEventListener('click', () => {
      if (isConnectMode) {
        if (!selectedBubble) {
          selectedBubble = data;
          bubble.style.outline = '2px solid yellow';
        } else {
          connections.push({ from: selectedBubble, to: data, label: '' });

          selectedBubble.el.style.outline = '';
          selectedBubble = null;
          saveSnapshot();
        }
      }
    });

    enableDragging(bubble, data);
    enableBubbleInteractions(bubble, data);

bubbles.push(data);


    updateSidebar();
    updateBubbleIds();
    updateSidebar();

  });

  state.connections.forEach(conn => {
    if (bubbles[conn.from] && bubbles[conn.to]) {
connections.push({
  from: bubbles[conn.from],
  to: bubbles[conn.to],
  label: conn.label || ''
});
    }
  });
  updateSidebar();
}

function saveSnapshot() {
  const snap = getStateSnapshot();
  undoStack.push(snap);
  redoStack.length = 0;
  localStorage.setItem('bubbleHistory', JSON.stringify(undoStack));
}
function updateBubbleIds() {
  bubbles.forEach((b, i) => {
    if (b.idLabel) b.idLabel.textContent = `#${i}`;
  });
}


function undo() {
  if (undoStack.length <= 1) return;
  const snap = undoStack.pop();
  redoStack.push(snap);
  restoreStateFromSnapshot(undoStack[undoStack.length - 1]);
  localStorage.setItem('bubbleHistory', JSON.stringify(undoStack));
}

function redo() {
  if (redoStack.length === 0) return;
  const snap = redoStack.pop();
  undoStack.push(snap);
  restoreStateFromSnapshot(snap);
  localStorage.setItem('bubbleHistory', JSON.stringify(undoStack));
}

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'z') {
    e.preventDefault();
    undo();
  } else if (e.ctrlKey && e.key === 'y') {
    e.preventDefault();
    redo();
  }
});

// Restore last session
const history = localStorage.getItem('bubbleHistory');
if (history) {
  undoStack = JSON.parse(history);
  if (undoStack.length) restoreStateFromSnapshot(undoStack[undoStack.length - 1]);
}
document.getElementById('exportMap').addEventListener('click', () => {
  const json = getStateSnapshot();
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = "mindmap.json";
  link.click();
});

document.getElementById('importMapBtn').addEventListener('click', () => {
  document.getElementById('importMap').click();
});

document.getElementById('importMap').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const content = reader.result;
      undoStack.push(content); // push to undo
      redoStack.length = 0;
      restoreStateFromSnapshot(content);
      localStorage.setItem('bubbleHistory', JSON.stringify(undoStack));
    } catch (err) {
      alert("Failed to import file. Not valid JSON?");
      console.error(err);
    }
  };
  reader.readAsText(file);
});



// When user clicks a bubble, make it the activeBubble
function makeBubbleActive(data) {
  if (activeBubble) activeBubble.el.classList.remove('active');
  activeBubble = data;
  data.el.classList.add('active');
  updateSidebar();
}


// Attach to all bubbles after creation
function enableBubbleInteractions(bubble, data) {
  bubble.addEventListener('click', () => {
    makeBubbleActive(data);
  });
}

// Type change buttons
controlPanel.querySelectorAll('[data-type]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!activeBubble) return alert("No bubble selected.");
    const newType = btn.getAttribute('data-type');
    activeBubble.type = newType;
    activeBubble.el.className = `bubble ${newType}`;
    saveSnapshot();
  });
});

// Lock/Unlock toggle
controlPanel.querySelector('#lockToggle').addEventListener('click', () => {
  if (!activeBubble) return alert("No bubble selected.");
  activeBubble.locked = !activeBubble.locked;
  activeBubble.el.classList.toggle('locked', activeBubble.locked);
  saveSnapshot();
});

// Delete
controlPanel.querySelector('#deleteBubble').addEventListener('click', () => {
  if (!activeBubble) return alert("No bubble selected.");
  document.body.removeChild(activeBubble.el);
  bubbles.splice(bubbles.indexOf(activeBubble), 1);
  for (let i = connections.length - 1; i >= 0; i--) {
    if (connections[i].from === activeBubble || connections[i].to === activeBubble) {
      connections.splice(i, 1);
    }
  }
  activeBubble = null;
  saveSnapshot();
  updateSidebar();
});

// Quick connect (to another selected bubble)
controlPanel.querySelector('#quickConnect').addEventListener('click', () => {
  if (!activeBubble) return alert("Select a source bubble.");

  const menu = document.createElement('select');
  menu.style.position = 'fixed';
  menu.style.top = '50%';
  menu.style.left = '50%';
  menu.style.transform = 'translate(-50%, -50%)';
  menu.style.zIndex = 9999;
  menu.style.fontSize = '16px';

  const placeholder = document.createElement('option');
  placeholder.textContent = 'Select target bubble...';
  placeholder.disabled = true;
  placeholder.selected = true;
  menu.appendChild(placeholder);

  bubbles.forEach((b, i) => {
    if (b === activeBubble) return;
    const exists = connections.some(c => c.from === activeBubble && c.to === b);
    if (exists) return;

    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `#${i}: ${b.el.innerText.slice(0, 30)}`;
    menu.appendChild(opt);
  });

  menu.addEventListener('change', () => {
    const target = bubbles[parseInt(menu.value)];
    if (target) {
      connections.push({ from: activeBubble, to: target, label: '' });
      saveSnapshot();
      document.body.removeChild(menu);
    }
  });

  document.body.appendChild(menu);
});


// Center view
controlPanel.querySelector('#centerView').addEventListener('click', () => {
  if (activeBubble) {
    camX = activeBubble.x - window.innerWidth / 2 / zoom;
    camY = activeBubble.y - window.innerHeight / 2 / zoom;
  } else {
    camX = camY = 0;
  }
});

// Export image
controlPanel.querySelector('#exportImageBtn').addEventListener('click', () => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  document.querySelectorAll('.bubble').forEach(bubble => {
    const rect = bubble.getBoundingClientRect();
    const style = getComputedStyle(bubble);

    ctx.fillStyle = style.backgroundColor || '#000';
    ctx.beginPath();
    ctx.ellipse(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      rect.width / 2,
      rect.height / 2,
      0, 0, 2 * Math.PI
    );
    ctx.fill();

    const text = bubble.querySelector('.bubble-text')?.textContent || '';
    ctx.fillStyle = style.color || '#fff';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      text,
      rect.left + rect.width / 2,
      rect.top + rect.height / 2 + 6
    );
  });

  const link = document.createElement('a');
  link.download = 'speechflow_map.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

// Add bubble at random position
controlPanel.querySelector('#addBubbleBtn').addEventListener('click', () => {
  const x = camX + Math.random() * (window.innerWidth - 300);
  const y = camY + Math.random() * (window.innerHeight - 200);
  const bubble = createBubble("New idea", x, y, 'idea');
  updateSidebar();
  saveSnapshot();
});

// Start from center with a single bubble
controlPanel.querySelector('#centerBubbleBtn').addEventListener('click', () => {
  const centerX = camX + window.innerWidth / 2 / zoom;
  const centerY = camY + window.innerHeight / 2 / zoom;
  const bubble = createBubble("Central Idea", centerX, centerY, 'idea');
  updateSidebar();
  saveSnapshot();
});




// Clear map with confirmation
controlPanel.querySelector('#clearMap').addEventListener('click', () => {
  if (confirm("Are you sure you want to clear the entire map?")) {
    document.querySelectorAll('.bubble').forEach(b => b.remove());
    bubbles.length = 0;
    connections.length = 0;
    activeBubble = null;
    saveSnapshot();
    updateSidebar();
  }
});

// Generate from prompt
controlPanel.querySelector('#generateFromPrompt').addEventListener('click', () => {
  const prompt = document.getElementById('promptInput').value.trim();
  if (!prompt) return alert("Type something first!");

  // Create center bubble
  const centerX = camX + window.innerWidth / 2 / zoom;
  const centerY = camY + window.innerHeight / 2 / zoom;

  const centerBubble = createBubble(prompt, centerX, centerY, 'idea');

  // Generate related ideas
  const related = [
    `Why is "${prompt}" important?`,
    `How does "${prompt}" affect others?`,
    `What comes after "${prompt}"?`,
    `Obstacles to "${prompt}"`,
    `Steps to achieve "${prompt}"`
  ];

  shuffleArray(related);
  const count = Math.floor(Math.random() * 3) + 3; // 3–5

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i;
    const radius = 220;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;

    const childBubble = createBubble(related[i], x, y, 'question');
    connections.push({ from: centerBubble, to: childBubble, label: '' });
  }

  updateSidebar();
  saveSnapshot();
});



function updateSidebar() {
  const list = document.getElementById('bubbleList');
  list.innerHTML = '';

  bubbles.forEach((b, i) => {
    const li = document.createElement('li');
    li.textContent = `#${i}: ${b.el.innerText.slice(0, 30)}`;
    if (b === activeBubble) li.classList.add('active');

    li.draggable = true;

    li.addEventListener('click', () => {
      makeBubbleActive(b);
      camX = b.x - window.innerWidth / 2 / zoom;
      camY = b.y - window.innerHeight / 2 / zoom;
    });

    li.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', i);
    });

    li.addEventListener('dragover', (e) => {
      e.preventDefault();
      li.style.borderTop = '2px solid #F24E1E';
    });

    li.addEventListener('dragleave', () => {
      li.style.borderTop = '';
    });

    li.addEventListener('drop', (e) => {
      e.preventDefault();
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
      const toIndex = i;
      const moving = bubbles.splice(fromIndex, 1)[0];
      bubbles.splice(toIndex, 0, moving);
      updateBubbleIds();
      updateSidebar();
      saveSnapshot();
    });

    list.appendChild(li);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const playBtn = document.getElementById('playBtn');
  if (playBtn) {
    playBtn.addEventListener('click', playBubblesInOrder);
  } else {
    console.warn("playBtn not found in DOM");
  }
});

document.getElementById('playStart').addEventListener('click', playBubblesInOrder);

document.getElementById('playPause').addEventListener('click', () => {
  playbackPaused = true;
});

document.getElementById('playResume').addEventListener('click', () => {
  if (!playbackActive || !playbackPaused) return;
  playbackPaused = false;
  playNextBubble();
});

document.getElementById('playStop').addEventListener('click', () => {
  playbackActive = false;
  playbackPaused = false;
  orderedPlayback = [];
  playbackIndex = 0;
});

function createBubble(text, x, y, type = 'idea') {
  const bubble = document.createElement('div');
  bubble.className = `bubble ${type}`;
  bubble.style.position = 'absolute';

  const textSpan = document.createElement('span');
  textSpan.className = 'bubble-text';
  textSpan.textContent = text;
  bubble.appendChild(textSpan);

  const data = {
    el: bubble,
    x,
    y,
    dragging: false,
    locked: false,
    visible: true,
    order: null,
    type,
    textEl: textSpan
  };

  const idLabel = document.createElement('div');
  idLabel.className = 'bubble-id-label';
  bubble.appendChild(idLabel);
  data.idLabel = idLabel;

    bubble.addEventListener('dblclick', () => {
    const input = prompt("Set playback order number or type 'edit' or 'delete':");
    if (input === 'delete') {
      document.body.removeChild(bubble);
      const index = bubbles.indexOf(data);
      if (index > -1) bubbles.splice(index, 1);
      for (let i = connections.length - 1; i >= 0; i--) {
        if (connections[i].from === data || connections[i].to === data) {
          connections.splice(i, 1);
        }
      }
      updateSidebar();
      return;
    } else if (input === 'edit') {
      const newText = prompt("New text:", data.textEl.textContent);
      if (newText) {
        data.textEl.textContent = newText.charAt(0).toUpperCase() + newText.slice(1);
      }
      updateSidebar();
      return;
    } else if (input === 'type') {
      const newType = prompt("Enter type: idea, task, question, blocker, note", data.type);
      const allowed = ['idea', 'task', 'question', 'blocker', 'note'];
      if (allowed.includes(newType)) {
        data.type = newType;
        bubble.className = `bubble ${newType}`;
        saveSnapshot();
      } else {
        alert("Invalid type");
      }
      return;
    } else {
      data.order = parseInt(input);
      bubble.classList.add('locked');
    }
    updateSidebar();
  });


  enableDragging(bubble, data);
  enableBubbleInteractions(bubble, data);

  document.body.appendChild(bubble);
  bubbles.push(data);
  return data;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}




