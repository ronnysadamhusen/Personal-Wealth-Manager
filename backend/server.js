const path = require('path');
const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static frontend files (frontend is compiled into ./public in Docker)
app.use(express.static(path.join(__dirname, 'public')));

// Feature routers — each file owns one API domain.
app.use(require('./routes/accounts'));
app.use(require('./routes/transactions'));
app.use(require('./routes/transfers'));
app.use(require('./routes/budgets'));
app.use(require('./routes/installments'));
app.use(require('./routes/categories'));
app.use(require('./routes/pdf'));
app.use(require('./routes/ai'));
app.use(require('./routes/debtsReceivables'));
app.use(require('./routes/goals'));
app.use(require('./routes/investments'));
app.use(require('./routes/receipt'));
app.use(require('./routes/system'));

// All other requests get served the index.html from the Vite-built frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Personal Wealth Manager API server running on port ${port}`);
});
