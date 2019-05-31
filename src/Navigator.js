import { parseLink } from "./utils";

class Navigator {
    constructor({ base = "", router }) {
        this.base = base;
        this.router = router;
    }

    /**
     * Переход к странице с изменением адреса
     * @public
     * @param {string} url адрес для перехода
     * @param {Object} state состояние для History API
     * @return {this} Текущий инстанс маршрутизатора
     */
    go(url, state) {
        return this.goto(this._getLink(url), { state });
    }

    /**
     * Меняет адрес страницы
     * @public
     * @param  {string}  url             адрес
     * @param  {Object}  state           состояние для History API
     * @param  {boolean} [process=true] перейти на страницу
     * @return {this} Текущий инстанс маршрутизатора
     */
    replace(url, state = {}, process = true) {
        return this.goto(this._getLink(url), {
            state,
            replaceState: true,
            withoutProcess: !process
        });
    }

    /**
     * Устанавиливает новые параметры в адресной строке и возвращает ее
     * @public
     * @param {Object|Function} newQuery Новые параметры
     * @param {Object} [oldQuery] Старые параметры, если их нет, то берет из ссылки
     * @param {string} [url] Адрес страницы
     * @return {string} Обновленная ссылка
     */
    updateQuery(newQuery, oldQuery, url) {
        const { pathname, search } = parseLink(
            url ? this._getLink(url) : location.href,
            this.router.isHashMode
        );
        const query = oldQuery == null ? this.router.qs.parse(search) : { ...oldQuery };

        Object.entries(typeof newQuery === "function" ? newQuery(query) : newQuery).forEach(
            ([key, value]) => {
                if (value != null) {
                    query[key] = value;
                } else {
                    delete query[key];
                }
            }
        );

        return `${pathname}?${this.router.qs.stringify(query)}`;
    }

    _getLink(url) {
        if (url.indexOf(this.base) === 0) {
            // eslint-disable-next-line no-param-reassign
            url = url.substr(this.base.length);
        }

        return `${this.base}${url[0] === "/" ? "" : "/"}${url}`;
    }
}

export default Navigator;
