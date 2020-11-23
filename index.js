const { readdirSync } = require("fs");
const { resolve, basename } = require("path");
const noopLogger = require("./util/noopLogger.js");

const types = ["sql", "js", "cjs", "mjs"];

module.exports = (sql, options = {}) => {
	const table = options.table || "migrations";
	const directory = options.directory || "./migrations";
	const logger = options.logger || noopLogger;

	const migrator = { sql, table, directory };

	migrator.apply = async () => {
		await initialize();

		const migrated = [];

		for (const filename of readdirSync(resolve(directory)).sort()) {
			const type = getType(filename);

			if (!type) continue;

			const exists = await has(filename);

			if (exists) continue;

			logger.info({ filename }, "applying migration");

			migrated.push(await apply(type, filename));
		}

		return migrated;
	};

	migrator.has = async (filename) => {
		const initialized = await isInitialized();

		if (!initialized) return false;

		return await has(filename);
	};

	migrator.all = async () => {
		const initialized = await isInitialized();

		if (!initialized) return [];

		return await all();
	};

	return migrator;

	function initialize() {
		return sql`
			create table if not exists ${sql(table)} (
				id integer primary key generated always as identity,
				filename text not null,
				created_at timestamp not null default now()
			)
		`;
	}

	async function isInitialized() {
		const result = await sql`
			select from information_schema.tables
			where table_name = ${table}
		`;

		return result.count > 0;
	}

	async function all() {
		const rows = await sql`
			select filename from ${sql(table)} order by id
		`;

		return rows.map((row) => resolve(directory, row.filename));
	}

	async function has(filename) {
		const rows = await sql`
			select from ${sql(table)} where filename = ${basename(filename)}
		`;

		return rows.count > 0;
	}

	async function apply(type, filename) {
		const file = resolve(directory, filename);

		await sql.begin(async (sql) => {
			if (type === "sql") {
				await sql.file(file);
			} else if (type === "js" || type === "mjs" || type === "cjs") {
				const { default: migrate } = await import(file);
				await migrate(sql);
			}

			await record(filename);
		});

		return file;
	}

	function record(filename) {
		return sql`insert into ${sql(table)} ${sql({ filename })}`;
	}

	function getType(filename) {
		for (const type of types) {
			if (filename.endsWith(`.${type}`)) return type;
		}
	}
};
