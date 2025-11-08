import { analyzeImage } from '../client';

describe('analyzeImage form-data payload', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true }),
    })) as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete (global as any).fetch;
  });

  it('sends multipart body with image field and no explicit headers', async () => {
    await analyzeImage(
      { uri: 'blob://x', name: 'photo.jpg', type: 'image/jpeg' },
      {
        machine_id: 'bambu_p1s',
        experience: 'Beginner',
        app_version: 'test',
      },
    );

    expect((global as any).fetch).toHaveBeenCalled();
    const [, options] = (global as any).fetch.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.headers).toBeUndefined();
    const body = options.body as FormData;
    expect(body instanceof FormData).toBe(true);
    expect(body.has('image')).toBe(true);
    expect(body.has('meta')).toBe(true);
  });
});
