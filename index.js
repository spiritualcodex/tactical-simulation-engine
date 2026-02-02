import express from 'express';

const app = express();
const port = process.env.PORT || 3000;

// In-memory state tracking
const engineState = {
  lastCommand: null,
  snapshotAt: new Date().toISOString(),
  version: 'engine@1.0.0'
};

app.use(express.json());

// Status endpoint for Office observability
app.get('/api/engine/status', (req, res) => {
  res.json({
    engineOnline: true,
    lastCommand: engineState.lastCommand,
    snapshotAt: engineState.snapshotAt,
    version: engineState.version
  });
});

// Command endpoints (stubs for now - will be implemented when engine logic is added)
app.post('/api/command/advance-match', (req, res) => {
  engineState.lastCommand = {
    type: 'advance-match',
    at: new Date().toISOString()
  };
  engineState.snapshotAt = new Date().toISOString();
  console.log('✅ Command received: advance-match');
  res.json({ success: true, message: 'Match advanced' });
});

app.post('/api/command/reset-simulation', (req, res) => {
  engineState.lastCommand = {
    type: 'reset-simulation',
    at: new Date().toISOString()
  };
  engineState.snapshotAt = new Date().toISOString();
  console.log('✅ Command received: reset-simulation');
  res.json({ success: true, message: 'Simulation reset' });
});

app.post('/api/command/advance-day', (req, res) => {
  engineState.lastCommand = {
    type: 'advance-day',
    at: new Date().toISOString()
  };
  engineState.snapshotAt = new Date().toISOString();
  console.log('✅ Command received: advance-day');
  res.json({ success: true, message: 'Day advanced' });
});

// Match state endpoint (stub)
app.get('/api/match-state', (req, res) => {
  res.json({
    minute: 0,
    homeScore: 0,
    awayScore: 0,
    possession: 50,
    shots: 0,
    onTarget: 0,
    fouls: 0,
    corners: 0,
    events: []
  });
});

app.get('/', (req, res) => {
  res.send('Tactical Simulation Engine v1.0.0');
});

app.listen(port, () => {
  console.log(`🚀 Engine listening on port ${port}`);
});
