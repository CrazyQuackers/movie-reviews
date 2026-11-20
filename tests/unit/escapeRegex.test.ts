import { escapeRegex } from '../../src/utils/regex';

describe('escapeRegex', () => {
  it('leaves plain text alone', () => {
    expect(escapeRegex('The Matrix 2')).toBe('The Matrix 2');
  });

  it('escapes every regex metacharacter so user input is matched literally', () => {
    const special = '.*+?^${}()|[]\\';
    const re = new RegExp(`^${escapeRegex(special)}$`);
    expect(re.test(special)).toBe(true);
    expect(re.test('anything else')).toBe(false);
  });

  it('makes ".*" match only a literal ".*"', () => {
    const re = new RegExp(escapeRegex('.*'), 'i');
    expect(re.test('The Matrix')).toBe(false);
    expect(re.test('what.*ever')).toBe(true);
  });
});
