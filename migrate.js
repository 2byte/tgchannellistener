const dbConnection = require('./db_connection');
const {resolve: pathResolve} = require('path');

(async () => {
    const db = await dbConnection();

    await db.migrate({
        force: true,
        migrationsPath: pathResolve(process.cwd(), './migrations')
    });

    console.info('Migrations ran successfully');
})();
