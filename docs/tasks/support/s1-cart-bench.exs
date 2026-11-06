partition = System.get_env("MIX_TEST_PARTITION", "")

unless System.get_env("MIX_ENV") == "test" and String.starts_with?(partition, "s1_20261106_") do
  raise "Refusing to run outside a dedicated S1 test partition"
end

alias Delivest.Oms.Carts
alias Delivest.Oms.CartView

branch = Delivest.Factory.insert(:branch)
product = Delivest.Factory.insert_branch_product(branch.id, price: 1_250)

samples =
  for _ <- 1..300 do
    session = "s1-cart-#{Ecto.UUID.generate()}"
    {:ok, cart} = Carts.create_cart(%{session_id: session, branch_id: branch.id})
    cart.id
  end

percentile = fn values, p ->
  values = Enum.sort(values)
  Enum.at(values, min(ceil(length(values) * p) - 1, length(values) - 1))
end

profile = fn label, ids, operation ->
  pid = self()
  handler_id = "s1-cart-#{label}"
  :ok = :telemetry.attach(handler_id, [:delivest, :repo, :query], fn _, measurement, _, _ ->
    send(pid, {:query, measurement})
  end, nil)

  latencies =
    Enum.map(ids, fn id ->
      at = System.monotonic_time(:microsecond)
      operation.(id)
      System.monotonic_time(:microsecond) - at
    end)

  measurements =
    Stream.repeatedly(fn ->
      receive do
        {:query, measurement} -> measurement
      after
        0 -> :done
      end
    end)
    |> Enum.take_while(&(&1 != :done))

  :telemetry.detach(handler_id)

  to_ms = &(&1 / 1_000)
  native_ms = fn native -> System.convert_time_unit(native, :native, :nanosecond) / 1_000_000 end
  query_time = Enum.reduce(measurements, 0, &(Map.get(&1, :query_time, 0) + &2))
  queue_time = Enum.reduce(measurements, 0, &(Map.get(&1, :queue_time, 0) + &2))

  IO.puts("#{label} samples=#{length(ids)} p50_ms=#{Float.round(to_ms.(percentile.(latencies, 0.5)), 2)} p95_ms=#{Float.round(to_ms.(percentile.(latencies, 0.95)), 2)} sql_per_op=#{Float.round(length(measurements) / length(ids), 2)} query_ms=#{Float.round(native_ms.(query_time), 2)} queue_ms=#{Float.round(native_ms.(queue_time), 2)} errors=0")
end

{warm, timed} = Enum.split(samples, 50)
Enum.each(warm, fn id -> {:ok, _, _} = Carts.add_item(id, product.id, 1) end)
profile.("mutation", timed, fn id -> {:ok, _, _} = Carts.add_item(id, product.id, 1) end)
profile.("read", timed, fn id -> %CartView{} = Carts.get_cart_by_id(id) end)
