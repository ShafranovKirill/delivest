database = Application.fetch_env!(:delivest, Delivest.Repo)[:database]

unless Mix.env() in [:dev, :test] and is_binary(database) and
         String.starts_with?(database, "delivest_s5_load") and
         System.get_env("PORT") == "4200" and System.get_env("PHX_SERVER") == "true" do
  raise "S5 server requires dedicated dev/test database and PORT=4200 PHX_SERVER=true"
end

Logger.configure(level: :warning)
{:ok, _} = Application.ensure_all_started(:delivest)

table = :ets.new(:s5_sql, [:public, :set])
:ets.insert(table, [{:count, 0}, {:total_us, 0}, {:queue_us, 0}])

:ok =
  :telemetry.attach(
    "s5-load-sql",
    [:delivest, :repo, :query],
    fn _event, measurements, _meta, tab ->
      :ets.update_counter(tab, :count, 1)

      :ets.update_counter(
        tab,
        :total_us,
        System.convert_time_unit(Map.get(measurements, :total_time, 0), :native, :microsecond)
      )

      :ets.update_counter(
        tab,
        :queue_us,
        System.convert_time_unit(Map.get(measurements, :queue_time, 0), :native, :microsecond)
      )
    end,
    table
  )

path = System.get_env("S5_TELEMETRY_FILE") || "/tmp/delivest-s5-load-telemetry.json"

write_snapshot = fn ->
  backlog =
    case Delivest.Repo.query("SELECT state, count(*) FROM oban_jobs GROUP BY state", []) do
      {:ok, %{rows: rows}} -> Map.new(rows, fn [state, count] -> {state, count} end)
      _ -> %{}
    end

  data = %{
    at: DateTime.utc_now() |> DateTime.to_iso8601(),
    sql_count: :ets.lookup_element(table, :count, 2),
    sql_total_us: :ets.lookup_element(table, :total_us, 2),
    sql_queue_us: :ets.lookup_element(table, :queue_us, 2),
    oban_by_state: backlog,
    beam_memory_bytes: :erlang.memory(:total)
  }

  File.write!(path, Jason.encode!(data))
end

write_snapshot.()
IO.puts("S5 dedicated server ready; database=#{database}; telemetry=#{path}")

Stream.repeatedly(fn ->
  Process.sleep(5_000)
  write_snapshot.()
end)
|> Stream.run()
