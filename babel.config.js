const presets = [
    [
        "@babel/env",
        {
            useBuiltIns: "usage",
            corejs: 3,
            loose: true,
            exclude: ["transform-regenerator", "transform-async-to-generator"]
        }
    ]
];
const plugins = [
    [
        "babel-plugin-transform-async-to-promises",
        {
            inlineHelpers: true
        }
    ]
];

module.exports = { plugins, presets };
