import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as dotenv from 'dotenv';
import TgChannelListener from '../src/TgChannelListener';
import { readFileSync } from 'fs';
import TgChannelModel from '../src/TgChannelModel';

describe('Testing TgChannelListener class', () => {
    dotenv.config({
        path: '../.env'
    });

    const makeTgListener = () => {
        TgChannelListener.prototype.getChannelHistory = vi.fn();

        return new TgChannelListener.create()
            .appId(+process.env.APP_ID)
            .appHash(process.env.APP_HASH)
            .pathStorageSessions(__dirname + '/storage')
            .rememberSession()
            .make();
    };

    const TG_CHANNEL_NAME = 'oopsfix';
    let tgListener = null;

    beforeAll(async () => {
        tgListener = makeTgListener()

        await tgListener.connect();
    }, 30000);

    it('Creating telegram channel listener and authanticating', async () => {
        const listener = makeTgListener();

        const sessionId = await listener.connect();

        expect(sessionId).not.toBeNull();
    }, 30000);

    it('Get channel history', async () => {

        const testChannel = (new TgChannelModel.create).fake({
            last_message_id: 3,
        });

        const historyResult = await tgListener.getChannelHistory(testChannel);

        expect(historyResult).not.toBeNull();

        //console.log(historyResult);

        tgListener.getChannelHistory.mockResolvedValue(
            JSON.parse(readFileSync(__dirname +'/fixtures/history_example.json'))
        );

        const newMessages = await tgListener.getNewMessageFromChannel(testChannel);

        expect(newMessages[0].id).toEqual(4);

        const newMessagesParts = await tgListener.getNewMessageFromChannel(
            testChannel.setLastMessageId(2)
        );

        expect(newMessagesParts[0].id).toEqual(3);
        expect(newMessagesParts[1].id).toEqual(4);
    });

    it('Channel history listener', async () => {
        const update = JSON.parse(readFileSync(__dirname +'/fixtures/history_example.json'));

        const firstMessage = update.messages[0];

        update.messages = update.messages.slice(1);

        tgListener.getChannelHistory.mockResolvedValue(
            update
        );

        const cbNewMessage = vi.fn();
        const cbNewMessageOnEvent = vi.fn();

        const testChannel = (new TgChannelModel.create).fake({
            last_message_id: 2,
        });

        tgListener.listenerNewMessages({
            channels: [
                testChannel
            ],
            interval: 1000 * 10,
            intervalBetweenChannels: 1000,
            onUpdate: cbNewMessage,
        });

        tgListener.on('newMessage', cbNewMessageOnEvent);

        setTimeout(() => {
            update.messages.unshift(firstMessage)
            tgListener.getChannelHistory.mockResolvedValue(
                update
            );
        }, 1000 * 8);

        await new Promise(resolve => {
            setTimeout(() => {
                expect(cbNewMessage).toHaveBeenCalledTimes(2);
                expect(cbNewMessageOnEvent).toHaveBeenCalledTimes(2);
                resolve();
            }, 1000 * 30);
        });

    }, 1000 * 60 * 2);
});
