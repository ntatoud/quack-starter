/** @type {import("prettier").Options} */
const config = {
  importOrder: ["^react$", "^(?!^react$|^@/|^[./]).*", "^next$", "^(?!^next$|^@/|^[./]).*", "^@/(.*)$", "^[./]"],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  importOrderParserPlugins: ["jsx", "typescript"],
  plugins: ["@trivago/prettier-plugin-sort-imports", "prettier-plugin-tailwindcss"],
};

module.exports = config;
