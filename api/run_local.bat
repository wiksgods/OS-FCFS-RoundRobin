@echo off
:: Di chuyển vào thư mục chứa code backend (thư mục api)
cd /d "%~dp0HDH\HDH\api"

echo Dang kiem tra va cai dat cac thu vien can thiet...
C:\Users\admin\AppData\Local\Microsoft\WindowsApps\python3.12.exe -m pip install -r requirements.txt

echo.
echo Dang khoi dong FastAPI Backend Server tai http://127.0.0.1:8000 ...
echo Nhan Ctrl+C de dung server.
echo.

:: Chạy uvicorn server
C:\Users\admin\AppData\Local\Microsoft\WindowsApps\python3.12.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload

pause
