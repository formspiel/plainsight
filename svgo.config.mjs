// SVGO config for favicon.svg. The default preset's inlineStyles plugin
// tries to flatten <style> rules into per-element style="" attributes and
// drops anything it can't inline -- including our @media
// (prefers-color-scheme: dark) block, which is the entire point of this
// file. Disabled so the stylesheet (and the media query) survives.
export default {
  plugins: [
    {
      name: "preset-default",
      params: {
        overrides: {
          inlineStyles: false,
        },
      },
    },
  ],
};
