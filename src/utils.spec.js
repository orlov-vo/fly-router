/* eslint-env jest */
import * as utils from "./utils";

describe("normalize", () => {
    test("it should remove slash from begin of path", () => {
        expect(utils.normalize("/some-path-with-slash")).toBe("some-path-with-slash");
    });
});
