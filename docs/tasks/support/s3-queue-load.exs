# Run from server/: S3_QUEUE_ALLOW_DB_CREATE=1 MIX_ENV=test mix run --no-start ../docs/tasks/support/s3-queue-load.exs
# Local technical gates, fixed before measurement (not a production SLA): 120 s at 50
# orders/min over five branches, then 30 s at 5x, with a slow maintenance backlog.
# Critical eligible-wait p95 <= 2 s baseline, <= 10 s burst; maintenance adds
# <= 2 s to baseline critical p95; backlog drains within 60 s after injection.
unless System.get_env("S3_QUEUE_ALLOW_DB_CREATE") == "1" do
  raise "Set S3_QUEUE_ALLOW_DB_CREATE=1 to create a fresh s3r_queue_* database"
end

unless Mix.env() == :test do
  raise "Run with MIX_ENV=test (local provider mock and no production configuration)"
end

defmodule S3QueueWorker do
  use Oban.Worker, max_attempts: 3

  @impl true
  def perform(%Oban.Job{args: args, attempt: attempt}) do
    latency = args["latency_ms"]
    Process.sleep(latency)
    key = "#{args["order"]}:#{args["kind"]}"
    mode = args["mode"]

    case {mode, attempt} do
      {"crash_before_effect", 1} ->
        Process.exit(self(), :kill)

      {"503", 1} ->
        {:error, :provider_503}

      {"429", 1} ->
        {:error, :provider_429}

      {"transport_timeout", 1} ->
        {:error, :transport_timeout}

      {"unknown", 1} ->
        record_effect(key)
        {:cancel, :unknown_outcome}

      _ ->
        record_effect(key)
        :ok
    end
  end

  @impl true
  def backoff(_job), do: 1

  defp record_effect(key) do
    Delivest.Repo.query!(
      "INSERT INTO s3_effects (effect_key, calls) VALUES ($1, 1) ON CONFLICT (effect_key) DO UPDATE SET calls = s3_effects.calls + 1",
      [key]
    )
  end
end

defmodule S3QueueLoad do
  import Ecto.Query

  @queues [
    default: 5,
    notifications: 2,
    polling: 2,
    maintenance: 1,
    crm: 2,
    events: 10,
    fiscal: 2
  ]
  @critical ~w(default notifications polling crm events fiscal)
  @control_ms 30_000
  @baseline_ms 120_000
  @burst_ms 30_000
  @drain_ms 60_000
  @repo_queue_target_ms 50
  @repo_queue_interval_ms 1_000

  def run do
    {:ok, _} = Application.ensure_all_started(:oban)
    Logger.configure(level: :warning)
    :ets.new(:s3_queue_events, [:named_table, :public, :bag, write_concurrency: true])
    sha = System.cmd("git", ["rev-parse", "HEAD"], cd: "..") |> elem(0) |> String.trim()
    server_sha = System.cmd("git", ["rev-parse", "HEAD"], cd: ".") |> elem(0) |> String.trim()

    dirty_hash =
      System.cmd("git", ["diff", "--binary"], cd: ".")
      |> elem(0)
      |> then(&:crypto.hash(:sha256, &1))
      |> Base.encode16(case: :lower)

    started_at = DateTime.utc_now() |> DateTime.to_iso8601()
    host = :inet.gethostname() |> elem(1) |> to_string()

    profile = %{
      control_ms: @control_ms,
      baseline_ms: @baseline_ms,
      burst_ms: @burst_ms,
      burst_factor: 5,
      branches: 5,
      jobs_per_logical_order: 6,
      workload_kind: "synthetic mock jobs per logical order; no HTTP checkout",
      critical_mock_latency_ms: 30,
      maintenance_mock_latency_ms: 1_500,
      repo_pool_size: 20,
      repo_queue_target_ms: @repo_queue_target_ms,
      repo_queue_interval_ms: @repo_queue_interval_ms,
      queues: Map.new(@queues),
      maintenance_jobs: 120,
      critical_p95_baseline_ms: 2_000,
      critical_p95_burst_ms: 10_000,
      maintenance_delta_p95_ms: 2_000,
      drain_ms: @drain_ms
    }

    run_count = System.get_env("S3_QUEUE_RUNS", "3") |> String.to_integer()
    unless run_count in 1..3, do: raise("S3_QUEUE_RUNS must be 1..3")
    runs = Enum.map(1..run_count, &run_once/1)

    output = %{
      started_at: started_at,
      completed_at: DateTime.utc_now() |> DateTime.to_iso8601(),
      git_sha: sha,
      server_sha: server_sha,
      server_dirty_diff_sha256: dirty_hash,
      host: host,
      platform: platform(),
      profile: profile,
      runs: runs,
      scope: "local Oban/Postgres producer-consumer gate; no production SLA or full N01 claim"
    }

    path = "/tmp/delivest-s3r-queue-#{System.system_time(:second)}.json"
    File.write!(path, Jason.encode!(output, pretty: true))
    File.write!(String.replace_suffix(path, ".json", ".md"), markdown(output))
    IO.puts("RESULT_JSON=#{path}")
    IO.puts("RESULT_MD=#{String.replace_suffix(path, ".json", ".md")}")
    if Enum.any?(runs, &(not &1.gates_passed)), do: System.halt(2)
  end

  defp run_once(rep) do
    :ets.delete_all_objects(:s3_queue_events)
    db = "s3r_queue_#{System.system_time(:second)}_#{rep}"
    base = Application.fetch_env!(:delivest, Delivest.Repo)

    config =
      base
      |> Keyword.put(:database, db)
      |> Keyword.put(:pool, DBConnection.ConnectionPool)
      |> Keyword.put(:pool_size, 20)
      |> Keyword.put(:queue_target, @repo_queue_target_ms)
      |> Keyword.put(:queue_interval, @repo_queue_interval_ms)

    case Ecto.Adapters.Postgres.storage_up(config) do
      :ok -> :ok
      {:error, :already_up} -> raise "Refusing to reuse #{db}"
      other -> raise "Cannot create #{db}: #{inspect(other)}"
    end

    Application.put_env(:delivest, Delivest.Repo, config)
    {:ok, repo} = Delivest.Repo.start_link()
    Ecto.Migrator.run(Delivest.Repo, "priv/repo/migrations", :up, all: true, log: false)

    Delivest.Repo.query!(
      "CREATE TABLE s3_effects (effect_key text PRIMARY KEY, calls integer NOT NULL)"
    )

    oban_opts =
      Application.fetch_env!(:delivest, Oban)
      |> Keyword.merge(
        name: :s3_queue,
        testing: :disabled,
        queues: @queues,
        crontab: false,
        pruner: false,
        stager: [interval: 1_000],
        lifeline: [rescue_after: {2, :seconds}, interval: 1_000]
      )

    {:ok, oban} = Oban.start_link(oban_opts)
    handler = "s3-queue-#{rep}"

    :ok =
      :telemetry.attach_many(
        handler,
        [
          [:oban, :job, :start],
          [:oban, :job, :stop],
          [:oban, :job, :exception],
          [:delivest, :repo, :query]
        ],
        &__MODULE__.event/4,
        nil
      )

    before_stats = resources()
    started = System.monotonic_time(:millisecond)

    inject(25, 1_200, "control")
    control_end = System.monotonic_time(:millisecond)
    control_stats = resources()

    # Bounded maintenance backlog takes about 180 s at concurrency one.
    for n <- 1..120,
        do:
          insert(
            "maintenance",
            "maintenance-#{n}",
            "maintenance",
            1_500,
            if(n == 1, do: "crash_before_effect", else: "ok"),
            "maintenance"
          )

    maintenance_started = System.monotonic_time(:millisecond)
    inject(100, 1_200, "baseline")
    baseline_end = System.monotonic_time(:millisecond)
    baseline_stats = resources()
    inject(125, 240, "burst")
    injection_end = System.monotonic_time(:millisecond)
    burst_stats = resources()
    drain_started = System.monotonic_time(:millisecond)
    drain = await_drain(drain_started, drain_started + @drain_ms)
    after_stats = resources()

    jobs =
      Delivest.Repo.all(
        from j in Oban.Job,
          select: %{
            id: j.id,
            queue: j.queue,
            state: j.state,
            args: j.args,
            scheduled_at: j.scheduled_at,
            attempted_at: j.attempted_at,
            attempt: j.attempt
          }
      )

    events = :ets.tab2list(:s3_queue_events)

    result =
      summarize(
        jobs,
        events,
        started,
        control_end,
        maintenance_started,
        baseline_end,
        injection_end,
        drain,
        before_stats,
        control_stats,
        baseline_stats,
        burst_stats,
        after_stats,
        rep,
        db
      )

    :telemetry.detach(handler)
    GenServer.stop(oban)
    GenServer.stop(repo)
    result
  end

  def event([:oban, :job, outcome], measurements, %{job: job, state: state}, _) do
    :ets.insert(
      :s3_queue_events,
      {:job, job.id, job.queue, outcome, state,
       System.convert_time_unit(measurements.duration, :native, :microsecond) / 1_000,
       job.attempt}
    )
  end

  def event([:oban, :job, :start], _, %{job: job}, _) do
    :ets.insert(
      :s3_queue_events,
      {:start, job.id, job.queue, job.attempt,
       max(DateTime.diff(DateTime.utc_now(), job.scheduled_at, :millisecond), 0)}
    )
  end

  def event([:delivest, :repo, :query], measurements, _, _) do
    if time = measurements[:queue_time] do
      :ets.insert(
        :s3_queue_events,
        {:db_queue_ms, System.convert_time_unit(time, :native, :microsecond) / 1_000}
      )
    end
  end

  def event(_, _, _, _), do: :ok

  defp inject(count, interval, phase) do
    base = System.monotonic_time(:millisecond)

    for n <- 1..count do
      target = base + (n - 1) * interval
      Process.sleep(max(target - System.monotonic_time(:millisecond), 0))
      branch = rem(n - 1, 5) + 1
      order = "#{phase}-b#{branch}-o#{n}"

      mode =
        case rem(n, 25) do
          1 -> "503"
          2 -> "429"
          3 -> "transport_timeout"
          4 -> "unknown"
          _ -> "ok"
        end

      for queue <- @critical do
        insert(queue, order, queue, 30, if(queue == "crm", do: mode, else: "ok"), phase)
      end
    end

    Process.sleep(max(base + count * interval - System.monotonic_time(:millisecond), 0))
  end

  defp insert(queue, order, kind, latency, mode, phase) do
    args = %{order: order, kind: kind, latency_ms: latency, mode: mode, phase: phase}
    %Oban.Job{} = Delivest.Repo.insert!(S3QueueWorker.new(args, queue: queue))
  end

  defp await_drain(started, deadline) do
    remaining =
      Delivest.Repo.aggregate(
        from(j in Oban.Job,
          where: j.state in ["available", "scheduled", "retryable", "executing"]
        ),
        :count
      )

    cond do
      remaining == 0 ->
        %{drained: true, remaining: 0, elapsed_ms: System.monotonic_time(:millisecond) - started}

      System.monotonic_time(:millisecond) >= deadline ->
        %{
          drained: false,
          remaining: remaining,
          elapsed_ms: System.monotonic_time(:millisecond) - started
        }

      true ->
        Process.sleep(250)
        await_drain(started, deadline)
    end
  end

  defp resources do
    %{
      beam_memory_bytes: :erlang.memory(:total),
      beam_processes: :erlang.system_info(:process_count),
      cpu_run_queue: :erlang.statistics(:run_queue),
      beam_runtime_ms: :erlang.statistics(:runtime) |> elem(0),
      beam_wall_clock_ms: :erlang.statistics(:wall_clock) |> elem(0),
      pg_version: Delivest.Repo.query!("SHOW server_version").rows |> hd() |> hd(),
      repo_pool_size: 20,
      repo_queue_target_ms: @repo_queue_target_ms,
      repo_queue_interval_ms: @repo_queue_interval_ms,
      pg_active_connections:
        Delivest.Repo.query!(
          "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND state = 'active'"
        ).rows
        |> hd()
        |> hd(),
      pg_connections:
        Delivest.Repo.query!(
          "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()"
        ).rows
        |> hd()
        |> hd()
    }
  end

  defp platform do
    %{
      otp: System.otp_release(),
      elixir: System.version(),
      schedulers: :erlang.system_info(:schedulers_online),
      cpu_model:
        File.read!("/proc/cpuinfo")
        |> String.split("\n")
        |> Enum.find(&String.starts_with?(&1, "model name")),
      mem_total_kb:
        File.read!("/proc/meminfo")
        |> String.split("\n")
        |> Enum.find(&String.starts_with?(&1, "MemTotal:"))
    }
  end

  defp summarize(
         jobs,
         events,
         started,
         control_end,
         maintenance_started,
         baseline_end,
         injection_end,
         drain,
         before_stats,
         control_stats,
         baseline_stats,
         burst_stats,
         after_stats,
         rep,
         db
       ) do
    phases =
      for phase <- ~w(control baseline burst maintenance), into: %{} do
        selected = Enum.filter(jobs, &(&1.args["phase"] == phase))
        critical = Enum.filter(selected, &(&1.queue in @critical))
        ids = MapSet.new(selected, & &1.id)

        waits =
          for {:start, id, _, attempt, ms} <- events,
              attempt == 1 and Enum.any?(critical, &(&1.id == id)),
              do: ms

        critical_ids = MapSet.new(critical, & &1.id)

        per_queue_wait_ms =
          events
          |> Enum.flat_map(fn
            {:start, id, queue, 1, ms} ->
              if MapSet.member?(critical_ids, id), do: [{queue, ms}], else: []

            _ ->
              []
          end)
          |> Enum.group_by(&elem(&1, 0), &elem(&1, 1))
          |> Map.new(fn {queue, values} -> {queue, percentiles(values)} end)

        runtimes =
          for {:job, id, _, _, _, ms, _} <- events, MapSet.member?(ids, id), do: ms

        {phase,
         %{
           jobs: length(selected),
           completed: Enum.count(selected, &(&1.state == "completed")),
           states: Enum.frequencies_by(selected, & &1.state),
           eligible_wait_ms: percentiles(waits),
           per_queue_eligible_wait_ms: per_queue_wait_ms,
           runtime_ms: percentiles(runtimes),
           retries: Enum.count(selected, &(&1.attempt > 1)),
           errors:
             Enum.count(events, fn
               {:job, id, _, :exception, _, _, _} -> MapSet.member?(ids, id)
               _ -> false
             end)
         }}
      end

    db_wait = for {:db_queue_ms, ms} <- events, do: ms
    effects = Delivest.Repo.query!("SELECT effect_key, calls FROM s3_effects").rows
    expected_effects = length(jobs)
    known_effects = Enum.count(jobs, &(&1.state == "completed"))
    unknown_effects = Enum.count(jobs, &(&1.state == "cancelled"))
    control_p95 = phases["control"].eligible_wait_ms.p95
    baseline_p95 = phases["baseline"].eligible_wait_ms.p95
    burst_p95 = phases["burst"].eligible_wait_ms.p95

    result = %{
      run: rep,
      database: db,
      started_at: DateTime.utc_now() |> DateTime.to_iso8601(),
      elapsed_ms: System.monotonic_time(:millisecond) - started,
      actual_control_ms: control_end - started,
      actual_baseline_ms: baseline_end - maintenance_started,
      actual_burst_ms: injection_end - baseline_end,
      phases: phases,
      db_queue_ms: percentiles(db_wait),
      resources_before: before_stats,
      resources_control: control_stats,
      resources_baseline: baseline_stats,
      resources_burst: burst_stats,
      resources_after: after_stats,
      drain: drain,
      logical_effects: length(effects),
      known_effects: known_effects,
      unknown_effects: unknown_effects,
      expected_effects: expected_effects,
      duplicate_effects: Enum.count(effects, fn [_, calls] -> calls != 1 end),
      oldest_remaining_age_seconds: oldest_remaining_age(),
      gates: %{
        baseline_p95: baseline_p95 <= 2_000,
        burst_p95: burst_p95 <= 10_000,
        maintenance_delta_p95: baseline_p95 - control_p95 <= 2_000,
        drain: drain.drained,
        logical_effects:
          length(effects) == expected_effects and
            known_effects + unknown_effects == expected_effects,
        duplicate_effects: Enum.all?(effects, fn [_, calls] -> calls == 1 end),
        actual_retries: phases["baseline"].retries + phases["burst"].retries > 0,
        worker_crash_recovered:
          Enum.any?(
            jobs,
            &(&1.args["mode"] == "crash_before_effect" and &1.state == "completed" and
                &1.attempt > 1)
          ),
        full_windows:
          baseline_end - maintenance_started >= @baseline_ms and
            injection_end - baseline_end >= @burst_ms
      }
    }

    Map.put(result, :gates_passed, Enum.all?(result.gates, &elem(&1, 1)))
  end

  defp oldest_remaining_age do
    oldest =
      Delivest.Repo.one(
        from j in Oban.Job,
          where: j.state in ["available", "scheduled", "retryable", "executing"],
          select: min(j.scheduled_at)
      )

    if oldest, do: max(DateTime.diff(DateTime.utc_now(), oldest, :second), 0), else: 0
  end

  defp percentiles([]), do: %{p50: nil, p95: nil, p99: nil}

  defp percentiles(values) do
    sorted = Enum.sort(values)
    n = length(sorted)

    %{
      p50: Enum.at(sorted, ceil(n * 0.50) - 1),
      p95: Enum.at(sorted, ceil(n * 0.95) - 1),
      p99: Enum.at(sorted, ceil(n * 0.99) - 1)
    }
  end

  defp markdown(output) do
    lines = [
      "# S3 queue load: local measurement",
      "",
      "SHA: #{output.git_sha}",
      "Started: #{output.started_at}",
      "Completed: #{output.completed_at}",
      "Scope: #{output.scope}",
      "",
      "| Run | Baseline p95 ms | Burst p95 ms | Drain | Retries | Effects | Passed |",
      "|---|---:|---:|---|---:|---:|---|"
    ]

    rows =
      Enum.map(output.runs, fn r ->
        "| #{r.run} | #{r.phases["baseline"].eligible_wait_ms.p95} | #{r.phases["burst"].eligible_wait_ms.p95} | #{r.drain.drained} | #{r.phases["baseline"].retries + r.phases["burst"].retries} | #{r.logical_effects}/#{r.expected_effects} | #{r.gates_passed} |"
      end)

    Enum.join(lines ++ rows, "\n") <> "\n"
  end
end

S3QueueLoad.run()
