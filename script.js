(function () {
  const STORAGE_VOTE = 'sondage-vote';
  const STORAGE_VOTE_ID = 'sondage-vote-id';
  const API_URL = window.API_URL || 'http://localhost:3000';
  const TYPES_FALLBACK = ['Écrit', 'Oral', 'QCM', 'Projet', 'Pratique'];

  const form = document.getElementById('form-sondage');
  const container = document.getElementById('choix-container');
  const resultatsSection = document.getElementById('resultats');
  const messageVote = document.getElementById('message-vote');
  const listeResultats = document.getElementById('liste-resultats');

  function parseTypesText(text) {
    return text
      .split(/\r?\n/)
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
  }

  function getTypes() {
    return fetch('typeExamen.txt')
      .then(function (r) { return r.ok ? r.text() : Promise.reject(); })
      .then(parseTypesText)
      .catch(function () { return TYPES_FALLBACK; });
  }

  function renderChoix(types) {
    var name = 'type-examen';
    container.innerHTML = '';
    types.forEach(function (type, i) {
      var id = 'opt-' + type.replace(/\s+/g, '-');
      var label = document.createElement('label');
      label.className = 'option-item';
      label.style.animationDelay = (i * 0.05) + 's';
      label.htmlFor = id;
      label.innerHTML =
        '<input type="radio" name="' + name + '" id="' + id + '" value="' + escapeHtml(type) + '" required> ' +
        '<span class="label-text">' + escapeHtml(type) + '</span>';
      container.appendChild(label);
      label.querySelector('input').addEventListener('change', function () {
        container.querySelectorAll('label').forEach(function (l) { l.classList.remove('selected'); });
        label.classList.add('selected');
      });
    });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function getTotal(counts) {
    return Object.keys(counts).reduce(function (acc, k) { return acc + (counts[k] || 0); }, 0);
  }

  function getStats() {
    if (!API_URL) {
      console.warn('API_URL non configurée');
      return Promise.resolve({});
    }
    console.log('Chargement des stats depuis:', API_URL + '/api/stats');
    return fetch(API_URL + '/api/stats')
      .then(function (r) {
        if (!r.ok) {
          throw new Error('HTTP ' + r.status);
        }
        return r.json();
      })
      .then(function (data) {
        console.log('Stats chargées:', data);
        return data.counts || {};
      })
      .catch(function (err) {
        console.warn('Impossible de charger les stats depuis l\'API:', err.message);
        return {};
      });
  }

  function getVoteId() {
    try {
      var id = localStorage.getItem(STORAGE_VOTE_ID);
      if (!id) {
        id = Date.now().toString(36) + Math.random().toString(36).substr(2);
        localStorage.setItem(STORAGE_VOTE_ID, id);
      }
      return id;
    } catch (_) {
      return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
  }

  function afficherResultats(types, counts) {
    var total = getTotal(counts);
    var voted = localStorage.getItem(STORAGE_VOTE);

    messageVote.textContent = voted
      ? 'Vous avez déjà voté. Merci !'
      : 'Merci d\'avoir voté.';

    listeResultats.innerHTML = '';
    types.forEach(function (type) {
      var n = counts[type] || 0;
      var pct = total > 0 ? Math.round((n / total) * 100) : 0;
      var li = document.createElement('li');
      li.innerHTML =
        '<span class="label">' + escapeHtml(type) + '</span>' +
        '<span class="bar-wrap"><span class="bar" style="width:' + pct + '%"></span></span>' +
        '<span class="pourcent">' + pct + ' %</span>';
      listeResultats.appendChild(li);
    });

    resultatsSection.hidden = false;
    form.closest('.sondage').setAttribute('data-voted', voted ? 'true' : '');
    requestAnimationFrame(function () {
      resultatsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  function enregistrerVote(choix, types) {
    if (!API_URL) {
      alert('Le backend n\'est pas configuré. Veuillez configurer API_URL dans config.js');
      return Promise.reject('Backend non configuré');
    }
    var voteId = getVoteId();
    console.log('Envoi du vote à:', API_URL + '/api/vote');
    return fetch(API_URL + '/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ choix: choix, voteId: voteId })
    })
      .then(function (r) {
        if (!r.ok) {
          return r.text().then(function (text) {
            throw new Error('HTTP ' + r.status + ': ' + text);
          });
        }
        return r.json();
      })
      .then(function (data) {
        console.log('Vote enregistré avec succès:', data);
        localStorage.setItem(STORAGE_VOTE, choix);
        afficherResultats(types, data.counts);
      })
      .catch(function (err) {
        console.error('Erreur complète:', err);
        var isLocal = API_URL.includes('localhost') || API_URL.includes('127.0.0.1');
        var message = isLocal 
          ? 'Erreur: ' + err.message + '\n\nVérifiez que le backend est démarré:\ncd backend && npm start'
          : 'Erreur lors de l\'enregistrement du vote. Le backend est-il déployé ?\n\n' + err.message;
        alert(message);
        throw err;
      });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var selected = document.querySelector('input[name="type-examen"]:checked');
    if (!selected) return;
    var btn = form.querySelector('.btn-submit');
    var types = Array.from(document.querySelectorAll('#choix-container input[value]')).map(function (i) { return i.value; });
    btn.disabled = true;
    btn.textContent = 'Envoi…';
    enregistrerVote(selected.value, types.length ? types : TYPES_FALLBACK).then(function () {
      btn.textContent = 'Vote enregistré';
      btn.disabled = false;
    }).catch(function () {
      btn.textContent = 'Envoyer mon vote';
      btn.disabled = false;
    });
  });

  getTypes().then(function (types) {
    renderChoix(types);
    getStats().then(function (counts) {
      afficherResultats(types, counts);
    }).catch(function (err) {
      console.error('Erreur lors du chargement des stats:', err);
      afficherResultats(types, {});
    });
  }).catch(function (err) {
    console.error('Erreur lors du chargement des types:', err);
    renderChoix(TYPES_FALLBACK);
    getStats().then(function (counts) {
      afficherResultats(TYPES_FALLBACK, counts);
    }).catch(function () {
      afficherResultats(TYPES_FALLBACK, {});
    });
  });
})();
