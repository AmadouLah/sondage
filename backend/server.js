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

app.use(cors());
app.use(express.json());

function initDatabase() {
  return pool.query(`
    CREATE TABLE IF NOT EXISTS votes (
      id VARCHAR(255) PRIMARY KEY,
      choix VARCHAR(255) NOT NULL,
      timestamp BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_votes_choix ON votes(choix);
    CREATE INDEX IF NOT EXISTS idx_votes_timestamp ON votes(timestamp DESC);
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
          'UPDATE votes SET choix = $1, timestamp = $2 WHERE id = $3',
          [choix, timestamp, voteId]
        );
      } else {
        return pool.query(
          'INSERT INTO votes (id, choix, timestamp) VALUES ($1, $2, $3)',
          [voteId, choix, timestamp]
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
    pool.query('SELECT id, choix, timestamp FROM votes ORDER BY timestamp DESC'),
    getCounts()
  ])
    .then(function (results) {
      var votes = results[0].rows.map(function (row) {
        return {
          id: row.id,
          choix: row.choix,
          timestamp: parseInt(row.timestamp, 10)
        };
      });
      res.json({ votes: votes, counts: results[1] });
    })
    .catch(function (err) {
      handleError(res, err, 'Erreur lors de la lecture:');
    });
});

initDatabase().then(function () {
  app.listen(PORT, '0.0.0.0', function () {
    console.log('Serveur démarré sur le port', PORT);
  });
});
