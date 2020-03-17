const { expect } = require("chai");
const mockFs = require('mock-fs');
const { resolve } = require("path");

const getRecursiveFiles = require("../../lib/utils/getRecursiveFiles");

describe("getRecursiveFiles", () => {

  beforeEach(() => {
    mockFs({
      'migrations': {
        prod: {
          'file1_prod.js': '',
          "file2_prod.js": ''
        },
        test: {
          'file1_test.js': ''
        }
      }
    });
  });

  it("should return all files in all directories", async () => {
    const files = await getRecursiveFiles('migrations');
    mockFs.restore();
    expect(files).to.deep.equal([
      resolve("migrations/prod/file1_prod.js"),
      resolve("migrations/prod/file2_prod.js"),
      resolve("migrations/test/file1_test.js")
    ]);
  });
});
