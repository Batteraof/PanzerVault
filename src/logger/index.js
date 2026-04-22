function format(level, args) {
  return [`[${new Date().toISOString()}] [${level}]`, ...args];
}

module.exports = {
  info: (...args) => console.log(...format('info', args)),
  warn: (...args) => console.warn(...format('warn', args)),
  error: (...args) => console.error(...format('error', args)),
  debug: (...args) => {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(...format('debug', args));
    }
  }
};
