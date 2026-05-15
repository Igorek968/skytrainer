@echo off
setlocal
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo [Ошибка] npm не найден в PATH. Установите Node.js LTS: https://nodejs.org/
  echo После установки откройте новый терминал и снова запустите этот файл.
  exit /b 1
)

if not exist "node_modules\" (
  echo Устанавливаю зависимости ^(npm install^)...
  call npm install
  if errorlevel 1 exit /b 1
)

echo Запуск dev-сервера ^(Ctrl+C — остановить^)...
echo Убедитесь, что в .env заданы DATABASE_URL и при необходимости AUTH_URL / NEXTAUTH_URL как в браузере.
call npm run dev
exit /b %errorlevel%
