const { expect } = require("chai");
const sinon = require("sinon");

const proxyquire = require("proxyquire");

describe("baseline", () => {
  let baseline;
  let status;
  let configFile;
  let db;
  let lock;
  let changelogCollection;

  function mockStatus() {
    return sinon.stub().returns(
      Promise.resolve([
        {
          fileName: "20160605123224-first_applied_migration.js",
          appliedAt: new Date()
        },
        {
          fileName: "20160606093207-first_ignored_migration.js",
          appliedAt: 'IGNORED'
        },
        {
          fileName: "20160606093207-second_applied_migration.js",
          appliedAt: new Date()
        },
        {
          fileName: "20160607173840-first_pending_migration.js",
          appliedAt: "PENDING"
        },
        {
          fileName: "20160608060209-second_pending_migration.js",
          appliedAt: "PENDING"
        }
      ])
    );
  }

  function mockConfigFile() {
    return {
      shouldExist: sinon.stub().returns(Promise.resolve()),
      read: sinon.stub().returns({
        changelogCollectionName: "changelog"
      })
    };
  }

  function mockDb() {
    const mock = {};
    mock.collection = sinon.stub();
    mock.collection.withArgs("changelog").returns(changelogCollection);
    return mock;
  }

  function mockChangelogCollection() {
    return {
      insertOne: sinon.stub().returns(Promise.resolve())
    };
  }

  function mockLock() {
    return {
      lock: sinon.stub().resolves(),
      unlock: sinon.stub().resolves()
    }
  }

  function loadBaselineWithInjectedMocks() {
    return proxyquire("../../lib/actions/baseline", {
      "./status": status,
      "../env/configFile": configFile,
      "./lock": lock
    });
  }

  beforeEach(() => {
    changelogCollection = mockChangelogCollection();

    status = mockStatus();
    configFile = mockConfigFile();
    db = mockDb();
    lock = mockLock();

    baseline = loadBaselineWithInjectedMocks();
  });

  it("should fetch the status", async () => {
    await baseline(db, '20160605123224-first_applied_migration.js');
    expect(status.called).to.equal(true);
  });

  it("should fail on invalid migration name", async () => {
    try {
      await baseline(db, 'invalid.js');
      expect.fail("Error was not thrown");
    } catch (err) {
      expect(err.message).to.deep.equal(
        "Baseline migration: invalid.js not found"
      );
    }
  });

  it("should populate the changelog with info about the upgraded migrations", async () => {
    const clock = sinon.useFakeTimers(
      new Date("2016-06-09T08:07:00.077Z").getTime()
    );
    await baseline(db, "20160607173840-first_pending_migration.js");

    expect(changelogCollection.insertOne.called).to.equal(true);
    expect(changelogCollection.insertOne.callCount).to.equal(2);
    expect(changelogCollection.insertOne.getCall(0).args[0]).to.deep.equal({
      appliedAt: new Date("2016-06-09T08:07:00.077Z"),
      fileName: "20160606093207-first_ignored_migration.js"
    });
    expect(changelogCollection.insertOne.getCall(1).args[0]).to.deep.equal({
      appliedAt: new Date("2016-06-09T08:07:00.077Z"),
      fileName: "20160607173840-first_pending_migration.js"
    });
    clock.restore();
  });

  it("should yield a list of upgraded migration file names", async () => {
    const upgradedFileNames = await baseline(db, '20160607173840-first_pending_migration.js');
    expect(upgradedFileNames).to.deep.equal([
      "20160606093207-first_ignored_migration.js",
      "20160607173840-first_pending_migration.js",
    ]);
  });

  it("should yield an error + items already migrated when unable to update the changelog", async () => {
    changelogCollection.insertOne
      .onSecondCall()
      .returns(Promise.reject(new Error("Kernel panic")));
    try {
      await baseline(db, '20160607173840-first_pending_migration.js');
      expect.fail("Error was not thrown");
    } catch (err) {
      expect(err.message).to.deep.equal(
        "Could not update changelog: Kernel panic"
      );
    }
  });

  it("should not lock and unlock when not configured", async () => {
    await baseline(db, '20160607173840-first_pending_migration.js');
    expect(lock.lock.called).to.equal(false);
    expect(lock.unlock.called).to.equal(false);
  })

  it("should lock and unlock when configured", async () => {
    configFile.read.returns({ changelogCollectionName: "changelog", useLock: true });
    await baseline(db, '20160607173840-first_pending_migration.js');
    expect(lock.lock.called).to.equal(true);
    expect(lock.unlock.called).to.equal(true);
  })

  it("should unlock also with unhandled exception", async () => {
    configFile.read.returns({useLock: true});
    status.rejects();
    try {
      await baseline(db, '20160607173840-first_pending_migration.js');
      expect.fail("Error was not thrown");
    }
    catch(ex) {
      expect(lock.unlock.called).to.equal(true);
    }
  })
});
