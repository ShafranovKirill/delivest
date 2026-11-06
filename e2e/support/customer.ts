import { expect, type Page } from "@playwright/test";

type Fulfillment = "delivery" | "pickup";

const chooseFulfillment = async (page: Page, fulfillment: Fulfillment) => {
  if (fulfillment === "pickup") {
    await page.getByText("Заберу самостоятельно").click();
  } else {
    await page.getByText("Указать адрес доставки").click();
    await page.getByLabel("Город, улица, дом").fill("Москва, Тверская, 7");
  }

  const confirmLabel = fulfillment === "delivery" ? "Подтвердить адрес" : "Заказать сюда";
  await page.getByRole("button", { name: confirmLabel }).click();
};

export const placeOrder = async (page: Page, fulfillment: Fulfillment, mobile = false) => {
  await page.goto("/");
  await page.getByRole("button", { name: "590 ₽" }).click();
  await chooseFulfillment(page, fulfillment);

  const cart = mobile ? page : page.locator("header");
  await cart.getByRole("button", { name: "590 ₽" }).click();
  await page.getByRole("button", { name: "К оформлению заказа" }).click();

  await expect(page).toHaveURL(/checkout/, { timeout: 30_000 });
  if (mobile) {
    await expect(page.getByRole("button", { name: "Другое время" })).toBeVisible();
    await page.getByRole("button", { name: "1 товар" }).click();
    const composition = page.getByRole("heading", { name: "Состав заказа" }).locator("..");
    await expect(composition.getByText("Маргарита")).toBeVisible();
  }

  const phoneInput = page.locator("input[name=phone]");
  await expect(phoneInput).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Оформить заказ" }).click();
  const phoneError = page.getByText("Введите номер телефона полностью");
  await expect(phoneError).toBeVisible();
  await expect(phoneInput).toBeFocused();
  await phoneInput.fill("+79990001122");
  await expect(phoneError).toBeHidden();
  await page.getByRole("button", { name: "Оформить заказ" }).click();

  const heading = page.getByText(/^Заказ \d+$/);
  await expect(heading).toBeVisible();
  const orderHeading = await heading.innerText();
  await expect(page).toHaveURL(/\/checkout\/order\/[^/]+$/);
  await page.reload();
  await expect(heading).toHaveText(orderHeading);
  return orderHeading.replace("Заказ ", "");
};
