export function scanNetwork(ns, start = "home") {
  const seen = new Set([start]);
  const queue = [start];
  const parent = new Map([[start, null]]);

  while (queue.length > 0) {
    const host = queue.shift();
    for (const neighbour of ns.scan(host)) {
      if (seen.has(neighbour)) continue;
      seen.add(neighbour);
      parent.set(neighbour, host);
      queue.push(neighbour);
    }
  }

  return { hosts: [...seen], parent };
}

export function pathTo(parent, target) {
  if (!parent.has(target)) return [];
  const path = [];
  let current = target;
  while (current !== null) {
    path.push(current);
    current = parent.get(current) ?? null;
  }
  return path.reverse();
}

