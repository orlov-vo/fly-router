import FlyRouter from "fly-router";
import * as qs from "qs";

const router = new FlyRouter({
    stringify: qs.stringify,
    parse: qs.parse
});

function page(name) {
    let element = null;

    return {
        enter(route) {
            const { container } = route.context;
            element = document.createElement("h1");
            element.innerText = typeof name === "function" ? name(route) : name;
            container.appendChild(element);
        },
        update(route) {
            element.innerText = typeof name === "function" ? name(route) : name;
        },
        leave(route) {
            const { container } = route.context;
            container.removeChild(element);
        }
    };
}

router
    .add("/", page("Home"))
    .group("/users", [], group =>
        group
            .add("/", page("User list"))
            .add("/create", page("Create user"))
            .add("/:id", page(({ params }) => `User: ${params.id}`))
    )
    .add("*", page("404 - Not found"))
    .start({ container: document.body.getElementsByTagName("main")[0] });
