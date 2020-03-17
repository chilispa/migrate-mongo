const fs = require("fs-extra");
const path = require("path");

module.exports =   async function getRecursiveFiles(dir) {
  const dirents = await fs.readdir(dir, {withFileTypes: true});
  const files = await Promise.all(dirents.map((dirent) => {
    const res = path.resolve(dir, dirent.name);
    return dirent.isDirectory() ? getRecursiveFiles(res) : res;
  }));
  return files.flat();
}