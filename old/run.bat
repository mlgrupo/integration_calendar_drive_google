@echo off
echo ========================================
echo   Versao Antiga - Google Integration
echo ========================================
echo.

echo Instalando dependencias...
npm install

echo.
echo Copiando configuracao...
copy config.env .env

echo.
echo Iniciando servidor...
echo Servidor rodando em: http://localhost:3000
echo.
echo Endpoints disponiveis:
echo - GET /api/drive/sync
echo - GET /api/users/sync
echo - GET /api/drive/files
echo - GET /api/users
echo - GET /health
echo.
npm start 