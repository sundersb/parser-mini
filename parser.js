'use strict';

const { assert } = require("console");

/**
 * @callback Predicate
 * @param {string} text Text to test
 * @returns {boolean}
 */

/**
 * @template A
 * @typedef {object} Just<A>
 * @property {T} parsed Parsed value
 * @property {string} rest Rest of the text being parsed
 * 
 * @typedef {Just<A>|undefined} Maybe<A>
 */

/**
 * @template A,B
 * 
 * @callback ParseFunction Text parsing function
 * @param {Just<A>} input Parse result of the previous parser
 * @returns {Maybe<B>}
 * 
 * @callback Mapper<A,B> Map one multitude to another
 * @param {A} value Value to map
 * @returns {B}
 */

const notEmptyObject = o => o && typeof o == 'object';

/**
 * Parser class
 * @template A,B
 * @param {ParseFunction<A,B>} parse 
 */
function Parser(parse) {
    this._parse = parse;

    /**
     * Try to parse text
     * @param {string} text Text to parse
     * @returns {Maybe<B>}
     */
    this.parseText = text => this._parse({ rest: text });

    /**
     * Save parse result as a property
     * @param {string} key Name of the property under which the parse result should be saved
     * @returns {Parser<A,Record<string,B> & { key: B}>}
     */
    this.save = key => {
        const internal = input => {
            const point = this._parse(input);

            if (point) {
                const result = { parsed: {}, rest: point.rest };
                result.parsed[key] = point.parsed;
                return result;
            }
        };
        return new Parser(internal);
    };

    /**
     * The bind combinator
     * @template {object} C
     * @param {Parser<B,C>} next 
     * @returns {Parser<A,B & C>}
     * @description `bind :: Parser a -> (a -> Parser b) -> Parser b`.
     * Requires both `B` and `C` types being derived from `object`. This
     * requirement is needed since there is no obvious way to implement
     * binding to variables as `<-` in `do` notation.
     * 
     * @example
     * ~~~js
     * const parser = Parser
     *     // Left parser counts # characters and save their number in the 'level' property:
     *     .char('#').many().fmap(cs => cs.length).save('level')
     * 
     *     // Right parser decodes all the rest of the string and saves result in 'content':
     *     .bind(innerParser.save('content'))
     * 
     *     // The `data` contains both properties fused: `{ level: 2, content: [...] }`
     *     .fmap(data => new Header(data.level, data.content));
     * ~~~
     */
    this.bind = next => {
        const internal = input => {
            const left = this._parse(input);

            if (left) {
                const right = next._parse(left);

                if (right) {
                    assert(
                        notEmptyObject(left.parsed) && notEmptyObject(right.parsed),
                        'Both left and right parser should return object'
                    );

                    return {
                        parsed: Object.assign(left.parsed, right.parsed),
                        rest: right.rest,
                    };
                }
            }

        };
        return new Parser(internal);
    };

    /**
     * Combinator which feeds parsed content to the next parser
     * @template C
     * @param {Parser<any,C>} next Parser to bind
     * @param {string} [key] Name of the property to use as input of the `next`
     * @returns {Parser<A,B&C>}
     * @description Makes the right parser to parse result of the left one instead of the unparsed rest of the text.
     * @example
     * ~~~js
     * const linkParser = Parser
     *     .brackets('[', ']').save('text')
     *     .bind(Parser.brackets('(', ')').save('hrefTitle'))
     * 
     *     // Parses contents of the hrefTitle property instead of anything after the ')':
     *     .bindInversed(untilSpaceParser.save('href').bind(hintParser.save('hint')), 'hrefTitle')
     * 
     *     .fmap(data => new Link(data.href, data.text, data.hint));
     * ~~~
     */
    this.bindInversed = (next, key) => {
        const internal = input => {
            const left = this._parse(input);

            if (left) {
                const rest = key
                    ? left.parsed[key]
                    : left.parsed;

                const right = next._parse({ rest });

                if (right) {
                    assert(
                        notEmptyObject(left.parsed) && notEmptyObject(right.parsed),
                        'Both left and right parser should return object'
                    );

                    return {
                        parsed: Object.assign(left.parsed, right.parsed),
                        rest: left.rest,
                    };
                }
            }
        };
        return new Parser(internal);
    };

    /**
     * Sequence combinator
     * @template C
     * @param {Parser<B,C>} next 
     * @returns {Parser<A,C>}
     * @description The sequence `>>` (or *then*) combinator which returns result of the right parser.
     * @example
     * ~~~js
     * // Skips spaces and take contents of the following quoted string.
     * // Returns only text within quotes discarding the parsed spaces.
     * const hintParser = Parser.char(' ').many()
     *     .seq(Parser.quoted('"'));
     * ~~~
     */
    this.seq = next => {
        const internal = input => {
            const left = this._parse(input);
            return left && next._parse(left);
        };
        return new Parser(internal);
    };

    /**
     * Inversed sequence combinator
     * @template C
     * @param {Parser<any,C>} next Next parser
     * @param {string} [key] Name of the property to use as input of the `next`
     * @returns {Parser<A,C>}
     * @description Makes the right parser work on the result of the left one
     * (not on the yet unparsed text).
     * @example
     * ~~~js
     * const italicParser = makeStarsParser(1)
     * 
     *     // Parse the text which makeStarsParser has found:
     *     .seqInversed(contentParser)
     * 
     *     // Only result of the makeContentParser is available here
     *     .fmap(makeItalic);
     * ~~~
     */
    this.seqInversed = (next, key) => {
        const internal = input => {
            const left = this._parse(input);

            if (left) {
                const rest = key
                    ? left.parsed[key]
                    : left.parsed;

                const right = next._parse({ rest });

                if (right) {
                    return {
                        parsed: right.parsed,
                        rest: left.rest,
                    };
                }
            }
        };
        return new Parser(internal);
    };

    /**
     * Combinator that return result of the left parser
     * @template C
     * @param {Parser<B,C>} next Next parser
     * @returns {Parser<A,B>}
     * @description Makes both left and right parsers to work but
     * returns result of the left one only
     * @example
     * ~~~js
     * const parser = exactQuote
     *     .seq(untilQuote)   // return this text only
     *     .pass(exactQuote); // make sure the closing quote exists but discard it
     * ~~~
     */
    this.pass = next => {
        const internal = input => {
            const left = this._parse(input);
            if (left) {
                const right = next._parse(left);
                return right && { parsed: left.parsed, rest: right.rest };
            }
        };
        return new Parser(internal);
    };

    /**
     * Fallback to other parser if this one fails
     * @param {Parser<A,B>} other Alternative parser of the same type
     * @returns {Parser<A,B>}
     * @example
     * ~~~js
     * const contentParser = linkParser.or(boldParser).or(italicParser).or(whateverElseParser);
     * ~~~
     */
    this.or = other => {
        const internal = input =>
            this._parse(input) || other._parse(input);
        return new Parser(internal);
    };

    /**
     * Repeat modifier
     * @param {number} [min] Minimal allowed iteration. Ignored if zero.
     * @param {number} [max] Maximal allowed iterations. Ignored if zero.
     * @param {Predicate} [condition] Auxilliary condition to go on (when needed).
     * @returns {Parser<A,B[]>}
     * @description Repeats the parser several times
     * @example
     * ~~~js
     * // Much the same as /^\d+\. +(.*)/
     * const orderedItemParser = Parser
     *     .sat(isDigit).many(1)
     *     .pass(Parser.char('.'))
     *     .pass(Parser.char(' ').many(1))
     *     .seq(untilLineBreak);
     * ~~~
     */
    this.many = (min, max, condition) => {
        const internal = input => { 
            let text = input.rest;

            /** @type {B[]} */
            const elements = [];

            let iterations = 0;

            const overflow = max
                ? () => iterations > max
                : () => false;
            
            const underflow = min
                ? () => iterations < min
                : () => false;
            
            const goOn = condition
                ? () => text && condition(text) && !overflow()
                : () => text && !overflow();
            
            while (goOn()) {
                const result = this._parse({ parsed: input.parsed, rest: text });

                if (!result) break;

                ++iterations;
                elements.push(result.parsed);
                text = result.rest;
            }

            return overflow() || underflow()
                ? undefined
                : { parsed: elements, rest: text };
        };
        return new Parser(internal);
    };

    /**
     * Lift mapper to parser
     * @template C
     * @param {Mapper<B,C>} mapper Mapper
     * @returns {Parser<A,C>}
     * @description Turns `Parser` to functor purely mapping its' result.
     * General placed in the end of the Parser's fluent expression.
     * @example
     * ~~~js
     * const unorderedParser = Parser
     *     .peek(text => text.startsWith('* '))
     *     .seq(unorderedItemParser.many(1, 0, isNotParagraph))
     * 
     *     // Maps collected list-items array to an unordered list:
     *     .fmap(items => new UnorderedList(items));
     * ~~~
     */
    this.fmap = mapper => {
        const internal = input => {
            const result = this._parse(input);
            return result && { parsed: mapper(result.parsed), rest: result.rest };
        };
        return new Parser(internal);
    };

    /**
     * Do not fail but return default value
     * @param {B} defaultValue Value to return when the parser fails
     * @returns {Parser<A,B>}
     */
    this.default = defaultValue => {
        const internal = input =>
            this._parse(input) || { parsed: defaultValue, rest: input.rest };

        return new Parser(internal);
    };
}

/**
 * Make parser which always returns constant value
 * @template T
 * @param {T} value 
 * @returns {Parser<any,T>}
 */
Parser.result = value => {
    return new Parser(input => ({ parsed: value, rest: input.rest }));
};

/**
 * Make parser which always fails
 * @returns {Parser<any,any>}
 */
Parser.zero = () => new Parser(() => undefined);

/**
 * Make parser which consumes any single char
 * @returns {Parser<any,string>}
 */
Parser.item = () => {
    const internal = input => {
        const rest = input.rest;

        return rest
            ? { parsed: rest[0], rest: rest.slice(1) }
            : undefined;
    };
    return new Parser(internal);
};

/**
 * Make parser which consumes only this given character
 * @param {string} c Character
 * @returns {Parser<any,string>}
 */
Parser.char = c => {
    const internal = input => {
        const rest = input.rest;
        return rest && rest[0] == c
            ? { parsed: c, rest: rest.slice(1) }
            : undefined;
    };
    return new Parser(internal);
};

/**
 * Make parser which consumes single char which matches `condition`
 * @param {Predicate} condition Condition
 * @returns {Parser<any,string>}
 * @description `sat` means "satisfy"
 */
Parser.sat = condition => {
    const internal = input => { 
        if (input.rest && condition(input.rest[0])) {
            return { parsed: input.rest[0], rest: input.rest.slice(1) };
        }
    };
    return new Parser(internal);
};

/**
 * Make parser which matches text against the provided string
 * @param {string} template Template to match
 * @returns {Parser<any,string>}
 */
Parser.string = template => {
    const internal = input => {
        return input.rest && input.rest.startsWith(template)
            ? { parsed: template, rest: input.rest.slice(template.length) }
            : undefined;
    };
    return new Parser(internal);
};

/**
 * Make parser which looks ahead into the unparsed text and fails if condition is not met
 * @param {Predicate} condition Condition to check
 * @returns {Parser<any,any>}
 */
Parser.peek = condition => {
    const internal = input => {
        return condition(input.rest)
            ? input
            : undefined;
    };
    return new Parser(internal);
};

/**
 * Make parser which consumes all the rest of the unparsed text
 * @returns {Parser<any,string>}
 */
Parser.all = () => {
    const internal = input => {
        return { parsed: input.rest, rest: '' };
    };
    return new Parser(internal);
};

/**
 * Make parser which suceeds when input is empty
 * @returns {Parser<any,boolean>}
 */
Parser.end = () => {
    const internal = input => {
        return input.rest
            ? undefined
            : { parsed: true, rest: '' };
    };
    return new Parser(internal);
};

/**
 * Make parser for the quoted text
 * @param {string} quote Quote character or string
 * @returns {Parser<any,string>}
 */
Parser.quoted = quote => {
    const exactQuote = Parser.string(quote);

    const untilQuote = Parser
        .item()
        .many(0, 0, text => !text.startsWith(quote))
        .fmap(cs => cs.join(''));

    return exactQuote
        .seq(untilQuote)
        .pass(exactQuote);
};

/**
 * Make parser for the text between braces
 * @param {string} left Left bracket
 * @param {string} right Right bracket
 * @returns {Parser<any,string>}
 * @description The left and right braces must differ for the braces-matching to perform correctly.
 */
Parser.brackets = (left, right) => {
    assert(
        left != right,
        'The left and right braces must differ'
    );

    const internal = input => {
        const text = input.rest;

        if (text && text[0] == left) {
            let index = 1;
            let balance = 1;

            while (balance && index < text.length) {
                const char = text[index];

                if (char == left) {
                    ++balance;
                } else if (char == right) {
                    --balance;
                }
                ++index;
            }

            return balance
                ? undefined
                : { parsed: text.slice(1, index - 1), rest: text.slice(index) };
        }
        
    };
    return new Parser(internal);
};

/**
 * Make content parser which returns array of parsed elements with non parsed text fragments mapped to required type
 * @template A,B
 * @param {Parser<A,B>} elementParser 
 * @param {Mapper<string,B>} fromText 
 * @param {Predicate} condition 
 * @returns {Parser<A,B[]>}
 */
Parser.repeat = (elementParser, fromText, condition) => {
    const internal = input => {
        let text = input.rest;

        /** @type {string[]} */
        let chars = [];

        /** @type {B[]} */
        const elements = [];

        const makeText = () => {
            if (chars.length) {
                elements.push(fromText(chars.join('')));
                chars.length = 0;
            }
        };

        while (text && condition(text)) {
            const result = elementParser._parse({ parsed: {}, rest: text });

            if (result) {
                makeText();

                elements.push(result.parsed);
                text = result.rest;
            } else {
                chars.push(text[0]);
                text = text.slice(1);
            }
        }

        makeText();

        return elements.length
            ? { parsed: elements, rest: text }
            : undefined;
    };
    return new Parser(internal);
};

module.exports = {
    Parser,
};
