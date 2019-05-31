/* eslint-env node */
const nodeResolve = require("rollup-plugin-node-resolve");
const commonjs = require("rollup-plugin-commonjs");
const babel = require("rollup-plugin-babel");
const autoExternal = require("rollup-plugin-auto-external");
const pkg = require("./package.json");

function createConfig(env) {
    let babelOptions = {
        forceAllTransforms: true
    };

    if (env === "es2015") {
        babelOptions = {
            targets: {
                esmodules: true
            }
        };
    }

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
        plugins: [
            babel({
                exclude: "node_modules/**",
                presets: [
                    [
                        "@babel/env",
                        {
                            useBuiltIns: "usage",
                            corejs: 3,
                            loose: true,
                            exclude: ["transform-regenerator", "transform-async-to-generator"],
                            ...babelOptions
                        }
                    ]
                ],
                plugins: [
                    [
                        "babel-plugin-transform-async-to-promises",
                        {
                            inlineHelpers: true
                        }
                    ]
                ]
            })
        ]
    };
}

module.exports = [createConfig("es5"), createConfig("es2015")];
