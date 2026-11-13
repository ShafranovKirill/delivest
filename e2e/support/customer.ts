import { expect, type Page } from "@playwright/test";
import { mockDeliveryAddressSuggestion, selectDeliveryAddress } from './delivery-address'
import { branchSlug } from './env'

type Fulfillment = "delivery" | "pickup";

const chooseFulfillment = async (page: Page, fulfillment: Fulfillment) => {
  if (fulfillment === "pickup") {
    await page.getByText("Заберу самостоятельно").click();
  } else {
    await page.getByText("Указать адрес доставки").click();
    await selectDeliveryAddress(page)
  }

  const confirmLabel = fulfillment === "delivery" ? "Подтвердить адрес" : "Заказать сюда";
  await page.getByRole("button", { name: confirmLabel }).click();
};

export const placeOrder = async (page: Page, fulfillment: Fulfillment, mobile = false) => {
  if (fulfillment === 'delivery') await mockDeliveryAddressSuggestion(page)
  await page.goto(`/${branchSlug}`);
  const menuProduct = page.getByRole("button", { name: "590 ₽" });
  const branchPicker = page.getByRole('heading', { name: 'Выберите филиал' });
  await expect(menuProduct.or(branchPicker).filter({ visible: true }).first()).toBeVisible();
  if (await branchPicker.isVisible()) {
    await page.getByRole('button', { name: /^E2E\b/ }).click();
    await expect(page).toHaveURL(new RegExp(`/${branchSlug}/?$`));
  }
  await expect(menuProduct).toBeVisible();
  await menuProduct.click();
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
