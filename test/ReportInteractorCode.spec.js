import ReportInteractorCode from "../src/ReportInteractorCode";

describe('ReportInteractorCode', () => {
    let codeStore;

    beforeEach(() => {
        codeStore = new ReportInteractorCode();
    });

    afterEach(() => {
        codeStore.stop();
    });

    test('should initialize with empty map', () => {
        expect(codeStore.map.size).toBe(0);
    });

    test('should add new entry', () => {
        const mockHandler = jest.fn();
        codeStore.add('test_enclave', mockHandler);

        expect(codeStore.map.has('test_enclave')).toBe(true);
        expect(codeStore.map.get('test_enclave').object).toBe(mockHandler);
        expect(codeStore.map.get('test_enclave').counter).toBe(5);
    });

    test('should not add duplicate entries', () => {
        const mockHandler1 = jest.fn();
        const mockHandler2 = jest.fn();
        
        codeStore.add('test_enclave', mockHandler1);
        codeStore.add('test_enclave', mockHandler2);

        expect(codeStore.map.get('test_enclave').object).toBe(mockHandler1);
    });

    test('should return null for non-existent entry', () => {
        const result = codeStore.access('non_existent');
        expect(result).toBe(null);
    });

    test('should return object and increment counter on access', () => {
        const mockHandler = jest.fn();
        codeStore.add('test_enclave', mockHandler);

        const result = codeStore.access('test_enclave');

        expect(result).toBe(mockHandler);
        expect(codeStore.map.get('test_enclave').counter).toBe(10);
    });

    test('should decrement counter and remove entry when counter reaches zero', () => {
        const mockHandler = jest.fn();
        codeStore.add('test_enclave', mockHandler);
        
        for (let i = 0; i < 5; i++) {
            codeStore.decrementCounters();
        }

        expect(codeStore.map.has('test_enclave')).toBe(false);
    });

    test('should stop timer when stop is called', () => {
        const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
        codeStore.stop();
        
        expect(clearIntervalSpy).toHaveBeenCalled();
        clearIntervalSpy.mockRestore();
    });
});