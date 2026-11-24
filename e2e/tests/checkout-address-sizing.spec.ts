import { expect, test, type Page } from "@playwright/test";

async function openCheckoutAddress(
  page: Page,
  operatorAddress: boolean,
  pickupMethods: Array<"pickup" | "dine_in">,
) {
  await page.route('**/client/storefront/v1/bootstrap?*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const branches = [...body.branches, body.selected_branch];
    for (const branch of branches) {
      if (branch?.slug === "e2e" && branch.branch_info) {
        branch.branch_info.fulfillment_methods = ["delivery", ...pickupMethods];
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
  await page.getByRole("button", { name: "Доставка", exact: true }).click();
  const cartButton = page.viewportSize()!.width < 768 ? page : page.locator("header");
  await cartButton.getByRole("button", { name: "590 ₽" }).click();
  await page.getByRole("button", { name: "К оформлению заказа" }).click();
  await expect(page).toHaveURL(/checkout/);
  if (operatorAddress) {
    await page.getByRole("checkbox", { name: "Уточнить адрес по телефону" }).check();
  } else {
    await page.getByLabel("Улица и дом").fill("Тверская, 7");
  }
  await page
    .getByRole("group", { name: "Адрес доставки" })
    .getByRole("button", {
      name: pickupMethods.includes("pickup") ? "Самовывоз" : "В зале",
    })
    .click();
  const dialog = page
    .getByRole("dialog")
    .filter({ has: page.getByRole("radio", { name: /Самовывоз|В зале/ }) });
  await expect(dialog).toBeVisible();
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

for (const method of ["Самовывоз", "В зале"] as const) {
  test(`checkout form ${method} opens the branch preview before changing fulfillment`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const dialog = await openCheckoutAddress(page, false, [
      "pickup",
      "dine_in",
    ]);
    await dialog.getByRole("button", { name: "Закрыть" }).click();
    await page
      .getByRole("group", { name: "Адрес доставки" })
      .getByRole("button", { name: method })
      .click();
    await expect(dialog.getByTestId("pickup-branch-list")).toBeVisible();
    await expect(dialog.getByTestId("pickup-branch-detail")).toHaveCount(0);
    await dialog
      .getByTestId("pickup-branch-row")
      .filter({ has: page.getByText("E2E", { exact: true }) })
      .click();
    const detail = dialog.getByTestId("pickup-branch-detail");
    await expect(detail).toBeVisible();
    await expect(
      detail.getByRole("radio", {
        name: method === "Самовывоз" ? "С собой" : "В зале",
      }),
    ).toHaveAttribute("aria-checked", "true");
    await detail.getByRole("button", { name: "Назад" }).click();
    await expect(dialog.getByTestId("pickup-branch-list")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Заказ на доставку" }),
    ).toBeVisible();
  });
}

async function expectDialogFitsViewport(
  dialog: ReturnType<Page["getByRole"]>,
) {
  const dimensions = await dialog.evaluate((root) => {
    const box = root.getBoundingClientRect();
    return {
      top: box.top,
      bottom: box.bottom,
      left: box.left,
      right: box.right,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    };
  });
  expect(dimensions.top).toBeGreaterThanOrEqual(0);
  expect(dimensions.bottom).toBeLessThanOrEqual(dimensions.viewportHeight);
  expect(dimensions.left).toBeGreaterThanOrEqual(0);
  expect(dimensions.right).toBeLessThanOrEqual(dimensions.viewportWidth);
}

for (const viewport of [
  { width: 319, height: 1020 },
  { width: 390, height: 844 },
  { width: 375, height: 667 },
]) {
  for (const operatorAddress of [false, true]) {
    test(`checkout inline address and pickup picker fit ${viewport.width}x${viewport.height} with operator ${operatorAddress}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      const dialog = await openCheckoutAddress(page, operatorAddress, ["pickup"]);
      await expect(dialog.locator(".cursor-grab")).toHaveCount(0);
      await expectDialogFitsViewport(dialog);
      await expect(dialog.getByTestId("pickup-branch-list")).toBeVisible();
      await dialog.getByRole("button", { name: "Закрыть" }).click();
      await expect(page.getByRole("heading", { name: "Заказ на доставку" })).toBeVisible();
      await expect(
        page.getByRole("checkbox", { name: "Уточнить адрес по телефону" }),
      ).toHaveCount(operatorAddress ? 1 : 0);
      if (operatorAddress) {
        const checkbox = page.getByRole("checkbox", { name: "Уточнить адрес по телефону" });
        await expect(checkbox).toBeChecked();
        await checkbox.uncheck();
      }
      await expect(page.getByLabel("Улица и дом")).toBeVisible();
      const horizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(horizontalOverflow).toBeLessThanOrEqual(2);
    });
  }
}
