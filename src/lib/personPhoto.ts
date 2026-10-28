const cache = new Map<string, Promise<string | null>>();
let inFlight = 0;
const waiters: Array<() => void> = [];
const CONCURRENCY = 3;

function acquire() {
  if (inFlight < CONCURRENCY) {
    inFlight += 1;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => waiters.push(resolve));
}

function release() {
  const next = waiters.shift();
  if (next) next();
  else inFlight = Math.max(0, inFlight - 1);
}

export function personPhotoUrl(email: string) {
  return `/api/people/photo?email=${encodeURIComponent(email.trim())}`;
}

export function loadPersonPhoto(email: string) {
  const key = email.trim().toLowerCase();
  if (!key) return Promise.resolve(null);
  const hit = cache.get(key);
  if (hit) return hit;
  const request = acquire()
    .then(() => fetch(personPhotoUrl(key), { credentials: "same-origin" }))
    .then((res) => {
      const type = (res.headers.get("content-type") || "").toLowerCase();
      if (!res.ok || !type.startsWith("image/")) throw new Error("no photo");
      return res.blob();
    })
    .then((blob) => URL.createObjectURL(blob))
    .catch(() => null)
    .finally(release);
  cache.set(key, request);
  return request;
}
