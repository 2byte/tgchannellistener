module.exports = class TgChannelModel {

    #attributes = {};
    #manager = null;

    constructor(attributes) {
        this.#attributes = attributes;
    }

    static create = class {
        #attributes = {};

        constructor(tgChannelAttributes)  {
            this.#attributes = tgChannelAttributes;
        }

        fake(attributes = {}) {
            const addDate = new Date();
            addDate.setHours(addDate.getHours() + 10);
            const addZero = (num) => num < 10? `0${num}` : num;

            return new TgChannelModel(Object.assign({
                id: 1,
                name: 'fake',
                url: 'https://t.me/fake',
                status: 'work',
                track_type: 'newmessage',
                tracking_end_date: `${addDate.getFullYear()}-${addZero(addDate.getMonth()+1)}-${addZero(addDate.getDate())} ${addZero(addDate.getHours())}:${addZero(addDate.getMinutes())}:${addZero(addDate.getSeconds())}`,
                is_new: 1,
                last_message_id: 0,
                track_type_lastmessage_quantity: 0,
            }, attributes));
        }

        make() {
            return new TgChannelModel(this.#attributes);
        }
    }

    get id() {
        return this.#attributes.id;
    }

    get track() {
        return this.#attributes.status == 'work' && this.#attributes.tracking_end_date >= new Date();
    }

    get name() {
        return this.#attributes.name;
    }

    get is_new() {
        return this.#attributes.is_new;
    }

    get lastMessageId() {
        return this.#attributes.last_message_id;
    }

    get track_type() {
        return this.#attributes.track_type;
    }

    get trackTypeLastMessageQuantity() {
        return this.#attributes.track_type_lastmessage_quantity;
    }

    get attributes() {
        return this.#attributes;
    }

    get status() {
        return this.#attributes.status;
    }

    get wait_send_message() {
        return this.#attributes.wait_send_message !== null ? JSON.parse(this.#attributes.wait_send_message) : null;
    }

    setLastMessageId(id) {
        this.#attributes.last_message_id = id;
        return this;
    }

    setManager(manager) {
        this.#manager = manager;
        return this;
    }

    async save() {
        const added = await this.#manager.save(this);

        this.#attributes.id = added.lastID;
        return this;
    }

    destroy() {
        return this.#manager.destroy(this);
    }

    async refresh() {
        const data = await this.#manager.getData(this.id);
        this.#attributes = data;

        return this;
    }

    async refreshAttributes(attributes) {
        Object.assign(this.#attributes, attributes);
        return this;
    }

    async update(attributes = {}) {
        Object.assign(this.#attributes, attributes);

        await this.#manager.update(this.id, this.#attributes);

        return this.refresh();
    }

    updateWaitSendMessage(messages) {
        const prevMessages = this.wait_send_message;

        if (prevMessages !== null) {
            const newBundleMessage = prevMessages.concat(messages);

            return this.update({wait_send_message: JSON.stringify(newBundleMessage)});
        }

        return false;
    }
}
