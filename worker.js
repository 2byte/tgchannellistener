const TgChannelListenerWorker = require('./src/TgChannelListenerWorker');
const TgChannelListener = require('./src/TgChannelListener');
const dbConnection = require('./db_connection');
const path = require('path');
const TgChannelManager = require('./src/TgChannelManager');
const { config } = require('dotenv');
const express = require('express');

const resultLoadEnv = config();

if (resultLoadEnv.error) {
    throw new Error(resultLoadEnv.error);
}

dbConnection()
    .then((db) => {
        const tgChannelManager = new TgChannelManager.create().db(db).make();

        const app = express();

        app.use(express.json());

        const router = express.Router();

        router
            .post('add', async (req, res) => {
                const data = req.body;
                const insertedChannel = await tgChannelManager.add(data);
                res.status(200).send({
                    success: true,
                    id: insertedChannel.lastID,
                });
            })
            .post('{id}/delete', async (req, res) => {
                const channelId = req.params.id;

                if (await tgChannelManager.delete(channelId)) {
                    return res.status(200).send({ success: true });
                }

                res.status(500).send({ success: false });
            })
            .post('{id}/update', async (req, res) => {
                const channelId = req.params.id;
                const data = req.body;

                if (await tgChannelManager.update(channelId, data)) {
                    return res.status(200).send({ success: true });
                }

                return res.status(500).send({ success: false });
            })
            .get('{id}', async (req, res) => {
                const channelId = req.params.id;
                const channel = await tgChannelManager.get(channelId);
                res.status(200).send({ success: true, data: channel });
            });

        app.use('channel', router);

        app.listen(process.env.SERVER_API_PORT, () => {
            console.log(
                `Server listening on port ${process.env.SERVER_API_PORT}`
            );
        });

        const listenerBuilder = new TgChannelListener.create()
            .appId(+process.env.APP_ID)
            .appHash(process.env.APP_HASH)
            .pathStorageSessions(__dirname + '/storage')
            .rememberSession();

        const limitCycles = +process.env.LIMIT_CYCLES;
        if (limitCycles > 0) {
            listenerBuilder.setLimitCycles(limitCycles);
        }
        const listenerInterval = +process.env.LISTENER_INTERVAL;
        if (+listenerInterval > 0) {
            listenerBuilder.setListenerInterval(listenerInterval * 60 * 1000);
        }

        const tgListener = listenerBuilder.make();

        const tgWorker = new TgChannelListenerWorker.create()
            .tgChannel(tgChannelManager)
            .tgChannelListener(tgListener)
            .urlNotifyNewMessage(process.env.API_URL_NOTIFY_NEWMESSAGE)
            .make();

        tgWorker.run({
            cbEachChannel: (channel, messages) => {
                console.log(
                    `channel: ${channel.name} new messages ${messages.length}`
                );
            },
        });
    })
    .catch((err) => {
        throw new Error(err);
    });
