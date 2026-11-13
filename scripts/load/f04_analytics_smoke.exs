# Run with `MIX_ENV=test mix run --no-start` from a server checkout.
partition = System.get_env("MIX_TEST_PARTITION", "")
port = System.get_env("TEST_DB_PORT", "")
host = System.get_env("TEST_DB_HOST")

unless Mix.env() == :test and System.get_env("F04_SMOKE_RUN") == "1" and
         String.match?(partition, ~r/^f04_smoke_[a-z0-9_]+$/) and host == "127.0.0.1" and
         String.match?(port, ~r/^\d+$/) and port != "5432" do
  raise "F04 smoke requires its dedicated loopback database and explicit F04_SMOKE_RUN=1"
end

Logger.configure(level: :warning)
{:ok, _} = Application.ensure_all_started(:delivest)

alias Delivest.{Background, Features, Funnel, LocalTime, Repo}
alias Delivest.Analytics.Reports.Query
alias Delivest.Identity.Branch
alias Delivest.Identity.Branch.BranchInfo

Ecto.Adapters.SQL.Sandbox.mode(Repo, :auto)
database = Application.fetch_env!(:delivest, Repo)[:database]

unless database == "delivest_test#{partition}", do: raise("unexpected test database")

if Repo.aggregate(Branch, :count) != 0 do
  raise "F04 smoke requires an empty disposable database"
end

{:ok, _} = Features.configure("analytics_funnel", :franchise, true, actor: "f04-smoke")

branches =
  for index <- 1..3 do
    branch =
      %Branch{}
      |> Branch.changeset(%{
        name: "F04 Smoke #{index}",
        slug: "f04-smoke-#{index}",
        code: "F04#{index}",
        is_active: true
      })
      |> Repo.insert!()

    Repo.insert!(%BranchInfo{branch_id: branch.id})

    {:ok, _} =
      Features.configure("analytics_funnel", {:branch, branch.id}, true, actor: "f04-smoke")

    branch
  end

elapsed_ms = fn started ->
  System.convert_time_unit(System.monotonic_time() - started, :native, :microsecond) / 1_000
end

capture_samples =
  for index <- 1..1_200 do
    branch = Enum.at(branches, rem(index - 1, length(branches)))
    started = System.monotonic_time()

    {:ok, _} =
      Funnel.capture(
        %{
          "event_id" => Ecto.UUID.generate(),
          "branch_id" => branch.id,
          "event" => "visit",
          "source_type" => "campaign",
          "utm_source" => "f04-smoke"
        },
        "guest:" <> Ecto.UUID.generate()
      )

    elapsed_ms.(started)
  end

refresh_started = System.monotonic_time()

for branch <- branches do
  assert_result = Background.run_now("analytics.funnel", {:branch, branch.id}, new_work: true)

  unless match?({:ok, _}, assert_result),
    do: raise("refresh queue failed: #{inspect(assert_result)}")
end

ids = Enum.map(branches, &Ecto.UUID.dump!(&1.id))
day = LocalTime.today(LocalTime.timezone(hd(branches).id))

ready_count = fn ->
  [[ready]] =
    Repo.query!(
      """
      SELECT count(*) FROM analytics_report_states s
      JOIN analytics_report_snapshots p ON p.id=s.snapshot_id
      WHERE s.feature='analytics_funnel' AND s.branch_id=ANY($1::uuid[])
        AND s.day=$2 AND s.revision=p.revision
      """,
      [ids, day]
    ).rows

  ready
end

published =
  Enum.reduce_while(1..10, false, fn _, _ ->
    {:ok, _} = Background.dispatch_due()
    %{failure: 0} = Oban.drain_queue(queue: :background, with_scheduled: true, with_safety: false)

    if ready_count.() == length(branches), do: {:halt, true}, else: {:cont, false}
  end)

unless published, do: raise("report refresh did not publish current revisions")
refresh_ms = elapsed_ms.(refresh_started)

counter = :ets.new(:f04_smoke_queries, [:set, :public])
:ets.insert(counter, {:count, 0})
owner = self()

:ok =
  :telemetry.attach(
    "f04-smoke-query-count",
    [:delivest, :repo, :query],
    fn _, _, _, {table, process} ->
      if self() == process, do: :ets.update_counter(table, :count, 1)
    end,
    {counter, owner}
  )

measure_read = fn branch_ids ->
  :ets.insert(counter, {:count, 0})
  started = System.monotonic_time()
  report = Query.read("analytics_funnel", branch_ids, day, day, "funnel", %{}, 1)
  {report, :ets.lookup_element(counter, :count, 2), elapsed_ms.(started)}
end

{one, one_queries, one_ms} = measure_read.([hd(branches).id])
{all, all_queries, all_ms} = measure_read.(Enum.map(branches, & &1.id))

unless one.totals["sessions"] == 400 and all.totals["sessions"] == 1_200 and
         all_queries <= one_queries + 3 and all_queries <= 20 do
  raise "unexpected report counts or query growth: #{inspect({one.totals, all.totals, one_queries, all_queries})}"
end

[[index_count]] =
  Repo.query!(
    """
    SELECT count(*) FROM pg_indexes
    WHERE tablename='funnel_events' AND indexname='funnel_events_session_id_received_at_id_index'
    """,
    []
  ).rows

unless index_count == 1, do: raise("funnel event cutoff index is missing")

sorted = Enum.sort(capture_samples)
p95 = Enum.at(sorted, ceil(length(sorted) * 0.95) - 1)

IO.puts(
  Jason.encode!(%{
    database: database,
    branches: length(branches),
    events: length(capture_samples),
    capture_p95_ms: p95,
    refresh_ms: refresh_ms,
    one_branch_read_ms: one_ms,
    three_branch_read_ms: all_ms,
    one_branch_queries: one_queries,
    three_branch_queries: all_queries,
    sessions: all.totals["sessions"],
    cutoff_index_present: true
  })
)
