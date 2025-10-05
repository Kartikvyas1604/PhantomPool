module.exports = {
  extends: ["next/core-web-vitals", "next/typescript"],
  rules: {
    // Disable specific rules that might cause issues during migration
    "@typescript-eslint/no-unused-vars": "warn",
    "@typescript-eslint/no-explicit-any": "warn",
    "react-hooks/exhaustive-deps": "warn"
  }
};