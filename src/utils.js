/** Никто лучше в браузере не умеет парсить ссылки, чем элемент ссылки =) */
const A = typeof document !== "undefined" && document.createElement("a");

/**
 * Разбирает ссылку на составляющие
 * @param {string} href Ссылка для разбора
 * @param {boolean} [isHashMode] Режим ссылок через хэш
 * @return {Object} Разобранные данные
 */
export function parseLink(href, isHashMode = false) {
    A.href = href;

    if (isHashMode) {
        A.href = A.hash.slice(1);
    }

    const pathname = A.pathname.indexOf("/") === 0 ? A.pathname.slice(1) : A.pathname;

    const search = A.search.slice(1);

    return {
        pathname,
        search,
        hash: A.hash.slice(1)
    };
}

/**
 * Сравнивает сегменты между собой
 * @param {string[]} a Список сегментов A
 * @param {string[]} b Список сегментов B
 * @param {boolean} hasWildcard Режим в котором сегмент Б имеет в конце подстановочный сегмент
 * @return {boolean} Совпадают ли сегменты между собой
 */
export function segmentsMatch(a, b, hasWildcard = false) {
    if (!hasWildcard && a.length !== b.length) {
        return false;
    }

    let i = hasWildcard ? b.length - 1 : a.length;
    while (i) {
        i -= 1;
        if (a[i] !== b[i] && b[i][0] !== ":") {
            return false;
        }
    }

    return true;
}

/**
 * Сравнивает два значения на всю глубину вложености, если это объекты или массивы
 * @param {any} a Значение А
 * @param {any} b Значение Б
 * @return {boolean} Равны ли значения А и Б между собой
 */
export function deepEqual(a, b) {
    // Одно из значений null, значит можно сравнить по ссылке
    if (a === null || b === null) {
        return a === b;
    }

    // Если оба массивы, сравниваем парами все элементы
    if (Array.isArray(a) && Array.isArray(b)) {
        let i = a.length;

        // Отличается длина массивов
        if (b.length !== i) {
            return false;
        }

        while (i) {
            if (!deepEqual(a[i], b[i])) {
                return false;
            }
            i -= 1;
        }

        return true;
    }

    // Если оба объекты, сравниваем по ключам
    if (typeof a === "object" && typeof b === "object") {
        const aKeys = Object.keys(a);
        const bKeys = Object.keys(b);

        let i = aKeys.length;

        // Отличается список ключей
        if (bKeys.length !== i) {
            return false;
        }

        while (i) {
            const key = aKeys[i];

            if (!Object.prototype.hasOwnProperty.call(b, key) || !deepEqual(b[key], a[key])) {
                return false;
            }
            i -= 1;
        }

        return true;
    }

    // Сравниваем просто по ссылке
    return a === b;
}

/**
 * Нормализует путь, обрезает слеш вначале и конце строки
 * @param {string} path Путь
 * @return {string} Нормализованный путь
 */
export const normalize = path => path.replace(/^\/|\/$/, "");

/**
 * Соединяет пути между собой
 * @param {string} a Путь А
 * @param {string} b Путь Б
 * @return {string} Путь содержайщий пути А и Б
 */
export function concatPaths(a, b) {
    return `${normalize(a)}/${normalize(b)}`;
}
