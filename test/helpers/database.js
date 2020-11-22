const { randomBytes } = require("crypto");

async function hasTable(sql, table) {
	const result = await sql`
		select from information_schema.tables
		where table_name = ${table}
	`;

	return result.count > 0;
}

function getTestTableName(label = "table") {
	return `test_${label}_${randomBytes(8).toString("hex")}`;
}

module.exports = {
	hasTable,
	getTestTableName,
};
