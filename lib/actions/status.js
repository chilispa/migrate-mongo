const { find, maxBy } = require("lodash");
const migrationsDir = require("../env/migrationsDir");
const configFile = require("../env/configFile");

module.exports = async db => {
  await migrationsDir.shouldExist();
  await configFile.shouldExist();
  const fileNames = await migrationsDir.getFileNames();

  const config = await configFile.read();
  const collectionName = config.changelogCollectionName;
  const collection = db.collection(collectionName);
  const changelog = await collection.find({}).toArray();
  const latest = maxBy(changelog, change => change.appliedAt);
  const latestIndex = latest ? fileNames.findIndex(item => item === latest.fileName) : null

  function getStatus(fileName, index) {
    const itemInLog = find(changelog, { fileName });
    let status = 'PENDING'
    if (itemInLog) {
      status = itemInLog.appliedAt.toJSON();
    }
    else if (config.ignoreOldMigrations && latest && index < latestIndex) {
      status = 'IGNORED';
    } 
    return status;
  }

  const statusTable = fileNames.map((fileName, index) => {
    const appliedAt = getStatus(fileName, index)
    return { fileName, appliedAt };
  });

  return statusTable;
};
