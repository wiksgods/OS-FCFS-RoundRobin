from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title="CPU Scheduling API")

# Enable CORS so frontend can communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ProcessInput(BaseModel):
    pid: int
    arrivalTime: int
    burstTime: int

class SimulationRequest(BaseModel):
    processes: List[ProcessInput]
    quantum: int

# Re-implementing the scheduling logic in Python to process on backend
class Process:
    def __init__(self, pid, arrival_time, burst_time):
        self.pid = pid
        self.arrival_time = arrival_time
        self.burst_time = burst_time
        self.remaining_time = burst_time
        self.completion_time = 0
        self.turnaround_time = 0
        self.waiting_time = 0

def run_fcfs_simulation(proc_list: List[ProcessInput]):
    list_proc = [Process(p.pid, p.arrivalTime, p.burstTime) for p in proc_list]
    # Sort by Arrival Time, then PID
    list_proc.sort(key=lambda p: (p.arrival_time, p.pid))
    
    snapshots = []
    t = 0
    index = 0
    ready_queue = []
    current_process = None
    completed = 0
    n = len(list_proc)
    gantt_history = []
    logs = [f"[t=0] Hệ thống khởi động điều phối FCFS."]

    completed_map = {}

    while completed < n or current_process:
        # 1. New arrivals
        while index < n and list_proc[index].arrival_time == t:
            ready_queue.append(list_proc[index])
            logs.append(f'<div class="log-entry"><strong class="time">[t={t}]</strong> <span class="success">Tiến trình P{list_proc[index].pid} đến</span> và xếp vào Ready Queue.</div>')
            index += 1

        # 2. CPU allocation
        if not current_process and ready_queue:
            current_process = ready_queue.pop(0)
            logs.append(f'<div class="log-entry"><strong class="time">[t={t}]</strong> CPU nạp <span class="info">P{current_process.pid}</span> và bắt đầu thực thi.</div>')

        # 3. Record snapshot before execution tick
        current_gantt = []
        for g in gantt_history:
            current_gantt.append(g.copy())

        if current_process:
            start = t - (current_process.burst_time - current_process.remaining_time)
            current_gantt.append({
                "pid": current_process.pid,
                "start": start,
                "end": t + 1,
                "isIdle": False
            })
        elif index < n:
            # CPU is idle
            if current_gantt and current_gantt[-1]["isIdle"]:
                current_gantt[-1]["end"] = t + 1
            else:
                current_gantt.append({
                    "pid": "IDLE",
                    "start": t,
                    "end": t + 1,
                    "isIdle": True
                })

        snapshots.append({
            "time": t,
            "queue": [{"pid": p.pid, "arrivalTime": p.arrival_time, "burstTime": p.burst_time, "remainingTime": p.remaining_time} for p in ready_queue],
            "cpu": {
                "pid": current_process.pid,
                "arrivalTime": current_process.arrival_time,
                "burstTime": current_process.burst_time,
                "remainingTime": current_process.remaining_time
            } if current_process else None,
            "logs": list(logs),
            "gantt": current_gantt
        })

        # 4. Execution tick
        if current_process:
            current_process.remaining_time -= 1
            if current_process.remaining_time == 0:
                logs.append(f'<div class="log-entry"><strong class="time">[t={t+1}]</strong> <span class="danger">P{current_process.pid} thực thi xong</span> và giải phóng CPU.</div>')
                
                current_process.completion_time = t + 1
                current_process.turnaround_time = current_process.completion_time - current_process.arrival_time
                current_process.waiting_time = current_process.turnaround_time - current_process.burst_time
                
                completed_map[current_process.pid] = current_process
                
                gantt_history.append({
                    "pid": current_process.pid,
                    "start": t + 1 - current_process.burst_time,
                    "end": t + 1,
                    "isIdle": False
                })

                completed += 1
                current_process = None
        else:
            # Idle CPU record tick in gantt history
            if gantt_history and gantt_history[-1]["pid"] == "IDLE":
                gantt_history[-1]["end"] = t + 1
            else:
                gantt_history.append({
                    "pid": "IDLE",
                    "start": t,
                    "end": t + 1,
                    "isIdle": True
                })

        t += 1

    # Final static snapshot
    logs.append(f'<div class="log-entry"><strong class="time">[t={t}]</strong> <span class="success">Hoàn thành toàn bộ mô phỏng FCFS.</span></div>')
    snapshots.append({
        "time": t,
        "queue": [],
        "cpu": None,
        "logs": list(logs),
        "gantt": gantt_history
    })

    # Reconstruct sorted results
    results = []
    for orig in proc_list:
        p = completed_map[orig.pid]
        results.append({
            "pid": p.pid,
            "arrivalTime": p.arrival_time,
            "burstTime": p.burst_time,
            "completionTime": p.completion_time,
            "turnaroundTime": p.turnaround_time,
            "waitingTime": p.waiting_time
        })

    return results, snapshots

def run_rr_simulation(proc_list: List[ProcessInput], q: int):
    list_proc = [Process(p.pid, p.arrivalTime, p.burstTime) for p in proc_list]
    # Sort by Arrival Time, then PID
    list_proc.sort(key=lambda p: (p.arrival_time, p.pid))

    snapshots = []
    t = 0
    index = 0
    ready_queue = []
    current_process = None
    current_quantum_left = 0
    completed = 0
    n = len(list_proc)
    gantt_history = []
    logs = [f"[t=0] Hệ thống khởi động điều phối Round Robin (q = {q})."]

    completed_map = {}
    current_burst_start = 0

    while completed < n or current_process:
        # 1. Check arrivals at time t
        while index < n and list_proc[index].arrival_time == t:
            ready_queue.append(list_proc[index])
            logs.append(f'<div class="log-entry"><strong class="time">[t={t}]</strong> <span class="success">Tiến trình P{list_proc[index].pid} đến</span> và xếp vào Ready Queue.</div>')
            index += 1

        # 2. CPU allocation
        if not current_process and ready_queue:
            current_process = ready_queue.pop(0)
            current_quantum_left = q
            current_burst_start = t
            logs.append(f'<div class="log-entry"><strong class="time">[t={t}]</strong> CPU nạp <span class="info">P{current_process.pid}</span> với lượng tử q = {q}.</div>')

        # 3. Record snapshot before execution tick
        current_gantt = []
        for g in gantt_history:
            current_gantt.append(g.copy())

        if current_process:
            current_gantt.append({
                "pid": current_process.pid,
                "start": current_burst_start,
                "end": t + 1,
                "isIdle": False
            })
        elif index < n:
            # CPU is idle
            if current_gantt and current_gantt[-1]["isIdle"]:
                current_gantt[-1]["end"] = t + 1
            else:
                current_gantt.append({
                    "pid": "IDLE",
                    "start": t,
                    "end": t + 1,
                    "isIdle": True
                })

        snapshots.append({
            "time": t,
            "queue": [{"pid": p.pid, "arrivalTime": p.arrival_time, "burstTime": p.burst_time, "remainingTime": p.remaining_time} for p in ready_queue],
            "cpu": {
                "pid": current_process.pid,
                "arrivalTime": current_process.arrival_time,
                "burstTime": current_process.burst_time,
                "remainingTime": current_process.remaining_time,
                "quantumLeft": current_quantum_left
            } if current_process else None,
            "logs": list(logs),
            "gantt": current_gantt
        })

        # 4. Execution tick
        if current_process:
            current_process.remaining_time -= 1
            current_quantum_left -= 1

            if current_process.remaining_time == 0:
                logs.append(f'<div class="log-entry"><strong class="time">[t={t+1}]</strong> <span class="danger">P{current_process.pid} thực thi xong</span> và giải phóng CPU.</div>')
                
                current_process.completion_time = t + 1
                current_process.turnaround_time = current_process.completion_time - current_process.arrival_time
                current_process.waiting_time = current_process.turnaround_time - current_process.burst_time
                
                completed_map[current_process.pid] = current_process
                
                gantt_history.append({
                    "pid": current_process.pid,
                    "start": current_burst_start,
                    "end": t + 1,
                    "isIdle": False
                })

                completed += 1
                current_process = None
            elif current_quantum_left == 0:
                logs.append(f'<div class="log-entry"><strong class="time">[t={t+1}]</strong> Hết lượng tử q cho P{current_process.pid}. Tiến trình bị tạm dừng.</div>')
                
                gantt_history.append({
                    "pid": current_process.pid,
                    "start": current_burst_start,
                    "end": t + 1,
                    "isIdle": False
                })

                # Arrivals at time t+1 must enter queue BEFORE the preempted process
                while index < n and list_proc[index].arrival_time == t + 1:
                    ready_queue.append(list_proc[index])
                    logs.append(f'<div class="log-entry"><strong class="time">[t={t+1}]</strong> <span class="success">Tiến trình P{list_proc[index].pid} đến</span> và xếp vào Ready Queue.</div>')
                    index += 1

                ready_queue.append(current_process)
                current_process = None
        else:
            # CPU idle tick record
            if gantt_history and gantt_history[-1]["pid"] == "IDLE":
                gantt_history[-1]["end"] = t + 1
            else:
                gantt_history.append({
                    "pid": "IDLE",
                    "start": t,
                    "end": t + 1,
                    "isIdle": True
                })

        t += 1

    # Final snapshot
    logs.append(f'<div class="log-entry"><strong class="time">[t={t}]</strong> <span class="success">Hoàn thành toàn bộ mô phỏng Round Robin.</span></div>')
    snapshots.append({
        "time": t,
        "queue": [],
        "cpu": None,
        "logs": list(logs),
        "gantt": gantt_history
    })

    results = []
    for orig in proc_list:
        p = completed_map[orig.pid]
        results.append({
            "pid": p.pid,
            "arrivalTime": p.arrival_time,
            "burstTime": p.burst_time,
            "completionTime": p.completion_time,
            "turnaroundTime": p.turnaround_time,
            "waitingTime": p.waiting_time
        })

    return results, snapshots

# Sửa từ "/" thành "/api"
@app.get("/api")
def read_root():
    return {"status": "active", "message": "CPU Scheduling API is running"}

# Sửa từ "/simulate" thành "/api/simulate"
@app.post("/api/simulate")
def simulate(req: SimulationRequest):
    fcfs_results, fcfs_snapshots = run_fcfs_simulation(req.processes)
    rr_results, rr_snapshots = run_rr_simulation(req.processes, req.quantum)
    
    return {
        "fcfs": {
            "results": fcfs_results,
            "snapshots": fcfs_snapshots
        },
        "rr": {
            "results": rr_results,
            "snapshots": rr_snapshots
        }
    }


if __name__ == "__main__":
    import uvicorn
    # Chọn một cổng ngẫu nhiên không trùng hệ thống (ví dụ: 8080, 8888, 9000)
    uvicorn.run(app, host="127.0.0.1", port=9000)