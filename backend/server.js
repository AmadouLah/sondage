if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: '.env.local' });
}

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());

app.get('/', function (req, res) {
  res.json({ 
    message: 'API Sondage - Backend opérationnel', 
    endpoints: ['/api/vote', '/api/stats', '/api/votes', '/api/health'],
    admin: 'DELETE /api/votes?key=ADMIN_KEY'
  });
});

app.get('/api/health', function (req, res) {
  pool.query('SELECT NOW() as time, COUNT(*) as votes_count FROM votes')
    .then(function (result) {
      res.json({
        status: 'ok',
        database: 'connected',
        time: result.rows[0].time,
        votesCount: parseInt(result.rows[0].votes_count, 10)
      });
    })
    .catch(function (err) {
      res.status(500).json({
        status: 'error',
        database: 'disconnected',
        error: err.message
      });
    });
});

function getClientIp(req) {
  var forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    var ip = forwarded.split(',')[0];
    if (ip) return ip.trim();
  }
  return req.headers['x-real-ip'] ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         'unknown';
}

function initDatabase() {
  return pool.query(`
    CREATE TABLE IF NOT EXISTS votes (
      id VARCHAR(255) PRIMARY KEY,
      choix VARCHAR(255) NOT NULL,
      timestamp BIGINT NOT NULL,
      ip_address VARCHAR(45)
    );
    CREATE INDEX IF NOT EXISTS idx_votes_choix ON votes(choix);
    CREATE INDEX IF NOT EXISTS idx_votes_timestamp ON votes(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_votes_ip ON votes(ip_address);
  `).catch(function (err) {
    console.error('Erreur lors de l\'initialisation de la base:', err);
  });
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getCounts() {
  return pool.query(`
    SELECT choix, COUNT(*) as count
    FROM votes
    GROUP BY choix
  `).then(function (result) {
    var counts = {};
    result.rows.forEach(function (row) {
      counts[row.choix] = parseInt(row.count, 10);
    });
    return counts;
  });
}

function handleError(res, err, message) {
  console.error(message, err);
  res.status(500).json({ error: 'Erreur serveur' });
}

app.post('/api/vote', function (req, res) {
  var choix = req.body.choix;
  var voteId = req.body.voteId;
  var ipAddress = getClientIp(req);

  if (!choix) {
    return res.status(400).json({ error: 'Choix requis' });
  }

  if (!voteId) {
    voteId = generateId();
  }

  pool.query('SELECT choix FROM votes WHERE id = $1', [voteId])
    .then(function (result) {
      var ancienVote = result.rows.length > 0 ? result.rows[0].choix : null;
      var timestamp = Date.now();

      if (ancienVote) {
        return pool.query(
          'UPDATE votes SET choix = $1, timestamp = $2, ip_address = $4 WHERE id = $3',
          [choix, timestamp, voteId, ipAddress]
        );
      } else {
        return pool.query(
          'INSERT INTO votes (id, choix, timestamp, ip_address) VALUES ($1, $2, $3, $4)',
          [voteId, choix, timestamp, ipAddress]
        );
      }
    })
    .then(function () {
      return getCounts();
    })
    .then(function (counts) {
      res.json({ success: true, voteId: voteId, counts: counts });
    })
    .catch(function (err) {
      handleError(res, err, 'Erreur lors de l\'enregistrement:');
    });
});

app.get('/api/stats', function (req, res) {
  getCounts()
    .then(function (counts) {
      res.json({ counts: counts });
    })
    .catch(function (err) {
      handleError(res, err, 'Erreur lors de la lecture:');
    });
});

app.get('/api/votes', function (req, res) {
  Promise.all([
    pool.query('SELECT id, choix, timestamp, ip_address FROM votes ORDER BY timestamp DESC'),
    getCounts()
  ])
    .then(function (results) {
      var votes = results[0].rows.map(function (row) {
        return {
          id: row.id,
          choix: row.choix,
          timestamp: parseInt(row.timestamp, 10),
          ip_address: row.ip_address || 'unknown'
        };
      });
      res.json({ votes: votes, counts: results[1] });
    })
    .catch(function (err) {
      handleError(res, err, 'Erreur lors de la lecture:');
    });
});

function checkAdminKey(req) {
  var providedKey = req.headers['x-admin-key'] || req.query.key;
  var adminKey = process.env.ADMIN_KEY || 'admin123';
  return providedKey === adminKey;
}

app.delete('/api/votes', function (req, res) {
  if (!checkAdminKey(req)) {
    return res.status(401).json({ error: 'Accès non autorisé' });
  }
  
  pool.query('DELETE FROM votes')
    .then(function () {
      res.json({ success: true, message: 'Tous les votes ont été supprimés' });
    })
    .catch(function (err) {
      handleError(res, err, 'Erreur lors de la suppression:');
    });
});

function startServer() {
  app.listen(PORT, '0.0.0.0', function () {
    console.log('🚀 Serveur démarré sur http://localhost:' + PORT);
    console.log('📊 Base de données:', process.env.DATABASE_URL ? 'Configurée' : '⚠️  Non configurée');
    console.log('🌐 CORS activé pour toutes les origines');
    
    if (process.env.DATABASE_URL) {
      pool.query('SELECT NOW()')
        .then(function () {
          console.log('✅ Connexion à la base de données NeonDB réussie');
        })
        .catch(function (err) {
          console.error('❌ Erreur de connexion à la base de données:', err.message);
          console.error('Le serveur fonctionne mais la base de données n\'est pas accessible');
        });
    }
  });
}

initDatabase()
  .then(startServer)
  .catch(function (err) {
    console.error('Erreur lors de l\'initialisation:', err);
    console.log('Démarrage du serveur malgré l\'erreur...');
    startServer();
  });
