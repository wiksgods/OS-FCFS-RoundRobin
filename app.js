// Cấu hình API Endpoint (Thay đổi ở đây để chuyển đổi giữa Local và Production)
const API_BASE_URL = 'http://127.0.0.1:8000/api'; // Localhost
// const API_BASE_URL = 'https://os.wexecute.com/api'; // Production (cPanel)

// State Management
let processes = [];
let nextPid = 1;

const processGradients = [
  'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)', // Neon Cyan
  'linear-gradient(135deg, #00ff87 0%, #60efff 100%)', // Bright Emerald/Teal
  'linear-gradient(135deg, #ff9a00 0%, #ff5100 100%)', // Neon Orange
  'linear-gradient(135deg, #f355da 0%, #7000ff 100%)', // Neon Lilac/Violet
  'linear-gradient(135deg, #ff0844 0%, #ffb199 100%)', // Neon Coral/Pink
  'linear-gradient(135deg, #ffea00 0%, #ffaa00 100%)', // Neon Gold/Yellow
  'linear-gradient(135deg, #38bdf8 0%, #3b82f6 100%)', // Vivid Blue
  'linear-gradient(135deg, #f472b6 0%, #ec4899 100%)', // Neon Hot Pink
];

// Simulation States
let simState = {
  fcfs: { snapshots: [], step: 0, timer: null, speed: 1000 },
  rr: { snapshots: [], step: 0, timer: null, speed: 1000 }
};

// Helper to get color for a process
function getProcessColor(pid) {
  const index = (pid - 1) % processGradients.length;
  return processGradients[index];
}

// Default Data Loading
function loadDefaultDemo() {
  processes = [
    { pid: 1, arrivalTime: 1, burstTime: 4 },
    { pid: 2, arrivalTime: 0, burstTime: 3 },
    { pid: 3, arrivalTime: 3, burstTime: 5 }
  ];
  nextPid = 4;
  document.getElementById('quantum-input').value = 2;
  renderProcessTable();
  runSimulation();
}

// Render Input Process Table
function renderProcessTable() {
  const tbody = document.getElementById('process-list-tbody');
  tbody.innerHTML = '';
  
  processes.forEach((p) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>P${p.pid}</strong></td>
      <td>${p.arrivalTime}</td>
      <td>${p.burstTime}</td>
      <td>
        <button type="button" class="btn btn-danger" onclick="deleteProcess(${p.pid})">
          Xóa
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Add New Process
function addProcess() {
  const atInput = document.getElementById('add-arrival-time');
  const btInput = document.getElementById('add-burst-time');
  
  const at = parseInt(atInput.value, 10);
  const bt = parseInt(btInput.value, 10);
  
  if (isNaN(at) || at < 0) {
    alert('Thời điểm đến (Arrival Time) phải là số không âm.');
    return;
  }
  if (isNaN(bt) || bt <= 0) {
    alert('Thời gian chạy (Burst Time) phải là số nguyên dương.');
    return;
  }
  
  processes.push({
    pid: nextPid++,
    arrivalTime: at,
    burstTime: bt
  });
  
  atInput.value = 0;
  btInput.value = 5;
  
  renderProcessTable();
}

// Delete Process
window.deleteProcess = function(pid) {
  processes = processes.filter(p => p.pid !== pid);
  renderProcessTable();
};

// Toggle Tabs
function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const contents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      contents.forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const contentId = tab.getAttribute('aria-controls');
      document.getElementById(contentId).classList.add('active');
      
      // Pause simulation on tab change
      pauseSimulation('fcfs');
      pauseSimulation('rr');
    });
  });
}

// ============================================================================
// SIMULATION ENGINE & SNAPSHOT GENERATORS
// ============================================================================

// Generate snapshots second-by-second for FCFS
function generateFCFSSnapshots(procList) {
  let list = procList.map(p => ({ ...p, remainingTime: p.burstTime }));
  // Sort by Arrival Time, then PID
  list.sort((a, b) => {
    if (a.arrivalTime !== b.arrivalTime) {
      return a.arrivalTime - b.arrivalTime;
    }
    return a.pid - b.pid;
  });
  
  let snapshots = [];
  let t = 0;
  let index = 0;
  let readyQueue = [];
  let currentProcess = null;
  let completed = 0;
  const n = list.length;
  let ganttHistory = [];
  let logs = [`[t=0] Hệ thống khởi động điều phối FCFS.`];

  // Map to hold original process parameters to compute metrics later
  let completedMap = {};

  while (completed < n || currentProcess) {
    // 1. New arrivals
    while (index < n && list[index].arrivalTime === t) {
      readyQueue.push({ ...list[index] });
      logs.push(`<div class="log-entry"><strong class="time">[t=${t}]</strong> <span class="success">Tiến trình P${list[index].pid} đến</span> và xếp vào Ready Queue.</div>`);
      index++;
    }

    // 2. CPU allocation
    if (!currentProcess && readyQueue.length > 0) {
      currentProcess = readyQueue.shift();
      logs.push(`<div class="log-entry"><strong class="time">[t=${t}]</strong> CPU nạp <span class="info">P${currentProcess.pid}</span> và bắt đầu thực thi.</div>`);
    }

    // 3. Record snapshot before execution tick
    let currentGantt = [];
    // Reconstruct gantt chart up to time t + 1
    ganttHistory.forEach(g => {
      currentGantt.push({ ...g });
    });

    if (currentProcess) {
      const start = t - (currentProcess.burstTime - currentProcess.remainingTime);
      currentGantt.push({
        pid: currentProcess.pid,
        start: start,
        end: t + 1,
        isIdle: false
      });
    } else if (index < n) {
      // CPU is idle
      if (currentGantt.length > 0 && currentGantt[currentGantt.length - 1].isIdle) {
        currentGantt[currentGantt.length - 1].end = t + 1;
      } else {
        currentGantt.push({
          pid: 'IDLE',
          start: t,
          end: t + 1,
          isIdle: true
        });
      }
    }

    snapshots.push({
      time: t,
      queue: readyQueue.map(p => ({ ...p })),
      cpu: currentProcess ? { ...currentProcess } : null,
      logs: [...logs],
      gantt: currentGantt
    });

    // 4. Execution tick
    if (currentProcess) {
      currentProcess.remainingTime--;
      if (currentProcess.remainingTime === 0) {
        logs.push(`<div class="log-entry"><strong class="time">[t=${t+1}]</strong> <span class="danger">P${currentProcess.pid} thực thi xong</span> và giải phóng CPU.</div>`);
        
        currentProcess.completionTime = t + 1;
        currentProcess.turnaroundTime = currentProcess.completionTime - currentProcess.arrivalTime;
        currentProcess.waitingTime = currentProcess.turnaroundTime - currentProcess.burstTime;
        
        completedMap[currentProcess.pid] = { ...currentProcess };
        
        ganttHistory.push({
          pid: currentProcess.pid,
          start: t + 1 - currentProcess.burstTime,
          end: t + 1,
          isIdle: false
        });

        completed++;
        currentProcess = null;
      }
    } else {
      // Idle CPU record tick in gantt history
      if (ganttHistory.length > 0 && ganttHistory[ganttHistory.length - 1].pid === 'IDLE') {
        ganttHistory[ganttHistory.length - 1].end = t + 1;
      } else {
        ganttHistory.push({
          pid: 'IDLE',
          start: t,
          end: t + 1,
          isIdle: true
        });
      }
    }

    t++;
  }

  // Final static snapshot
  logs.push(`<div class="log-entry"><strong class="time">[t=${t}]</strong> <span class="success">Hoàn thành toàn bộ mô phỏng FCFS.</span></div>`);
  snapshots.push({
    time: t,
    queue: [],
    cpu: null,
    logs: [...logs],
    gantt: ganttHistory
  });

  // Reconstruct sorted results
  const results = procList.map(orig => completedMap[orig.pid]);

  return { results, snapshots };
}

// Generate snapshots second-by-second for Round Robin
function generateRRSnapshots(procList, q) {
  let list = procList.map(p => ({ ...p, remainingTime: p.burstTime }));
  // Sort by Arrival Time, then PID
  list.sort((a, b) => {
    if (a.arrivalTime !== b.arrivalTime) {
      return a.arrivalTime - b.arrivalTime;
    }
    return a.pid - b.pid;
  });

  let snapshots = [];
  let t = 0;
  let index = 0;
  let readyQueue = [];
  let currentProcess = null;
  let currentQuantumLeft = 0;
  let completed = 0;
  const n = list.length;
  let ganttHistory = [];
  let logs = [`[t=0] Hệ thống khởi động điều phối Round Robin (q = ${q}).`];

  let completedMap = {};
  
  // Track start times of current burst in gantt
  let currentBurstStart = 0;

  while (completed < n || currentProcess) {
    // 1. Check arrivals at time t
    while (index < n && list[index].arrivalTime === t) {
      readyQueue.push({ ...list[index] });
      logs.push(`<div class="log-entry"><strong class="time">[t=${t}]</strong> <span class="success">Tiến trình P${list[index].pid} đến</span> và xếp vào Ready Queue.</div>`);
      index++;
    }

    // 2. CPU allocation
    if (!currentProcess && readyQueue.length > 0) {
      currentProcess = readyQueue.shift();
      currentQuantumLeft = q;
      currentBurstStart = t;
      logs.push(`<div class="log-entry"><strong class="time">[t=${t}]</strong> CPU nạp <span class="info">P${currentProcess.pid}</span> với lượng tử q = ${q}.</div>`);
    }

    // 3. Record snapshot before execution tick
    let currentGantt = [];
    ganttHistory.forEach(g => {
      currentGantt.push({ ...g });
    });

    if (currentProcess) {
      currentGantt.push({
        pid: currentProcess.pid,
        start: currentBurstStart,
        end: t + 1,
        isIdle: false
      });
    } else if (index < n) {
      // CPU is idle
      if (currentGantt.length > 0 && currentGantt[currentGantt.length - 1].isIdle) {
        currentGantt[currentGantt.length - 1].end = t + 1;
      } else {
        currentGantt.push({
          pid: 'IDLE',
          start: t,
          end: t + 1,
          isIdle: true
        });
      }
    }

    snapshots.push({
      time: t,
      queue: readyQueue.map(p => ({ ...p })),
      cpu: currentProcess ? { ...currentProcess, quantumLeft: currentQuantumLeft } : null,
      logs: [...logs],
      gantt: currentGantt
    });

    // 4. Execution tick
    if (currentProcess) {
      currentProcess.remainingTime--;
      currentQuantumLeft--;

      if (currentProcess.remainingTime === 0) {
        logs.push(`<div class="log-entry"><strong class="time">[t=${t+1}]</strong> <span class="danger">P${currentProcess.pid} thực thi xong</span> và giải phóng CPU.</div>`);
        
        currentProcess.completionTime = t + 1;
        currentProcess.turnaroundTime = currentProcess.completionTime - currentProcess.arrivalTime;
        currentProcess.waitingTime = currentProcess.turnaroundTime - currentProcess.burstTime;
        
        completedMap[currentProcess.pid] = { ...currentProcess };
        
        ganttHistory.push({
          pid: currentProcess.pid,
          start: currentBurstStart,
          end: t + 1,
          isIdle: false
        });

        completed++;
        currentProcess = null;
      } else if (currentQuantumLeft === 0) {
        logs.push(`<div class="log-entry"><strong class="time">[t=${t+1}]</strong> Hết lượng tử q cho P${currentProcess.pid}. Tiến trình bị tạm dừng.</div>`);
        
        ganttHistory.push({
          pid: currentProcess.pid,
          start: currentBurstStart,
          end: t + 1,
          isIdle: false
        });

        // Arrivals at time t+1 must enter queue BEFORE the preempted process
        while (index < n && list[index].arrivalTime === t + 1) {
          readyQueue.push({ ...list[index] });
          logs.push(`<div class="log-entry"><strong class="time">[t=${t+1}]</strong> <span class="success">Tiến trình P${list[index].pid} đến</span> và xếp vào Ready Queue.</div>`);
          index++;
        }

        readyQueue.push({ ...currentProcess });
        currentProcess = null;
      }
    } else {
      // CPU idle tick record
      if (ganttHistory.length > 0 && ganttHistory[ganttHistory.length - 1].pid === 'IDLE') {
        ganttHistory[ganttHistory.length - 1].end = t + 1;
      } else {
        ganttHistory.push({
          pid: 'IDLE',
          start: t,
          end: t + 1,
          isIdle: true
        });
      }
    }

    t++;
  }

  // Final snapshot
  logs.push(`<div class="log-entry"><strong class="time">[t=${t}]</strong> <span class="success">Hoàn thành toàn bộ mô phỏng Round Robin.</span></div>`);
  snapshots.push({
    time: t,
    queue: [],
    cpu: null,
    logs: [...logs],
    gantt: ganttHistory
  });

  const results = procList.map(orig => completedMap[orig.pid]);

  return { results, snapshots };
}

// ============================================================================
// GANTT & UI RENDERERS
// ============================================================================

// Render Gantt Chart Visuals
function renderGantt(chartId, timelineId, ganttData, fullTimeSpan) {
  const chartDiv = document.getElementById(chartId);
  const timelineDiv = document.getElementById(timelineId);
  
  chartDiv.innerHTML = '';
  timelineDiv.innerHTML = '';
  
  if (ganttData.length === 0) return;
  
  // Use either the local maximum or the overall full time span to align comparative charts
  const totalDuration = fullTimeSpan || ganttData[ganttData.length - 1].end;
  
  ganttData.forEach((block) => {
    const duration = block.end - block.start;
    if (duration <= 0) return;
    
    const widthPercent = (duration / totalDuration) * 100;
    
    const blockEl = document.createElement('div');
    blockEl.className = 'gantt-block' + (block.isIdle ? ' idle' : '');
    blockEl.style.width = `${widthPercent}%`;
    
    if (block.isIdle) {
      blockEl.innerHTML = `IDLE`;
    } else {
      blockEl.innerHTML = `P${block.pid}`;
      blockEl.style.background = getProcessColor(block.pid);
    }
    
    // Tooltip
    const tooltip = document.createElement('span');
    tooltip.className = 'tooltip';
    tooltip.innerHTML = `
      <strong>${block.isIdle ? 'Trạng thái Rảnh (IDLE)' : 'Tiến trình P' + block.pid}</strong><br>
      Bắt đầu: ${block.start}<br>
      Kết thúc: ${block.end}<br>
      Thời lượng: ${duration}
    `;
    blockEl.appendChild(tooltip);
    chartDiv.appendChild(blockEl);
  });
  
  // Render Timeline Ticks
  let ticks = [0];
  ganttData.forEach(block => {
    ticks.push(block.end);
  });
  ticks = [...new Set(ticks)].sort((a, b) => a - b);
  
  ticks.forEach(tick => {
    const leftPercent = (tick / totalDuration) * 100;
    
    const tickEl = document.createElement('div');
    tickEl.className = 'gantt-tick';
    tickEl.style.left = `${leftPercent}%`;
    tickEl.innerHTML = `<span>${tick}</span>`;
    
    timelineDiv.appendChild(tickEl);
  });
}

// Render Results Table
function renderResultsTable(tableId, results) {
  const tbody = document.getElementById(tableId);
  tbody.innerHTML = '';
  
  results.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>P${p.pid}</strong></td>
      <td>${p.arrivalTime}</td>
      <td>${p.burstTime}</td>
      <td>${p.completionTime !== undefined ? p.completionTime : '-'}</td>
      <td>${p.turnaroundTime !== undefined ? p.turnaroundTime : '-'}</td>
      <td>${p.waitingTime !== undefined ? p.waitingTime : '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Render Simulation Step
function renderSimStep(algo) {
  const state = simState[algo];
  const snapshot = state.snapshots[state.step];
  if (!snapshot) return;

  // 1. Time Badge
  document.getElementById(`${algo}-sim-time`).innerText = snapshot.time;

  // 2. Ready Queue
  const queueContainer = document.getElementById(`${algo}-sim-queue`);
  queueContainer.innerHTML = '';
  if (snapshot.queue.length === 0) {
    queueContainer.innerHTML = '<span class="queue-empty-text">Hàng đợi rỗng</span>';
  } else {
    snapshot.queue.forEach(p => {
      const qItem = document.createElement('div');
      qItem.className = 'queue-item';
      qItem.style.background = getProcessColor(p.pid);
      qItem.innerHTML = `P${p.pid}<span class="queue-item-bt">${p.remainingTime}s</span>`;
      queueContainer.appendChild(qItem);
    });
  }

  // 3. CPU Status
  const cpuBox = document.getElementById(`${algo}-sim-cpu`);
  const cpuCard = document.getElementById(`${algo}-sim-cpu-card`);
  
  if (snapshot.cpu) {
    cpuBox.className = 'cpu-box busy';
    cpuCard.className = 'cpu-visualizer-card busy';
    cpuBox.style.background = getProcessColor(snapshot.cpu.pid);
    
    let quantumStr = snapshot.cpu.quantumLeft !== undefined ? ` | q: ${snapshot.cpu.quantumLeft}` : '';
    cpuBox.innerHTML = `P${snapshot.cpu.pid}<span class="cpu-box-rt">BT còn lại: ${snapshot.cpu.remainingTime}s${quantumStr}</span>`;
  } else {
    cpuBox.className = 'cpu-box';
    cpuCard.className = 'cpu-visualizer-card';
    cpuBox.style.background = 'transparent';
    cpuBox.innerHTML = 'Rảnh (IDLE)';
  }

  // 4. System Log
  const logBox = document.getElementById(`${algo}-sim-log`);
  logBox.innerHTML = snapshot.logs.join('');
  logBox.scrollTop = logBox.scrollHeight;

  // 5. Dynamic Gantt Chart (Proportional to final total simulation duration)
  const totalSimDuration = state.snapshots[state.snapshots.length - 1].time;
  renderGantt(`${algo}-gantt-chart`, `${algo}-gantt-timeline`, snapshot.gantt, totalSimDuration);

  // 6. Update Button States
  document.getElementById(`btn-${algo}-sim-prev`).disabled = (state.step === 0);
  document.getElementById(`btn-${algo}-sim-next`).disabled = (state.step === state.snapshots.length - 1);
  
  const playBtn = document.getElementById(`btn-${algo}-sim-play`);
  if (state.timer) {
    playBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
    playBtn.classList.add('active-play');
  } else {
    playBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
    playBtn.classList.remove('active-play');
  }
}

// ============================================================================
// SIMULATION PLAY CONTROLS
// ============================================================================

function stepNext(algo) {
  const state = simState[algo];
  if (state.step < state.snapshots.length - 1) {
    state.step++;
    renderSimStep(algo);
  } else {
    pauseSimulation(algo);
  }
}

function stepPrev(algo) {
  const state = simState[algo];
  if (state.step > 0) {
    state.step--;
    renderSimStep(algo);
  }
}

function resetSimulation(algo) {
  pauseSimulation(algo);
  simState[algo].step = 0;
  renderSimStep(algo);
}

function pauseSimulation(algo) {
  const state = simState[algo];
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
  renderSimStep(algo);
}

function playSimulation(algo) {
  const state = simState[algo];
  if (state.timer) {
    pauseSimulation(algo);
  } else {
    // If we are at the end, start over
    if (state.step === state.snapshots.length - 1) {
      state.step = 0;
    }
    state.timer = setInterval(() => {
      stepNext(algo);
    }, state.speed);
    renderSimStep(algo);
  }
}

function changeSpeed(algo, newSpeed) {
  simState[algo].speed = parseInt(newSpeed, 10);
  if (simState[algo].timer) {
    pauseSimulation(algo);
    playSimulation(algo);
  }
}

// ============================================================================
// MAIN SIMULATION WORKFLOW
// ============================================================================

async function runSimulation() {
  if (processes.length === 0) {
    alert('Vui lòng thêm ít nhất một tiến trình.');
    return;
  }
  
  const qInput = document.getElementById('quantum-input');
  const q = parseInt(qInput.value, 10);
  if (isNaN(q) || q <= 0) {
    alert('Vui lòng nhập thời lượng tử q hợp lệ cho Round Robin (q > 0).');
    return;
  }
  
  document.getElementById('rr-title-text').innerText = `Kết quả điều phối Round Robin (q = ${q})`;
  
  // Stop any running visualizer timers
  pauseSimulation('fcfs');
  pauseSimulation('rr');

  try {
    // Call FastAPI backend to run the simulation
    const response = await fetch(`${API_BASE_URL}/simulate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        processes: processes,
        quantum: q
      })
    });

    if (!response.ok) {
      throw new Error('Không thể kết nối tới backend FastAPI.');
    }

    const data = await response.json();

    // 1. Process FCFS simulation
    const fcfsOut = data.fcfs;
    simState.fcfs.snapshots = fcfsOut.snapshots;
    simState.fcfs.step = 0;
    
    const fcfsN = fcfsOut.results.length;
    const fcfsAWT = fcfsOut.results.reduce((sum, p) => sum + p.waitingTime, 0) / fcfsN;
    const fcfsATAT = fcfsOut.results.reduce((sum, p) => sum + p.turnaroundTime, 0) / fcfsN;
    
    document.getElementById('fcfs-awt').innerText = fcfsAWT.toFixed(2);
    document.getElementById('fcfs-atat').innerText = fcfsATAT.toFixed(2);
    renderResultsTable('fcfs-results-tbody', fcfsOut.results);
    renderSimStep('fcfs');
    
    // 2. Process Round Robin simulation
    const rrOut = data.rr;
    simState.rr.snapshots = rrOut.snapshots;
    simState.rr.step = 0;
    
    const rrN = rrOut.results.length;
    const rrAWT = rrOut.results.reduce((sum, p) => sum + p.waitingTime, 0) / rrN;
    const rrATAT = rrOut.results.reduce((sum, p) => sum + p.turnaroundTime, 0) / rrN;
    
    document.getElementById('rr-awt').innerText = rrAWT.toFixed(2);
    document.getElementById('rr-atat').innerText = rrATAT.toFixed(2);
    renderResultsTable('rr-results-tbody', rrOut.results);
    renderSimStep('rr');
    
    // 3. Compare Results
    document.getElementById('compare-fcfs-awt').innerText = fcfsAWT.toFixed(2);
    document.getElementById('compare-rr-awt').innerText = rrAWT.toFixed(2);
    document.getElementById('compare-fcfs-atat').innerText = fcfsATAT.toFixed(2);
    document.getElementById('compare-rr-atat').innerText = rrATAT.toFixed(2);
    
    // Determine winner on AWT
    if (fcfsAWT < rrAWT) {
      document.getElementById('compare-winner-awt').innerHTML = '<span style="color: var(--success); font-weight: 600;">FCFS</span>';
    } else if (rrAWT < fcfsAWT) {
      document.getElementById('compare-winner-awt').innerHTML = '<span style="color: var(--success); font-weight: 600;">Round Robin</span>';
    } else {
      document.getElementById('compare-winner-awt').innerText = 'Bằng nhau';
    }
    
    // Determine winner on ATAT
    if (fcfsATAT < rrATAT) {
      document.getElementById('compare-winner-atat').innerHTML = '<span style="color: var(--success); font-weight: 600;">FCFS</span>';
    } else if (rrATAT < fcfsATAT) {
      document.getElementById('compare-winner-atat').innerHTML = '<span style="color: var(--success); font-weight: 600;">Round Robin</span>';
    } else {
      document.getElementById('compare-winner-atat').innerText = 'Bằng nhau';
    }
    
    // Performance summary badge
    let summaryText = '';
    if (fcfsAWT === rrAWT && fcfsATAT === rrATAT) {
      summaryText = 'Hai thuật toán có hiệu năng tương đồng trên bộ dữ liệu này.';
    } else {
      const winner = fcfsAWT <= rrAWT ? 'FCFS' : 'Round Robin';
      const diff = Math.abs(fcfsAWT - rrAWT).toFixed(2);
      summaryText = `Thuật toán <strong>${winner}</strong> có thời gian chờ tối ưu hơn (ít hơn ${diff} đơn vị thời gian).`;
    }
    document.getElementById('winner-text').innerHTML = summaryText;
  } catch (error) {
    console.error(error);
    alert('Đã xảy ra lỗi khi kết nối tới FastAPI backend: ' + error.message);
  }
}

// ============================================================================
// ATTACH EVENT LISTENERS
// ============================================================================

// Base Panel Controls
document.getElementById('btn-add-process').addEventListener('click', addProcess);
document.getElementById('btn-run-simulation').addEventListener('click', runSimulation);
document.getElementById('btn-reset-demo').addEventListener('click', loadDefaultDemo);

// FCFS Simulator Control Panel
document.getElementById('btn-fcfs-sim-reset').addEventListener('click', () => resetSimulation('fcfs'));
document.getElementById('btn-fcfs-sim-prev').addEventListener('click', () => stepPrev('fcfs'));
document.getElementById('btn-fcfs-sim-play').addEventListener('click', () => playSimulation('fcfs'));
document.getElementById('btn-fcfs-sim-next').addEventListener('click', () => stepNext('fcfs'));
document.getElementById('fcfs-sim-speed').addEventListener('change', (e) => changeSpeed('fcfs', e.target.value));

// RR Simulator Control Panel
document.getElementById('btn-rr-sim-reset').addEventListener('click', () => resetSimulation('rr'));
document.getElementById('btn-rr-sim-prev').addEventListener('click', () => stepPrev('rr'));
document.getElementById('btn-rr-sim-play').addEventListener('click', () => playSimulation('rr'));
document.getElementById('btn-rr-sim-next').addEventListener('click', () => stepNext('rr'));
document.getElementById('rr-sim-speed').addEventListener('change', (e) => changeSpeed('rr', e.target.value));

// Initial Setup
window.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  loadDefaultDemo();
});
