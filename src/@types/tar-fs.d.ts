declare module "tar-fs" {
  import { Writable } from "stream";
  import { CreateOptions, ExtractOptions } from "tar-stream";
  export function extract(cwd: string, opts?: ExtractOptions): Writable;
  export function pack(cwd: string, opts?: CreateOptions): NodeJS.ReadableStream;
}
