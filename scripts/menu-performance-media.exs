# Generate variants only for the isolated local measurement fixture.
import Ecto.Query
repo = Application.fetch_env!(:delivest, Delivest.Repo)
s3 = Application.fetch_env!(:ex_aws, :s3)

unless Mix.env() == :dev and
         String.starts_with?(Keyword.fetch!(repo, :database), "delivest_menu_perf_") and
         Keyword.fetch!(repo, :hostname) in ["localhost", "127.0.0.1"] and
         Keyword.fetch!(s3, :host) in ["localhost", "127.0.0.1"] do
  raise "Media measurement requires isolated local fixture and local S3"
end

Application.put_env(
  :delivest,
  DelivestWeb.Endpoint,
  Application.fetch_env!(:delivest, DelivestWeb.Endpoint)
  |> Keyword.merge(server: false, code_reloader: false, reloadable_apps: [], watchers: [])
)

Application.put_env(
  :delivest,
  Oban,
  Application.fetch_env!(:delivest, Oban) |> Keyword.put(:testing, :manual)
)

Logger.configure(level: :warning)
{:ok, _} = Application.ensure_all_started(:delivest)
output = System.fetch_env!("MENU_MEDIA_OUTPUT")
File.mkdir_p!(output)

rows =
  Delivest.Repo.all(
    from f in Delivest.Media.File, where: f.context == :product and not f.is_private
  )
  |> Enum.map(fn file ->
    {:ok, %{body: original}} = ExAws.S3.get_object(file.bucket, file.key) |> ExAws.request()
    {:ok, updated} = Delivest.Media.Thumbnails.store(file)

    sizes =
      for width <- [192, 384, 800], into: %{} do
        {:ok, webp, actual_width} = Delivest.Media.Thumbnail.build_width(original, width)
        File.write!(Path.join(output, "#{file.id}-#{width}.webp"), webp)
        {to_string(width), %{bytes: byte_size(webp), width: actual_width}}
      end

    quality_samples =
      for width <- [192, 384], quality <- [70, 75, 80] do
        {:ok, image} =
          Vix.Vips.Operation.thumbnail_buffer(original, width,
            height: width,
            size: :VIPS_SIZE_DOWN
          )

        {:ok, webp} = Vix.Vips.Image.write_to_buffer(image, ".webp[Q=#{quality},strip]")
        File.write!(Path.join(output, "#{file.id}-#{width}-q#{quality}.webp"), webp)
        %{width: width, quality: quality, bytes: byte_size(webp)}
      end

    %{
      id: file.id,
      source_bytes: byte_size(original),
      sizes: sizes,
      quality_samples: quality_samples,
      published_variants: map_size(updated.variant_keys)
    }
  end)

File.write!(Path.join(output, "sizes.json"), Jason.encode!(rows, pretty: true))
IO.puts("Generated #{length(rows)} product variant sets")
