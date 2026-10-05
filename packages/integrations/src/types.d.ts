declare module 'ofx-js' {
  export function parse(source: string): Promise<unknown>;
}
