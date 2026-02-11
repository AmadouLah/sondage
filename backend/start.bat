@echo off
echo Démarrage du backend...
echo.
if not exist .env.local (
    echo ATTENTION: Le fichier .env.local n'existe pas!
    echo Créez-le avec votre DATABASE_URL NeonDB
    echo.
)
echo Installation des dépendances...
call npm install
echo.
echo Démarrage du serveur sur http://localhost:3000
echo.
call npm start
