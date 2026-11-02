const { Client } = require('pg');

// Prisma can fan out relation reads inside one transaction. pg deprecates
// overlapping queries on a single client, so queue them before pg.
// Each pooled client owns its own queue; separate connections stay concurrent.
class PrismaPgClient extends Client {
  #pending = Promise.resolve();

  query(...args) {
    let callback = typeof args.at(-1) === 'function' ? args.pop() : null;
    if (!callback && typeof args[0]?.callback === 'function') {
      const { callback: configuredCallback, ...config } = args[0];
      callback = configuredCallback;
      args[0] = config;
    }
    const result = this.#pending.then(() => super.query(...args));
    // A failed statement must still allow ROLLBACK and subsequent pool use.
    this.#pending = result.then(
      () => undefined,
      () => undefined
    );
    if (callback) {
      result.then(
        (value) => callback(null, value),
        (error) => callback(error)
      );
      return undefined;
    }
    return result;
  }
}

module.exports = { PrismaPgClient };
