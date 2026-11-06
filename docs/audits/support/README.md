# Order-create benchmark support

`order-create-bench.exs` is a local test-only harness. It uses `Delivest.Factory` and `Delivest.Oms.create_order/1`; it makes no HTTP/provider calls. It refuses to run outside `MIX_ENV=test` or without a `MIX_TEST_PARTITION` beginning `_capacity_bench_`.

From the `server/` directory, use a fresh partition for each run:

```sh
MIX_ENV=test MIX_TEST_PARTITION=_capacity_bench_local_20261106_01 mix ecto.create
MIX_ENV=test MIX_TEST_PARTITION=_capacity_bench_local_20261106_01 mix ecto.migrate
MIX_ENV=test MIX_TEST_PARTITION=_capacity_bench_local_20261106_01 mix run ../docs/audits/support/order-create-bench.exs
```

The partition suffix becomes part of the `delivest_test...` database name from `server/config/test.exs`. The script does not drop, reset, or migrate a non-test database. Each run inserts test branches, products, carts, and orders into its partition; use a fresh partition rather than rerunning into a populated one. `TEST_DB_HOST` and `TEST_DB_PORT` are optional connection settings from test config. No credentials or production connection string are embedded in this harness. Configure those variables only for an isolated test PostgreSQL instance.

The committed result is a sanitized summary of one run, not a machine-independent benchmark guarantee. The original detailed output was kept under `/tmp` and is not required to reproduce the harness.
