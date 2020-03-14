const { expect } = require("chai");
const sinon = require("sinon");

const proxyquire = require("proxyquire");

describe("lock", () => {
  let lock;
  let configFile;
  let db;
  let lockCollection;

  function mockConfigFile() {
    return {
      shouldExist: sinon.stub().resolves(),
      read: sinon.stub().returns({
        lockCollectionName: "migrate_mongo_lock"
      })
    };
  }

  function mockDb() {
    const mock = {};
    mock.collection = sinon.stub();
    mock.collection.withArgs("migrate_mongo_lock").returns(lockCollection);
    return mock;
  }

  function duplicateError() {
    const error = new Error("Duplicate _id");
    error.code = 11000;
    return error;
  }

  function mockLockCollection() {
    const insertStub = sinon.stub();
    insertStub.onFirstCall().resolves();
    insertStub.rejects(duplicateError());

    return {
      deleteOne: sinon.stub().resolves(),
      insertOne: insertStub
    };
  }

  beforeEach(() => {
    lockCollection = mockLockCollection();

    configFile = mockConfigFile();
    db = mockDb();
    lock = proxyquire("../../lib/actions/lock", {
      "../env/configFile": configFile
    });
  });

  it("should check that the config file exists", async () => {
    await lock.lock(db);
    expect(configFile.shouldExist.called).to.equal(true);
  });

  it("should yield an error when config file does not exist", async () => {
    configFile.shouldExist.returns(
      Promise.reject(new Error("config file does not exist"))
    );
    try {
      await lock.lock(db);
      expect.fail("Error was not thrown");
    } catch (err) {
      expect(err.message).to.equal("config file does not exist");
    }
  });

  it("should insert lock document with current time and _id equal to 'lock'", async () => {
    const clock = sinon.useFakeTimers(
      new Date("2016-06-09T08:07:00.077Z").getTime()
    );
    await lock.lock(db);
    expect(lockCollection.insertOne.called).to.equal(true);
    expect(lockCollection.insertOne.firstCall.args).to.eql([{_id: "lock", timestamp: new Date("2016-06-09T08:07:00.077Z")}]);
    clock.restore();
  });

  it("should retry if document already exists", async () => {
    const clock = sinon.useFakeTimers(new Date());
    lockCollection.insertOne = sinon.stub().rejects(duplicateError());
    lock.lock(db).catch(() => expect.fail("Unexpected error"));
    await clock.tickAsync(0);
    expect(lockCollection.insertOne.called).to.equal(true);
    lockCollection.insertOne.resetHistory();
    expect(lockCollection.insertOne.called).to.equal(false);
    await clock.tickAsync(1000);
    expect(lockCollection.insertOne.called).to.equal(false);
    await clock.tickAsync(5000);
    expect(lockCollection.insertOne.called).to.equal(true);
    clock.restore();
  })

  it("should propagate unhandled mongo expeptions", async () => {
    lockCollection.insertOne = sinon.stub().rejects(new Error("Unhandled mongo exception"));
    try {
      await lock.lock(db);
      expect.fail("Error was not thrown");
    } catch (err) {
      expect(err.message).to.equal("Unhandled mongo exception");
    }
  })

  it("should unlock when locked", async () => {
    await lock.lock(db);
    await lock.unlock(db);
    expect(lockCollection.deleteOne.firstCall.args).to.eql([{_id: "lock"}]);
    expect(lockCollection.deleteOne.calledAfter(lockCollection.insertOne)).to.equal(true);
  })

});
