import AppError from '../utils/AppError.js';

/**
 * Request validation middleware (Zod).
 *
 * Usage:
 *   router.post('/', validate({ body: createUserSchema }), controller.create);
 *   router.get('/:id', validate({ params: idParamSchema, query: listQuerySchema }), ...);
 *
 * Validates req.body / req.query / req.params against the given Zod schemas.
 * On success, replaces the request data with the parsed (coerced, stripped)
 * values. On failure, throws a 422 AppError with field-level messages.
 */
const REQUEST_PARTS = ['params', 'query', 'body'];

const validate = (schemas) => (req, _res, next) => {
  const errors = [];

  for (const part of REQUEST_PARTS) {
    const schema = schemas[part];
    if (!schema) continue;

    const result = schema.safeParse(req[part]);

    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({
          field: issue.path.length > 0 ? issue.path.join('.') : part,
          location: part,
          message: issue.message,
        });
      }
    } else if (part === 'body') {
      req.body = result.data;
    } else {
      // Express 5 exposes req.query/req.params via getters; shadow them
      // on the instance with the parsed values.
      Object.defineProperty(req, part, {
        value: result.data,
        writable: true,
        configurable: true,
      });
    }
  }

  if (errors.length > 0) {
    return next(
      new AppError('Validation failed', 422, {
        errors,
        code: 'VALIDATION_ERROR',
      }),
    );
  }

  return next();
};

export default validate;
