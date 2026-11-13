partition = System.get_env("MIX_TEST_PARTITION", "")

unless System.get_env("MIX_ENV") == "test" and String.starts_with?(partition, "s1_20261106_") do
  raise "Refusing to run: set MIX_ENV=test and a fresh MIX_TEST_PARTITION beginning s1_20261106_"
end

alias Delivest.{Oms, Repo}
alias Delivest.Oms.Carts
alias Delivest.Identity.Branch

branches =
  for index <- 1..5 do
    Delivest.Factory.insert(:branch,
      name: "Bench Branch #{index}",
      slug: "bench-branch-#{index}",
      code: "B#{index}"
    )
  end

products =
  for {branch, index} <- Enum.with_index(branches, 1) do
    Delivest.Factory.insert_branch_product(branch.id,
      name: "Bench Product #{index}",
      price: 1_250
    )
  end

cart_for = fn {branch, product}, index ->
  session = "bench-#{Ecto.UUID.generate()}"
  {:ok, cart} = Carts.create_cart(%{session_id: session, branch_id: branch.id})
  {:ok, _item, _view} = Carts.add_item(cart.id, product.id, 1)

  %{
    attrs: %{
      "cart_id" => cart.id,
      "branch_id" => branch.id,
      "session_id" => session,
      "fulfillment_type" => "pickup",
      "payment_method" => "cash",
      "comment" => "bench-#{index}"
    }
  }
end

samples =
  for index <- 1..300 do
    pair = Enum.at(Enum.zip(branches, products), rem(index - 1, 5))
    cart_for.(pair, index)
  end

warmup = Enum.take(samples, 50)
timed = Enum.drop(samples, 50)
concurrency = String.to_integer(System.get_env("BENCH_CONCURRENCY", "10"))

Enum.each(warmup, fn sample ->
  {:ok, _order} = Oms.create_order(sample.attrs)
end)

test_pid = self()
handler = fn _event, measurement, _metadata, pid -> send(pid, {:repo_query, measurement}) end
:ok = :telemetry.attach("s1-bench-repo-query", [:delivest, :repo, :query], handler, test_pid)

started = System.monotonic_time(:microsecond)

latencies =
  timed
  |> Task.async_stream(fn sample ->
    at = System.monotonic_time(:microsecond)
    {:ok, _order} = Oms.create_order(sample.attrs)
    System.monotonic_time(:microsecond) - at
  end, max_concurrency: concurrency, timeout: :infinity, ordered: false)
  |> Enum.map(fn {:ok, latency} -> latency end)

elapsed_us = System.monotonic_time(:microsecond) - started

query_measurements =
  Stream.repeatedly(fn ->
    receive do
      {:repo_query, measurement} -> measurement
    after
      0 -> :done
    end
  end)
  |> Enum.take_while(&(&1 != :done))

:telemetry.detach("s1-bench-repo-query")

percentile = fn values, p ->
  values = Enum.sort(values)
  Enum.at(values, min(ceil(length(values) * p) - 1, length(values) - 1))
end

microseconds_to_ms = &(&1 / 1_000)
native_to_ms = fn native -> System.convert_time_unit(native, :native, :nanosecond) / 1_000_000 end
total_seconds = elapsed_us / 1_000_000
rate_per_minute = length(latencies) / total_seconds * 60
query_time_native = Enum.reduce(query_measurements, 0, &(Map.get(&1, :query_time, 0) + &2))
queue_time_native = Enum.reduce(query_measurements, 0, &(Map.get(&1, :queue_time, 0) + &2))

IO.puts("database=delivest_test#{partition} concurrency=#{concurrency}")
IO.puts("branches=#{length(branches)} warmup_orders=#{length(warmup)} measured_orders=#{length(latencies)}")
IO.puts("elapsed_seconds=#{Float.round(total_seconds, 3)} orders_per_minute=#{Float.round(rate_per_minute, 1)}")
IO.puts("latency_ms_p50=#{Float.round(microseconds_to_ms.(percentile.(latencies, 0.50)), 2)} latency_ms_p95=#{Float.round(microseconds_to_ms.(percentile.(latencies, 0.95)), 2)}")
IO.puts("repo_queries=#{length(query_measurements)} queries_per_order=#{Float.round(length(query_measurements) / length(latencies), 2)}")
IO.puts("repo_query_time_ms_total=#{Float.round(native_to_ms.(query_time_native), 2)} repo_queue_time_ms_total=#{Float.round(native_to_ms.(queue_time_native), 2)}")
IO.puts("orders_exist=#{Repo.aggregate(Delivest.Oms.Order, :count)} branches_exist=#{Repo.aggregate(Branch, :count)}")
