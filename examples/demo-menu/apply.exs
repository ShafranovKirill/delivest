# Run from the server directory: MIX_ENV=dev mix run ../examples/demo-menu/apply.exs
import Ecto.Query
alias Delivest.{Repo, Media, Relations}
alias Delivest.Media.File, as: MediaFile
alias Delivest.Net.{Category, Product, Stock, Catalogs}
alias Delivest.Relations.EntityRelation

fixture_dir = __DIR__
config = fixture_dir |> Path.join("catalog.json") |> File.read!() |> Jason.decode!()

banners =
  fixture_dir
  |> Path.join("banners.json")
  |> File.read!()
  |> Jason.decode!()
  |> Map.fetch!("banners")

products = config["products"]
categories = config["categories"]

unless Mix.env() in [:dev, :test], do: raise("Demo menu requires MIX_ENV=dev or test")
repo = Application.fetch_env!(:delivest, Repo)
s3 = ExAws.Config.new(:s3)
local? = fn host -> host in ["localhost", "127.0.0.1", "::1"] end
unless local?.(repo[:hostname]) and local?.(s3.host), do: raise("Refusing non-local DB or S3")

unless length(products) == 30 and length(categories) == 5 and length(banners) == 6,
  do: raise("Incomplete demo menu fixture")

slugs =
  System.get_env("DEMO_MENU_BRANCH_SLUGS", "demo-center,demo-north,demo-south")
  |> String.split(",", trim: true)
  |> Enum.map(&String.trim/1)
  |> Enum.uniq()

unless slugs != [], do: raise("No target branch slugs")

branches =
  Repo.all(
    from b in Delivest.Identity.Branch,
      where: b.slug in ^slugs and b.is_active and is_nil(b.deleted_at)
  )

unless length(branches) == length(slugs),
  do: raise("Target branches are missing or inactive: #{inspect(slugs)}")

branch_ids = Enum.map(branches, & &1.id)

owner_id =
  Repo.one!(
    from s in Delivest.Identity.Staff, where: is_nil(s.deleted_at), select: s.id, limit: 1
  )

fixtures = [
  {"Category", Enum.map(categories, & &1["id"])},
  {"Product", Enum.map(products, & &1["product_id"])},
  {"Stock", Enum.map(banners, & &1["stock_id"])}
]

category_ids = Enum.map(categories, & &1["id"])
product_ids = Enum.map(products, & &1["product_id"])
stock_ids = Enum.map(banners, & &1["stock_id"])
media_ids = Enum.map(products, & &1["media_id"]) ++ Enum.map(banners, & &1["media_id"])
media_before = Repo.all(from m in MediaFile, where: m.id in ^media_ids)

relations_before =
  Repo.all(
    from r in EntityRelation,
      where:
        r.from_entity_type == "Branch" and r.from_id in ^branch_ids and
          r.to_entity_type in ["Category", "Product", "Stock"]
  )

backup = %{
  "branch_slugs" => slugs,
  "branch_ids" => branch_ids,
  "catalog_versions" => Map.new(branches, &{&1.id, &1.catalog_version}),
  "relations" =>
    Enum.map(relations_before, fn r ->
      %{
        "from_id" => r.from_id,
        "to_entity_type" => r.to_entity_type,
        "to_id" => r.to_id,
        "payload" => r.payload
      }
    end),
  "media" =>
    Enum.map(media_before, fn m ->
      Map.take(m, [
        :id,
        :bucket,
        :key,
        :thumb_key,
        :original_name,
        :mime_type,
        :size,
        :context,
        :owner_id,
        :is_private
      ])
    end),
  "existing_fixture_ids" => %{
    "categories" => Repo.all(from c in Category, where: c.id in ^category_ids, select: c.id),
    "products" => Repo.all(from p in Product, where: p.id in ^product_ids, select: p.id),
    "stocks" => Repo.all(from s in Stock, where: s.id in ^stock_ids, select: s.id)
  }
}

backup_path =
  Path.join(
    System.tmp_dir!(),
    "delivest-demo-menu-backup-#{System.system_time(:millisecond)}.json"
  )

File.write!(backup_path, Jason.encode!(backup, pretty: true))
IO.puts("Saved relation backup: #{backup_path}")

assets =
  Enum.map(products, &{:product, &1["media_id"], &1["asset"]}) ++
    Enum.map(banners, &{:stock, &1["media_id"], &1["asset"]})

bucket = Media.public_bucket()

for {context, id, asset} <- assets do
  path = Path.join(fixture_dir, asset)
  body = File.read!(path)
  key = "demo-menu/#{context}/#{id}.webp"

  {:ok, _} =
    bucket |> ExAws.S3.put_object(key, body, content_type: "image/webp") |> ExAws.request()
end

{:ok, _} =
  Repo.transaction(
    fn ->
      for {context, id, asset} <- assets do
        body = File.read!(Path.join(fixture_dir, asset))
        key = "demo-menu/#{context}/#{id}.webp"
        file = Repo.get(MediaFile, id) || %MediaFile{id: id}

        file
        |> MediaFile.changeset(%{
          bucket: bucket,
          key: key,
          original_name: Path.basename(asset),
          mime_type: "image/webp",
          size: byte_size(body),
          context: context,
          owner_id: owner_id,
          is_private: false
        })
        |> Ecto.Changeset.change(thumb_key: key)
        |> then(fn changeset ->
          if file.__meta__.state == :loaded,
            do: Repo.update!(changeset),
            else: Repo.insert!(changeset)
        end)
      end

      for row <- categories do
        category = Repo.get(Category, row["id"]) || %Category{id: row["id"]}

        category
        |> Category.changeset(%{name: row["name"], order: row["order"] * 1.0, is_active: true})
        |> then(fn changeset ->
          if category.__meta__.state == :loaded,
            do: Repo.update!(changeset),
            else: Repo.insert!(changeset)
        end)
      end

      for row <- products do
        product = Repo.get(Product, row["product_id"]) || %Product{id: row["product_id"]}

        product
        |> Product.changeset(%{
          name: row["name"],
          price: Delivest.Money.from_rubles(row["price"]),
          category_id: row["category_id"],
          media_id: row["media_id"],
          is_active: true,
          tags: [],
          slug: row["slug"]
        })
        |> Ecto.Changeset.change(order: row["order"] * 1.0)
        |> then(fn changeset ->
          if product.__meta__.state == :loaded,
            do: Repo.update!(changeset),
            else: Repo.insert!(changeset)
        end)
      end

      for row <- banners do
        stock = Repo.get(Stock, row["stock_id"]) || %Stock{id: row["stock_id"]}

        stock
        |> Stock.changeset(%{
          media_id: row["media_id"],
          text: row["text"],
          is_active: true,
          order: row["order"] * 1.0
        })
        |> then(fn changeset ->
          if stock.__meta__.state == :loaded,
            do: Repo.update!(changeset),
            else: Repo.insert!(changeset)
        end)
      end

      for {type, ids} <- fixtures do
        Repo.delete_all(
          from r in EntityRelation,
            where:
              r.from_entity_type == "Branch" and r.from_id in ^branch_ids and
                r.to_entity_type == ^type and r.to_id not in ^ids
        )

        for branch_id <- branch_ids, id <- ids do
          {:ok, _} = Relations.create_relation(Repo, "Branch", branch_id, type, id, %{})
        end
      end

      Catalogs.bump_versions(branch_ids)
    end,
    timeout: :infinity
  )

Enum.each(branch_ids, fn branch_id ->
  Catalogs.invalidate_menu_cache(branch_id)
  Cachex.del(:stock_cache, branch_id)
end)

IO.puts("Applied demo menu to #{Enum.join(slugs, ", ")}: 5 categories, 30 products, 6 banners")
