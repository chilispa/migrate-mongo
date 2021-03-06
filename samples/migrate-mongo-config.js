// In this file you can configure migrate-mongo

const config = {
  mongodb: {
    // TODO Change (or review) the url to your MongoDB:
    url: "mongodb://localhost:27017",

    // TODO Change this to your database name:
    databaseName: "YOURDATABASENAME",

    options: {
      useNewUrlParser: true, // removes a deprecation warning when connecting
      useUnifiedTopology: true, // removes a deprecating warning when connecting
      //   connectTimeoutMS: 3600000, // increase connection timeout to 1 hour
      //   socketTimeoutMS: 3600000, // increase socket timeout to 1 hour
    }
  },

  // The migrations dir, can be an relative or absolute path. Only edit this when really necessary.
  migrationsDir: "migrations",

  // Regex with file files to include, relative to migrationsDir
  include: null,

  // The mongodb collection where the applied changes are stored. Only edit this when really necessary.
  changelogCollectionName: "changelog",

  // The mondogb collection where lock documents are stored. Only edit this when really necessary.
  lockCollectionName: "migrate_mongo_lock",

  // Writes a lock to prevent concurrent migrations to run.
  useLock: true,

  // Skip migrations older than the latest applied one
  ignoreOldMigrations: true
};

// Return the config as a promise
module.exports = config;
