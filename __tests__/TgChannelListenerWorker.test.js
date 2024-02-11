import { describe, beforeAll, it, vi, expect } from 'vitest';
import TgChannelListenerWorker from '../src/TgChannelListenerWorker';
import dbConnection from '../db_connection';
import path from 'path';
import TgChannelModel from '../src/TgChannelModel';
import TgChannelManager from '../src/TgChannelManager';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { createTgListener } from './helpers/helpers';
import express from 'express';

describe('Test TgChannelListenerWorker', () => {
    config({ path: path.join(__dirname, '..', '.env') });

    const createTgWorker = ({ tgChannelManager, tgChannelListener } = {}) => {
        return new TgChannelListenerWorker.create()
            .tgChannel(tgChannelManager)
            .tgChannelListener(tgChannelListener)
            .urlNotifyNewMessage('http://localhost:3434')
            .make();
    };

    let db = null;

    beforeAll(async () => {
        db = await dbConnection(
            path.join(__dirname, '..', 'database', 'db.db3')
        );
    });

    it('Testing tracking for new posts tgChannelListenerWorker', async () => {
        const update = JSON.parse(
            readFileSync(__dirname + '/fixtures/history_example.json')
        );

        const tgChannelManager = new TgChannelManager.create().db(db).make();

        await tgChannelManager.deleteAll();

        const tgChannelListener = createTgListener({
            limitCycles: 5,
            listenerInterval: 3000,
        });

        const tgWorker = createTgWorker({
            tgChannelListener,
            tgChannelManager,
        });

        // Start new channel
        const notifyNewMessageCb = vi.fn().mockResolvedValueOnce(true);
        tgWorker.notifyNewMessage = notifyNewMessageCb;

        const newChannel = new TgChannelModel.create().fake({
            last_message_id: 0,
            is_new: 1,
        });

        newChannel.setManager(tgChannelManager);
        await newChannel.save();

        const newChannelOnUpdate = vi.fn();

        tgChannelListener.getChannelHistory = vi.fn().mockResolvedValue(update);

        await tgWorker.run({
            cbEachChannel: newChannelOnUpdate,
        });

        expect((await newChannel.refresh()).attributes).toMatchObject({
            is_new: 0,
            last_message_id: update.messages[0].id,
        });
        expect(newChannelOnUpdate).toHaveBeenCalledTimes(1);
        expect(notifyNewMessageCb).toHaveBeenCalledTimes(0);

        tgWorker.stop();

        // Start next channel tracking
        const nextNotifyNewMessageCb = vi.fn().mockResolvedValue(true);
        tgWorker.notifyNewMessage = nextNotifyNewMessageCb;

        const resultUpdates = tgChannelListener.issueUpdates(newChannel, {
            update,
            count: 2,
            interval: 4000,
        });

        const nextChannelOnUpdate = vi.fn();

        tgChannelListener.resetCountListenerCycles();

        await tgWorker.run({
            cbEachChannel: nextChannelOnUpdate,
        });

        await resultUpdates;

        expect((await newChannel.refresh()).attributes).toMatchObject({
            is_new: 0,
            last_message_id: update.messages[0].id,
        });
        expect(nextNotifyNewMessageCb).toHaveBeenCalledTimes(2);
        expect(nextChannelOnUpdate).toHaveBeenCalledTimes(2);
        expect(nextNotifyNewMessageCb).toHaveBeenCalledTimes(2);

        tgWorker.stop();

        // Start tracking for channel with type_track lastmessage
        await newChannel.update({
            track_type: 'lastmessage',
            track_type_lastmessage_quantity: 3,
            last_message_id: 0,
        });

        const lastMessageOnUpdate = vi.fn();
        const newUpdate = JSON.parse(
            readFileSync(__dirname + '/fixtures/history_example.json')
        );
        tgChannelListener.getChannelHistory = vi
            .fn()
            .mockResolvedValue(newUpdate);

        await tgWorker.run({
            cbEachChannel: lastMessageOnUpdate,
            forFetchChannel: true
        });
        await new Promise(resolve => setTimeout(resolve, 4000));

        const freshChannel = await newChannel.refresh();

        expect(freshChannel.status).toEqual('stop');
        expect(lastMessageOnUpdate).toHaveBeenCalledTimes(1);
        expect(freshChannel.lastMessageId).toEqual(newUpdate.messages[0].id);
    }, 50000);

    it('Testing notifyNewMessage', async () => {
        const tgWorker = createTgWorker();

        const app = express();

        app.use(express.json());

        app.post('/', (req, res) => {
            res.send({success: true})
        });

        app.listen(3434, () => {
            console.log('Server is running on port 3434');
        });

        const update = JSON.parse(
            readFileSync(__dirname + '/fixtures/history_example.json')
        );

        const channel = new TgChannelModel.create().fake();

        const resultNotify = await tgWorker.notifyNewMessage(channel, update.messages);

        await new Promise((resolve) => {
            setTimeout(() => {
                expect(resultNotify).toBe(true);
                resolve();
            }, 5000);
        })
    }, 10000);
});
