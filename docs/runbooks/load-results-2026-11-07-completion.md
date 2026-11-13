# Completion exploratory load — 2026-11-07

Frozen runtime: root `c8fab886ee541ca150c0bf593818a5f10ebfd03f`, server `ece18a380564ed2d34c7d417135abce71815f087`, client `634ec436f7ba993f38f156b5d65960810a08d3dc`, agent `962df0d`. Local Phoenix dev runtime and Node generator on `127.0.0.1:4200`, dedicated database `delivest_s5_load_20261107`. This is a short exploratory safe subset, not a production capacity test. Raw reports: `/tmp/delivest-completion-load-{100,500,1000}.json`. The tracked [compact evidence](evidence/refactor-completion-load-2026-11-07.json) retains config, resources, telemetry, summary, gate, and each raw file's SHA-256, without per-request samples.

Later root `a5429ac` and server `2ae3166` changed E2E tests and a test helper; the application runtime path measured here was unchanged. The numbers remain evidence for the frozen runtime above.

The seeded fixture has five active branches, 1000 products, 100 with modifier choices, and 15 promotions. Virtual sessions use 10 s think time, 80% menu and 20% cart intent; a separate stream places 50 guest pickup/cash orders per minute. Each stage has a 120 s active window and about 10 s drain. Cart/order actions select plain products. Gates: p95 menu ≤200 ms, cart ≤300 ms, order save without provider wait ≤500 ms, technical 5xx/timeouts <0.1%; unexpected 4xx and 429 fail the exploratory gate. The three stages reuse the fixture and warm cache. Generator and app share one host.

| Sessions | Requests (menu/cart/order) | Menu p50/p95/p99 ms | Cart p50/p95/p99 ms | Order p50/p95/p99 ms | Orders in active window | Technical / business / 429 | Short gate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 100 | 1333 (959/274/100) | 33.31/44.28/63.87 | 32.33/45.62/61.03 | 41.66/65.80/70.32 | 100 | 0 / 0 / 0 | pass |
| 500 | 6106 (4779/1226/101) | 47.76/61.91/67.48 | 47.60/64.94/86.78 | 60.04/72.55/78.38 | 100 | 0 / 0 / 0 | pass |
| 1000 | 12066 (9549/2417/100) | 55.38/70.53/77.13 | 55.42/73.00/80.06 | 68.79/81.16/84.43 | 100 | 0 / 0 / 0 | pass |

At 500 sessions, 101 order flows completed in the measured/drain interval; 100 counted as successful orders inside the active 120 s window (50/min). All three JSON gate fields say `thresholds_met_for_short_run_only`. SQL telemetry is coarse: 5 s snapshots include background work and drain, so it cannot attribute queries or pool saturation to individual HTTP actions. SQL count deltas were 24,754 / 73,492 / 134,114; total DB time deltas 11.45 / 89.73 / 304.61 s; queue time deltas 2.70 / 60.80 / 247.56 s for the 100 / 500 / 1000 stages. The large 1000-session queue sum is a profiling lead, not a measured pool saturation ratio. Oban completed counts rose 2,917→3,423, 3,423→3,937, and 3,937→4,446. Process RSS changed 203,852→184,288, 362,060→224,912, and 532,664→277,936 KiB. These short deltas do not prove stable backlog or memory.

The workload excludes login/account, delivery, loyalty, online payment, sockets, provider latency/faults, cold-cache spike, and modifier checkout. N02 still needs the agreed 5 min warmup, 30 min stable, 5 min spike, ≥2 h soak, and three comparable repetitions; N04 fault recovery and pilot remain separate. No production capacity or live-provider result is inferred from this run.
