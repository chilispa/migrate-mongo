const _ = require("lodash");
const pEachSeries = require("p-each-series");
const status = require("./status");
const configFile = require("../env/configFile");
const lock = require("./lock");

module.exports = async (db, baselineName) => {
  const config = await configFile.read();
  if (config.useLock) {
    await lock.lock(db);
  }

  try {
    const statusItems = await status(db);
    if (!statusItems.find(item => item.fileName === baselineName)) {
      throw new Error(`Baseline migration: ${baselineName} not found`)
    }

    const pendingItems = statusItems.filter(item => 
      (item.appliedAt === 'PENDING' || item.appliedAt === 'IGNORED') && (item.fileName <= baselineName)
    );
    const marked = [];

    const collectionName = config.changelogCollectionName;
    const collection = db.collection(collectionName);

    const markItem = async item => {
      const { fileName } = item;
      const appliedAt = new Date();

      try {
        await collection.insertOne({ fileName, appliedAt });
      } catch (err) {
        throw new Error(`Could not update changelog: ${err.message}`);
      }
      marked.push(item.fileName);
    };

    await pEachSeries(pendingItems, markItem);
    return marked;
  }
  finally {
    if (config.useLock) {
      await lock.unlock(db);
    }
  }
};
