const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { appendFileSync } = require('fs');
const input = require('input');
const path = require('path');
const EventEmitter = require('events');

module.exports = class TgChannelListener extends EventEmitter {
    #appId = null;
    #appHash = null;
    #pathStorageSessions = null;

    #isUseSession = false;
    #useSessionId = null;

    #telegramClient = null;

    #listenerChannelOffsets = [];
    #limitCycles = 0;
    #countListenerCycles = 0;
    #listenerInterval = 1000 * 60 * 2;

    constructor({
        appId,
        appHash,
        pathStorageSessions,
        rememberSession,
        limitCycles = 0,
        interval = 1000 * 60 * 2,
    }) {
        super();
        this.#appId = appId;
        this.#appHash = appHash;
        this.#pathStorageSessions = pathStorageSessions;
        this.#isUseSession = rememberSession;
        this.#limitCycles = limitCycles;
        this.#listenerInterval = interval;
    }

    async connect() {
        const lastSessionKey = this.#isUseSession
            ? await this.getSession()
            : this.#useSessionId;

        const stringSessionInstance = new StringSession(lastSessionKey);

        this.#telegramClient = new TelegramClient(
            stringSessionInstance,
            this.#appId,
            this.#appHash,
            {
                connectionRetries: 5,
            }
        );

        await this.#telegramClient.start({
            phoneNumber: async () =>
                await input.text('Please enter your number: '),
            password: async () =>
                await input.text('Please enter your password: '),
            phoneCode: async () =>
                await input.text('Please enter the code you received: '),
            onError: (err) => {
                throw new Error('Error connecting to Telegram: ', {
                    cause: err,
                });
            },
        });

        const receivedSessionKey = await this.#telegramClient.session.save();

        if (!this.#useSessionId && this.#isUseSession) {
            await writeFile(
                path.join(this.#pathStorageSessions, String(this.#appId)),
                receivedSessionKey
            );
        }

        return receivedSessionKey;
    }

    async getSession() {
        return this.#isUseSession
            ? (
                  await readFile(
                      path.join(this.#pathStorageSessions, String(this.#appId))
                  )
              ).toString()
            : this.#useSessionId || null;
    }

    useSession(sessionId) {
        this.#useSessionId = sessionId;

        return this;
    }

    rememberSession() {
        this.#isUseSession = true;
        return this;
    }

    async getChannelHistory(channelModel, { limit = 50 } = {}) {
        const history = await this.#telegramClient.invoke(
            new Api.messages.GetHistory({
                peer: channelModel.name,
                limit,
            })
        );

        return history;
    }

    async getNewMessageFromChannel(channelModel, { limit = 50 } = {}) {
        const historyMessages = await this.getChannelHistory(channelModel, {
            limit,
        });

        if (historyMessages.messages?.[0]?.id === channelModel.lastMessageId) {
            return [];
        }

        const indexOffsetMessage = historyMessages.messages.findIndex(
            (message) => message.id === channelModel.lastMessageId
        );

        return indexOffsetMessage === -1
            ?  historyMessages.messages.slice(0, 1)
            : historyMessages.messages.slice(0, indexOffsetMessage).reverse();
    }

    async getLastMessageFromChannel(channelModel, { limit = 50 } = {}) {
        const historyMessages = await this.getChannelHistory(channelModel, {
            limit,
        });

        return historyMessages.messages.length > 0
            ? [...historyMessages.messages].reverse()
            : null;
    }

    /**
     *
     * @param {channels: Array.<{TgChannelModel}>} param0
     */
    async listenerNewMessages({
        channels,
        interval,
        intervalBetweenChannels = 1000,
        limit = 50,
        onUpdate,
        limitCycles = 0,
    }) {
        if (limitCycles > 0) {
            this.#limitCycles = limitCycles;
        }
        if (interval > 0) {
            this.#listenerInterval = interval;
        }

        const sleep = (seconds) => {
            return new Promise((resolve) => setTimeout(resolve, seconds));
        };

        if (channels.length === 0) {
            console.log('No channels to listen');
            return true;
        }

        let whileRun = true;
        while (whileRun) {
            for (const channel of await channels()) {
                const offsetMessageId =
                    this.#listenerChannelOffsets?.[channel.name]?.id ??
                    channel.lastMessageId;
                channel.setLastMessageId(offsetMessageId);

                let newMessages = null;

                if (channel.is_new) {
                    newMessages = await this.getLastMessageFromChannel(
                        channel,
                        { limit: 1 }
                    );
                } else {
                    newMessages = await this.getNewMessageFromChannel(channel, {
                        limit,
                    });
                }

                if (newMessages !== null && newMessages.length > 0) {
                    this.#listenerChannelOffsets[channel.name] = {
                        id: newMessages.at(-1).id,
                        date: new Date(),
                    };

                    const emitUpdate = {
                        channel: channel,
                        messages: newMessages,
                    };

                    if (onUpdate) {
                        onUpdate(emitUpdate);
                    }

                    this.emit('newMessage', emitUpdate);
                }
                if (intervalBetweenChannels)
                    await sleep(intervalBetweenChannels);

                //console.log('end of channel', channel.name);
            }

            await sleep(this.#listenerInterval);

            if (this.#limitCycles > 0) {
                if (this.#countListenerCycles + 1 >= this.#limitCycles) {
                    console.log('Stopped listener');
                    whileRun = false;
                }
                this.#countListenerCycles++;
            }
        }
    }

    async issueUpdates(channelModel, { update, interval = 4000, count = 1 }) {
        if (count >= 1) {
            const lastMessage = update.messages[0];
            const newMessage = Object.assign(
                {
                    ...lastMessage,
                },
                { id: lastMessage.id + 1 }
            );

            update.messages.unshift(newMessage);

            console.log('Update message id: ', newMessage.id);
            this.getChannelHistory = async () => {
                return update;
            };
            await new Promise((resolve) => setTimeout(resolve, interval));
            count--;
            await this.issueUpdates(channelModel, { update, count });
        } else {
            return true;
        }
    }

    resetCountListenerCycles() {
        this.#countListenerCycles = 0;
        return this;
    }

    get listenerInterval() {
        return this.#listenerInterval;
    }

    static create = class {
        #appId = null;
        #appHash = null;
        #pathStorageSessions = null;
        #remeberSession = false;
        #limitCycles = 0;
        #interval = 1000 * 60 * 2;

        appId(id) {
            this.#appId = id;
            return this;
        }

        appHash(hash) {
            this.#appHash = hash;
            return this;
        }

        rememberSession() {
            this.#remeberSession = true;
            return this;
        }

        pathStorageSessions(path) {
            this.#pathStorageSessions = path;
            return this;
        }

        setLimitCycles(limit) {
            this.#limitCycles = limit;
            return this;
        }

        setListenerInterval(interval) {
            this.#interval = interval;
            return this;
        }

        make() {
            return new TgChannelListener({
                appId: this.#appId,
                appHash: this.#appHash,
                pathStorageSessions: this.#pathStorageSessions,
                rememberSession: this.#remeberSession,
                limitCycles: this.#limitCycles,
                interval: this.#interval,
            });
        }
    };
};
