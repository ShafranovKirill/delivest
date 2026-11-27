import { expect, test, type Page } from "@playwright/test";
import { selectPickupLocation } from "../support/pickup";

const phone = () => `+7998${String(Date.now() % 10_000_000).padStart(7, "0")}`;
let authSession = 0;
const method = {
  id: "e16bca24-a0f1-4b82-9af6-d38567166378",
  type: "bank_card",
  title: "Visa",
  last4: "4242",
};

async function enableOnlinePayment(page: Page) {
  await page.route("**/client/storefront/v1/bootstrap**", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (body.selected_branch?.branch_info) {
      body.selected_branch.branch_info.payment_methods = ["cash", "online"];
    }
    await route.fulfill({ response, json: body });
  });
  await page.route("**/client/capabilities", (route) =>
    route.fulfill({
      status: 200,
      json: { saved_payment_methods_enabled: true },
    }),
  );
  await page.route("**/client/payment-methods", (route) =>
    route.fulfill({ status: 200, json: { data: [method] } }),
  );
}

async function signIn(page: Page, number: string) {
  const ip = `198.19.0.${++authSession}`;
  await page.route("**/client/auth/**", (route) =>
    route.continue({
      headers: { ...route.request().headers(), "x-forwarded-for": ip },
    }),
  );
  await page.locator("header").getByRole("button", { name: "Войти" }).click();
  const confirmed = page.waitForResponse(
    (response) =>
      /\/client\/auth\/call\/[^/]+\/complete$/.test(
        new URL(response.url()).pathname,
      ) && response.status() === 200,
  );
  await page.getByRole("dialog").locator('input[name="phone"]').fill(number);
  await page.getByRole("button", { name: "Продолжить" }).click();
  await confirmed;
  await expect(
    page.locator("header").getByRole("button", { name: "Профиль" }),
  ).toBeVisible();
}

async function openCheckout(page: Page) {
  await page.getByRole("button", { name: "590 ₽" }).click();
  await page.getByText("Заберу самостоятельно").click();
  await selectPickupLocation(page);
  await page.locator("header").getByRole("button", { name: "590 ₽" }).click();
  await page.getByRole("button", { name: "К оформлению заказа" }).click();
  await expect(page).toHaveURL(/\/checkout$/);
}

async function pickPayment(page: Page, name: string) {
  await page.getByRole("button", { name: /Изменить способ оплаты/ }).click();
  await page
    .getByRole("dialog", { name: "Способ оплаты" })
    .getByRole("button", { name, exact: true })
    .click();
}

test("saved selection confirms the exact amount and a rejected method returns to ordinary checkout", async ({
  page,
}) => {
  await enableOnlinePayment(page);
  await page.goto("/e2e");
  await signIn(page, phone());
  await openCheckout(page);
  await pickPayment(page, "Онлайн, картой или СБП");
  await pickPayment(page, "Visa · 4242");

  const payloads: Record<string, unknown>[] = [];
  await page.route("**/client/orders", (route) => {
    if (route.request().method() !== "POST") return route.continue();
    payloads.push(route.request().postDataJSON());
    return route.fulfill({
      status: 422,
      json: { error: "saved_payment_method_not_found", message: "Unavailable" },
    });
  });
  await expect(
    page.getByRole("button", { name: "Оплатить 590 ₽" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Оплатить 590 ₽" }).click();
  await expect(
    page.getByText(
      "Этот способ оплаты больше недоступен. Выберите обычную онлайн-оплату",
    ),
  ).toBeVisible();
  expect(payloads).toHaveLength(1);
  expect(payloads[0]).toMatchObject({
    payment_method: "online",
    saved_payment_method_id: method.id,
    confirmed_payment_total: 59000,
    expected_total: 59000,
  });
  expect(payloads[0]).not.toHaveProperty("save_payment_method");
  await expect(
    page.getByRole("button", { name: "Оформить заказ" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Оформить заказ" }).click();
  await expect.poll(() => payloads.length).toBe(2);
  expect(payloads[1]).not.toHaveProperty("saved_payment_method_id");
  expect(payloads[1]).not.toHaveProperty("save_payment_method");
  await expect(page).toHaveURL(/\/checkout$/);
});

test("saving a new method requires unchecked-by-default consent from a signed-in client", async ({
  page,
}) => {
  await enableOnlinePayment(page);
  await page.goto("/e2e");
  await signIn(page, phone());
  await openCheckout(page);
  await pickPayment(page, "Онлайн, картой или СБП");
  const consent = page.getByRole("checkbox", {
    name: /Сохранить способ оплаты/,
  });
  await expect(consent).not.toBeChecked();
  const payloads: Record<string, unknown>[] = [];
  await page.route("**/client/orders", (route) => {
    if (route.request().method() !== "POST") return route.continue();
    payloads.push(route.request().postDataJSON());
    return route.fulfill({
      status: 422,
      json: { error: "order_failed", message: "Test" },
    });
  });
  await page.getByRole("button", { name: "Оформить заказ" }).click();
  await expect.poll(() => payloads.length).toBe(1);
  expect(payloads[0]).not.toHaveProperty("save_payment_method");
  await consent.check();
  await page.getByRole("button", { name: "Оформить заказ" }).click();
  await expect.poll(() => payloads.length).toBe(2);
  expect(payloads[1]).toMatchObject({
    payment_method: "online",
    save_payment_method: true,
  });
  expect(payloads[1]).not.toHaveProperty("saved_payment_method_id");
});

test("pending saved payment offers ordinary fallback on the same order only when server allows it", async ({
  page,
}) => {
  await enableOnlinePayment(page);
  const bootstrap = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/client/storefront/v1/bootstrap",
  );
  await page.goto("/e2e");
  const branchId = (await (await bootstrap).json()).selected_branch
    .id as string;
  await signIn(page, phone());
  const orderId = "7066f799-7588-4f8b-9cff-e8d43168bcbc";
  let available = false;
  let awaitingPayment = true;
  await page.route(`**/client/orders/${orderId}`, (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({
      status: 200,
      json: {
        data: {
          id: orderId,
          branch_id: branchId,
          cart_id: "cart-test",
          short_number: "123",
          status: "created",
          awaiting_payment: awaitingPayment,
          payment_method: "online",
          saved_payment_fallback_available: available,
          total_amount: 59000,
          subtotal_amount: 59000,
          discount_amount: 0,
          delivery_amount: 0,
          fulfillment_type: "pickup",
          items: [],
          promotions: [],
          inserted_at: new Date().toISOString(),
        },
      },
    });
  });
  const fallbackCalls: Record<string, unknown>[] = [];
  await page.route(`**/client/orders/${orderId}/pay`, (route) => {
    fallbackCalls.push(route.request().postDataJSON());
    if (fallbackCalls.length === 2) {
      awaitingPayment = false;
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({
      status: 409,
      json: { error: "payment_unavailable", message: "Pending" },
    });
  });
  await page.goto(`/e2e/checkout/order/${orderId}`);
  await expect(page.getByText("Заказ 123")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Оплатить другим способом · 590 ₽" }),
  ).toHaveCount(0);
  available = true;
  await page.reload();
  await page
    .getByRole("button", { name: "Оплатить другим способом · 590 ₽" })
    .click();
  await expect.poll(() => fallbackCalls.length).toBe(1);
  expect(fallbackCalls[0]).toEqual({ fallback_to_new_method: true });
  await expect(
    page.getByText(
      "Новая оплата пока недоступна. Проверьте статус заказа позже",
    ),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/checkout/order/${orderId}$`));
  const fallback = page.getByRole("button", {
    name: "Оплатить другим способом · 590 ₽",
  });
  await fallback.click();
  await expect(fallback).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/checkout/order/${orderId}$`));
});
