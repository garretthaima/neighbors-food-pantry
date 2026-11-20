/**
 * An error whose message is safe and useful to show the person using the app.
 * Anything else that reaches the error handler becomes a masked 500.
 */
export class AppError extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

export const badRequest = (message: string) => new AppError(400, message);
export const unauthorized = (message: string) => new AppError(401, message);
export const forbidden = (message: string) => new AppError(403, message);
export const notFound = (message = 'Not found.') => new AppError(404, message);
export const conflict = (message: string) => new AppError(409, message);
export const tooManyRequests = (message: string) => new AppError(429, message);
