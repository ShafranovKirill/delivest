import { ref } from "vue";
import { useStaffStore } from "@/stores/staff.store";
import { useToast } from "primevue/usetoast";
import { useI18n } from "vue-i18n";
import { isAxiosError } from "axios";
import type { StaffResponse, CreateStaffRequest, UpdateStaffRequest } from "@delivest/types";

export function useStaffForm() {
  const { t } = useI18n();
  const staffStore = useStaffStore();
  const toast = useToast();
  const isSubmitting = ref(false);

  const handleError = (error: any, type: "create" | "update" | "delete") => {
    let errorMessage = t(`staff.${type}.error_detail`);

    if (isAxiosError(error)) {
      const serverData = error.response?.data;
      if (serverData?.message) {
        errorMessage = Array.isArray(serverData.message) ? serverData.message[0] : serverData.message;
      }
    }

    toast.add({
      severity: "error",
      summary: t(`staff.${type}.error_summary`),
      detail: errorMessage,
      life: 5000,
    });
  };

  const remove = async (staff: StaffResponse | null) => {
    if (!staff) return { success: false };

    isSubmitting.value = true;
    try {
      await staffStore.deleteStaff(staff.id);

      toast.add({
        severity: "success",
        summary: t("staff.delete.success_summary"),
        detail: t("staff.delete.success_detail", { name: staff.name || staff.login }),
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

  const submit = async (id: string | null, data: Partial<CreateStaffRequest>) => {
    isSubmitting.value = true;
    const isUpdate = !!id;
    const action = isUpdate ? "update" : "create";

    try {
      if (isUpdate && id) {
        await staffStore.updateStaff({ id, ...data } as UpdateStaffRequest);
      } else {
        await staffStore.createStaff(data as CreateStaffRequest);
      }

      toast.add({
        severity: "success",
        summary: t(`staff.${action}.success_summary`),
        detail: t(`staff.${action}.success_detail`),
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
