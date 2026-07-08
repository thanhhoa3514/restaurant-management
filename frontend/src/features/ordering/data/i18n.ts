import { vi } from './i18n/vi'
import { en } from './i18n/en'


type Diff = Exclude<keyof typeof vi, keyof typeof en> | Exclude<keyof typeof en, keyof typeof vi>
type _KeyParity = Diff extends never ? true : ['i18n keys drift between vi/en:', Diff]
const _keyParity: _KeyParity = true
void _keyParity

export const DICT = { vi, en } as const
// Widened value shape (same keys, string values) so a DICT[lang] union — vi's
// literals or en's — is assignable when passed as a prop.
export type Dict = { readonly [K in keyof typeof en]: string }
