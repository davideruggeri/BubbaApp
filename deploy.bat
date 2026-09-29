@echo off
echo Building web app...
call npx expo export --platform web
if %errorlevel% neq 0 exit /b %errorlevel%

echo Injecting PWA manifest...
call node scripts/inject-pwa.js
if %errorlevel% neq 0 exit /b %errorlevel%

echo Deploying to Firebase...
call npx firebase deploy
pause
