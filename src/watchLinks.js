export default function watchLinks(router) {
    window.addEventListener("click", handler, false);
    window.addEventListener("touchstart", handler, false);

    function handler(event) {
        if (which(event) !== 1) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        if (event.defaultPrevented) return;

        // ensure target is a link
        let el = event.target;

        // el.nodeName for svg links are 'a' instead of 'A'
        while (el && el.nodeName.toUpperCase() !== "A") {
            el = el.parentNode;
        }

        if (!el || el.nodeName.toUpperCase() !== "A") return;

        // check if link is inside an svg
        // in this case, both href and target are always inside an object
        const svg = typeof el.href === "object" && el.href.constructor.name === "SVGAnimatedString";

        // Ignore if tag has
        // 1. 'download' attribute
        // 2. rel='external' attribute
        if (el.hasAttribute("download") || el.getAttribute("rel") === "external") return;

        // ensure non-hash for the same path

        // Check for mailto: in the href
        if (~el.href.indexOf("mailto:")) return;

        // check target
        // svg target is an object and its desired value is in .baseVal property
        if (svg ? el.target.baseVal : el.target) return;

        // x-origin
        // note: svg links that are not relative don't call click events (and skip watchLinks)
        // consequently, all svg links tested inside watchLinks are relative and in the same origin
        if (!svg && !sameOrigin(el.href)) return;

        // rebuild path
        // There aren't .pathname and .search properties in svg links, so we use href
        // Also, svg href is an object and its desired value is in .baseVal property
        let path = svg ? el.href.baseVal : el.pathname + el.search + (el.hash || "");

        // strip leading '/[drive letter]:' on NW.js on Windows
        if (typeof process !== "undefined" && path.match(/^\/[a-zA-Z]:\//)) {
            path = path.replace(/^\/[a-zA-Z]:\//, "/");
        }

        // same page
        const orig = path;

        if (path.indexOf(router.base) === 0) {
            path = path.substr(router.base.length);
        }

        if (router.base && orig === path) return;

        // no match? allow navigation
        if (!router.has(orig)) return;

        event.preventDefault();
        router.goto(orig);
    }
}

function which(event) {
    event = event || window.event;
    return event.which === null ? event.button : event.which;
}

function sameOrigin(href) {
    let origin = location.protocol + "//" + location.hostname;
    if (location.port) origin += ":" + location.port;

    return href && href.indexOf(origin) === 0;
}
