<script setup lang="ts">
import { useBranchStore } from '@/stores/branch.store'

const branchStore = useBranchStore()
</script>
<template>branch: {{ branchStore.curentBranch?.alias }}</template>
