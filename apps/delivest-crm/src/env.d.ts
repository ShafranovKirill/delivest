/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_PORT_CRM: string;
  readonly VITE_NODE_ENV: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
