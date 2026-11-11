import pino from 'pino-http';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: 'info',
  redact: ['req.headers.cookie', 'res.headers["set-cookie"]'],
  ...(!isProduction && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
        messageFormat: '{req.method} {req.url} {res.statusCode} - {responseTime}ms',
        hideObject: true,
      },
    },
  }),
});
