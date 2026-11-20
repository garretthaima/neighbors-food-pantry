import { describe, expect, it } from 'vitest';
import { CORN, CORN_STORED, useTestApp } from '../../../../test/helpers/testApp.ts';

const t = useTestApp();

describe('scanning', () => {
    it('looks a new barcode up once, then counts later scans from the database', async () => {
        const agent = await t.editor();

        const first = await agent.post('/api/scan').send({ barcode: CORN, mode: 'in' }).expect(200);
        expect(first.body).toMatchObject({
            status: 'ok',
            created: true,
            product: {
                barcode: CORN_STORED,
                name: 'Whole Kernel Corn',
                brand: 'Del Monte',
                quantity: 1,
                shelfId: null,
            },
        });

        // Same can scanned as EAN-13 by a different scanner.
        const second = await agent
            .post('/api/scan')
            .send({ barcode: CORN_STORED, mode: 'in' })
            .expect(200);
        expect(second.body).toMatchObject({ created: false, product: { quantity: 2 } });
        expect(t.lookups).toEqual([CORN_STORED]);
    });

    it('puts scanned items on the chosen shelf', async () => {
        const agent = await t.editor();
        const shelf = (await agent.post('/api/shelves').send({ name: 'A1' }).expect(201)).body;
        const res = await agent
            .post('/api/scan')
            .send({ barcode: CORN, mode: 'in', shelfId: shelf.id })
            .expect(200);
        expect(res.body.product).toMatchObject({ shelfId: shelf.id, shelfName: 'A1' });

        const shelves = (await agent.get('/api/shelves').expect(200)).body;
        expect(shelves).toMatchObject([{ name: 'A1', productCount: 1, itemCount: 1 }]);
    });

    it('gives items out and refuses to go below zero', async () => {
        const agent = await t.editor();
        await agent.post('/api/scan').send({ barcode: CORN, mode: 'in' }).expect(200);
        const out = await agent.post('/api/scan').send({ barcode: CORN, mode: 'out' }).expect(200);
        expect(out.body.product.quantity).toBe(0);
        const again = await agent
            .post('/api/scan')
            .send({ barcode: CORN, mode: 'out' })
            .expect(409);
        expect(again.body.error).toMatch(/none of these left/);
    });

    it('reports an unknown barcode without creating anything', async () => {
        const agent = await t.editor();
        const res = await agent
            .post('/api/scan')
            .send({ barcode: '036000291452', mode: 'in' })
            .expect(200);
        expect(res.body).toEqual({ status: 'unknown', barcode: '0036000291452' });
        await agent.get('/api/products').expect(200, []);

        // Giving out something never recorded does not call the lookup services.
        t.lookups = [];
        await agent
            .post('/api/scan')
            .send({ barcode: CORN, mode: 'out' })
            .expect(200, { status: 'unknown', barcode: CORN_STORED });
        expect(t.lookups).toEqual([]);
    });

    it('rejects input that is not a barcode', async () => {
        const agent = await t.editor();
        await agent.post('/api/scan').send({ barcode: 'hello', mode: 'in' }).expect(400);
    });
});
