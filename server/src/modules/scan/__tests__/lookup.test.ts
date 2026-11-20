import { describe, expect, it } from 'vitest';
import { CORN, CORN_STORED } from '../../../../test/helpers/testApp.ts';
import { createLookup } from '../lookup.ts';

describe('lookup services', () => {
    function fakeFetch(responses: Record<string, unknown>) {
        const calls: string[] = [];
        const fn = (async (url: string | URL | Request) => {
            const href = String(url);
            calls.push(href);
            const host = new URL(href).host;
            return new Response(JSON.stringify(responses[host] ?? {}), {
                status: host in responses ? 200 : 404,
            });
        }) as typeof fetch;
        return { fn, calls };
    }

    it('reads an Open Food Facts product', async () => {
        const { fn, calls } = fakeFetch({
            'world.openfoodfacts.org': {
                status: 1,
                product: {
                    product_name: ' Whole Kernel Corn ',
                    brands: 'Del Monte,Del Monte Foods',
                    quantity: '14.5 oz',
                    categories_tags: [
                        'en:plant-based-foods',
                        'en:canned-sweet-corn',
                        'fr:haricots',
                    ],
                    image_front_small_url: 'https://images.example/corn.jpg',
                },
            },
        });
        expect(await createLookup('ua', fn)(CORN_STORED)).toEqual({
            name: 'Whole Kernel Corn',
            brand: 'Del Monte',
            size: '14.5 oz',
            category: 'Canned sweet corn',
            imageUrl: 'https://images.example/corn.jpg',
            source: 'openfoodfacts',
        });
        expect(calls).toHaveLength(1);
    });

    it('falls back to UPCitemdb with the 12-digit code, and to null when both miss', async () => {
        const { fn, calls } = fakeFetch({
            'world.openfoodfacts.org': { status: 0 },
            'api.upcitemdb.com': {
                code: 'OK',
                items: [
                    {
                        title: 'DOVE BAR SOAP (4-PACK)',
                        brand: 'Dove',
                        category: 'Health & Beauty > Bath & Body > Bar Soap',
                        images: [],
                    },
                ],
            },
        });
        expect(await createLookup('ua', fn)(CORN_STORED)).toMatchObject({
            name: 'Dove Bar Soap (4-Pack)',
            category: 'Bar Soap',
            source: 'upcitemdb',
        });
        expect(calls[1]).toContain(`upc=${CORN}`);

        expect(await createLookup('ua', fakeFetch({}).fn)(CORN_STORED)).toBeNull();
    });
});
