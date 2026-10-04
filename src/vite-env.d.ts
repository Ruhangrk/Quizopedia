/// <reference types="vite/client" />

interface FileSystemHandlePermissionDescriptor {
  mode?: "read" | "readwrite";
}

interface FileSystemDirectoryHandle {
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
}

interface Window {
  showDirectoryPicker(options?: {
    id?: string;
    mode?: "read" | "readwrite";
    startIn?: WellKnownDirectory | FileSystemHandle;
  }): Promise<FileSystemDirectoryHandle>;
}

type WellKnownDirectory =
  | "desktop"
  | "documents"
  | "downloads"
  | "music"
  | "pictures"
  | "videos";
