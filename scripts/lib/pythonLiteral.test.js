import { describe, test, expect } from 'vitest';
import { parsePythonLiteral, extractAssignment } from './pythonLiteral.js';

describe('scalars', () => {
  test('parses Python singletons', () => {
    expect(parsePythonLiteral('True')).toBe(true);
    expect(parsePythonLiteral('False')).toBe(false);
    expect(parsePythonLiteral('None')).toBeNull();
  });

  test('parses numbers', () => {
    expect(parsePythonLiteral('42')).toBe(42);
    expect(parsePythonLiteral('-7')).toBe(-7);
    expect(parsePythonLiteral('3.5')).toBe(3.5);
  });
});

describe('strings', () => {
  test('handles both quote styles', () => {
    expect(parsePythonLiteral("'hello'")).toBe('hello');
    expect(parsePythonLiteral('"hello"')).toBe('hello');
  });

  // The reason this parser exists: the FFMQ data is full of these.
  test('keeps an apostrophe inside a double-quoted string', () => {
    expect(parsePythonLiteral('"Kaeli\'s House"')).toBe("Kaeli's House");
    expect(parsePythonLiteral('"Pazuzu\'s Tower"')).toBe("Pazuzu's Tower");
    expect(parsePythonLiteral('"GrenadeMan\'s House"')).toBe("GrenadeMan's House");
  });

  test('handles escapes', () => {
    expect(parsePythonLiteral("'a\\'b'")).toBe("a'b");
    expect(parsePythonLiteral('"line\\nbreak"')).toBe('line\nbreak');
    expect(parsePythonLiteral('"back\\\\slash"')).toBe('back\\slash');
  });
});

describe('containers', () => {
  test('parses lists, including nested and empty', () => {
    expect(parsePythonLiteral('[]')).toEqual([]);
    expect(parsePythonLiteral('[1, 2, 3]')).toEqual([1, 2, 3]);
    expect(parsePythonLiteral('[[1, 2], [3]]')).toEqual([[1, 2], [3]]);
  });

  test('parses tuples as arrays', () => {
    expect(parsePythonLiteral('(1, 2)')).toEqual([1, 2]);
  });

  test('parses dicts', () => {
    expect(parsePythonLiteral("{'a': 1, 'b': [2, 3]}")).toEqual({ a: 1, b: [2, 3] });
  });

  test('coerces integer dict keys to strings, like JSON', () => {
    expect(parsePythonLiteral('{1: "one"}')).toEqual({ 1: 'one' });
  });

  test('tolerates trailing commas and newlines', () => {
    expect(parsePythonLiteral('[\n  1,\n  2,\n]')).toEqual([1, 2]);
  });

  test('skips comments between tokens', () => {
    expect(parsePythonLiteral('[1, # a note\n 2]')).toEqual([1, 2]);
  });
});

describe('realistic shapes', () => {
  test('parses a room-like structure', () => {
    const src = `{'name': "Kaeli's House", 'id': 16, 'game_objects': [
        {'name': 'Box 01', 'object_id': 30, 'type': 'Box', 'access': ['DragonClaw', 'MegaGrenade']}
      ], 'links': [{'target_room': 220, 'entrance': 446, 'teleporter': [2, 1], 'access': []}]}`;
    const room = parsePythonLiteral(src);

    expect(room.name).toBe("Kaeli's House");
    expect(room.game_objects[0].access).toEqual(['DragonClaw', 'MegaGrenade']);
    expect(room.links[0].teleporter).toEqual([2, 1]);
  });
});

describe('extractAssignment', () => {
  const module = `# a header comment
from x import y

rooms = [{'id': 1, 'name': "Otto's House"}]

entrances_pairs = [[445, 28], [446, 38]]
`;

  test('pulls a named assignment out of a module', () => {
    expect(extractAssignment(module, 'rooms')).toEqual([{ id: 1, name: "Otto's House" }]);
    expect(extractAssignment(module, 'entrances_pairs')).toEqual([[445, 28], [446, 38]]);
  });

  test('throws a useful error for a missing name', () => {
    expect(() => extractAssignment(module, 'nope')).toThrow(/no top-level assignment/);
  });
});

describe('errors', () => {
  test('reports unterminated strings', () => {
    expect(() => parsePythonLiteral('"abc')).toThrow(/unterminated string/);
  });

  test('reports unknown tokens', () => {
    expect(() => parsePythonLiteral('[undefinedThing]')).toThrow(/unrecognised token/);
  });

  test('reports trailing content', () => {
    expect(() => parsePythonLiteral('[1] junk')).toThrow(/trailing content/);
  });
});
