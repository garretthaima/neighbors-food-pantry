import { describe, expect, it } from 'vitest';
import { CORN, CORN_STORED, useTestApp } from '../../../../test/helpers/testApp.ts';

const t = useTestApp();

describe('products', () => {
    it('adds an item by hand, edits it and records each quantity change', async () => {
        const agent = await t.editor();
        const created = (
            await agent
                .post('/api/products')
                .send({ name: 'Home-canned peaches', quantity: 3, barcode: '' })
                .expect(201)
        ).body;
        expect(created).toMatchObject({
            name: 'Home-canned peaches',
            barcode: null,
            quantity: 3,
            source: 'manual',
        });

        const edited = (
            await agent
                .patch(`/api/products/${created.id}`)
                .send({ size: '1 quart', quantity: 5 })
                .expect(200)
        ).body;
        expect(edited).toMatchObject({ size: '1 quart', quantity: 5, name: 'Home-canned peaches' });

        await agent.post(`/api/products/${created.id}/stock`).send({ delta: -2 }).expect(200);
        await agent.post(`/api/products/${created.id}/stock`).send({ delta: -9 }).expect(409);

        const activity = (await agent.get('/api/activity').expect(200)).body;
        expect(activity.last30Days).toEqual({ received: 3, givenOut: 2 });
        expect(
            activity.events.map((e: { delta: number; reason: string }) => [e.delta, e.reason])
        ).toEqual([
            [-2, 'out'],
            [2, 'adjust'],
            [3, 'in'],
        ]);
    });

    it('refuses a duplicate barcode and bad input with a readable message', async () => {
        const agent = await t.editor();
        await agent.post('/api/products').send({ name: 'Beans', barcode: CORN }).expect(201);
        const dup = await agent
            .post('/api/products')
            .send({ name: 'Other beans', barcode: CORN_STORED })
            .expect(409);
        expect(dup.body.error).toBe('Another item already has that barcode.');
        await agent.post('/api/products').send({ name: '  ' }).expect(400);
        await agent.post('/api/products').send({ name: 'x', quantity: -1 }).expect(400);
        await agent.post('/api/products').send({ name: 'x', shelfId: 999 }).expect(400);
        await agent.patch('/api/products/999').send({ name: 'x' }).expect(404);
    });

    it('keeps products when their shelf is deleted', async () => {
        const agent = await t.editor();
        const shelf = (await agent.post('/api/shelves').send({ name: 'Top' }).expect(201)).body;
        await agent.post('/api/shelves').send({ name: 'top' }).expect(409);
        const product = (
            await agent.post('/api/products').send({ name: 'Rice', shelfId: shelf.id }).expect(201)
        ).body;
        await agent.delete(`/api/shelves/${shelf.id}`).expect(204);
        const after = (await agent.get('/api/products').expect(200)).body;
        expect(after).toMatchObject([{ id: product.id, shelfId: null, shelfName: null }]);
        await agent.delete(`/api/products/${product.id}`).expect(204);
        await agent.get('/api/products').expect(200, []);
    });
});
