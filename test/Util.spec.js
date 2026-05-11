import { code_dir, loadDataProcessorHandler, loadInteractiveHandler } from "../src/Util";
import ReportInteractorCode from "../src/ReportInteractorCode";
import fs from 'fs';
import path from 'path';

jest.mock('fs');

describe('Util Functions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('code_dir', () => {
        test('should return default code directory when storage config is undefined', () => {
            fs.existsSync.mockReturnValue(false);
            fs.mkdirSync.mockImplementation(() => {});

            const result = code_dir(undefined);
            const expected = path.join(__dirname, '..', 'src', 'code');

            expect(result).toBeDefined();
            expect(fs.mkdirSync).toHaveBeenCalled();
        });

        test('should return code directory from storage config', () => {
            fs.existsSync.mockReturnValue(true);

            const storage_config = { data_dir: '/test/data' };
            const result = code_dir(storage_config);

            expect(result).toBe(path.join('/test/data', 'code'));
            expect(fs.mkdirSync).not.toHaveBeenCalled();
        });

        test('should create directory if it does not exist', () => {
            fs.existsSync.mockReturnValue(false);
            fs.mkdirSync.mockImplementation(() => {});

            const storage_config = { data_dir: '/test/data' };
            code_dir(storage_config);

            expect(fs.mkdirSync).toHaveBeenCalledWith(path.join('/test/data', 'code'), { recursive: true });
        });
    });

    describe('loadHandler', () => {
        test('loadDataProcessorHandler should load from cache if available', async () => {
            const mockHandler = jest.fn();
            const all_processor_code = new ReportInteractorCode();
            all_processor_code.add('test_p', mockHandler);

            const result = await loadDataProcessorHandler(all_processor_code, '/code/dir', 'code', 'test');

            expect(result).toBe(mockHandler);
        });

        test('loadInteractiveHandler should load from cache if available', async () => {
            const mockHandler = jest.fn();
            const all_interactor_code = new ReportInteractorCode();
            all_interactor_code.add('test_i', mockHandler);

            const mockMetaProvider = {
                getInteractorCode: jest.fn().mockResolvedValue('code')
            };

            const result = await loadInteractiveHandler(all_interactor_code, '/code/dir', mockMetaProvider, 'test');

            expect(result).toBe(mockHandler);
            expect(mockMetaProvider.getInteractorCode).not.toHaveBeenCalled();
        });
    });
});