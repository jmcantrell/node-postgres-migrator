const test = require("ava");
const postgres = require("postgres");
const { createTestDirectory } = require("../helpers/filesystem");
const { hasTable, getTestTableName } = require("../helpers/database");

const createMigrator = require("../../lib/createMigrator");

const silent = () => {};

const url = process.env.POSTGRES_URL || "postgresql://postgres:postgres@localhost:5432/postgres";

const sql = postgres(url, {
	debug: silent,
	onnotice: silent,
	onparameter: silent,
});

async function setup(callback) {
	const table = getTestTableName("migrations");
	const directory = createTestDirectory("migrations");
	const migrator = createMigrator(sql, { table, directory: directory.path });

	try {
		await callback(migrator, directory);
	} finally {
		await sql`drop table if exists ${sql(table)}`;
		directory.delete();
	}
}

test.serial("able to alter the database that is being migrated", async (t) => {
	await setup(async (migrator, directory) => {
		const table = getTestTableName();

		const file = directory.addFile("test.sql", `create table "${table}" (test integer);`);

		try {
			t.false(await hasTable(sql, table));

			t.deepEqual(await migrator.migrate(), [file]);

			t.true(await hasTable(sql, table));
		} finally {
			await sql`drop table if exists ${sql(table)}`;
		}
	});
});

test.serial("migrations are applied in alpha-numeric order of filenames", async (t) => {
	await setup(async (migrator, directory) => {
		const files = [
			directory.addFile("001.sql", "select 1;"),
			directory.addFile("010.sql", "select 1;"),
			directory.addFile("100.sql", "select 1;"),
		];

		t.deepEqual(await migrator.migrate(), files);
	});
});

test.serial("will not apply a migration more than once", async (t) => {
	await setup(async (migrator, directory) => {
		const table = getTestTableName();
		const file = directory.addFile("test.sql", `create table "${table}" (test integer);`);

		try {
			t.deepEqual(await migrator.migrate(), [file]);

			// If the script is run more than once, a database-level error would be thrown for trying
			// to create a table that already exists.
			await t.notThrowsAsync(async () => {
				t.deepEqual(await migrator.migrate(), []);
			});
		} finally {
			await sql`drop table if exists ${sql(table)}`;
		}
	});
});

test.serial("will only apply new migrations", async (t) => {
	await setup(async (migrator, directory) => {
		const file1 = directory.addFile("001.sql", "select 1;");

		t.deepEqual(await migrator.migrate(), [file1]);

		const file2 = directory.addFile("002.sql", "select 1;");

		t.deepEqual(await migrator.migrate(), [file2]);
	});
});

test.serial("migrations can also be a javascript file", async (t) => {
	await setup(async (migrator, directory) => {
		const files = [
			directory.addFile("001.js", "module.exports = (sql) => sql`select 1;`;"),
			directory.addFile("002.cjs", "module.exports = (sql) => sql`select 1;`;"),
			directory.addFile("003.mjs", "export default (sql) => sql`select 1;`;"),
		];

		t.deepEqual(await migrator.migrate(), files);
	});
});

test.serial("an error will be thrown if a migration fails", async (t) => {
	await setup(async (migrator, directory) => {
		directory.addFile("test.sql", "select 1/0;");

		await t.throwsAsync(migrator.migrate(), {
			name: "Error",
			message: "division by zero",
		});

		// Ensure that the migration was not recorded.
		t.deepEqual(await migrator.migrated(), []);
	});
});

test.serial("migration stops when an error is encountered", async (t) => {
	await setup(async (migrator, directory) => {
		const file1 = directory.addFile("001.sql", "select 1;");
		directory.addFile("002.sql", "select 1/0;");
		directory.addFile("003.sql", "select 1;");

		await t.throwsAsync(migrator.migrate(), {
			name: "Error",
			message: "division by zero",
		});

		// Ensure the first file was migrated, but the last one was never reached.
		t.deepEqual(await migrator.migrated(), [file1]);
	});
});
