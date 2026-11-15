# Run from server/: DEV_DATABASE=delivest_f01_demo_local DEV_EXTERNAL_HOST=127.0.0.1 MIX_ENV=dev mix run --no-start ../examples/demo-menu/stars.exs
import Ecto.Query

alias Delivest.Identity.Branch
alias Delivest.Net.Product
alias Delivest.Relations.EntityRelation
alias Delivest.Repo

rewards = [
  {"181c85b4-a76c-4596-86fa-f5b2abc05648", "Капучино", 120},
  {"331198e9-0906-4aa3-a76e-0588d86d95c6", "Лимонад с мятой", 140},
  {"f87a77b9-471a-46c1-bef1-a8f63e782bf4", "Картофель фри", 180},
  {"c28b3c94-5db7-4340-bbde-93c597f975bd", "Куриные наггетсы", 260},
  {"8e1b3653-5c84-40ea-9ab3-6747a2d5d833", "Чизкейк", 320},
  {"d2594886-dbbd-4bd4-bd1c-575e68563088", "Шоколадный торт", 360},
  {"fab71c79-87c2-4545-907b-160b4891bd8b", "Чизбургер", 450},
  {"411d9268-710a-4cf2-8df6-0df4d09dbebf", "Маргарита", 600}
]

unless Mix.env() == :dev and System.get_env("DEV_DATABASE") == "delivest_f01_demo_local" do
  raise "This script requires MIX_ENV=dev and DEV_DATABASE=delivest_f01_demo_local"
end

repo_config = Application.fetch_env!(:delivest, Repo)

unless repo_config[:database] == "delivest_f01_demo_local" and
         repo_config[:hostname] in ["localhost", "127.0.0.1", "::1"] do
  raise "Refusing to connect to a non-demo or non-local database"
end

{:ok, _} = Application.ensure_all_started(:ecto_sql)
{:ok, _} = Repo.start_link()
Logger.configure(level: :warning)

%Postgrex.Result{rows: [["delivest_f01_demo_local"]]} =
  Ecto.Adapters.SQL.query!(Repo, "SELECT current_database()", [])

branch =
  Repo.one!(
    from b in Branch,
      where: b.slug == "demo-center" and b.is_active and is_nil(b.deleted_at)
  )

ids = Enum.map(rewards, &elem(&1, 0))

products =
  Repo.all(
    from p in Product,
      join: r in EntityRelation,
      on:
        r.from_entity_type == "Branch" and r.from_id == ^branch.id and
          r.to_entity_type == "Product" and r.to_id == p.id,
      where: p.id in ^ids and p.is_active and is_nil(p.deleted_at)
  )
  |> Map.new(&{&1.id, &1})

for {id, name, _stars} <- rewards do
  case Map.get(products, id) do
    %Product{name: ^name} -> :ok
    other -> raise "Missing or unexpected demo-center product #{name} (#{id}): #{inspect(other)}"
  end
end

{:ok, changed} =
  Repo.transaction(fn ->
    Enum.reduce(rewards, 0, fn {id, _name, stars}, count ->
      {updated, _} =
        Repo.update_all(
          from(p in Product,
            where: p.id == ^id and (is_nil(p.stars_price) or p.stars_price != ^stars)
          ),
          set: [stars_price: stars]
        )

      count + updated
    end)
  end)

IO.puts("Updated #{changed} demo product stars prices:")

for {id, name, stars} <- rewards do
  %Product{stars_price: ^stars} = Repo.get!(Product, id)
  IO.puts("  #{name}: #{stars} stars")
end
