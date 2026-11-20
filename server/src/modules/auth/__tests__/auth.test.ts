import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { CORN, useTestApp } from '../../../../test/helpers/testApp.ts';

const t = useTestApp();

describe('access', () => {
    it('lets anyone view but only the volunteer PIN change things', async () => {
        const app = t.app();
        await request(app).get('/api/products').expect(200, []);
        await request(app).post('/api/scan').send({ barcode: CORN, mode: 'in' }).expect(403);
        await request(app).post('/api/login').send({ pin: 'nope' }).expect(401);
        const me = await (await t.editor(app)).get('/api/me').expect(200);
        expect(me.body).toEqual({ role: 'editor', viewNeedsPin: false });
    });

    it('hides the inventory behind the view PIN when one is set', async () => {
        const app = t.app({ viewPin: '1111' });
        await request(app).get('/api/products').expect(401);
        const viewer = request.agent(app);
        await viewer.post('/api/login').send({ pin: '1111' }).expect(200, { role: 'viewer' });
        await viewer.get('/api/products').expect(200);
        await viewer.post('/api/shelves').send({ name: 'A' }).expect(403);
    });

    it('rejects a cookie signed with a different secret', async () => {
        const agent = await t.editor(t.app({ sessionSecret: 'other-secret' }));
        const cookie = (await agent.post('/api/login').send({ pin: '2468' })).headers[
            'set-cookie'
        ]![0]!.split(';')[0]!;
        await request(t.app())
            .post('/api/shelves')
            .set('Cookie', cookie)
            .send({ name: 'A' })
            .expect(403);
    });

    it('locks out after repeated wrong PINs', async () => {
        const app = t.app();
        for (let i = 0; i < 10; i++)
            await request(app).post('/api/login').send({ pin: 'x' }).expect(401);
        await request(app).post('/api/login').send({ pin: '2468' }).expect(429);
    });
});
