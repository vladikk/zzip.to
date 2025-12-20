const kvsData = new Map();

function setKvsData(data) {
  kvsData.clear();
  Object.entries(data).forEach(([k, v]) => kvsData.set(k, v));
}

function kvs(id) {
  return {
    async get(key) {
      if (!kvsData.has(key)) {
        throw new Error('Key not found');
      }
      return kvsData.get(key);
    }
  };
}

module.exports = { kvs, setKvsData };
