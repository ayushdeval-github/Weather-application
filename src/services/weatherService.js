const apiClient = require('../utils/apiClient');
const Weather = require('../models/Weather');

exports.fetchWeatherFromAPI = async (city) => {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  const country = process.env.DEFAULT_COUNTRY || 'IN';
  // Append country code only if not already specified (e.g. "Delhi,IN")
  const query = city.includes(',') ? city : `${city},${country}`;
  const response = await apiClient.get(`/weather?q=${query}&appid=${apiKey}&units=metric`);
  
  return {
    city: response.data.name,
    temperature: response.data.main.temp,
    tempMax: response.data.main.temp_max,
    tempMin: response.data.main.temp_min,
    humidity: response.data.main.humidity,
    condition: response.data.weather[0].main,
    description: response.data.weather[0].description,
    windSpeed: response.data.wind.speed
  };
};

exports.storeWeatherData = async (weatherData) => {
  const weather = new Weather(weatherData);
  await weather.save();
  return weather;
};
