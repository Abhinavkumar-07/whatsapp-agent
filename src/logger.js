'use strict';

const pino = require('pino');
const { LOG_LEVEL } = require('./config');

// Use pino-pretty if available (installed as optionalDependency for better DX).
// Falls back to structured JSON output, which is perfectly valid for production.
let transport;
try {
  require.resolve('pino-pretty');
  transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:HH:MM:ss',
      ignore: 'pid,hostname',
      messageKey: 'msg',
    },
  };
} catch {
  // pino-pretty not available — JSON output will be used.
  // Tip: pipe stdout through `npx pino-pretty` for human-readable logs.
}

const logger = pino({
  level: LOG_LEVEL,
  base: null, // removes default pid/hostname fields
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(transport ? { transport } : {}),
});

module.exports = logger;
