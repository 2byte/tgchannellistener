import { vi } from 'vitest';
import TgChannelListener from '../../src/TgChannelListener';

export const createTgListener = ({limitCycles = 0, listenerInterval = 0} = {}) => {
    TgChannelListener.prototype.getChannelHistory = vi.fn();

    const listener = new TgChannelListener.create()
        .appId(+process.env.APP_ID)
        .appHash(process.env.APP_HASH)
        .pathStorageSessions(__dirname + '/storage')
        .rememberSession();

    if (limitCycles > 0) {
        listener.setLimitCycles(limitCycles);
    }
    if (listenerInterval > 0) {
        listener.setListenerInterval(listenerInterval);
    }

    return listener.make();
};
