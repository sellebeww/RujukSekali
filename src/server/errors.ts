/** Expected, user-facing failure. `message` is plain Indonesian shown in the UI. */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 409,
  ) {
    super(message);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Anda tidak punya akses untuk tindakan ini.') {
    super('FORBIDDEN', message, 403);
  }
}

export class NotFoundError extends DomainError {
  constructor(what = 'Data') {
    super('NOT_FOUND', `${what} tidak ditemukan.`, 404);
  }
}
