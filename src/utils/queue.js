let queue = [];
let active = 0;

const MAX_CONCURRENT = 3; // 🔥 you can change (2–5)

const runNext = async () => {
  if (active >= MAX_CONCURRENT || queue.length === 0) return;

  const { task, resolve, reject } = queue.shift();
  active++;

  try {
    const result = await task();
    resolve(result);
  } catch (err) {
    reject(err);
  } finally {
    active--;
    runNext(); // run next task
  }
};

exports.addToQueue = (task) => {
  return new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject });
    runNext();
  });
};