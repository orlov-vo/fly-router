import Route from "./Route";
import Navigator from "./Navigator";
import { concatPaths, deepEqual } from "./utils";
import watchLinks from "./watchLinks";

/**
 * Сравнивает маршруты по данным, которые они выдали
 * @param {Route} routeA Маршрут А
 * @param {Route} routeB Маршрут Б
 * @param {Object} dataA Данные маршрута А
 * @param {Object} dataB Данные маршрута Б
 * @return {boolean} Тотже маршрут
 */
function isSameRoute(routeA, routeB, dataA, dataB) {
    if (routeA !== routeB) {
        return false;
    }

    return (
        dataA.hash === dataB.hash &&
        deepEqual(dataA.params, dataB.params) &&
        deepEqual(dataA.query, dataB.query)
    );
}

/**
 * Маршрутизатор
 *
 * Основан на исходных кодах проекта "roadtrip" авторства Rich Harris
 * https://github.com/Rich-Harris/roadtrip
 *
 * Главные отличии от оригинала:
 * - Работает с wildcard выражениями в последнем сегменте
 * - Имеет возможность указывать несколько обработчиков-мидлварей для маршрута
 * - Нет beforeenter метода у маршрута (зачем?)
 * - Имеет возможность работать в hash режиме
 * - Не реализован scrollX, scollY
 *
 * Более подробную информацию об жизни маршрута смотри в описании класса Route
 */
class Router {
    constructor({ base = "", stringify, parse, isHashMode = false }) {
        /** Режим работы в хэшах */
        this.isHashMode = isHashMode;

        /** Контекст выполнения */
        this.context = {};

        this.qs = { stringify, parse };
        this.navigator = new Navigator({ base, router: this });

        /** Находимся ли в состоянии перехода между страницами */
        this.isTransitioning = false;

        /** Список маршрутов */
        this.routes = [];

        this.currentRoute = {
            enter: () => Promise.resolve(),
            leave: () => Promise.resolve()
        };

        this.currentData = {};

        this._onPopstate = this._onPopstate.bind(this);

        if (!isHashMode) {
            watchLinks(this);
        }
    }

    /**
     * Добавляет новое правило в маршрутизатор
     * @public
     * @param {string} path Путь ресурса
     * @param {Object[]} middlewares Мидлвари
     * @return {this} Текущий инстанс маршрутизатора
     */
    add(path, middlewares) {
        this.routes.push(new Route(path, [].concat(middlewares), this));

        return this;
    }

    /**
     * Вызывает fn и передает туда обертку над роутером, которая содержит методы add и group.
     * Эти методы конкатенируют basePath и path, а также добавляют baseMiddlewares в начало
     * @param {string} basePath Базовый путь
     * @param {Object[]} baseMiddlewares Базовые мидлвари
     * @param {Function} fn Функция которая вызывается
     * @return {this} Текущий инстанс маршрутизатора
     */
    group(basePath, baseMiddlewares, fn) {
        const helpers = {
            add: (path, middlewares) => {
                this.add(
                    concatPaths(basePath, path),
                    [].concat(baseMiddlewares).concat(middlewares)
                );
                return helpers;
            },
            group: (path, middlewares, fn2) => {
                this.group(
                    concatPaths(basePath, path),
                    [].concat(baseMiddlewares).concat(middlewares),
                    fn2
                );
                return helpers;
            }
        };

        fn(helpers);

        return this;
    }

    /**
     * Переводит на другрую страницу
     * @public
     * @param {string} href Ссылка
     * @param {Object} [options] Опции
     * @return {Promise} Обещание завершения перехода
     */
    goto(href, options = {}) {
        if (!href.includes("//") && this.isHashMode && href[0] !== "#") {
            // eslint-disable-next-line no-param-reassign
            href = `#${href[0] === "/" ? "" : "/"}${href}`;
        }

        const target = {
            href,
            options
        };

        const promise = new Promise((resolve, reject) => {
            target.resolve = resolve;
            target.reject = reject;
        });

        // Сохраняем цель в _target, чтобы потом сравнить в _goto()
        this._target = target;
        this._target.promise = promise;

        if (!this.isTransitioning) {
            this._goto(target);
        }

        return promise;
    }

    /**
     * Запускает обработку истории страницы
     * @public
     * @param {Object} [context] Параметры исполнения
     * @param {HTMLElement} context.container Контейнер для страниц
     * @return {this} Текущий инстанс маршрутизатора
     */
    start(context = { container: document.body }) {
        this.context = context;

        // Слушаем переходы по истории окна
        window.addEventListener("popstate", this._onPopstate);

        // Делаем первый переход
        this.goto(location.href);

        return this;
    }

    /**
     * Останавливает обработку истории страницы
     * @public
     * @return {this} Текущий инстанс маршрутизатора
     */
    stop() {
        window.removeEventListener("popstate", this._onPopstate);
        return this;
    }

    /**
     * Проверяет наличие обработчика для ссылки
     * @public
     * @param {string} href Искомая ссылка
     * @return {boolean} Есть ли маршрут с таким путем
     */
    has(href) {
        return this.routes.some(route => route.matches(href));
    }

    /**
     * Переход
     * @private
     * @param {Object} target Цель перехода
     */
    async _goto(target) {
        let newRoute;
        let newData;

        for (let i = 0; i < this.routes.length; i += 1) {
            const route = this.routes[i];
            newData = route.exec(target);

            if (newData) {
                newRoute = route;
                break;
            }
        }

        // Если не нашли подходящее правило, то ничего не делаем
        if (!newRoute || isSameRoute(newRoute, this.currentRoute, newRoute, this.currentData)) {
            target.resolve();
            return;
        }

        newData.meta = {};
        newData.navigator = this.navigator;
        newData.context = this.context;
        newData.state = target.options && target.options.state ? target.options.state : {};

        const { replaceState, invisible, state, withoutProcess } = target.options || {};

        // Обрабатываем переход, если необходимо
        if (!withoutProcess) {
            // Активируем переходное состяние
            this.isTransitioning = true;

            try {
                // Если маршрут такой же, то просто обновляем
                if (newRoute === this.currentRoute && newRoute.isUpdateable) {
                    await newRoute.update(newData, this.currentData);
                }

                // Иначе выгружаем старый маршрут и загружаем новый
                else {
                    await this.currentRoute.leave(this.currentData, newData);
                    await newRoute.enter(newData, this.currentData);
                }

                // Сохраняем текущее положение
                this.currentRoute = newRoute;
                this.currentData = newData;

                // Убираем переходное состяние
                this.isTransitioning = false;

                // Если не поменялась цель назначения, то завершаем успехом
                if (this._target === target) {
                    this._routeChanged = 0;
                    target.resolve();
                }

                // Если цель поменялась, делаем переход на новую цель
                else {
                    if (this._routeChanged > 10) {
                        throw new Error("Очень много редиректов!");
                    }

                    this._routeChanged += 1;

                    this._goto(this._target);
                    this._target.promise.then(target.resolve, target.reject);
                }
            } catch (err) {
                target.reject(err);
            }
        }

        if (target.popstate) {
            return;
        }

        if (invisible) {
            return;
        }

        history[replaceState ? "replaceState" : "pushState"](
            { ...state },
            document.title,
            target.href
        );
    }

    /**
     * Обработчик изменения адреса
     * @private
     */
    _onPopstate() {
        this._target = {
            href: location.href,
            popstate: true
        };

        this._target.promise = new Promise((resolve, reject) => {
            this._target.resolve = resolve;
            this._target.reject = reject;
        }).catch(err => {
            // eslint-disable-next-line no-console
            console.error(err);

            throw err;
        });

        if (!this.isTransitioning) {
            this._goto(this._target);
        }
    }
}

export default Router;
