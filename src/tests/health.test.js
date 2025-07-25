const request = require('supertest');
const app = require('../../index');

describe('Health Check', () => {
  test('GET /health should return 200', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);
    
    expect(response.body).toHaveProperty('status', 'OK');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('version');
  });

  test('GET /metrics should return metrics', async () => {
    const response = await request(app)
      .get('/metrics')
      .expect(200);
    
    expect(response.body).toHaveProperty('sucesso', true);
    expect(response.body).toHaveProperty('metrics');
    expect(response.body.metrics).toHaveProperty('requests');
    expect(response.body.metrics).toHaveProperty('errors');
  });

  test('GET /api should return 404 for non-existent route', async () => {
    const response = await request(app)
      .get('/api/non-existent')
      .expect(404);
    
    expect(response.body).toHaveProperty('sucesso', false);
    expect(response.body).toHaveProperty('erro');
  });
});

describe('API Routes', () => {
  test('GET /api/users should return users list', async () => {
    const response = await request(app)
      .get('/api/users')
      .expect(200);
    
    expect(response.body).toHaveProperty('sucesso', true);
    expect(response.body).toHaveProperty('usuarios');
    expect(Array.isArray(response.body.usuarios)).toBe(true);
  });

  test('POST /api/users should validate email', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ email: 'invalid-email' })
      .expect(400);
    
    expect(response.body).toHaveProperty('sucesso', false);
    expect(response.body).toHaveProperty('erro');
  });

  test('POST /api/users should accept valid email', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ email: 'test@reconectaoficial.com.br', nome: 'Test User' })
      .expect(200);
    
    expect(response.body).toHaveProperty('sucesso', true);
    expect(response.body).toHaveProperty('usuario');
  });
});

describe('Webhook Endpoints', () => {
  test('POST /api/webhook/drive should handle webhook', async () => {
    const response = await request(app)
      .post('/api/webhook/drive')
      .set('x-goog-resource-id', 'test-resource-id')
      .set('x-goog-channel-id', 'test-channel-id')
      .set('x-goog-resource-state', 'sync')
      .expect(200);
    
    expect(response.body).toHaveProperty('sucesso', true);
  });

  test('POST /api/webhook/calendar should handle webhook', async () => {
    const response = await request(app)
      .post('/api/webhook/calendar')
      .set('x-goog-resource-id', 'test-resource-id')
      .set('x-goog-channel-id', 'test-channel-id')
      .set('x-goog-resource-state', 'sync')
      .expect(200);
    
    expect(response.body).toHaveProperty('sucesso', true);
  });
});

describe('Rate Limiting', () => {
  test('should limit requests when exceeded', async () => {
    // Fazer muitas requisições rapidamente
    const promises = Array(150).fill().map(() => 
      request(app).get('/api/users')
    );
    
    const responses = await Promise.all(promises);
    const rateLimited = responses.filter(r => r.status === 429);
    
    expect(rateLimited.length).toBeGreaterThan(0);
  });
}); 