# Run against an isolated local fixture with mix run --no-start.
repo = Application.fetch_env!(:delivest, Delivest.Repo)

unless Mix.env() == :dev and
         String.starts_with?(Keyword.fetch!(repo, :database), "delivest_menu_perf_") and
         Keyword.fetch!(repo, :hostname) in ["localhost", "127.0.0.1"] do
  raise "Menu measurements require an isolated local delivest_menu_perf_* database"
end

endpoint = Application.fetch_env!(:delivest, DelivestWeb.Endpoint)
http = Keyword.fetch!(endpoint, :http)

Application.put_env(
  :delivest,
  DelivestWeb.Endpoint,
  endpoint
  |> Keyword.put(:http, http |> Keyword.put(:ip, {127, 0, 0, 1}) |> Keyword.put(:port, 4100))
  |> Keyword.put(:server, true)
  |> Keyword.put(:code_reloader, false)
  |> Keyword.put(:reloadable_apps, [])
  |> Keyword.put(:watchers, [])
  |> Keyword.put(:live_reload, patterns: [])
)

Application.put_env(
  :delivest,
  Oban,
  Application.fetch_env!(:delivest, Oban) |> Keyword.put(:testing, :manual)
)

Logger.configure(level: :warning)
{:ok, _} = Application.ensure_all_started(:delivest)
IO.puts("Menu measurement fixture ready on 4100")
Process.sleep(:infinity)
