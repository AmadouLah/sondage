(function() {
  'use strict';

  function preventInspection() {
    document.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      return false;
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'F12' || 
          (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
          (e.ctrlKey && e.key === 'U') ||
          (e.ctrlKey && e.key === 'S')) {
        e.preventDefault();
        return false;
      }
    });

    document.addEventListener('selectstart', function(e) {
      e.preventDefault();
      return false;
    });

    document.addEventListener('dragstart', function(e) {
      e.preventDefault();
      return false;
    });

    if (window.DevTools) {
      window.DevTools.open();
    }

    var devtools = { open: false, orientation: null };
    var threshold = 160;
    setInterval(function() {
      if (window.outerHeight - window.innerHeight > threshold || 
          window.outerWidth - window.innerWidth > threshold) {
        if (!devtools.open) {
          devtools.open = true;
          document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;color:#fff;background:#000;"><h1>Inspection désactivée</h1></div>';
        }
      } else {
        devtools.open = false;
      }
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', preventInspection);
  } else {
    preventInspection();
  }
})();
