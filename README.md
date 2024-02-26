# `parser-mini` Readme

This library provides simple text parsing functionality.

## Installation

Run the following command:

~~~sh
npm install --save @sundersb/parser-mini
~~~

## Examples

~~~js
const Parser = require('@sundersb/parser-mini');

const join = cs => cs.join('');

const lineBreakParser = Parser
    .char('\n')
    .or(Parser.string('\r\n'));

expect(lineBreakParser.parseText('\nText')).to.deep.equal({
    parsed: '\n',
    rest: 'Text'
});
expect(lineBreakParser.parseText('text')).to.be.undefined;

const untilSpaceParser = Parser.sat(c => c != ' ')
    .many()
    .fmap(join);

expect(untilSpaceParser.parseText('some text')).to.deep.equal({
    parsed: 'some',
    rest: ' text'
});
~~~

## GitHub page

[https://github.com/sundersb/parser-mini](https://github.com/sundersb/parser-mini)

## See also

* [@sundersb/markdown-mini](https://www.npmjs.com/package/@sundersb/markdown-mini)
