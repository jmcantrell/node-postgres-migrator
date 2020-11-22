const logger = {};

const noop = () => {};

const types = ["trace", "debug", "info", "warn", "error"];

for (const type of types) {
	logger[type] = noop;
}

module.exports = logger;
