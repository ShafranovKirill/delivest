partition = System.get_env("MIX_TEST_PARTITION", "")

unless System.get_env("MIX_ENV") == "test" and
         String.starts_with?(partition, "_catalog_audit_") do
  raise "Refusing to run: set MIX_ENV=test and a fresh MIX_TEST_PARTITION beginning _catalog_audit_"
end

ExUnit.start()
Ecto.Adapters.SQL.Sandbox.mode(Delivest.Repo, :manual)

defmodule Delivest.CatalogBranchIsolationReproTest do
  use ExUnit.Case, async: false

  alias Delivest.{Repo, Relations}
  alias Delivest.Identity.{Role, StaffBranch}
  alias Delivest.Net.{ProductStop, Categories, Products, Stops}

  setup do
    Ecto.Adapters.SQL.Sandbox.checkout(Repo)

    branch_a = Delivest.Factory.insert(:branch, name: "Audit A")
    branch_b = Delivest.Factory.insert(:branch, name: "Audit B")
    role = Repo.insert!(%Role{name: "audit-admin-#{Ecto.UUID.generate()}", permissions: ["admin"]})
    staff = Delivest.Factory.insert(:staff, role: role) |> Repo.preload(:role)
    staff = %{staff | branches: []}

    %{branch_a: branch_a, branch_b: branch_b, staff: staff}
  end

  test "branch menu preload returns a product related only to another branch", context do
    category = Delivest.Factory.insert(:category)
    product = Delivest.Factory.insert(:product, category_id: category.id)

    {:ok, _} = Relations.create_relation(Repo, "Branch", context.branch_a.id, "Category", category.id)
    {:ok, _} = Relations.create_relation(Repo, "Branch", context.branch_b.id, "Category", category.id)
    {:ok, _} = Relations.create_relation(Repo, "Branch", context.branch_b.id, "Product", product.id)

    branch_a_menu = Categories.list_category_for_branch(context.branch_a.id)
    loaded_category = Enum.find(branch_a_menu, &(&1.id == category.id))

    assert loaded_category != nil
    assert Enum.any?(loaded_category.products, &(&1.id == product.id))

    IO.puts("EVIDENCE menu_branch_a_contains_product_related_only_to_branch_b=true")
  end

  test "resuming a product in branch B deletes the manual stop row for branch A", context do
    product = Delivest.Factory.insert(:product)
    {:ok, _} = Relations.create_relation(Repo, "Branch", context.branch_a.id, "Product", product.id)
    {:ok, _} = Relations.create_relation(Repo, "Branch", context.branch_b.id, "Product", product.id)

    {:ok, stop_a} = Stops.stop(context.staff, context.branch_a.id, product, :until_resumed)
    assert stop_a.branch_id == context.branch_a.id

    role = Repo.insert!(%Role{name: "audit-stop-editor-#{Ecto.UUID.generate()}", permissions: ["stops.update"]})
    branch_b_editor = Delivest.Factory.insert(:staff, role: role)
    Repo.insert!(%StaffBranch{staff_id: branch_b_editor.id, branch_id: context.branch_b.id})
    branch_b_editor = Repo.preload(branch_b_editor, [:role, :branches])

    {:ok, stop_b} = Stops.stop(branch_b_editor, context.branch_b.id, product, :until_resumed)
    assert stop_b.branch_id == context.branch_a.id

    {:ok, _product} = Stops.resume(branch_b_editor, context.branch_b.id, product)
    remaining = Repo.all(ProductStop)

    assert remaining == []
    IO.puts("EVIDENCE stop_branch_b_resume_deleted_branch_a_manual_stop=true")
  end

  test "branch-only product update leaves the other branch menu cache untouched", context do
    category = Delivest.Factory.insert(:category)
    product = Delivest.Factory.insert(:product, category_id: category.id)

    for branch <- [context.branch_a, context.branch_b] do
      {:ok, _} = Relations.create_relation(Repo, "Branch", branch.id, "Product", product.id)
    end

    [editor_branch_id, other_branch_id] = Relations.list_source_ids("Product", product.id, "Branch")
    role = Repo.insert!(%Role{name: "audit-editor-#{Ecto.UUID.generate()}", permissions: ["products.update"]})
    editor = Delivest.Factory.insert(:staff, role: role)
    Repo.insert!(%StaffBranch{staff_id: editor.id, branch_id: editor_branch_id})
    editor = Repo.preload(editor, [:role, :branches])
    assert Delivest.Identity.authorize(editor, "products.update", editor_branch_id) == :ok
    assert Delivest.Identity.authorize(editor, "products.update", other_branch_id) == {:error, :forbidden}

    {:ok, true} = Cachex.put(:menu_cache, editor_branch_id, :old_editor_menu)
    {:ok, true} = Cachex.put(:menu_cache, other_branch_id, :old_other_menu)

    {:ok, updated} = Products.update_product(editor, product, %{"name" => "Updated shared product"})
    assert updated.name == "Updated shared product"
    assert Repo.get!(Delivest.Net.Product, product.id).name == "Updated shared product"
    assert Cachex.get(:menu_cache, editor_branch_id) == {:ok, nil}
    assert Cachex.get(:menu_cache, other_branch_id) == {:ok, :old_other_menu}

    IO.puts("EVIDENCE branch_only_editor_mutated_shared_product=true other_branch_menu_cache_still_old=true")
  end
end
