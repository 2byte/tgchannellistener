const TgChannelListener = require('../src/TgChannelListener');
const dotenv = require('dotenv');

dotenv.config({
    path: __dirname + '/../.env'
});

const tgListener = new TgChannelListener.create()
    .appId(+process.env.APP_ID)
    .appHash(process.env.APP_HASH)
    .pathStorageSessions(__dirname + '/storage')
    .rememberSession()
    .make();

(async () => {
    await tgListener.connect();
})();
