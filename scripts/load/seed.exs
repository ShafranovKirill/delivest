alias Delivest.Identity.Branch
alias Delivest.Net.{Category, Product, ModifierGroup, Modifier, ProductModifierGroup}
alias Delivest.Relations
alias Delivest.Repo
alias Delivest.Promo.Promotion

database = Application.fetch_env!(:delivest, Delivest.Repo)[:database]

unless Mix.env() in [:dev, :test] and is_binary(database) and
         String.starts_with?(database, "delivest_s5_load") do
  raise "S5 seed requires MIX_ENV=dev/test and DEV_DATABASE=delivest_s5_load*"
end

if Repo.aggregate(Branch, :count) != 0 do
  raise "S5 seed requires an empty dedicated database"
end

branches =
  for b <- 1..5 do
    branch =
      %Branch{}
      |> Branch.changeset(%{
        name: "S5 Branch #{b}",
        slug: "s5-branch-#{b}",
        code: "S5B#{b}",
        is_active: true
      })
      |> Repo.insert!()

    categories =
      for c <- 1..10 do
        category =
          %Category{}
          |> Category.changeset(%{name: "S5 Category #{b}-#{c}", order: c * 1.0, is_active: true})
          |> Repo.insert!()

        {:ok, _} = Relations.create_relation(Repo, "Branch", branch.id, "Category", category.id)
        category
      end

    products =
      for p <- 1..200 do
        category = Enum.at(categories, div(p - 1, 20))

        product =
          %Product{}
          |> Product.changeset(%{
            name: "S5 Product #{b}-#{p}",
            category_id: category.id,
            price: 10_000 + rem(p, 25) * 1_000,
            is_active: true,
            description: "Load fixture product #{p}",
            order: p * 1.0
          })
          |> Repo.insert!()

        {:ok, _} = Relations.create_relation(Repo, "Branch", branch.id, "Product", product.id)
        product
      end

    group =
      %ModifierGroup{}
      |> ModifierGroup.changeset(%{name: "S5 Size #{b}", min: 0, max: 1})
      |> Repo.insert!()

    for {name, price} <- [{"Regular", 0}, {"Large", 2_000}] do
      %Modifier{}
      |> Modifier.changeset(%{group_id: group.id, name: name, price: price})
      |> Repo.insert!()
    end

    for product <- Enum.take(products, 20) do
      Repo.insert!(%ProductModifierGroup{product_id: product.id, group_id: group.id})
    end

    for {name, rules} <- [
          {"S5 pickup", "when fulfillment in (pickup) then discount 10%"},
          {"S5 delivery only", "when fulfillment in (delivery) then discount 5%"},
          {"S5 high subtotal", "when subtotal >= 1000 then discount 100 rub"}
        ] do
      Repo.insert!(%Promotion{
        branch_id: branch.id,
        name: "#{name} #{b}",
        kind: :automatic,
        rules: rules,
        enabled: true
      })
    end

    %{id: branch.id, products: Enum.map(products, & &1.id)}
  end

path = System.get_env("S5_FIXTURE_FILE") || "/tmp/delivest-s5-load-fixture.json"
File.write!(path, Jason.encode!(%{seed: 20_261_107, branches: branches}))
IO.puts("S5 fixture: #{path}; branches=5 products=1000 modifier_groups=5 promotions=15")
