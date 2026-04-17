// src/utils/queue.js
let queue = [];
let active = 0;
const MAX = 2; // 🔥 keep low for Render

const runNext = async () => {
  if (active >= MAX || queue.length === 0) return;

  const { task, resolve, reject } = queue.shift();
  active++;

  try {
    const result = await task();
    resolve(result);
  } catch (err) {
    reject(err);
  } finally {
    active--;
    runNext();
  }
};

exports.addToQueue = (task) => {
  return new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject });
    runNext();
  });
};
