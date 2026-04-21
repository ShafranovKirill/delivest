import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "apps/delivest-api/**",
      "apps/delivest-web/**",
      "**/*.config.mjs",
      "**/*.config.js",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...pluginVue.configs["flat/recommended"],
  {
    files: ["**/*.vue", "**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: [".vue"],
      },
    },
  },
  {
    files: ["**/*.config.js", "**/*.config.mjs"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ["apps/delivest-crm/src/main.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
    },
  },
);
