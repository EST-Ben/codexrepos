import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { createServer } from '../src/index';

describe('POST /api/analyze-image', () => {
  let app: Awaited<ReturnType<typeof createServer>>;

  beforeAll(async () => {
    app = await createServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts multipart uploads and returns pipeline response', async () => {
    const meta = {
      machine_id: 'bambu_p1s',
      experience: 'Beginner',
    };

    const res = await request(app.server)
      .post('/api/analyze-image')
      .set('Origin', 'http://localhost:8081')
      .attach('image', Buffer.from([1, 2, 3]), {
        filename: 'foo.jpg',
        contentType: 'image/jpeg',
      })
      .field('meta', JSON.stringify(meta));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('image_id');
    expect(res.body).toHaveProperty('predictions');
    expect(Array.isArray(res.body.predictions)).toBe(true);
    expect(res.body.machine?.id).toBe(meta.machine_id);
  });
});
