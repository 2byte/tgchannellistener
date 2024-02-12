const { last } = require('lodash');
const TgChannel = require('./TgChannelModel'); // eslint-disable-line no-unused-vars

module.exports = class TgChannelManager {
    #table = 'telegram_channels';
    #db = null;
    #attributes = [
        'name',
        'url',
        'status',
        'tracking_end_date',
        'track_type',
        'track_type_lastmessage_quantity',
        'is_new',
        'last_message_id',
    ];

    constructor({ table, db }) {
        this.#table = table;
        this.#db = db;
    }

    static create = class {
        #table = 'telegram_channels';
        #db = null;

        table(table) {
            this.#table = table;
            return this;
        }

        db(dbInstance) {
            this.#db = dbInstance;
            return this;
        }

        make() {
            return new TgChannelManager({
                db: this.#db,
                table: this.#table,
            });
        }
    };

    add({
        name,
        url,
        status,
        tracking_end_date,
        track_type,
        track_type_lastmessage_quantity = 0,
        is_new = 1,
        last_message_id = 0,
    }) {
        const attributes = this.#attributes
            .map((attribute) => {
                return '`' + attribute + '`';
            })
            .join(',');
        const attributesValueTemplate = this.#attributes
            .map((attribute) => {
                return `?`;
            })
            .join(',');

        return this.#db.run(
            `INSERT INTO ${
                this.#table
            } (${attributes}) VALUES(${attributesValueTemplate})`,
            [
                name,
                url,
                status,
                tracking_end_date,
                track_type,
                track_type_lastmessage_quantity,
                is_new,
                last_message_id,
            ]
        );
    }

    save(channel) {
        return this.add(channel.attributes);
    }

    destroy(channel) {
        return this.delete(channel.id);
    }

    delete(id) {
        return this.#db.run(`DELETE FROM ${this.#table} WHERE id =?`, [id]);
    }

    update(id, attributes) {
        const attributeUpdateTemplate = Object.keys(attributes)
            .map((key) => {
                return '`' + key + '`=?';
            })
            .join(',');
        return this.#db.run(
            `UPDATE ${this.#table} SET ${attributeUpdateTemplate} WHERE id=?`,
            [...Object.values(attributes), id]
        );
    }

    getTracking() {
        return this.#db.all(
            `SELECT * FROM ${
                this.#table
            } WHERE status = 'work' AND tracking_end_date >= datetime('now')`
        );
    }

    async get(id) {
        return new TgChannel(await this.#db.get('SELECT * FROM `telegram_channels` WHERE `id`=?', [id]));
    }

    async getData(id) {
        return (await this.get(id)).attributes;
    }

    async getChannel(attributes = {}) {
        const defaultAttributes = Object.assign(
            {
                status: 'work',
            },
            attributes
        );

        const sqlWhere = Object.keys(defaultAttributes)
            .map((key) => {
                return '`' + key + '`=?';
            })
            .join(' AND ');

        const sql = `SELECT * FROM ${
            this.#table
        } WHERE status =? AND tracking_end_date >=datetime('now') AND ${sqlWhere}`;

        const channels = await this.#db.all(sql, [
            defaultAttributes.status,
            ...Object.values(defaultAttributes),
        ]);

        return channels !== null
            ? channels.map((channel) => {
                  return new TgChannel(channel).setManager(this);
              })
            : [];
    }

    all() {
        return this.#db.all('SELECT * FROM '+ this.#table);
    }

    deleteAll() {
        return this.#db.run(`DELETE FROM ${this.#table}`);
    }
};
