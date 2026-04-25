const weatherService = require('../services/weatherService');
const Weather = require('../models/Weather');
const mongoose = require('mongoose');

// Helper: build a case-insensitive city regex filter
// Also matches partial names e.g. "Delhi" matches "New Delhi"
function cityFilter(city) {
  return { $regex: city.trim(), $options: 'i' };
}

// 1️⃣ Current Weather (without caching)
exports.getCurrentWeather = async (req, res, next) => {
  try {
    const { city } = req.query;
    if (!city) return res.status(400).json({ error: 'City is required' });

    const weatherData = await weatherService.fetchWeatherFromAPI(city);

    res.json({ source: 'api', data: weatherData });
  } catch (error) {
    next(error);
  }
};

// 2️⃣ Fetch & Store
exports.fetchAndStoreWeather = async (req, res, next) => {
  try {
    const { city } = req.body;
    if (!city) return res.status(400).json({ error: 'City is required' });

    const weatherData = await weatherService.fetchWeatherFromAPI(city);
    const storedWeather = await weatherService.storeWeatherData(weatherData);

    res.status(201).json({ message: 'Weather data stored successfully', data: storedWeather });
  } catch (error) {
    next(error);
  }
};

// 3️⃣ History — case-insensitive city match
exports.getHistory = async (req, res, next) => {
  try {
    const { city, startDate, endDate } = req.query;
    if (!city) return res.status(400).json({ error: 'City is required' });

    const filter = { city: cityFilter(city) };
    if (startDate && endDate) {
      filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    } else if (startDate) {
      filter.date = { $gte: new Date(startDate) };
    } else if (endDate) {
      filter.date = { $lte: new Date(endDate) };
    }

    const history = await Weather.find(filter).sort({ date: -1 }).limit(100);
    res.json({ count: history.length, data: history });
  } catch (error) {
    next(error);
  }
};

// 4️⃣ Temperature Analytics — case-insensitive city match
exports.getTemperatureAnalytics = async (req, res, next) => {
  try {
    const { city } = req.query;
    if (!city) return res.status(400).json({ error: 'City is required' });

    const analytics = await Weather.aggregate([
      { $match: { city: { $regex: city.trim(), $options: 'i' } } },
      {
        $group: {
          _id: "$city",
          avgTemp: { $avg: "$temperature" },
          maxTemp: { $max: "$temperature" },
          minTemp: { $min: "$temperature" },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json(analytics.length > 0 ? analytics[0] : { message: 'No data found. Store some weather records first using the Dashboard or Manage Data tab.' });
  } catch (error) {
    next(error);
  }
};

// 5️⃣ Trends — case-insensitive city match
exports.getTrends = async (req, res, next) => {
  try {
    const { city } = req.query;
    if (!city) return res.status(400).json({ error: 'City is required' });

    // Weekly trends (last 7 days grouped by day)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const trends = await Weather.aggregate([
      { $match: { city: { $regex: city.trim(), $options: 'i' }, date: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          avgTemp: { $avg: "$temperature" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json(trends);
  } catch (error) {
    next(error);
  }
};

// 6️⃣ Condition Stats — case-insensitive city match
exports.getConditionStats = async (req, res, next) => {
  try {
    const { city } = req.query;
    if (!city) return res.status(400).json({ error: 'City is required' });

    const stats = await Weather.aggregate([
      { $match: { city: { $regex: city.trim(), $options: 'i' } } },
      {
        $group: {
          _id: "$condition",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json(stats);
  } catch (error) {
    next(error);
  }
};

// 7️⃣ Delete Old Data
exports.deleteOldData = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - parseInt(days));

    const result = await Weather.deleteMany({ date: { $lt: dateLimit } });
    res.json({ message: `Deleted ${result.deletedCount} old records` });
  } catch (error) {
    next(error);
  }
};

// 8️⃣ Health Check
exports.healthCheck = async (req, res, next) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date(),
      services: {
        database: dbStatus
      }
    });
  } catch (error) {
    next(error);
  }
};

// 9️⃣ Cache Status
exports.cacheStatus = async (req, res, next) => {
  res.json({ message: 'Caching has been permanently disabled and removed from the system.' });
};
