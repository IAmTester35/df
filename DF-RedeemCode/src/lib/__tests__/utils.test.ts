import { describe, it, expect } from 'vitest';
import { getParams, unescapeFirebaseKey, escapeFirebaseKey, parseInputCodes, processSyncData } from '../utils';

describe('utils', () => {
    describe('getParams', () => {
        it('should correctly parse search params from a URL', () => {
            const url = 'https://example.com?foo=bar&baz=qux';
            const params = getParams(url);
            expect(params).toEqual({ foo: 'bar', baz: 'qux' });
        });

        it('should return an empty object for invalid URLs', () => {
            expect(getParams('not-a-url')).toEqual({});
        });
    });

    describe('Firebase key escaping/unescaping', () => {
        it('should escape correctly', () => {
            expect(escapeFirebaseKey('a.b#c$d/e[f]')).toBe('a%2Eb%23c%24d%2Fe%5Bf%5D');
        });

        it('should unescape correctly', () => {
            expect(unescapeFirebaseKey('a%2Eb%23c%24d%2Fe%5Bf%5D')).toBe('a.b#c$d/e[f]');
        });
    });

    describe('parseInputCodes', () => {
        it('should split by newline and trim whitespace', () => {
            const input = '  CODE1  \nCODE2\n\nCODE3  ';
            const result = parseInputCodes(input);
            expect(result).toEqual(['CODE1', 'CODE2', 'CODE3']);
        });

        it('should filter out empty lines and invisible characters', () => {
            const input = '\n\u200b\nCODE1\n \n';
            const result = parseInputCodes(input);
            expect(result).toEqual(['CODE1']);
        });

        it('should remove double quotes from codes', () => {
            const input = '"CODE1"\n"CODE2"';
            const result = parseInputCodes(input);
            expect(result).toEqual(['CODE1', 'CODE2']);
        });

        it('should filter out duplicates', () => {
            const input = 'CODE1\nCODE2\nCODE1';
            const result = parseInputCodes(input);
            expect(result).toEqual(['CODE1', 'CODE2']);
        });
    });

    describe('processSyncData', () => {
        it('should correctly process entries and filter statusDigit 0', () => {
            const data = {
                'code1': 100, // ts 10, status 0
                'code2': 101, // ts 10, status 1
                'code%2E3': 200, // ts 20, status 0 (escaped key)
            };
            const localKeys = new Set(['code1']); // code1 already in local history
            
            const result = processSyncData(data, localKeys);
            
            expect(result.length).toBe(1);
            expect(result[0].cdkey).toBe('code.3');
            expect(result[0].ts).toBe(20);
        });

        it('should return empty array when no new success codes are present', () => {
            const data = { 'code1': 101 };
            const localKeys = new Set<string>();
            expect(processSyncData(data, localKeys)).toEqual([]);
        });
    });
});
