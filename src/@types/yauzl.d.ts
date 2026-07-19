declare module "yauzl" {
  import { Readable } from "stream";
  export interface Entry {
    fileName: string;
    extraFields: { id: number; data: Buffer }[];
    comment: string;
    versionMadeBy: number;
    versionNeededToExtract: number;
    generalPurposeBitFlag: number;
    compressionMethod: number;
    lastModFileTime: number;
    lastModFileDate: number;
    crc32: number;
    compressedSize: number;
    uncompressedSize: number;
  }
  export interface ZipFile {
    readEntry(): void;
    close(): void;
    openReadStream(entry: Entry, callback: (err?: Error, stream?: Readable) => void): void;
    on(event: "entry", listener: (entry: Entry) => void): this;
    on(event: "end", listener: () => void): this;
    on(event: "close", listener: () => void): this;
    on(event: "error", listener: (err: Error) => void): this;
  }
  export function open(path: string, options: { lazyEntries: boolean }, callback: (err?: Error, zipfile?: ZipFile) => void): void;
}
