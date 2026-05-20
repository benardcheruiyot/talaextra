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

const allowedOriginsRaw = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

// Support wildcard subdomains: e.g., add 'https://*.extracash.mkopaji.com' to ALLOWED_ORIGINS
const allowedWildcardDomains = allowedOriginsRaw.filter(origin => origin.startsWith('https://*.'));
const allowedOrigins = allowedOriginsRaw.filter(origin => !origin.startsWith('https://*.'));

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

      // Exact match
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Wildcard subdomain match
      const matched = allowedWildcardDomains.some(wildcard => {
        // e.g., wildcard = 'https://*.extracash.mkopaji.com'
        const base = wildcard.replace('https://*.', '');
        try {
          const url = new URL(origin);
          return url.protocol === 'https:' && url.hostname.endsWith('.' + base);
        } catch {
          return false;
        }
      });
      if (matched) {
        return callback(null, true);
      }

      console.warn(`[CORS BLOCKED] Origin: ${origin} | Allowed: [${allowedOrigins.join(', ')}] | Wildcards: [${allowedWildcardDomains.join(', ')}]`);
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
