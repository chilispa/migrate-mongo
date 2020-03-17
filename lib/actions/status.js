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

  function getStatus(fileName) {
    const itemInLog = find(changelog, { fileName });
    let status = 'PENDING'
    if (itemInLog) {
      status = itemInLog.appliedAt.toJSON();
    }
    else if (config.ignoreOldMigrations && latest && fileName < latest.fileName) {
      status = 'IGNORED';
    } 
    return status;
  }

  const statusTable = fileNames.map(fileName => {
    const appliedAt = getStatus(fileName)
    return { fileName, appliedAt };
  });

  return statusTable;
};
