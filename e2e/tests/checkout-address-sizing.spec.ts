import { expect, test, type Page } from "@playwright/test";

async function openCheckoutAddress(
  page: Page,
  operatorAddress: boolean,
  pickupMethods?: Array<"pickup" | "dine_in">,
) {
  await page.route(/\/client\/branches(?:\/[^?]+\/select)?$/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const branches = Array.isArray(body.data) ? body.data : [body.data];
    for (const branch of branches) {
      if (branch?.slug === "e2e" && branch.branch_info) {
        if (pickupMethods)
          branch.branch_info.fulfillment_methods = [
            "delivery",
            ...pickupMethods,
          ];
        branch.branch_info.delivery = {
          ...branch.branch_info.delivery,
          map_address: false,
          show_city: false,
          operator_address: operatorAddress,
          address_mode_set: true,
        };
      }
    }
    await route.fulfill({ response, json: body });
  });

  await page.goto("/e2e");
  await page.getByRole("button", { name: "590 ₽" }).click();
  await page.getByText("Указать адрес доставки").click();
  if (operatorAddress) {
    await page
      .getByRole("button", { name: "Уточнить адрес по телефону" })
      .click();
  } else {
    await page.getByLabel("Улица, дом").fill("Тверская, 7");
    await page.getByRole("button", { name: "Подтвердить адрес" }).click();
  }
  await page
    .getByRole("button", { name: "590 ₽", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByRole("button", { name: "К оформлению заказа" }).click();
  await expect(page).toHaveURL(/checkout/);
  await page.getByRole("button", { name: /Адрес доставки:/ }).click();
  const address = page.getByLabel("Улица, дом");
  const dialog = page
    .getByRole("dialog")
    .filter({ has: page.getByRole("radio", { name: /Самовывоз|В зале/ }) });
  await expect(dialog).toBeVisible();
  await expect(address).toBeVisible();
  return dialog;
}

for (const pickupMethods of [
  ["pickup", "dine_in"] as Array<"pickup" | "dine_in">,
  ["pickup"] as Array<"pickup" | "dine_in">,
  ["dine_in"] as Array<"pickup" | "dine_in">,
]) {
  test(`checkout pickup previews branch with ${pickupMethods.join(" and ")}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const dialog = await openCheckoutAddress(page, false, pickupMethods);
    await dialog
      .getByRole("radio", {
        name: pickupMethods.includes("pickup") ? "Самовывоз" : "В зале",
      })
      .click();
    const list = dialog.getByTestId("pickup-branch-list");
    await expect(list).toBeVisible();
    await list
      .getByTestId("pickup-branch-row")
      .filter({ has: page.getByText("E2E", { exact: true }) })
      .click();
    const detail = dialog.getByTestId("pickup-branch-detail");
    await expect(detail).toBeVisible();
    await expect(detail).toContainText("Москва, Тверская улица, 7");
    const initialConfirmation = pickupMethods.includes("pickup")
      ? "Заберу здесь"
      : "Останусь здесь";
    await expect(
      detail.getByRole("button", { name: initialConfirmation }),
    ).toBeVisible();
    if (pickupMethods.length > 1) {
      await detail.getByRole("radio", { name: "В зале" }).click();
      await expect(
        detail.getByRole("button", { name: "Останусь здесь" }),
      ).toBeVisible();
      await detail.getByRole("radio", { name: "С собой" }).click();
      await expect(
        detail.getByRole("button", { name: "Заберу здесь" }),
      ).toBeVisible();
    } else {
      await expect(detail.getByRole("radiogroup")).toHaveCount(0);
    }
    await detail.getByRole("button", { name: "Назад" }).click();
    await expect(list).toBeVisible();
    await expect(detail).toHaveCount(0);
  });
}

test("checkout dine-in confirmation returns to the order with the selected method", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const dialog = await openCheckoutAddress(page, false, ["pickup", "dine_in"]);
  await dialog.getByRole("radio", { name: "Самовывоз" }).click();
  await dialog
    .getByTestId("pickup-branch-row")
    .filter({ has: page.getByText("E2E", { exact: true }) })
    .click();
  const detail = dialog.getByTestId("pickup-branch-detail");
  await detail.getByRole("radio", { name: "В зале" }).click();
  await detail.getByRole("button", { name: "Останусь здесь" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Заказ в зале" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Адрес кафе:.*Тверская улица, 7/ }),
  ).toBeVisible();
});

async function expectNaturalHeight(
  page: Page,
  dialog: ReturnType<Page["getByRole"]>,
) {
  const dimensions = await dialog.evaluate((root) => {
    const box = root.getBoundingClientRect();
    const scrollExcess = [root, ...root.querySelectorAll<HTMLElement>("*")]
      .filter((element) => {
        const overflow = getComputedStyle(element).overflowY;
        return overflow === "auto" || overflow === "scroll";
      })
      .map((element) =>
        Math.max(0, element.scrollHeight - element.clientHeight),
      );
    return {
      height: box.height,
      centerOffset: Math.abs(box.top + box.height / 2 - window.innerHeight / 2),
      excess: Math.max(0, ...scrollExcess),
    };
  });
  expect(dimensions.height).toBeLessThan(page.viewportSize()!.height - 16);
  expect(dimensions.centerOffset).toBeLessThanOrEqual(3);
  expect(dimensions.excess).toBeLessThanOrEqual(2);
}

for (const viewport of [
  { width: 319, height: 1020 },
  { width: 390, height: 844 },
  { width: 375, height: 667 },
]) {
  for (const operatorAddress of [false, true]) {
    test(`checkout address dialog fits ${viewport.width}x${viewport.height} with operator ${operatorAddress}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      const dialog = await openCheckoutAddress(page, operatorAddress);
      await expect(
        dialog.getByRole("button", { name: "Уточнить адрес по телефону" }),
      ).toHaveCount(operatorAddress ? 1 : 0);
      await expect(dialog.locator(".cursor-grab")).toHaveCount(0);
      await expectNaturalHeight(page, dialog);

      const modes = dialog.getByRole("radiogroup").first();
      await modes.getByRole("radio", { name: "Самовывоз" }).click();
      await expect(dialog.getByTestId("pickup-branch-list")).toBeVisible();
      await expectNaturalHeight(page, dialog);
      await modes.getByRole("radio", { name: "Доставка" }).click();
      await expect(dialog.getByLabel("Улица, дом")).toBeVisible();
      await expectNaturalHeight(page, dialog);
    });
  }
}
