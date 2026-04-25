const express = require('express');
const cors = require('cors');
const path = require('path');
const weatherRoutes = require('./routes/weatherRoutes');
const errorMiddleware = require('./middleware/errorMiddleware');

const app = express();

// CORS — allow browser clients (configurable via CORS_ORIGIN env var)
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));

app.use(express.json());

// Serve frontend static files from public/
app.use(express.static(path.join(__dirname, '..', 'public')));

// Routes
app.use('/api/weather', weatherRoutes);

// Error Middleware
app.use(errorMiddleware);

module.exports = app;
