# TÀI LIỆU GIỚI THIỆU SẢN PHẨM: MÔ PHỎNG ĐIỀU PHỐI CPU (FCFS & ROUND ROBIN)

Ứng dụng sử dụng kiến trúc **Decoupled (Tách biệt Frontend và Backend)**:
*   **Frontend**: HTML5, CSS3 (giao diện hiện đại, responsive) và JavaScript thuần (xử lý hiệu ứng, điều khiển mô phỏng).
*   **Backend**: FastAPI (Python) - một framework hiệu năng cao, chịu trách nhiệm tính toán thuật toán và sinh dữ liệu mô phỏng.

---

##run local
chạy run bat ở fordel api để chạy server unicorn 
mở index.hmtl 

## 1. Quy Trình Hoạt Động Toàn Hệ Thống (Workflow)

Quy trình từ lúc người dùng nhập liệu cho đến khi hiển thị kết quả diễn ra qua 5 bước:

1. **Nhập liệu**: Người dùng nhập danh sách các tiến trình (gồm PID, thời điểm đến - Arrival Time, thời gian chạy - Burst Time) và thời lượng tử $q$ của thuật toán Round Robin trên giao diện Frontend.
2. **Gửi yêu cầu**: Khi người dùng nhấn nút **"Chạy Mô Phỏng"**, Frontend sẽ đóng gói dữ liệu dưới dạng JSON và gửi một yêu cầu HTTP POST tới Backend FastAPI thông qua endpoint `/simulate`.
3. **Xử lý thuật toán (Backend)**:
   - Backend tiếp nhận dữ liệu, khởi tạo các đối tượng tiến trình.
   - Chạy mô phỏng thuật toán **FCFS** (First-Come First-Served) và **Round Robin** (RR) theo từng giây (từ giây $0$ cho đến khi tất cả tiến trình hoàn thành).
   - Tại mỗi giây, Backend ghi lại trạng thái của hệ thống (Snapshots) bao gồm: hàng đợi Ready, tiến trình đang chạy trong CPU, biểu đồ Gantt lũy tiến và nhật ký hoạt động (System Log).
   - Tính toán các thông số hiệu năng cuối cùng: Thời điểm hoàn thành (CT), Thời gian quay vòng (TAT), Thời gian chờ (WT) của từng tiến trình và thời gian trung bình (AWT, ATAT).
4. **Trả kết quả**: Backend đóng gói toàn bộ kết quả tính toán và chuỗi Snapshots thành một đối tượng JSON duy nhất và gửi trả về cho Frontend.
5. **Trực quan hóa (Frontend)**:
   - Frontend nhận dữ liệu JSON, cập nhật bảng kết quả chi tiết và bảng so sánh hiệu năng giữa hai thuật toán.
   - Vẽ biểu đồ Gantt tĩnh hoàn chỉnh.
   - Kích hoạt bộ điều khiển mô phỏng (Play, Pause, Next, Prev, Reset, Speed) cho phép người dùng xem lại quá trình điều phối từng giây một cách trực quan sinh động dựa trên chuỗi Snapshots đã nhận.

---

## 2. Cách Thức Giao Tiếp (API Communication)

Frontend và Backend giao tiếp thông qua giao thức **HTTP** với định dạng dữ liệu **JSON**.

*   **Endpoint**: `POST http://127.0.0.1:8000/simulate`
*   **CORS (Cross-Origin Resource Sharing)**: Được cấu hình ở Backend cho phép Frontend chạy từ bất kỳ nguồn nào (như mở trực tiếp file HTML hoặc qua Live Server) đều có thể gọi API một cách an toàn.

### Dữ liệu Frontend gửi đi (Request Payload):
```json
{
  "processes": [
    { "pid": 1, "arrivalTime": 1, "burstTime": 4 },
    { "pid": 2, "arrivalTime": 0, "burstTime": 3 },
    { "pid": 3, "arrivalTime": 3, "burstTime": 5 }
  ],
  "quantum": 2
}
```

---

## 3. Cấu Trúc Kết Quả Trả Về Từ Backend (Response JSON)

Backend trả về một đối tượng JSON chứa kết quả của cả hai thuật toán `fcfs` và `rr`. Mỗi thuật toán gồm 2 phần chính: `results` (kết quả tổng hợp) và `snapshots` (trạng thái chi tiết từng giây).

### Cấu trúc tổng quát:
```json
{
  "fcfs": {
    "results": [...],
    "snapshots": [...]
  },
  "rr": {
    "results": [...],
    "snapshots": [...]
  }
}
```

### Chi tiết bên trong:

#### A. Mảng `results` (Bảng thông số chi tiết):
Chứa kết quả cuối cùng của từng tiến trình sau khi chạy xong thuật toán.
```json
{
  "pid": 1,
  "arrivalTime": 1,
  "burstTime": 4,
  "completionTime": 7,  // Thời điểm hoàn thành (CT)
  "turnaroundTime": 6,  // Thời gian quay vòng (TAT = CT - AT)
  "waitingTime": 2      // Thời gian chờ (WT = TAT - BT)
}
```

#### B. Mảng `snapshots` (Dữ liệu mô phỏng từng giây):
Mỗi phần tử trong mảng đại diện cho trạng thái của hệ thống tại giây thứ `time`. Đây là chìa khóa giúp Frontend chạy hiệu ứng mô phỏng từng bước mà không cần tính toán lại ở client.
```json
{
  "time": 2, // Giây thứ 2 của hệ thống
  "queue": [ // Danh sách các tiến trình đang nằm trong hàng đợi Ready
    { "pid": 3, "arrivalTime": 3, "burstTime": 5, "remainingTime": 5 }
  ],
  "cpu": { // Tiến trình đang được nạp trong CPU tại giây này
    "pid": 2,
    "arrivalTime": 0,
    "burstTime": 3,
    "remainingTime": 1,
    "quantumLeft": 1 // Chỉ có ở Round Robin (thời gian lượng tử còn lại)
  },
  "logs": [ // Nhật ký hệ thống tích lũy đến thời điểm hiện tại (dạng HTML)
    "[t=0] Hệ thống khởi động...",
    "<div class=\"log-entry\">[t=0] Tiến trình P2 đến...</div>"
  ],
  "gantt": [ // Lịch sử biểu đồ Gantt được vẽ lũy tiến đến giây hiện tại
    { "pid": 2, "start": 0, "end": 2, "isIdle": false }
  ]
}
```

---

## 4. Điểm Nổi Bật Của Sản Phẩm Để Giới Thiệu (Key Selling Points)

1.  **Tách biệt xử lý logic và hiển thị (Decoupled Architecture)**: 
    *   Giúp mã nguồn sạch sẽ, dễ bảo trì và mở rộng.
    *   Backend viết bằng Python tận dụng tối đa thế mạnh xử lý thuật toán logic cấu trúc dữ liệu.
    *   Frontend chỉ tập trung vào trải nghiệm người dùng (UX/UI) và hiệu ứng mượt mà.
2.  **Mô phỏng thời gian thực (Step-by-Step Simulation)**: Người dùng có thể bấm **Play** để xem hệ thống chạy tự động, **Pause** để dừng lại phân tích, hoặc bấm **Next/Prev** để đi tới/lui từng giây một cách trực quan.
3.  **Biểu đồ Gantt tương tác**: Biểu đồ Gantt tự động co giãn theo thời gian thực, hiển thị chi tiết thông tin tiến trình (Start, End, Duration) khi di chuột vào (Tooltip).
4.  **So sánh hiệu năng trực quan**: Tự động tính toán và so sánh thời gian chờ trung bình (AWT), thời gian hoàn thành trung bình (ATAT) giữa hai thuật toán và đưa ra kết luận thuật toán nào tối ưu hơn cho bộ dữ liệu hiện tại.
