export class ConnectorError extends Error {
    code;
    status;
    constructor(message, code, status) {
        super(message);
        this.name = 'ConnectorError';
        this.code = code;
        this.status = status;
    }
}
export function ok(data) {
    return { ok: true, data };
}
export function fail(error, code, status) {
    return failure(error, code, status);
}
export function failure(error, code, status) {
    return {
        ok: false,
        error,
        ...(code ? { code } : {}),
        ...(typeof status === 'number' ? { status } : {}),
    };
}
export function failFromUnknown(error, fallbackCode = 'INVALID_REQUEST') {
    if (error instanceof ConnectorError) {
        return fail(error.message, error.code, error.status);
    }
    return fail('Request could not be completed.', fallbackCode);
}
//# sourceMappingURL=types.js.map