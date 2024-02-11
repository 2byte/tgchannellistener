const EventEmitter = require('events');

class ErrorNotifyNewMessage extends Error {
    constructor(message) {
        super(message);
    }
}

exports.ErrorNotifyNewMessage = ErrorNotifyNewMessage

module.exports = class TgChannelListenerWorker extends EventEmitter {
    /**
     * @type {TgChannelListener}
     */
    #tgChannelListener = null;
    #tgChannelManager = null;
    #urlNotifyNewMessage = null;
    #timerFetchChannelLastMessage = null;

    constructor({ tgChannelListener, tgChannelManager, urlNotifyNewMessage }) {
        super();
        this.#tgChannelListener = tgChannelListener;
        this.#tgChannelManager = tgChannelManager;
        this.#urlNotifyNewMessage = urlNotifyNewMessage;
    }

    static create = class {
        #tgChannelListener = null;
        #tgChannelManager = null;
        #urlNotifyNewMessage = null;

        tgChannelListener(tgChannelListenerInstance) {
            this.#tgChannelListener = tgChannelListenerInstance;
            return this;
        }

        tgChannel(tgChannelInstance) {
            this.#tgChannelManager = tgChannelInstance;
            return this;
        }

        urlNotifyNewMessage(url) {
            this.#urlNotifyNewMessage = url;
            return this;
        }

        make() {
            return new TgChannelListenerWorker({
                tgChannelListener: this.#tgChannelListener,
                tgChannelManager: this.#tgChannelManager,
                urlNotifyNewMessage: this.#urlNotifyNewMessage,
            });
        }
    };

    async notifyNewMessage(channel, messages) {
        const res = await fetch(this.#urlNotifyNewMessage, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                channel_name: channel.name,
                messages
            }),
        });

        const resBody = await res.json();

        if (res.ok && resBody.success === true) {
            return true;
        }

        return false;
    }

    async onUpdateChannel(channel, messages) {
        const last_message_id = messages.at(-1).id;

        if (channel.is_new) {
            const updateAttributes = {
                is_new: 0,
                last_message_id
            };
            this.#tgChannelManager.update(channel.id, updateAttributes);

            channel.refreshAttributes(updateAttributes);

            return null;
        }

        if (channel.track_type === 'lastmessage') {
            await channel.update({
                status: 'stop',
                last_message_id,
            });
        }

        if (this.#urlNotifyNewMessage !== null) {
            try {
                // send previous messages which are not sent yet
                if (this.notifyNewMessage(channel, messages)) {
                    await this.#tgChannelManager.update(channel.id, {
                        last_message_id,
                        wait_send_message: null,
                    });

                    channel.refreshAttributes({ last_message_id });
                } else {
                    await channel.updateWaitSendMessage(messages);
                    // send last message again if it is not sent yet
                    if (channel.track_type == 'lastmessage') {
                        await channel.update({ status:'work', last_message_id: 0 });
                    }
                }
            } catch (err) {
                throw new ErrorNotifyNewMessage(`Error notify new message: ${err.message}`, {cause: err});
            }
        }
    };

    sendPreviousMessages(channel) {
        if (channel.wait_send_message !== null) {
            return this.notifyNewMessage(channel, channel.wait_send_message).then((ok) => {
                return ok ? channel.update({ wait_send_message: null }) : false;
            });
        }

        return null;
    }

    async run({ cbEachChannel, limitCycles = 0 }) {

        const channelForTracking = async () => {
            return await this.#tgChannelManager.getChannel({
                track_type: 'newmessage',
            }) ?? []
        };

        // fetch last message
        const fetchChannelForLastMessage = async () => {

            const channelForFetchLastMessage = await this.#tgChannelManager.getChannel({
                track_type: 'lastmessage',
            }) ?? [];

            for (const channel of channelForFetchLastMessage) {
                this.sendPreviousMessages(channel);

                this.#tgChannelListener.getLastMessageFromChannel(channel, {
                    limit: channel.trackTypeLastMessageQuantity,
                }).then((messages) => {
                    this.onUpdateChannel(channel, messages);
                    cbEachChannel(channel, messages);
                });
            }
        }

        this.#timerFetchChannelLastMessage = setInterval(fetchChannelForLastMessage, this.#tgChannelListener.listenerInterval);

        this.#tgChannelListener.on('newMessage', async (data) => {
            try {
                this.sendPreviousMessages(data.channel);
                this.onUpdateChannel(data.channel, data.messages);
            } catch (err) {
                if (err instanceof ErrorNotifyNewMessage) {
                    console.error("Error notify for channel:", data.channel.name, err);
                } else {
                    throw err;
                }
            }
            this.emit('onUpdateChannel', data);
        });

        // Tracking new messages
        await this.#tgChannelListener.listenerNewMessages({
            channels: channelForTracking,
            onUpdate: cbEachChannel,
            limitCycles
        });

        return true;
    }

    stop() {
        clearInterval(this.#timerFetchChannelLastMessage);
        this.#tgChannelListener.removeAllListeners('newMessage');
    }
};
