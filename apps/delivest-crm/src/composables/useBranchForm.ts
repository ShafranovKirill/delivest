import { ref } from "vue";
import { useBranchStore } from "@/stores/branch.store";
import { useToast } from "primevue";
import { useI18n } from "vue-i18n";
import { isAxiosError } from "axios";
import type { BranchResponce } from "@delivest/types";

export function useBranchForm() {
  const { t } = useI18n();
  const branchStore = useBranchStore();
  const toast = useToast();
  const isSubmitting = ref(false);

  const handleError = (error: any, type: "create" | "update" | "delete") => {
    let errorMessage = t(`branches.${type}.error_detail`);
    if (isAxiosError(error)) {
      const serverData = error.response?.data;
      if (serverData?.message) {
        errorMessage = Array.isArray(serverData.message) ? serverData.message[0] : serverData.message;
      }
    }
    toast.add({
      severity: "error",
      summary: t(`branches.${type}.error_summary`),
      detail: errorMessage,
      life: 5000,
    });
  };

  const remove = async (branch: BranchResponce | null) => {
    if (!branch) return { success: false };

    isSubmitting.value = true;
    try {
      await branchStore.deleteBranch(branch.id);

      toast.add({
        severity: "success",
        summary: t("branches.delete.success_summary"),
        detail: t("branches.delete.success_detail", { name: branch.name }),
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

  const submit = async (id: string | null, data: any) => {
    isSubmitting.value = true;
    const isUpdate = !!id;
    const action = isUpdate ? "update" : "create";

    try {
      if (isUpdate && id) {
        await branchStore.updateBranch(id, data);
      } else {
        await branchStore.createBranch(data);
      }

      toast.add({
        severity: "success",
        summary: t(`branches.${action}.success_summary`),
        detail: t(`branches.${action}.success_detail`),
        life: 3000,
      });
      return { success: true, data };
    } catch (error) {
      handleError(error, action);
      return { success: false, error };
    } finally {
      isSubmitting.value = false;
    }
  };

  return { submit, remove, isSubmitting };
}
