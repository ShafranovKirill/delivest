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
  await page.setViewportSize({ width: 390, height: 844 });
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
  const input = page.getByLabel("Улица, дом");
  const confirmAddress = page.getByRole("button", { name: "Подтвердить адрес" });
  await input.fill("Тверская, 7");
  await expect(confirmAddress).toBeDisabled();
  await page.getByRole("option", { name: /Тверская.*7/ }).click();
  const caption = page.getByTestId("delivery-quote-caption");
  await expect(caption).toContainText("150 ₽");
  await expect(caption).toContainText("45 мин");
  await expect(caption).not.toContainText("Центр");
  const conditions = page.getByRole("button", { name: "Условия доставки" });
  await conditions.click();
  await expect(page.getByText("Центр", { exact: true })).toBeVisible();
  await expect(page.getByText(/Минимальная сумма.*500\s₽/)).toBeVisible();
  await expect(page.getByText(/бесплатно от 1\s500\s₽/)).toBeVisible();
  await expect(page.getByText(/от 500\s₽: 100\s₽/)).toBeVisible();
  if (process.env.ORDER_SUCCESS_SCREENSHOTS) {
    await page.screenshot({ path: `${process.env.ORDER_SUCCESS_SCREENSHOTS}/map-mobile-conditions.png`, fullPage: false, animations: 'disabled' });
  }
  await conditions.click();
  await expect(page.getByText('Условия доставки', { exact: true })).toBeHidden();
  if (process.env.ORDER_SUCCESS_SCREENSHOTS) {
    await page.screenshot({ path: `${process.env.ORDER_SUCCESS_SCREENSHOTS}/map-mobile.png`, fullPage: false, animations: 'disabled' });
  }
  await expect(confirmAddress).toBeEnabled();
  const canvas = page.locator(".maplibregl-canvas");
  await expect(canvas).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toBeHidden();
  const box = await canvas.boundingBox();
  const captionBox = await caption.boundingBox();
  expect(box).not.toBeNull();
  expect(captionBox?.height).toBe(44);
  const addressBox = await input.boundingBox();
  expect(captionBox!.y + captionBox!.height).toBeLessThan(addressBox!.y);
  const tabs = page.getByRole('radiogroup');
  const close = page.getByRole('button', { name: 'Закрыть' }).first();
  expect((await tabs.boundingBox())?.height).toBe(40);
  expect((await close.boundingBox())?.height).toBe(40);
  await page.mouse.move(
    box!.x + box!.width / 2 + 30,
    box!.y + box!.height / 2 - 30,
  );
  await expect(page.getByText(/^Центр · от 500\s₽: 100\s₽ · около 35 мин$/)).toBeVisible();

  await conditions.click();
  await expect(page.getByText("Центр", { exact: true })).toBeVisible();
  await input.fill("Арбат, 10");
  await page.getByRole("option", { name: /Арбат.*10/ }).click();
  await expect(caption).toContainText("Рассчитываем");
  await expect(caption).not.toContainText("150 ₽");
  await expect(page.getByText("Центр", { exact: true })).toBeHidden();
  await expect(conditions).toHaveCount(0);
  expect((await canvas.boundingBox())?.height).toBe(box?.height);
  expect((await caption.boundingBox())?.height).toBe(captionBox?.height);
  releaseSecond();
  await expect(caption).toContainText("250 ₽");
  await conditions.click();
  await expect(page.getByText("Арбат", { exact: true })).toBeVisible();
  expect((await canvas.boundingBox())?.height).toBe(box?.height);
  expect((await caption.boundingBox())?.height).toBe(captionBox?.height);
});

test("below minimum shows delivery price and keeps address confirmation available", async ({
  page,
}) => {
  await page.route("**/client/franchise", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.data.address_map = true;
    await route.fulfill({ response, json: body });
  });
  await page.route("**/client/geo/suggest**", async (route) => {
    await route.fulfill({ json: { data: [first] } });
  });
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
  await page.getByLabel("Улица, дом").fill("Тверская, 7");
  await page.getByRole("option", { name: /Тверская.*7/ }).click();
  const caption = page.getByTestId("delivery-quote-caption");
  await expect(caption).toContainText("100 ₽");
  await expect(caption).not.toContainText("500 ₽");
  await page.getByRole("button", { name: "Условия доставки" }).click();
  await expect(page.getByText("Центр", { exact: true })).toBeVisible();
  await expect(page.getByText(/Минимальная сумма.*500\s₽/)).toBeVisible();
  await expect(page.getByText(/бесплатно от 1\s500\s₽/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Подтвердить адрес" }),
  ).toBeEnabled();
});
