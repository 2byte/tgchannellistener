import { describe, it, expect } from 'vitest';
import dbConnection from '../db_connection';
import path from 'path';
import TgChannelManager from '../src/TgChannelManager';

describe('Test TgChannel model', () => {

    it('Testing queries', async () => {
        const db = await dbConnection(path.join(__dirname, '../database/db.db3'));

        const tgChannel = new TgChannelManager.create().db(db).make();

        const result = await tgChannel.add({
            name: 'test',
            url: 'https://t.me/test',
            status: 'work',
            tracking_end_date: "2025-01-01 00:00:00",
            track_type: 'newmessage',
            track_type_lastmessage_quatity: 0,
            is_new: 1
        });

        expect(result.lastID).toBeGreaterThan(0);

        const resUpdate = await tgChannel.update(result.lastID, {status: 'stop'});

        expect(resUpdate.changes).toEqual(1);

        await tgChannel.update(result.lastID, {status: 'work'});

        const resTrackingChannels = await tgChannel.getTracking();

        expect(resTrackingChannels.length).toBeGreaterThan(0);

        const resDelete = await tgChannel.delete(result.lastID);
        expect(resDelete.changes).toEqual(1);
    });
});
