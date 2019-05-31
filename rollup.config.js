/* eslint-env node */
const babel = require("rollup-plugin-babel");
const babelConfig = require("./babel.config");
const pkg = require("./package.json");

function updatePresetEnv(config, value) {
    const preset = config.presets.find(i => i && i[0] && i[0] === "@babel/env");

    preset[1] = typeof value === "function" ? value(preset[1]) : { ...preset[1], ...value };
}

function createConfig(env) {
    const config = updatePresetEnv(
        babelConfig,
        env === "es2015"
            ? {
                  targets: {
                      esmodules: true
                  }
              }
            : {
                  forceAllTransforms: true
              }
    );

    return {
        input: "src/index.js",
        external: id =>
            Object.keys(pkg.dependencies || {})
                .concat(Object.keys(pkg.peerDependnencies || {}))
                .includes(id.split("/")[0]),
        output: {
            file: `dist/fly-router.${env === "es2015" ? "m" : ""}js`,
            format: env === "es2015" ? "esm" : "cjs",
            exports: "named"
        },
        plugins: [babel(config)]
    };
}

module.exports = [createConfig("es5"), createConfig("es2015")];
