# Evaluated inside the production release. Keys are synthetic, deterministic and isolated.
injected = binding()
{arg, key} = case {Keyword.fetch(injected, :action), Keyword.fetch(injected, :key)} do
  {{:ok, action}, {:ok, fixture_key}} -> {action, fixture_key}
  _ ->
    args = System.argv()
    [action, fixture_key] = if hd(args) == "--", do: tl(args), else: args
    {action, fixture_key}
end
{:ok, _} = Application.ensure_all_started(:delivest)
unless Regex.match?(~r/\A[a-z0-9-]{1,40}\z/, key), do: raise("invalid fixture key")
repo = Delivest.Repo
id = fn salt ->
  <<a::binary-size(8), b::binary-size(4), c::binary-size(4), d::binary-size(4), e::binary-size(12), _::binary>> = Base.encode16(:crypto.hash(:sha256, key <> salt), case: :lower)
  Enum.join([a, b, c, d, e], "-")
end
order_id = id.("order")
cart_id = id.("cart")
branch_id = id.("branch")
object_key = "release-upgrade/#{key}/order-#{order_id}.txt"
body = "order=#{order_id}\nkey=#{key}\n"
bucket = Delivest.Media.public_bucket()
private_bucket = Delivest.Media.private_bucket()
case arg do
  "create" ->
    code = "U" <> (Base.encode16(:crypto.hash(:sha256, key), case: :upper) |> binary_part(0, 5))
    branch = %Delivest.Identity.Branch{id: branch_id, name: "Upgrade #{key}", slug: "upgrade-#{key}", code: code, is_active: true}
    cart = %Delivest.Oms.Cart{id: cart_id, branch_id: branch_id}
    order = %Delivest.Oms.Order{id: order_id, number: "UP-#{key}", branch_id: branch_id,
      cart_id: cart_id, business_date: Date.utc_today(), daily_number: 1, comment: object_key}
    repo.transaction(fn ->
      repo.insert!(branch)
      repo.insert!(cart)
      repo.insert!(order)
    end) |> case do {:ok, _} -> :ok; other -> raise("order insert failed: #{inspect(other)}") end
    {:ok, _} = ExAws.S3.put_object(bucket, object_key, body, content_type: "text/plain") |> ExAws.request()
    {:ok, _} = ExAws.S3.put_object(private_bucket, object_key, body, content_type: "text/plain") |> ExAws.request()
    IO.puts("created order=#{order_id} object=#{bucket}/#{object_key}")
  "read" ->
    %{comment: ^object_key} = repo.get!(Delivest.Oms.Order, order_id) |> repo.preload([:items])
    {:ok, %{body: ^body}} = ExAws.S3.get_object(bucket, object_key) |> ExAws.request()
    {:ok, %{body: ^body}} = ExAws.S3.get_object(private_bucket, object_key) |> ExAws.request()
    IO.puts("verified order=#{order_id} object=#{bucket}/#{object_key}")
  "assert_absent" ->
    nil = repo.get(Delivest.Oms.Order, order_id)
    IO.puts("absent order=#{order_id}")
  _ -> raise("usage: create|read|assert_absent key")
end
