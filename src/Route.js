import { parseLink, segmentsMatch, normalize } from "./utils";

/** Пустая функция */
const NOOP_FN = () => {};

/**
 * Класс для маршрута
 *
 * Содержит путь и мидлвари для обработки методов маршрута.
 * Основные методы маршрута: enter( route, prevRoute ), leave( route, nextRoute ), update( route, prevRoute )
 *
 * КАК РАБОТЮТ МИДЛВАРИ:
 * Для лучшего объяснения представим, что при регистрации маршрута передали middlewares = [ A, B, C, D, E ];
 * Каждая из мидлварей обязана реализовывать метод enter. Остальные leave и update по желанию.
 * К примеру графически это может бысть представлено в виде таблицы:
 *
 * # | name | enter | update | leave
 * --|------|-------|--------|------
 * 0 | A    | yes   |        | yes
 * 1 | B    | yes   |        |
 * 2 | C    | yes   | yes    |
 * 3 | D    | yes   | yes    | yes
 * 4 | E    | yes   |        | yes
 *
 * Когда вызывается метод enter у маршрута:
 * Проходимся поочередно с 0 мидлвари, вызывая enter у мидлвари, до тех пор, пока не прервется цепочка (не будет взывана
 * функция next()) или когда достигнем последней мидлвари. Запоминаем сколько было мидлварей было пройдено в lastIndex
 *
 * Пример:
 * Все мидлвари, кроме D вызывали next(), тогда цепочка будет:
 * A.enter -> B.enter -> C.enter -> D.enter | lastIndex = 3
 *
 * Когда вызывается метод leave у маршрута:
 * Проходимся начиная от lastIndex и до мидлвари с индексом 0, вызывая метод leave.
 *
 * Пример:
 * У нас lastIndex = 3, тогда цепочка вызовов будет:
 * D.leave -> A.leave | lastIndex = -1
 *
 * Когда взывается метод update у маршрута:
 * Проходимся поочередно с 0 мидлвари, вызывая update у мидлвари или в случаи отсутствия взываем leave и enter,
 * до тех пор, пока не прервется цепочка (не будет взывана функция next()) или когда достигнем последней мидлвари.
 * Если мы не дошли до lastIndex, то для тех мидлварей вызываем leave. Записываем сколько было было пройдено в lastIndex
 *
 * Пример:
 * У нас lastIndex = 4, а next() не был вызыван у C тогда цепочка вызовов будет:
 * A.leave -> A.enter -> B.enter -> C.update -> E.leave -> D.leave | lastIndex = 2
 *
 * TODO: Придумать как сделать более правильную очередность вызовов при update
 */
class Route {
    /**
     * @constructor
     * @param {string} path Путь
     * @param {Object[]} middlewares Обработчики
     * @param {Router} router Инстанс маршрутизатора
     */
    constructor(path, middlewares, router) {
        this.path = normalize(path);
        this.segments = this.path.split("/");
        this.router = router;

        this.isUpdateable = middlewares.some(middleware => typeof middleware.update === "function");
        this.hasWildcard = this.segments[this.segments.length - 1][0] === "*";

        /** Индекс на мидварю до которой смогли дойти в enter, нужно для определения начала спуска в leave */
        let lastIndex = -1;

        // Навешиваем все мидлвари на enter
        this.enter = (_route, _previousRoute, next = NOOP_FN) => next();
        middlewares
            .map(middleware => middleware.enter)
            .forEach((fn, index) => {
                // Здесь не используется .filter() т.к. важно собрать точные индексы и записать их в lastIndex
                if (fn) {
                    // Формируем стек функций из мидлварей
                    this.enter = (stack => (route, previousRoute, next) =>
                        stack(route, previousRoute, () => {
                            // Записываем индекс мидлвари, для корректного выхода из маршрута
                            lastIndex = index;

                            // Вызываем следующую функцию
                            return fn.call(this, route, previousRoute, next);
                        }))(this.enter);
                }
            });

        // Навешиваем все мидлвари на update
        this._update = (_route, _prevRoute, next = NOOP_FN) => next();
        middlewares
            .map(middleware =>
                typeof middleware.update === "function"
                    ? middleware.update
                    : async (route, prevRoute, next) => {
                          if (typeof middleware.leave === "function") {
                              await middleware.leave(prevRoute, route);
                          }
                          await middleware.enter(route, prevRoute, next);
                      }
            )
            .forEach((fn, index) => {
                // Формируем стек функций из мидлварей
                this._update = (stack => (route, prevRoute, next) =>
                    stack(route, prevRoute, () => {
                        // Записываем индекс мидлвари, для корректного выхода из маршрута
                        lastIndex = index;

                        // Вызываем следующую функцию
                        return fn.call(this, route, prevRoute, next);
                    }))(this._update);
            });
        this.update = async (route, prevRoute) => {
            // Запоминаем индекс
            const remeberIndex = lastIndex;

            // Запускаем обновление
            await this._update(route, prevRoute);

            // Те мидлвари, которые не доступны убиваем
            if (remeberIndex > lastIndex) {
                await middlewares
                    .slice(lastIndex + 1, remeberIndex + 1)
                    .reverse()
                    .map(middleware => middleware.leave)
                    .filter(fn => typeof fn === "function")
                    .reduce((acc, fn) => acc.then(() => fn(prevRoute, route)), Promise.resolve());
            }
        };

        // Создаем функцию для leave
        this.leave = async (route, nextRoute) => {
            await middlewares
                .slice(0, lastIndex + 1)
                .reverse()
                .map(middleware => middleware.leave)
                .filter(fn => typeof fn === "function")
                .reduce((acc, fn) => acc.then(() => fn(route, nextRoute)), Promise.resolve());
        };
    }

    /**
     * Проверяет подходит ли href под этот маршрут
     * @param {string} href Ссылка
     * @return {boolean} Подходит ли href под этот маршрут
     */
    matches(href) {
        const { pathname } = parseLink(href, this.router.isHashMode);
        const segments = pathname.split("/");

        return segmentsMatch(segments, this.segments, this.hasWildcard);
    }

    /**
     * Парсит ссылку из target.href и достает информацию о сегментах из нее
     * @param {Object} target Параметры цели
     * @return {Object} Полученные данные
     */
    exec(target) {
        const { pathname, search, ...data } = parseLink(target.href, this.router.isHashMode);

        const segments = pathname.split("/");

        if (!this.hasWildcard && segments.length !== this.segments.length) {
            return false;
        }

        const params = {};

        for (let i = 0; i < segments.length; i += 1) {
            const segment = segments[i];
            const toMatch = this.segments[i];
            const lastMatchSegment = i === this.segments.length - 1;

            if (toMatch[0] === ":") {
                params[toMatch.slice(1)] = segment;
            } else if (lastMatchSegment && toMatch[0] === "*") {
                params[toMatch.slice(1)] = segments.slice(i).join("/");
                break;
            } else if (segment !== toMatch) {
                return false;
            }
        }

        return {
            pathname,
            params,
            search,
            ...data,
            query: this.router.qs.parse(search),
            scrollX: target.scrollX,
            scrollY: target.scrollY,
            matches: this.matches
        };
    }
}

export default Route;
