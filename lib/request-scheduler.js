/**
 * Request Scheduler
 * Ensures outbound requests are spaced evenly with optional jitter,
 * per-service keys and configurable intervals. Production-safe.
 */

class RequestScheduler {
    constructor() {
        this.queues = new Map(); // key -> { queue: [], running: 0, nextAvailable: 0 }
    }

    getConfigForKey(key) {
        const toInt = (v, d) => {
            const n = parseInt(v, 10);
            return Number.isFinite(n) ? n : d;
        };

        // Global defaults (aggressive throughput by default)
        const globalMin = toInt(process.env.REQUEST_MIN_INTERVAL_MS, 0);
        const jitterPct = Math.min(Math.max(parseFloat(process.env.THROTTLE_JITTER_PCT || '0'), 0), 1); // 0..1
        const concurrency = toInt(process.env.THROTTLE_CONCURRENCY, 256);

        // Per-key overrides
        const perKeyMin = {
            gmail: toInt(process.env.GMAIL_MIN_INTERVAL_MS, 0),
            openai: toInt(process.env.OPENAI_MIN_INTERVAL_MS, 0),
            pdf: toInt(process.env.PDF_MIN_INTERVAL_MS, 0),
        };

        const minInterval = perKeyMin[key] ?? globalMin;
        return { minInterval, jitterPct, concurrency };
    }

    ensureState(key) {
        if (!this.queues.has(key)) {
            this.queues.set(key, { queue: [], running: 0, nextAvailable: 0 });
        }
        return this.queues.get(key);
    }

    schedule(fn, key = 'global', opts = {}) {
        return new Promise((resolve, reject) => {
            const state = this.ensureState(key);
            state.queue.push({ fn, resolve, reject, opts });
            this.process(key);
        });
    }

    process(key) {
        const state = this.ensureState(key);
        const { minInterval, jitterPct, concurrency } = this.getConfigForKey(key);

        if (state.running >= concurrency) return;
        const job = state.queue.shift();
        if (!job) return;

        const now = Date.now();
        const baseWait = Math.max(0, state.nextAvailable - now);

        const run = async () => {
            state.running++;
            try {
                const result = await job.fn();
                // After success, set next window with jitter
                const jitter = (Math.random() * 2 - 1) * jitterPct; // -pct..+pct
                const intervalWithJitter = Math.max(0, Math.round(minInterval * (1 + jitter)));
                state.nextAvailable = Date.now() + intervalWithJitter;
                job.resolve(result);
            } catch (err) {
                job.reject(err);
            } finally {
                state.running--;
                // Process the next job
                setImmediate(() => this.process(key));
            }
        };

        if (baseWait > 0) {
            setTimeout(run, baseWait);
        } else {
            run();
        }
    }
}

module.exports = new RequestScheduler();
