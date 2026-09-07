import swaggerJsdoc from 'swagger-jsdoc';

/**
 * OpenAPI spec generated from JSDoc @openapi comments in route files.
 * Every module documents its endpoints in its *.routes.js file —
 * see src/routes/health.routes.js for the template to follow.
 */
const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'ACC Labour Law Compliance API',
      version: '1.0.0',
      description:
        'Gujarat Professional Tax Form 5 API. All responses share the shape ' +
        '`{ success, message, data }` on success and `{ success, message, errors?, code? }` on error.',
    },
    servers: [
      {
        url: '/api/v1',
        description: 'API v1',
      },
    ],
    components: {
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Success' },
            data: { type: 'object', nullable: true },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Something went wrong' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string', example: 'email' },
                  location: { type: 'string', example: 'body' },
                  message: { type: 'string', example: 'Invalid email address' },
                },
              },
            },
            code: { type: 'string', example: 'VALIDATION_ERROR' },
          },
        },
      },
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  // Paths are relative to the backend working directory
  apis: ['./src/routes/**/*.js', './src/modules/**/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

export const swaggerUiOptions = {
  customSiteTitle: 'ACC Labour Law Compliance API Docs',
  swaggerOptions: {
    persistAuthorization: true,
  },
};

export default swaggerSpec;
