export const regressionSample = {
  old: {
    openapi: '3.0.3',
    info: { title: '旧服务', version: '1.0.0' },
    paths: {
      '/orders': {
        post: {
          operationId: 'createOrder',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OrderRequest' },
              },
            },
          },
          responses: {
            '201': {
              description: 'created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/OrderResponse' },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        OrderRequest: {
          type: 'object',
          required: ['status'],
          properties: {
            status: {
              type: 'string',
              description: '请求状态说明变化不应报破坏',
              enum: ['draft', 'submitted'],
              nullable: true,
            },
          },
        },
        OrderResponse: {
          type: 'object',
          required: ['id', 'status'],
          properties: {
            id: { type: 'integer' },
            status: { type: 'string', enum: ['draft', 'submitted'] },
          },
        },
      },
    },
  },
  new: {
    openapi: '3.0.3',
    info: { title: '新服务', version: '2.0.0' },
    paths: {
      '/orders': {
        post: {
          operationId: 'createOrderV2',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OrderRequestV2' },
              },
            },
          },
          responses: {
            '201': {
              description: '订单已创建（仅文案变化）',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/OrderResponseV2' },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        OrderRequestV2: {
          type: 'object',
          required: ['status', 'tenantId'],
          properties: {
            status: {
              type: 'string',
              description: '新的状态说明',
              enum: ['submitted'],
              nullable: false,
            },
            tenantId: { type: 'string' },
          },
        },
        OrderResponseV2: {
          type: 'object',
          required: ['status'],
          properties: {
            id: { type: 'integer' },
            status: { type: 'string', enum: ['draft', 'submitted', 'cancelled'] },
          },
        },
      },
    },
  },
};
