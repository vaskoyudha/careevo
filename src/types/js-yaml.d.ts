declare module "js-yaml" {
  export interface LoadOptions {
    filename?: string;
    schema?: unknown;
    json?: boolean;
  }
  export function load(content: string, options?: LoadOptions): unknown;
  export function dump(obj: unknown, options?: unknown): string;
  const yaml: { load: typeof load; dump: typeof dump };
  export default yaml;
}
