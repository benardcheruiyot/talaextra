const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',') 
      : ['http://localhost:3000'];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || !process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200
};

const allowedBase = process.env.ALLOWED_BASE_DOMAIN || '';
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

module.exports = {
  credentials: true,
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    try {
      const url = new URL(origin);
      if (
        allowedBase &&
        url.protocol === 'https:' &&
        (url.hostname === allowedBase || url.hostname.endsWith('.' + allowedBase))
      ) {
        return callback(null, true);
      }
    } catch {}
    console.warn(`[CORS BLOCKED] Origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  optionsSuccessStatus: 200,
};
