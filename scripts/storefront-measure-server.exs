# Run from the server worktree with `mix run --no-start /absolute/path/to/this/file`.
# Keep the existing demo safety checks, database and seeding behavior, while
# removing development's per-request compilation/migration check from timings.
endpoint = DelivestWeb.Endpoint
config = Application.fetch_env!(:delivest, endpoint)
Application.put_env(:delivest, endpoint, Keyword.put(config, :reloadable_apps, []))
Code.require_file("scripts/local_f01_demo.exs", File.cwd!())
