// Configuration de l'URL de l'API
// Détection automatique de l'environnement
(function() {
  var isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  window.API_URL = window.API_URL || (isLocalhost 
    ? 'http://localhost:3000' 
    : 'https://sondage-api-0df0.onrender.com'); // Remplacez par votre URL de backend
})();
