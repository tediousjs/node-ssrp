import Instance from './instance';

export function parse(message: string): Instance[];

export class SyntaxError extends Error {
  expected: string;
  found: string;
  location: number;
}
