require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/db');
const startWeatherJob = require('./src/jobs/weatherJob');

const startServer = async () => {
  try {
    await connectDB();
    
    // Start cron job
    startWeatherJob();

    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port: ${PORT}`);
    });

    server.on('error', (error) => {
      console.error('Failed to start server:', error);
      process.exit(1);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
