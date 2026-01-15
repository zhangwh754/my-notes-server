import js from "@eslint/js";
import prettier from "eslint-plugin-prettier";

export default [
  js.configs.recommended,
  {
    plugins: {
      prettier,
    },
    rules: {
      ...prettier.configs.recommended.rules,
      "prettier/prettier": "error",
    },
  },
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
    rules: {
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "no-console": "off",
    },
  },
  {
    ignores: ["node_modules/**", "dist/**", "*.config.js"],
  },
];
