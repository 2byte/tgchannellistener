const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const { resolve: pathResolve } = require('path');

module.exports = async (pathDatabase) => {

    sqlite3.verbose();

    const db = await open({
        filename: pathDatabase || pathResolve(__dirname, './database/db.db3'),
        driver: sqlite3.Database,
    });

    /*db.on('trace', (msg) => {
        console.log(msg);
    });*/

    return db
};
