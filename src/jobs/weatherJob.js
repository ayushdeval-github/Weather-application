const cron = require('node-cron');
const weatherService = require('../services/weatherService');

// Job to fetch weather for a default city periodically (e.g., every 30 mins)
const startWeatherJob = () => {
  cron.schedule('*/30 * * * *', async () => {
    console.log('Running background job to fetch weather data...');
    try {
      const city = process.env.DEFAULT_CITY || 'Delhi';
      const weatherData = await weatherService.fetchWeatherFromAPI(city);
      await weatherService.storeWeatherData(weatherData);
      console.log(`Successfully stored periodic weather data for ${city}`);
    } catch (error) {
      console.error('Error in background job:', error.message);
    }
  });
};

module.exports = startWeatherJob;
