@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Calculadora de Cozinha

where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo ERRO: Node.js nao foi encontrado neste computador.
    echo Instale o Node.js em https://nodejs.org e tente novamente.
    echo.
    pause
    exit /b 1
)

start "" http://localhost:8080
node server.js
pause
