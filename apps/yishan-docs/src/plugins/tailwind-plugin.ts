module.exports = function tailwindPlugin() {
  const tailwindcss = require('@tailwindcss/postcss');
  return {
    name: 'tailwind-plugin',
    configurePostCss(opts) {
      opts.plugins.push(tailwindcss({
        config: './tailwind.config.ts'
      }));
      return opts;
    },
  };
};