# Run from a prepared server worktree with: mix run --no-start /abs/path/to/this/file
if Mix.env() != :dev, do: raise("Benchmark server requires MIX_ENV=dev")

repo = Application.fetch_env!(:delivest, Delivest.Repo)
database = Keyword.fetch!(repo, :database)
hostname = Keyword.fetch!(repo, :hostname)
db_port = Keyword.fetch!(repo, :port)

allowed_databases = [
  "delivest_f01_demo_startup_before_20261119",
  "delivest_f01_demo_startup_after_20261119"
]

unless database in allowed_databases and hostname in ["localhost", "127.0.0.1"] and
         db_port == 55_439 and is_nil(Keyword.get(repo, :url)) do
  raise(
    "Refusing to start benchmark against an unexpected database: #{inspect({hostname, db_port, database})}"
  )
end

endpoint = Application.fetch_env!(:delivest, DelivestWeb.Endpoint)
http = Keyword.fetch!(endpoint, :http)
port = Keyword.get(http, :port, 4_000)

unless port == 4_000 do
  raise("Refusing to start benchmark on unexpected endpoint port: #{inspect(port)}")
end

Application.put_env(
  :delivest,
  DelivestWeb.Endpoint,
  endpoint
  |> Keyword.put(:http, http |> Keyword.put(:ip, {127, 0, 0, 1}) |> Keyword.put(:port, 4_000))
  |> Keyword.put(:server, true)
  |> Keyword.put(:code_reloader, false)
  |> Keyword.put(:reloadable_apps, [])
  |> Keyword.put(:watchers, [])
  |> Keyword.put(:live_reload, patterns: [])
)

oban = Application.fetch_env!(:delivest, Oban)
Application.put_env(:delivest, Oban, Keyword.put(oban, :testing, :manual))
Logger.configure(level: :warning)

{:ok, _started} = Application.ensure_all_started(:delivest)

IO.puts(
  Jason.encode!(%{
    pid: System.pid(),
    database: database,
    database_host: hostname,
    database_port: db_port,
    endpoint_port: 4_000
  })
)

Process.sleep(:infinity)
