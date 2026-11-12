import { expect, test } from "../support/test";

const first = {
  city: "Москва",
  street: "Тверская",
  house: "7",
  value: "Москва, Тверская, 7",
  latitude: 55.757,
  longitude: 37.614,
  fias_id: null,
  postal_code: null,
  district: null,
  geo_precision: 0,
};
const second = {
  ...first,
  street: "Арбат",
  house: "10",
  value: "Москва, Арбат, 10",
  latitude: 55.752,
  longitude: 37.591,
};

test("address choice shows the server quote and clears it while another point is checked", async ({
  page,
}) => {
  let releaseSecond!: () => void;
  const secondGate = new Promise<void>((resolve) => {
    releaseSecond = resolve;
  });
  await page.route("**/client/franchise", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.data.address_map = true;
    await route.fulfill({ response, json: body });
  });
  await page.route("**/styles/liberty", async (route) => {
    await route.fulfill({
      json: {
        version: 8,
        glyphs:
          "https://tiles.openfreemap.org/qa-glyphs/{fontstack}/{range}.pbf",
        sources: {
          openmaptiles: {
            type: "vector",
            tiles: ["https://tiles.openfreemap.org/qa-tiles/{z}/{x}/{y}.pbf"],
          },
        },
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#eef1f5" },
          },
        ],
      },
    });
  });
  await page.route("**/qa-tiles/**", async (route) => {
    await route.fulfill({
      contentType: "application/x-protobuf",
      body: Buffer.alloc(0),
    });
  });
  await page.route("**/client/delivery/zones**", async (route) => {
    await route.fulfill({
      json: {
        data: [
          {
            id: "first",
            name: "Центр",
            color: "#dc2626",
            polygon: {
              type: "Polygon",
              coordinates: [
                [
                  [37.6, 55.75],
                  [37.63, 55.75],
                  [37.63, 55.77],
                  [37.6, 55.77],
                  [37.6, 55.75],
                ],
              ],
            },
            thresholds: [{ order_from: 50000, price: 10000 }],
            delivery_minutes: 35,
          },
        ],
      },
    });
  });
  await page.route("**/client/geo/suggest**", async (route) => {
    await route.fulfill({ json: { data: [first, second] } });
  });
  await page.route("**/client/delivery/quote**", async (route) => {
    const latitude = Number(
      new URL(route.request().url()).searchParams.get("latitude"),
    );
    if (latitude === second.latitude) await secondGate;
    await route.fulfill({
      json: {
        data: {
          status: "ok",
          price: latitude === second.latitude ? 25000 : 15000,
          min_order: 50000,
          free_from: 150000,
          minutes: 45,
          zone_id: latitude === second.latitude ? "second" : "first",
          zone_name: latitude === second.latitude ? "Арбат" : "Центр",
          zone_color: "#2563eb",
        },
      },
    });
  });

  await page.goto("/e2e");
  await page.getByRole("button", { name: "590 ₽" }).click();
  await page.getByText("Указать адрес доставки").click();
  const input = page.getByLabel("Город, улица, дом");
  const confirmAddress = page.getByRole("button", { name: "Подтвердить адрес" });
  await input.fill("Тверская, 7");
  await expect(confirmAddress).toBeDisabled();
  await page.getByRole("option", { name: /Тверская.*7/ }).click();
  const caption = page.getByTestId("delivery-quote-caption");
  await expect(caption).toContainText("Центр");
  await expect(caption).toContainText("150 ₽");
  await expect(confirmAddress).toBeEnabled();
  const canvas = page.locator(".maplibregl-canvas");
  await expect(canvas).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toBeHidden();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(
    box!.x + box!.width / 2 + 30,
    box!.y + box!.height / 2 - 30,
  );
  await expect(page.getByText(/от 500 ₽: 100 ₽/)).toBeVisible();

  await input.fill("Арбат, 10");
  await page.getByRole("option", { name: /Арбат.*10/ }).click();
  await expect(caption).toContainText("Проверяем стоимость доставки");
  await expect(caption).not.toContainText("150 ₽");
  releaseSecond();
  await expect(caption).toContainText("Арбат");
  await expect(caption).toContainText("250 ₽");
});

test("below minimum shows delivery price and keeps address confirmation available", async ({
  page,
}) => {
  await page.route("**/client/delivery/quote**", async (route) => {
    await route.fulfill({
      json: {
        data: {
          status: "below_minimum",
          price: 10000,
          min_order: 50000,
          free_from: 150000,
          minutes: 35,
          zone_id: "first",
          zone_name: "Центр",
          zone_color: "#dc2626",
        },
      },
    });
  });
  await page.goto("/e2e");
  await page.getByRole("button", { name: "590 ₽" }).click();
  await page.getByText("Указать адрес доставки").click();
  await page.getByLabel("Город, улица, дом").fill("Москва, Тверская, 7");
  const caption = page.getByTestId("delivery-quote-caption");
  await expect(caption).toContainText("Центр");
  await expect(caption).toContainText("100 ₽");
  await expect(caption).toContainText("500 ₽");
  await expect(caption).toContainText("1 500 ₽");
  await expect(
    page.getByRole("button", { name: "Подтвердить адрес" }),
  ).toBeEnabled();
});
