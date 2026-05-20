require('dotenv').config();
console.log('ALLOWED_ORIGINS:', process.env.ALLOWED_ORIGINS);
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const pushService = require('./services/pushService');

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration (Best Practice + Enhanced Logging)


// Best-practice CORS: allow all subdomains of extracash.mkopaji.com
const allowedBase = 'extracash.mkopaji.com';
const allowedOrigins = [
  'https://extracash.mkopaji.com',
  'https://www.extracash.mkopaji.com',
];
if (!isProduction) {
  allowedOrigins.push('http://localhost:3000', 'http://127.0.0.1:3000');
}

// Log every incoming request's Origin header
app.use((req, res, next) => {
  if (req.headers.origin) {
    console.log(`[CORS DEBUG] Incoming request Origin: ${req.headers.origin}`);
  }
  next();
});



app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      // Allow exact matches
      if (allowedOrigins.includes(origin)) return callback(null, true);

      // Allow any subdomain of extracash.mkopaji.com
      try {
        const url = new URL(origin);
        if (
          url.protocol === 'https:' &&
          url.hostname.endsWith('.' + allowedBase)
        ) {
          return callback(null, true);
        }
      } catch (e) {
        // Ignore parse errors
      }

      console.warn(`[CORS BLOCKED] Origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    },
    optionsSuccessStatus: 200,
  })
);

// Request logging
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10kb', extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    services: {
      push: pushService.isEnabled(),
    },
  });
});

// Routes
app.use('/api', routes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);

  // Configure Web Push VAPID
  const pushConfigured = pushService.configure();
  if (pushConfigured) {
    console.log('🔔 Web Push configured');

    // Send an early reminder after startup, then continue hourly.
    setTimeout(() => {
      pushService.broadcastHourlyReminder().catch((error) => {
        console.warn('[Push Scheduler] Immediate reminder failed:', error.message);
      });
    }, 2 * 60 * 1000);

    // Hourly push notification scheduler
    setInterval(() => {
      pushService.broadcastHourlyReminder().catch((error) => {
        console.warn('[Push Scheduler] Hourly reminder failed:', error.message);
      });
    }, 60 * 60 * 1000); // every 60 minutes
  } else {
    console.warn('🔕 Web Push disabled');
  }
});

module.exports = server;
