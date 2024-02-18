'use strict';

const { expect } = require('chai');
const { Parser } = require('./parser');

describe('Parser', () => {
    it('result', () => {
        const parser = Parser.result('result');
        const actual = parser.parseText('some text');
        expect(actual).not.be.empty;

        expect(actual.parsed).to.equal('result');
        expect(actual.rest).to.equal('some text');
    });

    it('zero', () => {
        const parser = Parser.zero();

        expect(parser.parseText('')).to.be.undefined;
        expect(parser.parseText('text')).to.be.undefined;
    });

    it('item', () => {
        const parser = Parser.item();

        expect(parser.parseText('c')).to.deep.equal({ parsed: 'c', rest: '' });
        expect(parser.parseText('abc')).to.deep.equal({ parsed: 'a', rest: 'bc' });
        expect(parser.parseText('')).to.be.undefined;
    });

    it('char', () => {
        const parser = Parser.char('a');

        expect(parser.parseText('a')).to.deep.equal({ parsed: 'a', rest: '' });
        expect(parser.parseText('ab')).to.deep.equal({ parsed: 'a', rest: 'b' });
        expect(parser.parseText('')).to.be.undefined;
        expect(parser.parseText('bc')).to.be.undefined;
    });

    it('sat', () => {
        const isDigit = c => '0123456789'.includes(c);

        const parser = Parser.sat(isDigit);

        expect(parser.parseText('0')).to.deep.equal({ parsed: '0', rest: '' });
        expect(parser.parseText('0 goon')).to.deep.equal({ parsed: '0', rest: ' goon' });
        expect(parser.parseText('')).to.be.undefined;
        expect(parser.parseText('b')).to.be.undefined;
    });

    it('string', () => {
        const parser = Parser.string('line');

        expect(parser.parseText('line')).to.deep.equal({ parsed: 'line', rest: '' });
        expect(parser.parseText('lines')).to.deep.equal({ parsed: 'line', rest: 's' });
        expect(parser.parseText(' line')).to.be.undefined;
    });

    it('peek', () => {
        const hasSquirrel = text => text && text.includes('squirrel');

        const parser = Parser.peek(hasSquirrel);

        expect(parser.parseText('many squirrels hide in the wood')).to.deep.equal({ rest: 'many squirrels hide in the wood' });
        expect(parser.parseText('but beware bears')).to.be.undefined;
    });

    it('all', () => {
        const parser = Parser.all();

        expect(parser.parseText('whatever')).to.deep.equal({ parsed: 'whatever', rest: '' });
        expect(parser.parseText('')).to.deep.equal({ parsed: '', rest: '' });
    });

    it('end', () => {
        const parser = Parser.end();

        expect(parser.parseText('')).to.deep.equal({ parsed: true, rest: '' });
        expect(parser.parseText('anything')).to.be.undefined;
    });

    it('quoted', () => {
        const parser = Parser.quoted('ох');

        expect(parser.parseText('ох поспел уже горох!')).to.deep.equal({ parsed: ' поспел уже гор', rest: '!' });
        expect(parser.parseText('охота')).to.be.undefined;
        expect(parser.parseText('пароход')).to.be.undefined;
    });

    it('brackets', () => {
        const parser = Parser.brackets('(', ')');

        expect(parser.parseText('(text)')).to.deep.equal({ parsed: 'text', rest: '' });
        expect(parser.parseText('(text) go on')).to.deep.equal({ parsed: 'text', rest: ' go on' });
        expect(parser.parseText('(internal (brackets))')).to.deep.equal({ parsed: 'internal (brackets)', rest: '' });
        expect(parser.parseText('(unclosed bracket')).to.be.undefined;
        expect(parser.parseText('(unmatched (brackets)')).to.be.undefined;
        expect(parser.parseText('no brackets')).to.be.undefined;
    });

    it('repeat', () => {
        const notHoho = text => !text.startsWith('hoho');
        const twos = Parser.char('2').many(1).fmap(() => 'twos');
        const fromText = () => '?'

        const parser = Parser.repeat(twos, fromText, notHoho);

        expect(parser.parseText('222olala552233hoho!')).to.deep.equal({ parsed: ['twos', '?', 'twos', '?'], rest: 'hoho!' });
    });

    it('save', () => {
        const parser = Parser.char('A').save('found');

        const expected = {
            parsed: { found: 'A' },
            rest: ' cat'
        };

        expect(parser.parseText('A cat')).to.deep.equal(expected);
    });

    it('bind', () => {
        const parser = Parser.string('Alice').save('first')
            .bind(Parser.string('Bob').save('second'));

        const expected = {
            parsed: {
                first: 'Alice',
                second: 'Bob',
            },
            rest: 'Pete'
        };

        expect(parser.parseText('AliceBobPete')).to.deep.equal(expected);
    });

    it('bindInversed', () => {
        const firstWord = Parser.sat(c => c != ' ').many(1).fmap(cs => cs.join('')).save('word');

        // Get expression within quotes and take its' first word
        const parser = Parser.quoted('"').save('allQuoted')
            .bindInversed(firstWord, 'allQuoted');

        const expected = {
            parsed: {
                allQuoted: 'found word',
                word: 'found'
            },
            rest: ' rest'
        };

        expect(parser.parseText('"found word" rest')).to.deep.equal(expected);
    });

    it('seq', () => {
        // The combined parser discards result of the left one and takes
        // the right parser's result as the total of the combination
        const parser = Parser.string('ignored ').seq(Parser.string('PRISE'));

        const expected = {
            parsed: 'PRISE',
            rest: ' rest',
        };

        expect(parser.parseText('ignored PRISE rest')).to.deep.equal(expected);
    });

    it('seqInversed', () => {
        const firstWord = Parser.sat(c => c != ' ').many(1).fmap(cs => cs.join(''));

        // Takes the first word from the quoted string
        // Differs from the `Parser.bind()` by taking result
        // of the right (internal) parser only
        const parser = Parser.quoted('"')
            .seqInversed(firstWord);

        const expected = {
            parsed: 'found',
            rest: ' rest'
        };

        expect(parser.parseText('"found word" rest')).to.deep.equal(expected);
    });

    it('pass', () => {
        // Takes amount of '2' chars and skips following spaces
        const parser = Parser.char('2').many(1)
            .fmap(cs => cs.length)
            .pass(Parser.char(' ').many());

        expect(parser.parseText('2go on')).to.deep.equal({ parsed: 1, rest: 'go on' });
        expect(parser.parseText('2 go on')).to.deep.equal({ parsed: 1, rest: 'go on' });
        expect(parser.parseText('22222     go on')).to.deep.equal({ parsed: 5, rest: 'go on' });
    });

    it('or', () => {
        // Parses either 2 or 3
        const parser = Parser.char('2').or(Parser.char('3'));

        expect(parser.parseText('2rest')).to.deep.equal({ parsed: '2', rest: 'rest' });
        expect(parser.parseText('3rest')).to.deep.equal({ parsed: '3', rest: 'rest' });
        expect(parser.parseText('4')).to.be.undefined;
        expect(parser.parseText('')).to.be.undefined;
    });

    it('many', () => {
        const notLast = text => text.startsWith('sahsah');

        // The 'sah' should repeat two or three times and leave the following last 'sah' unparsed
        const parser = Parser.string('sah').many(2, 3, notLast);

        expect(parser.parseText('sahsahsah-boo')).to.deep.equal({
            parsed: ['sah', 'sah'],
            rest: 'sah-boo',
        });

        expect(parser.parseText('sahsahsahsah-boo')).to.deep.equal({
            parsed: ['sah', 'sah', 'sah'],
            rest: 'sah-boo',
        });

        expect(parser.parseText('sah-boo')).to.be.undefined;
        expect(parser.parseText('sahsah-boo')).to.be.undefined;
    });

    it('fmap', () => {
        const isDigit = c => '0123456789'.includes(c);

        const parser = Parser.sat(isDigit).many(1)
            .fmap(cs => cs.length)
            .save('digitsCount');

        expect(parser.parseText('31415 etc')).to.deep.equal({ parsed: { digitsCount: 5 }, rest: ' etc' });
    });

    it('default', () => {
        const isDigit = c => '0123456789'.includes(c);

        const parser = Parser.sat(isDigit).many(1)
            .fmap(cs => parseInt(cs.join('')))
            .default(50);

        expect(parser.parseText('12345')).to.deep.equal({ parsed: 12345, rest: '' });
        expect(parser.parseText('12345 rest')).to.deep.equal({ parsed: 12345, rest: ' rest' });
        expect(parser.parseText('no digits')).to.deep.equal({ parsed: 50, rest: 'no digits' });
    });
});
