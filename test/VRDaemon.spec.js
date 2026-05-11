import { init_vrdaemon, get_express_instance, process_verfication_report, close_vrdaemon } from "../src/VRDaemon";
import TestMetaProvider from "./TestMetaProvider";
import { Sealer } from "@yeez-tech/meta-encryptor";
import { Readable } from 'stream';
import { key_pair } from "./helper";
import fs from 'fs';
import path from 'path';

const request = require('supertest');

const storage_config = {
    db: { name: 'sqlite3', filename: 'test_sqlite.db' },
    cdn: {},
    data_dir: path.resolve(__dirname, 'test_data')
};

const meta_provider = new TestMetaProvider(
    path.resolve(__dirname, "simple/VRDataProcessor.js"),
    path.resolve(__dirname, "simple/VRInteractor.js")
);

beforeAll(() => {
    if (!fs.existsSync(storage_config.data_dir)) {
        fs.mkdirSync(storage_config.data_dir, { recursive: true });
    }
});

afterAll(() => {
    close_vrdaemon();
    if (fs.existsSync(storage_config.data_dir)) {
        fs.rmSync(storage_config.data_dir, { recursive: true, force: true });
    }
});

describe('VRDaemon API Tests', () => {
    let app;

    beforeAll(async () => {
        init_vrdaemon(meta_provider, 4699, storage_config, __dirname);
        app = get_express_instance();
    });

    test('GET /api/report without request_hash should return 400', async () => {
        const response = await request(app).get('/api/report');
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('INVALID_REQUEST');
    });

    test('GET /api/report with non-existent request_hash should return 404', async () => {
        const response = await request(app).get('/api/report').query({ request_hash: 'non_existent_hash' });
        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('META_NOT_FOUND');
    });

    test('Process and query verification report', async () => {
        const inputString = "Test verification report content";
        const rs = Readable.from(inputString);
        const encryptedPath = path.join(__dirname, 'test_encrypted.data');
        const ws = fs.createWriteStream(encryptedPath);

        rs.pipe(new Sealer({ keyPair: key_pair })).pipe(ws);

        await new Promise(resolve => {
            ws.on('finish', resolve);
            ws.on('error', resolve);
        });

        await new Promise((resolve) => {
            process_verfication_report('test_req_001', encryptedPath, resolve);
        });

        const response = await request(app).get('/api/report').query({ request_hash: 'test_req_001' });
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.result.data.data).toBe(inputString);

        if (fs.existsSync(encryptedPath)) fs.unlinkSync(encryptedPath);
        const metaPath = path.join(__dirname, 'test_req_001.meta');
        if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
    });

    test('GET /api/report with params', async () => {
        const inputString = "Report with params";
        const rs = Readable.from(inputString);
        const encryptedPath = path.join(__dirname, 'test_encrypted_params.data');
        const ws = fs.createWriteStream(encryptedPath);

        rs.pipe(new Sealer({ keyPair: key_pair })).pipe(ws);

        await new Promise(resolve => {
            ws.on('finish', resolve);
            ws.on('error', resolve);
        });

        await new Promise((resolve) => {
            process_verfication_report('test_req_002', encryptedPath, resolve);
        });

        const params = JSON.stringify({ action: 'test', format: 'json' });
        const response = await request(app).get('/api/report')
            .query({ request_hash: 'test_req_002', params });
        
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        if (fs.existsSync(encryptedPath)) fs.unlinkSync(encryptedPath);
        const metaPath = path.join(__dirname, 'test_req_002.meta');
        if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
    });

    test('ETag caching works correctly', async () => {
        const inputString = "ETag test content";
        const rs = Readable.from(inputString);
        const encryptedPath = path.join(__dirname, 'test_encrypted_etag.data');
        const ws = fs.createWriteStream(encryptedPath);

        rs.pipe(new Sealer({ keyPair: key_pair })).pipe(ws);

        await new Promise(resolve => {
            ws.on('finish', resolve);
            ws.on('error', resolve);
        });

        await new Promise((resolve) => {
            process_verfication_report('test_req_003', encryptedPath, resolve);
        });

        const firstResponse = await request(app).get('/api/report')
            .query({ request_hash: 'test_req_003' });
        expect(firstResponse.status).toBe(200);
        const etag = firstResponse.headers.etag;
        expect(etag).toBeDefined();

        const secondResponse = await request(app).get('/api/report')
            .query({ request_hash: 'test_req_003' })
            .set('If-None-Match', etag);
        expect(secondResponse.status).toBe(304);

        if (fs.existsSync(encryptedPath)) fs.unlinkSync(encryptedPath);
        const metaPath = path.join(__dirname, 'test_req_003.meta');
        if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
    });
});

describe('VRDaemon Error Handling', () => {
    let app;

    beforeAll(async () => {
        init_vrdaemon(meta_provider, 4700, storage_config, __dirname);
        app = get_express_instance();
    });

    afterAll(() => {
        close_vrdaemon();
    });

    test('Process report with invalid encrypted file', async () => {
        const invalidPath = path.join(__dirname, 'invalid_encrypted.data');
        fs.writeFileSync(invalidPath, 'not encrypted data');

        await new Promise((resolve, reject) => {
            process_verfication_report('test_req_invalid', invalidPath, (err, result) => {
                if (err) {
                    expect(err).not.toBeNull();
                    resolve();
                } else {
                    reject(new Error('Expected error but got success'));
                }
            });
        });

        if (fs.existsSync(invalidPath)) fs.unlinkSync(invalidPath);
    });

    test('Process report with non-existent file should fail', async () => {
        await new Promise((resolve) => {
            process_verfication_report('test_req_no_file', 'non_existent_file.data', (err, result) => {
                expect(err).not.toBeNull();
                resolve();
            });
        });
    });
});

describe('VRDaemon Concurrency', () => {
    let app;

    beforeAll(async () => {
        init_vrdaemon(meta_provider, 4702, storage_config, __dirname);
        app = get_express_instance();
    });

    afterAll(() => {
        close_vrdaemon();
    });

    test('Process multiple reports concurrently', async () => {
        const reportCount = 3;
        const cleanupPaths = [];

        const setupPromises = [];
        for (let i = 0; i < reportCount; i++) {
            setupPromises.push(new Promise((resolve) => {
                const inputString = `Concurrent report ${i}`;
                const rs = Readable.from(inputString);
                const encryptedPath = path.join(__dirname, `test_encrypted_concurrent_${i}.data`);
                cleanupPaths.push(encryptedPath);
                
                const ws = fs.createWriteStream(encryptedPath);
                rs.pipe(new Sealer({ keyPair: key_pair })).pipe(ws);

                ws.on('finish', () => resolve({ encryptedPath, inputString, index: i }));
                ws.on('error', () => resolve({ encryptedPath, inputString, index: i }));
            }));
        }

        const setups = await Promise.all(setupPromises);

        const processPromises = setups.map(({ encryptedPath, inputString, index }) => {
            return new Promise((resolve) => {
                process_verfication_report(`test_req_concurrent_${index}`, encryptedPath, async () => {
                    const response = await request(app).get('/api/report')
                        .query({ request_hash: `test_req_concurrent_${index}` });
                    expect(response.status).toBe(200);
                    expect(response.body.success).toBe(true);
                    expect(response.body.result.data.data).toBe(inputString);

                    const metaPath = path.join(__dirname, `test_req_concurrent_${index}.meta`);
                    cleanupPaths.push(metaPath);
                    resolve();
                });
            });
        });

        await Promise.all(processPromises);

        cleanupPaths.forEach(p => {
            if (fs.existsSync(p)) fs.unlinkSync(p);
        });
    });
});