@echo off
REM ASCII-only launcher (cmd on zh-TW reads CP950; non-ASCII here breaks parsing)
cd /d "%~dp0"
set PORT=4180
set HOST=0.0.0.0
echo Castle game starting on port %PORT% ...
node "%~dp0server.cjs"
