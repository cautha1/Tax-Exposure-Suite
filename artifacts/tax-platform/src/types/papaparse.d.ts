declare module "papaparse" {
  export interface ParseError {
    message: string;
    code?: string;
    row?: number;
    type?: string;
  }

  export interface ParseResult<T> {
    data: T[];
    errors: ParseError[];
    meta: {
      fields?: string[];
      [key: string]: unknown;
    };
  }

  export interface ParseConfig<T> {
    header?: boolean;
    skipEmptyLines?: boolean | "greedy";
    transformHeader?: (header: string, index: number) => string;
    complete?: (results: ParseResult<T>) => void;
    error?: (error: ParseError) => void;
  }

  export function parse<T>(input: File | string, config: ParseConfig<T>): void;

  const Papa: {
    parse: typeof parse;
  };

  export default Papa;
}
