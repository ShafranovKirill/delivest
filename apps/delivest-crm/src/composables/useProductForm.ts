import { ref } from "vue";
import { useToast } from "primevue/usetoast";
import { useI18n } from "vue-i18n";
import { isAxiosError } from "axios";
import { useProductStore } from "@/stores/product.store";
import type { ProductResponse, CreateProductRequest, UpdateProductRequest } from "@delivest/types";

export function useProductForm() {
  const { t } = useI18n();
  const toast = useToast();
  const productStore = useProductStore();
  const isSubmitting = ref(false);

  const getServerMessage = (error: any, action: string) => {
    if (isAxiosError(error)) {
      const serverData = error.response?.data;
      if (serverData?.message) {
        return Array.isArray(serverData.message) ? serverData.message[0] : serverData.message;
      }
    }
    return t(`product.${action}.error_detail`);
  };

  const handleError = (error: any, action: "create" | "update" | "delete") => {
    const detail = getServerMessage(error, action);

    toast.add({
      severity: "error",
      summary: t(`product.${action}.error_summary`),
      detail,
      life: 5000,
    });
  };

  const submit = async (id: string | null, data: CreateProductRequest | UpdateProductRequest) => {
    isSubmitting.value = true;
    const isUpdate = !!id;
    const action = isUpdate ? "update" : "create";

    try {
      const result = isUpdate
        ? await productStore.updateProduct(data as UpdateProductRequest)
        : await productStore.createProduct(data as CreateProductRequest);

      toast.add({
        severity: "success",
        summary: t(`product.${action}.success_summary`),
        detail: t(`product.${action}.success_detail`),
        life: 3000,
      });
      return { success: true, data: result };
    } catch (error) {
      handleError(error, action);
      return { success: false, error };
    } finally {
      isSubmitting.value = false;
    }
  };

  const remove = async (product: ProductResponse | null) => {
    if (!product) return { success: false };

    isSubmitting.value = true;
    try {
      await productStore.deleteProduct(product.id);
      toast.add({
        severity: "success",
        summary: t("product.delete.success_summary"),
        detail: t("product.delete.success_detail", { name: product.name }),
        life: 3000,
      });
      return { success: true };
    } catch (error) {
      handleError(error, "delete");
      return { success: false, error };
    } finally {
      isSubmitting.value = false;
    }
  };

  return { submit, remove, isSubmitting };
}
