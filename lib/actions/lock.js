const configFile = require("../env/configFile");
const delay = require("../utils/delay");

module.exports = {
  async lock(db) {
    await configFile.shouldExist();
    const config = await configFile.read();
    const collectionName = config.lockCollectionName;
    const collection = db.collection(collectionName);

    try {
      return await collection.insertOne({_id: "lock", timestamp: new Date()});
    }
    catch(ex) {
      if(ex.code === 11000) {
        console.log("Collection already locked, trying again in 5 seconds");
        return delay(5000).then(() => this.lock(db));
      } 
      throw ex;
    }
  },

  async unlock(db) {
    const config = await configFile.read();
    const collectionName = config.lockCollectionName;
    const collection = db.collection(collectionName);
    return collection.deleteOne({_id: "lock"});
  }

};
