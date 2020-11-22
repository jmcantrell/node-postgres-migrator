const { mkdtempSync, rmdirSync, writeFileSync } = require("fs");
const { tmpdir } = require("os");
const { join } = require("path");

function createTestDirectory(name) {
	const context = {};

	context.path = mkdtempSync(join(tmpdir(), `${name}-`));

	context.delete = () => rmdirSync(context.path, { recursive: true });

	context.addFile = (filename, content) => {
		const file = join(context.path, filename);

		writeFileSync(file, content);

		return file;
	};

	return context;
}

module.exports = {
	createTestDirectory,
};
