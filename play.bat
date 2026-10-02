@echo off
rem The game over a local server (http://localhost:8765): the browser remembers the microphone answer (opened
rem straight from the file it asks every visit). Needs Python.
cd /d "%~dp0"
start "" http://localhost:8765/
python -m http.server 8765
