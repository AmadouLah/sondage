// Configuration de l'URL de l'API
// Détection automatique de l'environnement
(function() {
  var hostname = window.location.hostname;
  var isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '';
  window.API_URL = window.API_URL || (isLocal 
    ? 'http://localhost:3000' 
    : 'https://sondage-api-0df0.onrender.com');
  console.log('API_URL configurée:', window.API_URL);
})();
