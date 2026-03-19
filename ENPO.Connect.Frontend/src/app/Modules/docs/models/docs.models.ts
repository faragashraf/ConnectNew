export interface DocsLanguage {
  code: string;
  label: string;
  dir?: 'ltr' | 'rtl';
}

export interface DocsPage {
  id: string;
  group?: string;
  label: { [lang: string]: string };
  file: { [lang: string]: string };
}

export interface DocsManifest {
  defaultLang: string;
  languages: DocsLanguage[];
  pages: DocsPage[];
}
