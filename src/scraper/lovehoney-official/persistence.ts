export type LovehoneyPersistenceInput = {
  existingProductId: string | null;
};

export type LovehoneyPersistenceMode = 'create' | 'update';

export function resolveLovehoneyPersistenceMode(
  input: LovehoneyPersistenceInput,
): LovehoneyPersistenceMode {
  return String(input.existingProductId || '').trim() ? 'update' : 'create';
}
