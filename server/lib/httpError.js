// Throw this from a service; the error handler turns it into { error } with the status code.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (message) => new HttpError(400, message);
export const forbidden = (message = 'Access denied.') => new HttpError(403, message);
export const notFound = (message) => new HttpError(404, message);
export const conflict = (message) => new HttpError(409, message);
