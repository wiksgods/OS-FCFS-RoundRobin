import sys
import os

# Thêm thư mục hiện tại vào đường dẫn hệ thống
sys.path.insert(0, os.path.dirname(__file__))

# Import ứng dụng FastAPI từ main.py
from main import app
from a2wsgi import ASGIMiddleware

# Chuyển đổi ASGI (FastAPI) thành WSGI để Passenger (cPanel) hiểu được
application = ASGIMiddleware(app)
