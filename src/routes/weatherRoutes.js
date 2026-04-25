const express = require('express');
const router = express.Router();
const weatherController = require('../controllers/weatherController');
const rateLimiter = require('../middleware/rateLimiter');

// Rate limit apply to fetching routes mainly
router.get('/current', rateLimiter, weatherController.getCurrentWeather);
router.post('/fetch', rateLimiter, weatherController.fetchAndStoreWeather);
router.get('/history', weatherController.getHistory);
router.get('/analytics', weatherController.getTemperatureAnalytics);
router.get('/trends', weatherController.getTrends);
router.get('/conditions', weatherController.getConditionStats);
router.delete('/old-data', weatherController.deleteOldData);
router.get('/health', weatherController.healthCheck);
router.get('/cache-status', weatherController.cacheStatus);

module.exports = router;
