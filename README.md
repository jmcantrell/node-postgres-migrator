# postgres-migrator

Simple database migrations for PostgreSQL.

## Getting started

### Install

```bash
$ npm install postgres postgres-migrator
```

### Example

```js
const postgres = require("postgres");
const postgresMigrator = require("postgres-migrator");

const sql = postgres();
const migrator = postgresMigrator(sql, directory);

const migrated = await migrator.apply();
```

## Behavior

Migration is one-way. There is no ability to reverse a migration, as
this is rarely used, and is better handled with a new migration that
reverts a previous one.

Directories being migrated are expected to contain zero or more
migration files. Any unrecognized file types will be ignored.

Migration files are sorted before being applied, so you can be certain
that `001.sql` will be applied before `002.sql`.

As you would expect, only unapplied migrations will be applied.

Each migration is run in a database transaction. Any errors
encountered are left uncaught and migration ceases at that point.
Migrations completed previously are left applied, and once the error
is corrected, `migrator.apply` can be run again and migration will
continue from the last migration that was successfully applied.

Each migrator instance represents a directory of migration files. If
you need to support multiple directories, you can create a migrator
instance for each directory with a different table name.

Only the filename of the migration file is recorded, so relocating or
renaming the directory will not affect the tracking.

Migrations are tracked using a database table named `migrations`
(configurable).

Migrations are assumed to be in the directory `./migrations`
(configurable).

### Migration files

#### SQL migration files

SQL migration files are just plain `sql`, as you would expect. The
only restriction is that they have the extension ".sql" (lower case).

An example `sql` migration file might be `010-users-table-add-email.sql`:

```sql
alter table users add column email text not null unique;
```

#### JavaScript migration files

JavaScript migration files are `javascript` modules that export a
default function (can be async) that takes as its only argument an
instance of a postgres client (typically named `sql`).

See the [postgres][1] documentation for its capabilities.

If a promise is returned, it will be `await`ed.

The filename's extension must be `.js`, `.cjs`, or `.mjs`.

The file can be CommonJS (`module.exports`) or ES Module
(`import`/`export`) syntax.

An example `javascript` migration file might be `010-users-table-add-email.js`:

```js
module.exports = (sql) => {
	return sql`alter table users add column email text not null unique`;
};
```

## API

### Creating a migrator object

```js
const migrator = postgresMigrator(sql, { ...options });
```

The first argument must be a [postgres][1] client object.

The second argument is an optional options object with the following
default properties:

```js
const migrator = postgresMigrator(sql, {
	table: "migrations",
	directory: "./migrations",
	logger: undefined,
});
```

The `logger` option, if defined, is expected to be a standard logging
object. For example, if you want to log activity using `console`, you
would do the following:

```js
const migrator = postgresMigrator(sql, { logger: console });
```

Currently the only thing logged is the filename of the migration that
is about to be applied.

### Applying migrations

```js
const migrated = await migrator.apply();
```

If needed, the return value is an array of migration files that were
applied during that function call.

### Testing if a file has been migrated

```js
const exists = await migrator.has(filename);
```

### Getting all migrated files

```js
const migrated = await migrator.all();
```

## Recommendations

### Creating migration files

To reduce confusion, new migration files should be sorted after old
ones. You can ensure this by using a shell function like the following to
generate new migrations that are sorted by the timestamp when they
were created:

```bash
function mkmigration() {
	local name=$1
	local ext=${2:-sql}
	local ts=$(date +%Y%m%d%H%M%S)
	touch "${PWD}/migrations/${ts}.${ext}"
}
```

This will allow you to do the following:

```bash
$ mkmigration users-table
$ ls migrations
20201225103045-users-table.sql
```

Obviously this could be easily tailored to your project, such as using
a template for new migrations or a different way to establish proper
sorting.

### Command-line interface

I originally planned to include a command-line interface, but could
not decide how to make it flexible enough. I'll leave it to you to
decide how best to implement that for your project, but the following
should be sufficient for most:

```js
#!/usr/bin/env node

const postgres = require("postgres");
const postgresMigrator = require("postgres-migrator");

const sql = postgres(process.env.POSTGRES_URL);
const migrator = createMigrator(sql, { logger: console });

migrator
	.apply()
	.catch((error) => {
		logger.error(error);
		process.exit(1);
	})
	.finally(sql.end);
```

Obviously this could be easily tailored to your project, such as using
a command-line parser to allow options to be configurable, or
migrating multiple directories.

## Contributing

### Testing

Test files expect the environment variable `POSTGRES_URL` to point to
your database. No existing tables will be affected, including
`migrations`, as unique table names are used and dropped after the
test finishes.

A docker compose file is included which provisions a database that's
configured as expected:

```bash
$ docker-compose up
```

To run tests:

```bash
$ npm test
```

[1]: https://github.com/porsager/postgres/blob/master/README.md
